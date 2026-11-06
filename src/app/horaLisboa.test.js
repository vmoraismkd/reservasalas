import { describe, expect, it } from "vitest";
import { lisboaParaUTC } from "./horaLisboa.js";

const utc = (data, hora) => lisboaParaUTC(data, hora).instante?.toISOString();

describe("lisboaParaUTC", () => {
  it("no inverno Lisboa está em UTC+0", () => {
    expect(utc("2026-01-15", "10:00")).toBe("2026-01-15T10:00:00.000Z");
    expect(utc("2026-11-10", "09:00")).toBe("2026-11-10T09:00:00.000Z");
  });

  it("no verão Lisboa está em UTC+1", () => {
    expect(utc("2026-07-15", "10:00")).toBe("2026-07-15T09:00:00.000Z");
  });

  it("a meia-noite de verão cai no dia anterior em UTC", () => {
    expect(utc("2026-07-15", "00:30")).toBe("2026-07-14T23:30:00.000Z");
  });

  describe("passagem para a hora de verão (29/03/2026: 01:00 salta para 02:00)", () => {
    it("antes do salto ainda é UTC+0", () => {
      expect(utc("2026-03-29", "00:59")).toBe("2026-03-29T00:59:00.000Z");
    });

    it("recusa uma hora que não existe em Lisboa", () => {
      const resultado = lisboaParaUTC("2026-03-29", "01:30");
      expect(resultado.instante).toBeUndefined();
      expect(resultado.erro).toMatch(/não existe/i);
    });

    it("depois do salto já é UTC+1", () => {
      expect(utc("2026-03-29", "02:00")).toBe("2026-03-29T01:00:00.000Z");
    });
  });

  describe("passagem para a hora de inverno (25/10/2026: 02:00 volta a 01:00)", () => {
    it("uma hora que acontece duas vezes usa a primeira (ainda hora de verão)", () => {
      expect(utc("2026-10-25", "01:30")).toBe("2026-10-25T00:30:00.000Z");
    });

    it("depois da mudança já é UTC+0", () => {
      expect(utc("2026-10-25", "02:00")).toBe("2026-10-25T02:00:00.000Z");
    });
  });

  it.each([
    ["dia que não existe", "2026-02-30", "10:00"],
    ["mês 13", "2026-13-01", "10:00"],
    ["hora 24", "2026-11-10", "24:00"],
    ["minuto 60", "2026-11-10", "10:60"],
    ["data sem zeros", "2026-1-5", "10:00"],
    ["hora sem zero", "2026-11-10", "9:00"],
    ["data vazia", "", "10:00"],
    ["hora vazia", "2026-11-10", ""],
    ["data em falta", null, "10:00"],
    ["hora em falta", "2026-11-10", undefined],
    ["texto livre", "amanhã", "às dez"],
  ])("recusa %s", (_, data, hora) => {
    const resultado = lisboaParaUTC(data, hora);
    expect(resultado.instante).toBeUndefined();
    expect(resultado.erro).toEqual(expect.any(String));
  });
});
