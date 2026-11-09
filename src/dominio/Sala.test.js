import { describe, expect, it } from "vitest";
import { Sala } from "./Sala.js";
import { ErroDominio } from "./ErroDominio.js";

// Os ids são texto (ex.: UUID gerado pela base de dados).
const valida = { id: "5b1f0c9e-1d2a-4c3b-9e8f-7a6b5c4d3e2f", nome: "Sala Atlântico", capacidade: 12 };

describe("Sala", () => {
  it("cria uma sala com dados válidos", () => {
    const sala = new Sala(valida);
    expect(sala.id).toBe("5b1f0c9e-1d2a-4c3b-9e8f-7a6b5c4d3e2f");
    expect(sala.nome).toBe("Sala Atlântico");
    expect(sala.capacidade).toBe(12);
  });

  it("tira os espaços à volta do nome", () => {
    expect(new Sala({ ...valida, nome: "  Sala Douro  " }).nome).toBe("Sala Douro");
  });

  it.each(["", "   ", 1, 0, null, undefined])("rejeita id inválido: %s", (id) => {
    expect(() => new Sala({ ...valida, id })).toThrow(ErroDominio);
  });

  it("aceita qualquer texto não vazio como id", () => {
    expect(new Sala({ ...valida, id: "1" }).id).toBe("1");
  });

  it.each(["", "   ", null, undefined, 42])("rejeita nome inválido: %s", (nome) => {
    expect(() => new Sala({ ...valida, nome })).toThrow(ErroDominio);
  });

  it.each([0, -3, 2.5, "10", null, undefined, Infinity])("rejeita capacidade inválida: %s", (capacidade) => {
    expect(() => new Sala({ ...valida, capacidade })).toThrow(ErroDominio);
  });

  it("não pode ser alterada depois de criada", () => {
    const sala = new Sala(valida);
    expect(() => {
      sala.capacidade = 99;
    }).toThrow(TypeError);
    expect(sala.capacidade).toBe(12);
  });
});
