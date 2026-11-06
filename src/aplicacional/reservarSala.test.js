import { describe, expect, it, vi } from "vitest";
import { reservarSala } from "./reservarSala.js";
import { criarRepositorioFalso } from "./repositorioFalso.js";
import { Sala } from "../dominio/Sala.js";
import { Reserva } from "../dominio/Reserva.js";

const h = (hora) => new Date(`2026-11-10T${hora}:00Z`);

const salas = [
  new Sala({ id: 1, nome: "Sala Atlântico", capacidade: 12 }),
  new Sala({ id: 2, nome: "Sala Douro", capacidade: 6 }),
];
// A sala 1 já está ocupada das 10:00 às 12:00.
const ocupada = new Reserva({ id: 7, salaId: 1, inicio: h("10:00"), fim: h("12:00") });

function repositorio() {
  return criarRepositorioFalso({ salas, reservas: [ocupada], proximoId: 8 });
}

describe("reservarSala", () => {
  it("cria e guarda a reserva quando a sala está livre", async () => {
    const repo = repositorio();
    const resultado = await reservarSala(repo, { salaId: 1, inicio: h("14:00"), fim: h("15:00") });

    expect(resultado.sucesso).toBe(true);
    expect(resultado.reserva).toBeInstanceOf(Reserva);
    expect(resultado.reserva.id).toBe(8);
    expect(resultado.reserva.salaId).toBe(1);
    expect(resultado.reserva.inicio.toISOString()).toBe("2026-11-10T14:00:00.000Z");
    expect(resultado.reserva.fim.toISOString()).toBe("2026-11-10T15:00:00.000Z");
    expect(repo.guardarReserva).toHaveBeenCalledTimes(1);
    expect(repo.guardarReserva).toHaveBeenCalledWith(resultado.reserva);
  });

  it("aceita uma reserva seguida a outra na mesma sala", async () => {
    const repo = repositorio();
    const resultado = await reservarSala(repo, { salaId: 1, inicio: h("12:00"), fim: h("13:00") });
    expect(resultado.sucesso).toBe(true);
  });

  it("aceita outra sala no mesmo horário de uma reserva existente", async () => {
    const repo = repositorio();
    const resultado = await reservarSala(repo, { salaId: 2, inicio: h("10:00"), fim: h("12:00") });
    expect(resultado.sucesso).toBe(true);
  });

  it("recusa quando a sala já está ocupada nesse horário", async () => {
    const repo = repositorio();
    const resultado = await reservarSala(repo, { salaId: 1, inicio: h("11:00"), fim: h("13:00") });

    expect(resultado).toEqual({ sucesso: false, erro: expect.stringMatching(/ocupada/i) });
    expect(repo.guardarReserva).not.toHaveBeenCalled();
  });

  it("recusa quando a sala não existe", async () => {
    const repo = repositorio();
    const resultado = await reservarSala(repo, { salaId: 99, inicio: h("14:00"), fim: h("15:00") });

    expect(resultado).toEqual({ sucesso: false, erro: expect.stringMatching(/sala não existe/i) });
    expect(repo.guardarReserva).not.toHaveBeenCalled();
  });

  it("devolve o erro do domínio quando o fim é antes do início", async () => {
    const repo = repositorio();
    const resultado = await reservarSala(repo, { salaId: 1, inicio: h("15:00"), fim: h("14:00") });

    expect(resultado).toEqual({ sucesso: false, erro: "O fim da reserva tem de ser depois do início" });
    expect(repo.guardarReserva).not.toHaveBeenCalled();
  });

  it("devolve o erro do domínio quando as datas não são válidas", async () => {
    const repo = repositorio();
    const resultado = await reservarSala(repo, { salaId: 1, inicio: "amanhã", fim: h("14:00") });

    expect(resultado).toEqual({ sucesso: false, erro: "O início da reserva tem de ser uma data válida" });
    expect(repo.guardarReserva).not.toHaveBeenCalled();
  });

  it("não lança exceção se os dados vierem em falta", async () => {
    const repo = repositorio();
    await expect(reservarSala(repo, undefined)).resolves.toEqual({
      sucesso: false,
      erro: expect.any(String),
    });
  });

  it.each(["listarSalas", "listarReservasDaSala", "proximoIdReserva", "guardarReserva"])(
    "não lança exceção e não mostra detalhes técnicos se %s falhar",
    async (metodo) => {
      const repo = repositorio();
      repo[metodo] = vi.fn(async () => {
        throw new Error("ligação recusada: postgres://utilizador:segredo@host");
      });
      const espiaConsola = vi.spyOn(console, "error").mockImplementation(() => {});

      const resultado = await reservarSala(repo, { salaId: 1, inicio: h("14:00"), fim: h("15:00") });

      expect(resultado).toEqual({ sucesso: false, erro: expect.any(String) });
      expect(resultado.erro).not.toMatch(/postgres|segredo|ligação recusada/);
      espiaConsola.mockRestore();
    },
  );
});
