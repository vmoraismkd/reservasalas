import { describe, expect, it } from "vitest";
import { reservarSala } from "./reservarSala.js";
import { criarRepositorioFalso } from "./repositorioFalso.js";
import { Sala } from "../dominio/Sala.js";

const h = (hora) => new Date(`2026-11-10T${hora}:00Z`);

function repositorio() {
  return criarRepositorioFalso({ salas: [new Sala({ id: "s1", nome: "Sala Atlântico", capacidade: 12 })] });
}

describe("reservarSala: duração máxima de 2 horas", () => {
  it("recusa uma reserva com mais de 2 horas e devolve a mensagem, sem lançar exceção", async () => {
    const repo = repositorio();
    const pedido = reservarSala(repo, { salaId: "s1", inicio: h("10:00"), fim: h("12:01") });

    await expect(pedido).resolves.toEqual({
      sucesso: false,
      erro: "Uma reserva pode durar no máximo 2 horas",
    });
    expect(repo.guardarReserva).not.toHaveBeenCalled();
  });
});
