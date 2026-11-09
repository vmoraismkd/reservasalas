import { describe, expect, it } from "vitest";
import { lisboaParaUTC, utcParaLisboa } from "./horaLisboa.js";

const em = (iso) => utcParaLisboa(new Date(iso));

describe("utcParaLisboa (para mostrar no ecrã)", () => {
  it("no inverno Lisboa está em UTC+0", () => {
    expect(em("2026-11-10T09:00:00Z")).toEqual({ data: "2026-11-10", hora: "09:00" });
  });

  it("no verão Lisboa está em UTC+1", () => {
    expect(em("2027-07-15T08:00:00Z")).toEqual({ data: "2027-07-15", hora: "09:00" });
  });

  it("no verão, 23:30 UTC já é o dia seguinte em Lisboa", () => {
    expect(em("2027-07-15T23:30:00Z")).toEqual({ data: "2027-07-16", hora: "00:30" });
  });

  it("mostra a meia-noite como 00:00 (e não 24:00)", () => {
    expect(em("2026-12-01T00:00:00Z")).toEqual({ data: "2026-12-01", hora: "00:00" });
  });

  it("na mudança para a hora de inverno, os dois instantes das 01:30 mostram-se como 01:30", () => {
    expect(em("2026-10-25T00:30:00Z")).toEqual({ data: "2026-10-25", hora: "01:30" });
    expect(em("2026-10-25T01:30:00Z")).toEqual({ data: "2026-10-25", hora: "01:30" });
  });

  it("ignora segundos e milissegundos", () => {
    expect(em("2027-05-05T14:07:59.999Z")).toEqual({ data: "2027-05-05", hora: "15:07" });
  });

  it("é o inverso de lisboaParaUTC ao longo de um ano inteiro (de 37 em 37 horas)", () => {
    for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2027, 0, 1); t += 37 * 60 * 60 * 1000) {
      const { data, hora } = utcParaLisboa(new Date(t));
      const deVolta = lisboaParaUTC(data, hora).instante;
      expect(deVolta.getTime()).toBe(t);
    }
  });

  it.each([null, undefined, "2026-11-10", new Date("inválida")])("recusa o que não é uma data válida: %s", (valor) => {
    expect(() => utcParaLisboa(valor)).toThrow(TypeError);
  });
});
