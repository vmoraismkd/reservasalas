import { describe, expect, it } from "vitest";
import { listarSalas } from "./listarSalas.js";
import { criarRepositorioFalso } from "./repositorioFalso.js";
import { Sala } from "../dominio/Sala.js";

describe("listarSalas", () => {
  it("devolve as salas do repositório ordenadas pelo nome", async () => {
    const repo = criarRepositorioFalso({
      salas: [
        new Sala({ id: 1, nome: "Sala Tejo", capacidade: 20 }),
        new Sala({ id: 2, nome: "Sala Atlântico", capacidade: 12 }),
        new Sala({ id: 3, nome: "Sala Douro", capacidade: 6 }),
      ],
    });

    const salas = await listarSalas(repo);

    expect(salas.map((s) => s.nome)).toEqual(["Sala Atlântico", "Sala Douro", "Sala Tejo"]);
    expect(salas[0]).toBeInstanceOf(Sala);
  });

  it("devolve uma lista vazia quando não há salas", async () => {
    expect(await listarSalas(criarRepositorioFalso())).toEqual([]);
  });
});
