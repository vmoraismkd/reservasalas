import { ErroDominio } from "./ErroDominio.js";

// Os ids são texto opaco (ex.: UUID gerado pela base de dados): o domínio não depende do formato.
export function ehIdValido(id) {
  return typeof id === "string" && id.trim() !== "";
}

// Uma sala que pode ser reservada. Só existe se os dados forem válidos e não muda depois de criada.
export class Sala {
  constructor({ id, nome, capacidade }) {
    if (!ehIdValido(id)) {
      throw new ErroDominio("O id da sala é obrigatório (texto não vazio)");
    }
    if (typeof nome !== "string" || nome.trim() === "") {
      throw new ErroDominio("O nome da sala é obrigatório");
    }
    if (!Number.isInteger(capacidade) || capacidade <= 0) {
      throw new ErroDominio("A capacidade da sala tem de ser um número inteiro positivo");
    }

    this.id = id;
    this.nome = nome.trim();
    this.capacidade = capacidade;
    Object.freeze(this);
  }
}
