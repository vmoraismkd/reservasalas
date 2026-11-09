import { describe, expect, it } from "vitest";
import { RepositorioMemoria } from "./RepositorioMemoria.js";
import { METODOS_DO_REPOSITORIO } from "../aplicacional/repositorio.js";
import { reservarSala } from "../aplicacional/reservarSala.js";
import { Sala } from "../dominio/Sala.js";
import { Reserva } from "../dominio/Reserva.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const h = (hora) => new Date(`2026-11-10T${hora}:00Z`);
const atlantico = new Sala({ id: "s1", nome: "Sala Atlântico", capacidade: 12 });
const douro = new Sala({ id: "s2", nome: "Sala Douro", capacidade: 6 });
// Reserva já guardada (com id) ou nova (id null), na sala "s<n>".
const r = (id, salaId, inicio, fim) =>
  new Reserva({ id: id === null ? null : `r${id}`, salaId: `s${salaId}`, inicio: h(inicio), fim: h(fim) });

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
    expect(await repo.listarReservasDaSala("s1")).toEqual([a, c]);
    expect(await repo.listarReservasDaSala("s2")).toEqual([b]);
    expect(await repo.listarReservasDaSala("nao-existe")).toEqual([]);
  });

  it("ao guardar uma reserva nova atribui-lhe um UUID e devolve-a", async () => {
    const repo = new RepositorioMemoria();
    const guardada = await repo.guardarReserva(r(null, 2, "14:00", "15:00"));
    expect(guardada).toBeInstanceOf(Reserva);
    expect(guardada.id).toMatch(UUID);
    expect(guardada.salaId).toBe("s2");
    expect(guardada.inicio.toISOString()).toBe("2026-11-10T14:00:00.000Z");
    expect(await repo.listarReservas()).toEqual([guardada]);
    expect(await repo.listarReservasDaSala("s2")).toEqual([guardada]);
  });

  it("dá ids diferentes a cada reserva guardada", async () => {
    const repo = new RepositorioMemoria();
    const a = await repo.guardarReserva(r(null, 1, "09:00", "10:00"));
    const b = await repo.guardarReserva(r(null, 1, "10:00", "11:00"));
    expect(a.id).not.toBe(b.id);
  });

  it("recusa guardar uma reserva que já tem id (só guarda reservas novas)", async () => {
    const repo = new RepositorioMemoria();
    await expect(repo.guardarReserva(r(1, 2, "11:00", "12:00"))).rejects.toThrow(/já tem id/);
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

    const primeira = await reservarSala(repo, { salaId: "s1", inicio: h("10:00"), fim: h("12:00") });
    const chocante = await reservarSala(repo, { salaId: "s1", inicio: h("11:00"), fim: h("13:00") });
    const seguida = await reservarSala(repo, { salaId: "s1", inicio: h("12:00"), fim: h("13:00") });

    expect(primeira.sucesso).toBe(true);
    expect(chocante.sucesso).toBe(false);
    expect(seguida.sucesso).toBe(true);
    expect((await repo.listarReservas()).map((x) => x.id)).toEqual([primeira.reserva.id, seguida.reserva.id]);
  });
});
