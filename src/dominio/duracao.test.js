import { describe, expect, it } from "vitest";
import { garantirDuracaoMaxima } from "./duracao.js";
import { Reserva } from "./Reserva.js";
import { ErroDominio } from "./ErroDominio.js";

// Reserva na sala 1, no dia 10/11/2026 (UTC), entre as horas indicadas.
function reserva(inicio, fim, { diaFim = "2026-11-10" } = {}) {
  return new Reserva({
    id: "r1",
    salaId: "sala-1",
    inicio: new Date(`2026-11-10T${inicio}:00Z`),
    fim: new Date(`${diaFim}T${fim}:00Z`),
  });
}

describe("garantirDuracaoMaxima (uma reserva tem no máximo 2 horas)", () => {
  it("permite exatamente 2 horas", () => {
    expect(() => garantirDuracaoMaxima(reserva("10:00", "12:00"))).not.toThrow();
  });

  it("recusa 2 horas e 1 minuto", () => {
    expect(() => garantirDuracaoMaxima(reserva("10:00", "12:01"))).toThrow(ErroDominio);
  });

  it("permite 30 minutos", () => {
    expect(() => garantirDuracaoMaxima(reserva("10:00", "10:30"))).not.toThrow();
  });

  it("permite 1 hora e 59 minutos", () => {
    expect(() => garantirDuracaoMaxima(reserva("10:00", "11:59"))).not.toThrow();
  });

  it("recusa reservas bem mais longas (4 horas)", () => {
    expect(() => garantirDuracaoMaxima(reserva("09:00", "13:00"))).toThrow(ErroDominio);
  });

  it("conta a duração real quando a reserva atravessa a meia-noite", () => {
    expect(() => garantirDuracaoMaxima(reserva("23:00", "01:00", { diaFim: "2026-11-11" }))).not.toThrow();
    expect(() => garantirDuracaoMaxima(reserva("23:00", "01:30", { diaFim: "2026-11-11" }))).toThrow(ErroDominio);
  });

  it("explica o limite na mensagem do erro", () => {
    expect(() => garantirDuracaoMaxima(reserva("10:00", "12:01"))).toThrow(/no máximo 2 horas/);
  });
});
