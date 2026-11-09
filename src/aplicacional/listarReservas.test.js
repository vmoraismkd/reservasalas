import { describe, expect, it } from "vitest";
import { listarReservas } from "./listarReservas.js";
import { criarRepositorioFalso } from "./repositorioFalso.js";
import { Reserva } from "../dominio/Reserva.js";

const r = (id, salaId, inicio, fim) =>
  new Reserva({ id: `r${id}`, salaId: `s${salaId}`, inicio: new Date(inicio), fim: new Date(fim) });

describe("listarReservas", () => {
  it("devolve as reservas de todas as salas ordenadas pela data de início", async () => {
    const repo = criarRepositorioFalso({
      reservas: [
        r(1, 1, "2026-11-12T14:00:00Z", "2026-11-12T15:00:00Z"),
        r(2, 2, "2026-11-10T09:00:00Z", "2026-11-10T10:00:00Z"),
        r(3, 1, "2026-11-10T08:00:00Z", "2026-11-10T09:00:00Z"),
      ],
    });

    const reservas = await listarReservas(repo);

    expect(reservas.map((x) => x.id)).toEqual(["r3", "r2", "r1"]);
    expect(reservas[0]).toBeInstanceOf(Reserva);
  });

  it("devolve uma lista vazia quando não há reservas", async () => {
    expect(await listarReservas(criarRepositorioFalso())).toEqual([]);
  });
});
