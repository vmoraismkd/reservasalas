import { describe, expect, it } from "vitest";
import { RepositorioMemoria } from "./RepositorioMemoria.js";
import { METODOS_DO_REPOSITORIO } from "../aplicacional/repositorio.js";
import { reservarSala } from "../aplicacional/reservarSala.js";
import { Sala } from "../dominio/Sala.js";
import { Reserva } from "../dominio/Reserva.js";

const h = (hora) => new Date(`2026-11-10T${hora}:00Z`);
const atlantico = new Sala({ id: 1, nome: "Sala Atlântico", capacidade: 12 });
const douro = new Sala({ id: 2, nome: "Sala Douro", capacidade: 6 });
const r = (id, salaId, inicio, fim) => new Reserva({ id, salaId, inicio: h(inicio), fim: h(fim) });

describe("RepositorioMemoria", () => {
  it.each(METODOS_DO_REPOSITORIO)("cumpre a interface: tem o método %s", (metodo) => {
    expect(typeof new RepositorioMemoria()[metodo]).toBe("function");
  });

  it("começa vazio por omissão", async () => {
    const repo = new RepositorioMemoria();
    expect(await repo.listarSalas()).toEqual([]);
    expect(await repo.listarReservas()).toEqual([]);
  });

  it("lista as salas recebidas", async () => {
    const repo = new RepositorioMemoria({ salas: [atlantico, douro] });
    expect(await repo.listarSalas()).toEqual([atlantico, douro]);
  });

  it("lista todas as reservas e filtra as de uma sala", async () => {
    const a = r(1, 1, "09:00", "10:00");
    const b = r(2, 2, "09:00", "10:00");
    const c = r(3, 1, "11:00", "12:00");
    const repo = new RepositorioMemoria({ reservas: [a, b, c] });

    expect(await repo.listarReservas()).toEqual([a, b, c]);
    expect(await repo.listarReservasDaSala(1)).toEqual([a, c]);
    expect(await repo.listarReservasDaSala(2)).toEqual([b]);
    expect(await repo.listarReservasDaSala(99)).toEqual([]);
  });

  it("dá ids novos, sempre diferentes e acima dos já existentes", async () => {
    const repo = new RepositorioMemoria({ reservas: [r(5, 1, "09:00", "10:00")] });
    const primeiro = await repo.proximoIdReserva();
    const segundo = await repo.proximoIdReserva();
    expect(primeiro).toBe(6);
    expect(segundo).toBe(7);
  });

  it("começa os ids em 1 quando não há reservas", async () => {
    expect(await new RepositorioMemoria().proximoIdReserva()).toBe(1);
  });

  it("guarda uma reserva e passa a listá-la", async () => {
    const repo = new RepositorioMemoria();
    const nova = r(1, 2, "14:00", "15:00");
    await repo.guardarReserva(nova);
    expect(await repo.listarReservas()).toEqual([nova]);
    expect(await repo.listarReservasDaSala(2)).toEqual([nova]);
  });

  it("recusa guardar duas reservas com o mesmo id", async () => {
    const repo = new RepositorioMemoria({ reservas: [r(1, 1, "09:00", "10:00")] });
    await expect(repo.guardarReserva(r(1, 2, "11:00", "12:00"))).rejects.toThrow(/id 1/);
  });

  it("não deixa que alterar as listas devolvidas mude os dados guardados", async () => {
    const repo = new RepositorioMemoria({ salas: [atlantico], reservas: [r(1, 1, "09:00", "10:00")] });
    (await repo.listarSalas()).push(douro);
    (await repo.listarReservas()).length = 0;
    expect(await repo.listarSalas()).toEqual([atlantico]);
    expect(await repo.listarReservas()).toHaveLength(1);
  });

  it("não é afetado por alterações às listas passadas ao criar", async () => {
    const salas = [atlantico];
    const repo = new RepositorioMemoria({ salas });
    salas.push(douro);
    expect(await repo.listarSalas()).toEqual([atlantico]);
  });

  it("funciona com o caso de uso reservarSala do princípio ao fim", async () => {
    const repo = new RepositorioMemoria({ salas: [atlantico, douro] });

    const primeira = await reservarSala(repo, { salaId: 1, inicio: h("10:00"), fim: h("12:00") });
    const chocante = await reservarSala(repo, { salaId: 1, inicio: h("11:00"), fim: h("13:00") });
    const seguida = await reservarSala(repo, { salaId: 1, inicio: h("12:00"), fim: h("13:00") });

    expect(primeira.sucesso).toBe(true);
    expect(chocante.sucesso).toBe(false);
    expect(seguida.sucesso).toBe(true);
    expect((await repo.listarReservas()).map((x) => x.id)).toEqual([primeira.reserva.id, seguida.reserva.id]);
  });
});
