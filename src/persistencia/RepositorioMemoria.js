// Repositório que guarda tudo na memória do processo: os dados perdem-se ao reiniciar.
// Cumpre a interface definida em src/aplicacional/repositorio.js e serve para testes e
// para desenvolver sem base de dados.
import { randomUUID } from "node:crypto";
import { Reserva } from "../dominio/Reserva.js";

export class RepositorioMemoria {
  #salas;
  #reservas;

  constructor({ salas = [], reservas = [] } = {}) {
    // Cópias, para que quem criou o repositório não altere os dados por fora.
    this.#salas = [...salas];
    this.#reservas = [...reservas];
  }

  async listarSalas() {
    return [...this.#salas];
  }

  async listarReservas() {
    return [...this.#reservas];
  }

  async listarReservasDaSala(salaId) {
    return this.#reservas.filter((reserva) => reserva.salaId === salaId);
  }

  // Como a base de dados: atribui um UUID ao guardar e devolve a reserva guardada.
  async guardarReserva(reserva) {
    if (reserva.id !== null) {
      throw new Error("Só se guardam reservas novas: esta reserva já tem id");
    }
    const guardada = new Reserva({ id: randomUUID(), salaId: reserva.salaId, inicio: reserva.inicio, fim: reserva.fim });
    this.#reservas.push(guardada);
    return guardada;
  }
}
