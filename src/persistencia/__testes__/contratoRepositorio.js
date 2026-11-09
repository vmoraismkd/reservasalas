// Só para testes: contrato que qualquer repositório tem de cumprir
// (a interface está em src/aplicacional/repositorio.js).
//
// Uso:  testarContratoRepositorio("Nome", fabrica, { ignorar, motivo })
//   fabrica(salas) recebe [{ nome, capacidade }] e devolve { repositorio, limpar }:
//   o repositório já tem de ter estas salas; limpar() apaga tudo o que o teste criou.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Reserva } from "../../dominio/Reserva.js";
import { Sala } from "../../dominio/Sala.js";

// Prefixo das salas de teste: permite apagá-las sempre, mesmo as deixadas por uma execução interrompida.
export const PREFIXO_SALAS_TESTE = "__contrato__";

const SALAS = [
  { nome: `${PREFIXO_SALAS_TESTE} Norte`, capacidade: 8 },
  { nome: `${PREFIXO_SALAS_TESTE} Sul`, capacidade: 4 },
  { nome: `${PREFIXO_SALAS_TESTE} Vazia`, capacidade: 2 },
];

// Instantes escolhidos para apanhar desvios de fuso horário.
const INSTANTES = [
  ["inverno (Lisboa = UTC)", "2027-01-15T09:00:00.000Z", "2027-01-15T10:30:00.000Z"],
  ["verão (Lisboa = UTC+1)", "2027-07-15T08:00:00.000Z", "2027-07-15T09:45:00.000Z"],
  ["à volta da meia-noite UTC", "2027-03-10T23:30:00.000Z", "2027-03-11T00:30:00.000Z"],
  ["na mudança para a hora de inverno em Lisboa", "2026-10-25T00:30:00.000Z", "2026-10-25T02:00:00.000Z"],
  ["com segundos e milissegundos", "2027-05-05T14:07:09.123Z", "2027-05-05T15:07:09.987Z"],
];

export function testarContratoRepositorio(nome, fabrica, { ignorar = false, motivo = "" } = {}) {
  describe.skipIf(ignorar)(`Contrato do repositório: ${nome}${ignorar ? ` (ignorado: ${motivo})` : ""}`, () => {
    let repositorio;
    let limpar;
    let salas;

    beforeEach(async () => {
      ({ repositorio, limpar } = await fabrica(SALAS));
      const todas = await repositorio.listarSalas();
      salas = Object.fromEntries(
        SALAS.map(({ nome: n }) => [n.replace(`${PREFIXO_SALAS_TESTE} `, ""), todas.find((s) => s.nome === n)]),
      );
    });

    afterEach(async () => {
      vi.unstubAllEnvs();
      await limpar?.();
    });

    // Guarda uma reserva nova (sem id): o repositório atribui o id e devolve-a.
    async function guardar(sala, inicio, fim) {
      return repositorio.guardarReserva(new Reserva({ salaId: sala.id, inicio: new Date(inicio), fim: new Date(fim) }));
    }

    async function lerPorId(id) {
      return (await repositorio.listarReservas()).find((r) => r.id === id);
    }

    describe("salas", () => {
      it("lista as salas como entidades do domínio, com nome e capacidade", async () => {
        for (const { nome: n, capacidade } of SALAS) {
          const sala = (await repositorio.listarSalas()).find((s) => s.nome === n);
          expect(sala).toBeInstanceOf(Sala);
          expect(sala.capacidade).toBe(capacidade);
        }
      });
    });

    describe("reservas", () => {
      it("ao guardar atribui um id em texto, diferente para cada reserva", async () => {
        const a = await guardar(salas.Norte, "2027-02-01T08:00:00.000Z", "2027-02-01T09:00:00.000Z");
        const b = await guardar(salas.Norte, "2027-02-01T09:00:00.000Z", "2027-02-01T10:00:00.000Z");
        expect(a).toBeInstanceOf(Reserva);
        expect(typeof a.id).toBe("string");
        expect(a.id.trim()).not.toBe("");
        expect(a.id).not.toBe(b.id);
      });

      it("guarda uma reserva e volta a lê-la igual", async () => {
        const guardada = await guardar(salas.Norte, "2027-02-01T10:00:00.000Z", "2027-02-01T11:00:00.000Z");
        const lida = await lerPorId(guardada.id);
        expect(lida).toBeInstanceOf(Reserva);
        expect(lida.salaId).toBe(salas.Norte.id);
        expect(lida.inicio.toISOString()).toBe("2027-02-01T10:00:00.000Z");
        expect(lida.fim.toISOString()).toBe("2027-02-01T11:00:00.000Z");
      });

      it("lista só as reservas da sala pedida", async () => {
        const n1 = await guardar(salas.Norte, "2027-02-02T09:00:00.000Z", "2027-02-02T10:00:00.000Z");
        const n2 = await guardar(salas.Norte, "2027-02-02T11:00:00.000Z", "2027-02-02T12:00:00.000Z");
        const s1 = await guardar(salas.Sul, "2027-02-02T09:00:00.000Z", "2027-02-02T10:00:00.000Z");

        const idsNorte = (await repositorio.listarReservasDaSala(salas.Norte.id)).map((r) => r.id);
        const idsSul = (await repositorio.listarReservasDaSala(salas.Sul.id)).map((r) => r.id);
        expect(idsNorte.sort()).toEqual([n1.id, n2.id].sort());
        expect(idsSul).toEqual([s1.id]);
      });

      it("uma sala sem reservas devolve uma lista vazia", async () => {
        await guardar(salas.Norte, "2027-02-03T09:00:00.000Z", "2027-02-03T10:00:00.000Z");
        expect(await repositorio.listarReservasDaSala(salas.Vazia.id)).toEqual([]);
      });

      it("listar todas as reservas inclui as de várias salas", async () => {
        const n = await guardar(salas.Norte, "2027-02-04T09:00:00.000Z", "2027-02-04T10:00:00.000Z");
        const s = await guardar(salas.Sul, "2027-02-04T09:00:00.000Z", "2027-02-04T10:00:00.000Z");
        const ids = (await repositorio.listarReservas()).map((r) => r.id);
        expect(ids).toEqual(expect.arrayContaining([n.id, s.id]));
      });
    });

    describe("horas exatamente iguais, sem desvios de fuso horário", () => {
      it.each(INSTANTES)("%s", async (_, inicio, fim) => {
        const guardada = await guardar(salas.Norte, inicio, fim);
        const lida = await lerPorId(guardada.id);
        expect(lida.inicio.toISOString()).toBe(inicio);
        expect(lida.fim.toISOString()).toBe(fim);
      });

      it.each(["Pacific/Kiritimati", "America/Los_Angeles", "Europe/Lisbon"])(
        "com o processo no fuso %s, a hora lida continua igual à guardada",
        async (fuso) => {
          vi.stubEnv("TZ", fuso); // o Node.js passa a usar este fuso de imediato
          for (const [, inicio, fim] of INSTANTES) {
            const guardada = await guardar(salas.Sul, inicio, fim);
            const lida = await lerPorId(guardada.id);
            expect(lida.inicio.toISOString()).toBe(inicio);
            expect(lida.fim.toISOString()).toBe(fim);
          }
        },
      );
    });
  });
}
