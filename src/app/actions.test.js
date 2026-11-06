import { describe, expect, it } from "vitest";
import { reservarSalaAction } from "./actions.js";

function formulario({ salaId = "1", data, inicio, fim }) {
  const f = new FormData();
  f.set("salaId", salaId);
  f.set("data", data);
  f.set("inicio", inicio);
  f.set("fim", fim);
  return f;
}

// O repositório é partilhado por todo o servidor (e por estes testes): cada teste usa um dia diferente.
describe("reservarSalaAction", () => {
  it("reserva e devolve só { sucesso, erro }, sem o objeto Reserva", async () => {
    const r = await reservarSalaAction(null, formulario({ data: "2027-01-04", inicio: "10:00", fim: "11:00" }));
    expect(r).toEqual({ sucesso: true, erro: "" });
  });

  it("devolve a mensagem de sala ocupada quando há sobreposição", async () => {
    const dados = { data: "2027-01-05", inicio: "10:00", fim: "12:00" };
    await reservarSalaAction(null, formulario(dados));
    const r = await reservarSalaAction(null, formulario({ ...dados, inicio: "11:00", fim: "13:00" }));
    expect(r.sucesso).toBe(false);
    expect(r.erro).toMatch(/ocupada/i);
  });

  it("converte a hora de Lisboa: no verão, 10:00–11:00 em Lisboa choca com 10:30 e não com 11:00", async () => {
    await reservarSalaAction(null, formulario({ data: "2027-07-06", inicio: "10:00", fim: "11:00" }));
    const choca = await reservarSalaAction(null, formulario({ data: "2027-07-06", inicio: "10:30", fim: "11:30" }));
    const seguida = await reservarSalaAction(null, formulario({ data: "2027-07-06", inicio: "11:00", fim: "12:00" }));
    expect(choca.sucesso).toBe(false);
    expect(seguida.sucesso).toBe(true);
  });

  it("aceita a mesma hora noutra sala", async () => {
    const dados = { data: "2027-01-07", inicio: "10:00", fim: "11:00" };
    await reservarSalaAction(null, formulario(dados));
    const r = await reservarSalaAction(null, formulario({ ...dados, salaId: "2" }));
    expect(r.sucesso).toBe(true);
  });

  it("recusa uma sala que não existe", async () => {
    const r = await reservarSalaAction(null, formulario({ salaId: "99", data: "2027-01-08", inicio: "10:00", fim: "11:00" }));
    expect(r).toEqual({ sucesso: false, erro: expect.stringMatching(/sala não existe/i) });
  });

  it("recusa quando o fim é antes do início", async () => {
    const r = await reservarSalaAction(null, formulario({ data: "2027-01-09", inicio: "11:00", fim: "10:00" }));
    expect(r.erro).toMatch(/depois do início/);
  });

  it("recusa horas que não existem em Lisboa", async () => {
    const r = await reservarSalaAction(null, formulario({ data: "2027-03-28", inicio: "01:15", fim: "03:00" }));
    expect(r.erro).toMatch(/não existe em Lisboa/);
  });

  it("recusa dados mal formados sem lançar exceções", async () => {
    const r = await reservarSalaAction(null, formulario({ salaId: "abc", data: "ontem", inicio: "x", fim: "" }));
    expect(r).toEqual({ sucesso: false, erro: expect.any(String) });
  });
});
