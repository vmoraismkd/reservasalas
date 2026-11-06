import { ErroDominio } from "./ErroDominio.js";

// Uma sala que pode ser reservada. Só existe se os dados forem válidos e não muda depois de criada.
export class Sala {
  constructor({ id, nome, capacidade }) {
    if (!Number.isInteger(id) || id <= 0) {
      throw new ErroDominio("O id da sala tem de ser um número inteiro positivo");
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
