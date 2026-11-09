import { describe, expect, it, vi } from "vitest";
import { RepositorioPostgres } from "./RepositorioPostgres.js";
import { METODOS_DO_REPOSITORIO } from "../aplicacional/repositorio.js";
import { Reserva } from "../dominio/Reserva.js";
import { Sala } from "../dominio/Sala.js";

const SALA_ID = "6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const RESERVA_ID = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

// Ligação falsa: devolve as linhas indicadas e regista o SQL e os parâmetros de cada consulta.
function ligacaoFalsa(linhas = []) {
  return { consultar: vi.fn(async () => ({ rows: linhas, rowCount: linhas.length })) };
}

// Texto que um utilizador mal-intencionado poderia tentar meter no SQL.
const INJECAO = "x'; DROP TABLE public.reservas; --";

describe("RepositorioPostgres", () => {
  it.each(METODOS_DO_REPOSITORIO)("cumpre a interface: tem o método %s", (metodo) => {
    expect(typeof new RepositorioPostgres(ligacaoFalsa())[metodo]).toBe("function");
  });

  it("lista as salas como entidades do domínio", async () => {
    const ligacao = ligacaoFalsa([{ id: SALA_ID, nome: "Sala A", capacidade: 10 }]);
    const salas = await new RepositorioPostgres(ligacao).listarSalas();
    expect(salas).toEqual([new Sala({ id: SALA_ID, nome: "Sala A", capacidade: 10 })]);
    expect(salas[0]).toBeInstanceOf(Sala);
  });

  it("lista as reservas como entidades do domínio, com as datas como vêm da base de dados", async () => {
    const inicio = new Date("2027-07-15T08:00:00.000Z");
    const fim = new Date("2027-07-15T09:00:00.000Z");
    const ligacao = ligacaoFalsa([{ id: RESERVA_ID, sala_id: SALA_ID, inicio, fim }]);
    const [reserva] = await new RepositorioPostgres(ligacao).listarReservas();
    expect(reserva).toBeInstanceOf(Reserva);
    expect(reserva).toMatchObject({ id: RESERVA_ID, salaId: SALA_ID });
    expect(reserva.inicio.toISOString()).toBe(inicio.toISOString());
  });

  it("filtra as reservas de uma sala com um parâmetro, não com o id colado no SQL", async () => {
    const ligacao = ligacaoFalsa();
    await new RepositorioPostgres(ligacao).listarReservasDaSala(SALA_ID);
    const [sql, parametros] = ligacao.consultar.mock.calls[0];
    expect(sql).toMatch(/sala_id = \$1/);
    expect(sql).not.toContain(SALA_ID);
    expect(parametros).toEqual([SALA_ID]);
  });

  it.each(["nao-existe", "1", INJECAO, ""])(
    "um id de sala que não é UUID (%s) devolve lista vazia sem ir à base de dados",
    async (salaId) => {
      const ligacao = ligacaoFalsa();
      expect(await new RepositorioPostgres(ligacao).listarReservasDaSala(salaId)).toEqual([]);
      expect(ligacao.consultar).not.toHaveBeenCalled();
    },
  );

  it("guarda com parâmetros e devolve a reserva com o id gerado pela base de dados", async () => {
    const inicio = new Date("2027-01-15T09:00:00.000Z");
    const fim = new Date("2027-01-15T10:00:00.000Z");
    const ligacao = ligacaoFalsa([{ id: RESERVA_ID, sala_id: SALA_ID, inicio, fim }]);

    const guardada = await new RepositorioPostgres(ligacao).guardarReserva(new Reserva({ salaId: SALA_ID, inicio, fim }));

    const [sql, parametros] = ligacao.consultar.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO public\.reservas \(sala_id, inicio, fim\)\s+VALUES \(\$1, \$2, \$3\)/);
    expect(sql).toMatch(/RETURNING id, sala_id, inicio, fim/);
    expect(parametros).toEqual([SALA_ID, inicio, fim]);
    expect(parametros[1]).toBeInstanceOf(Date); // o pg envia a data com o fuso horário
    expect(guardada).toBeInstanceOf(Reserva);
    expect(guardada.id).toBe(RESERVA_ID);
  });

  it("recusa guardar uma reserva que já tem id (só guarda reservas novas)", async () => {
    const ligacao = ligacaoFalsa();
    const comId = new Reserva({ id: RESERVA_ID, salaId: SALA_ID, inicio: new Date(0), fim: new Date(1000) });
    await expect(new RepositorioPostgres(ligacao).guardarReserva(comId)).rejects.toThrow(/já tem id/);
    expect(ligacao.consultar).not.toHaveBeenCalled();
  });

  it("nenhuma consulta tem valores colados no SQL: tudo vai em parâmetros", async () => {
    const ligacao = ligacaoFalsa();
    const repo = new RepositorioPostgres(ligacao);
    await repo.listarSalas();
    await repo.listarReservas();
    await repo.listarReservasDaSala(SALA_ID);
    await repo.listarReservasDaSala(INJECAO);
    for (const [sql, parametros = []] of ligacao.consultar.mock.calls) {
      expect(sql).not.toMatch(/'/); // sem textos literais no SQL
      for (const valor of parametros) expect(sql).not.toContain(String(valor));
    }
  });
});
