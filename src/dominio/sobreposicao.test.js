import { describe, expect, it } from "vitest";
import { Reserva, garantirSemSobreposicao } from "./Reserva.js";
import { ErroDominio } from "./ErroDominio.js";

// Atalho: horas do dia 10/11/2026 em UTC, ex.: reserva(1, 1, "09:00", "10:00").
// Os números dão ids em texto ("r1", "sala-1"), como os da base de dados.
function reserva(id, salaId, inicio, fim) {
  return new Reserva({
    id: `r${id}`,
    salaId: `sala-${salaId}`,
    inicio: new Date(`2026-11-10T${inicio}:00Z`),
    fim: new Date(`2026-11-10T${fim}:00Z`),
  });
}

// Reserva de referência: sala 1, das 10:00 às 12:00.
const base = reserva(1, 1, "10:00", "12:00");

describe("Reserva.sobrepoeCom", () => {
  it.each([
    ["começa antes e acaba a meio", "09:00", "11:00"],
    ["começa a meio e acaba depois", "11:00", "13:00"],
    ["fica totalmente dentro", "10:30", "11:30"],
    ["cobre-a totalmente", "09:00", "13:00"],
    ["tem exatamente o mesmo horário", "10:00", "12:00"],
    ["começa à mesma hora e acaba antes", "10:00", "11:00"],
    ["começa a meio e acaba à mesma hora", "11:00", "12:00"],
  ])("na mesma sala, sobrepõe quando a outra %s", (_, inicio, fim) => {
    const outra = reserva(2, 1, inicio, fim);
    expect(base.sobrepoeCom(outra)).toBe(true);
    expect(outra.sobrepoeCom(base)).toBe(true);
  });

  it.each([
    ["acaba quando esta começa (seguidas)", "08:00", "10:00"],
    ["começa quando esta acaba (seguidas)", "12:00", "14:00"],
    ["é toda antes", "07:00", "09:00"],
    ["é toda depois", "13:00", "14:00"],
  ])("na mesma sala, não sobrepõe quando a outra %s", (_, inicio, fim) => {
    const outra = reserva(2, 1, inicio, fim);
    expect(base.sobrepoeCom(outra)).toBe(false);
    expect(outra.sobrepoeCom(base)).toBe(false);
  });

  it("não sobrepõe se for noutra sala no mesmo horário", () => {
    const outra = reserva(2, 2, "10:00", "12:00");
    expect(base.sobrepoeCom(outra)).toBe(false);
    expect(outra.sobrepoeCom(base)).toBe(false);
  });

  it("considera o dia, não só as horas", () => {
    const outroDia = new Reserva({
      id: "r2",
      salaId: "sala-1",
      inicio: new Date("2026-11-11T10:00:00Z"),
      fim: new Date("2026-11-11T12:00:00Z"),
    });
    expect(base.sobrepoeCom(outroDia)).toBe(false);
  });

  it("considera reservas que atravessam a meia-noite", () => {
    const noite = new Reserva({
      id: "r2",
      salaId: "sala-1",
      inicio: new Date("2026-11-09T22:00:00Z"),
      fim: new Date("2026-11-10T10:30:00Z"),
    });
    expect(base.sobrepoeCom(noite)).toBe(true);
  });
});

describe("garantirSemSobreposicao", () => {
  it("aceita quando a sala não tem reservas", () => {
    expect(() => garantirSemSobreposicao(base, [])).not.toThrow();
  });

  it("aceita reservas seguidas na mesma sala", () => {
    const existentes = [reserva(2, 1, "08:00", "10:00"), reserva(3, 1, "12:00", "13:00")];
    expect(() => garantirSemSobreposicao(base, existentes)).not.toThrow();
  });

  it("aceita outra sala ocupada no mesmo horário", () => {
    const existentes = [reserva(2, 2, "10:00", "12:00"), reserva(3, 3, "09:00", "13:00")];
    expect(() => garantirSemSobreposicao(base, existentes)).not.toThrow();
  });

  it("recusa com ErroDominio quando há sobreposição na mesma sala", () => {
    const existentes = [reserva(2, 1, "11:00", "13:00")];
    expect(() => garantirSemSobreposicao(base, existentes)).toThrow(ErroDominio);
  });

  it("recusa mesmo que só uma entre várias reservas cause conflito", () => {
    const existentes = [
      reserva(2, 1, "08:00", "10:00"),
      reserva(3, 2, "10:00", "12:00"),
      reserva(4, 1, "11:30", "12:30"),
      reserva(5, 1, "12:00", "13:00"),
    ];
    expect(() => garantirSemSobreposicao(base, existentes)).toThrow(ErroDominio);
  });

  it("explica o motivo na mensagem do erro", () => {
    const existentes = [reserva(2, 1, "09:00", "11:00")];
    expect(() => garantirSemSobreposicao(base, existentes)).toThrow(/ocupada/i);
  });
});
