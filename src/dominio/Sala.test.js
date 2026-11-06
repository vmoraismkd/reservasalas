import { describe, expect, it } from "vitest";
import { Sala } from "./Sala.js";
import { ErroDominio } from "./ErroDominio.js";

const valida = { id: 1, nome: "Sala Atlântico", capacidade: 12 };

describe("Sala", () => {
  it("cria uma sala com dados válidos", () => {
    const sala = new Sala(valida);
    expect(sala.id).toBe(1);
    expect(sala.nome).toBe("Sala Atlântico");
    expect(sala.capacidade).toBe(12);
  });

  it("tira os espaços à volta do nome", () => {
    expect(new Sala({ ...valida, nome: "  Sala Douro  " }).nome).toBe("Sala Douro");
  });

  it.each([0, -1, 1.5, "1", null, undefined])("rejeita id inválido: %s", (id) => {
    expect(() => new Sala({ ...valida, id })).toThrow(ErroDominio);
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
