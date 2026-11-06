import { describe, expect, it } from "vitest";
import { reservarSalaAction } from "./actions.js";

function formulario(data, inicio, fim) {
  const f = new FormData();
  f.set("salaId", "3");
  f.set("data", data);
  f.set("inicio", inicio);
  f.set("fim", fim);
  return f;
}

describe("reservarSalaAction: duração máxima", () => {
  it("devolve ao ecrã a mensagem do limite de 2 horas", async () => {
    const r = await reservarSalaAction(null, formulario("2027-02-01", "09:00", "11:30"));
    expect(r).toEqual({ sucesso: false, erro: "Uma reserva pode durar no máximo 2 horas" });
  });

  it("aceita exatamente 2 horas em hora de Lisboa, também no verão", async () => {
    const r = await reservarSalaAction(null, formulario("2027-07-01", "09:00", "11:00"));
    expect(r).toEqual({ sucesso: true, erro: "" });
  });
});
