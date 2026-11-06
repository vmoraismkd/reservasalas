import { describe, expect, it } from "vitest";
import { Reserva } from "./Reserva.js";
import { ErroDominio } from "./ErroDominio.js";

const inicio = new Date("2026-11-10T09:00:00Z");
const fim = new Date("2026-11-10T10:30:00Z");
const valida = { id: 1, salaId: 2, inicio, fim };

describe("Reserva", () => {
  it("cria uma reserva com dados válidos", () => {
    const reserva = new Reserva(valida);
    expect(reserva.id).toBe(1);
    expect(reserva.salaId).toBe(2);
    expect(reserva.inicio.toISOString()).toBe("2026-11-10T09:00:00.000Z");
    expect(reserva.fim.toISOString()).toBe("2026-11-10T10:30:00.000Z");
  });

  it.each([0, -1, 1.5, "1", null, undefined])("rejeita id inválido: %s", (id) => {
    expect(() => new Reserva({ ...valida, id })).toThrow(ErroDominio);
  });

  it.each([0, -1, 1.5, "2", null, undefined])("rejeita salaId inválido: %s", (salaId) => {
    expect(() => new Reserva({ ...valida, salaId })).toThrow(ErroDominio);
  });

  it.each([
    ["texto", "2026-11-10T09:00:00Z"],
    ["número", Date.UTC(2026, 10, 10, 9)],
    ["data inválida", new Date("não é data")],
    ["vazio", undefined],
  ])("rejeita início que não é uma data válida (%s)", (_, valor) => {
    expect(() => new Reserva({ ...valida, inicio: valor })).toThrow(ErroDominio);
  });

  it.each([
    ["texto", "2026-11-10T10:30:00Z"],
    ["data inválida", new Date("não é data")],
    ["vazio", null],
  ])("rejeita fim que não é uma data válida (%s)", (_, valor) => {
    expect(() => new Reserva({ ...valida, fim: valor })).toThrow(ErroDominio);
  });

  it("rejeita fim igual ao início", () => {
    expect(() => new Reserva({ ...valida, fim: new Date(inicio) })).toThrow("depois do início");
  });

  it("rejeita fim antes do início", () => {
    expect(() => new Reserva({ ...valida, inicio: fim, fim: inicio })).toThrow(ErroDominio);
  });

  it("não muda se as datas originais forem alteradas por fora", () => {
    const i = new Date(inicio);
    const reserva = new Reserva({ ...valida, inicio: i });
    i.setUTCHours(23);
    expect(reserva.inicio.toISOString()).toBe("2026-11-10T09:00:00.000Z");
  });

  it("não muda se as datas devolvidas forem alteradas", () => {
    const reserva = new Reserva(valida);
    reserva.fim.setUTCFullYear(2000);
    expect(reserva.fim.toISOString()).toBe("2026-11-10T10:30:00.000Z");
  });

  it("não pode ser alterada depois de criada", () => {
    const reserva = new Reserva(valida);
    expect(() => {
      reserva.salaId = 99;
    }).toThrow(TypeError);
    expect(() => {
      reserva.inicio = new Date();
    }).toThrow(TypeError);
  });
});
