// Repositório que guarda tudo na memória do processo: os dados perdem-se ao reiniciar.
// Cumpre a interface definida em src/aplicacional/repositorio.js e serve para testes e
// para desenvolver antes de existir a ligação ao PostgreSQL.
export class RepositorioMemoria {
  #salas;
  #reservas;
  #ultimoId;

  constructor({ salas = [], reservas = [] } = {}) {
    // Cópias, para que quem criou o repositório não altere os dados por fora.
    this.#salas = [...salas];
    this.#reservas = [...reservas];
    this.#ultimoId = Math.max(0, ...reservas.map((reserva) => reserva.id));
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

  async proximoIdReserva() {
    this.#ultimoId += 1;
    return this.#ultimoId;
  }

  async guardarReserva(reserva) {
    // Tal como uma chave primária na base de dados, o id não se pode repetir.
    if (this.#reservas.some((existente) => existente.id === reserva.id)) {
      throw new Error(`Já existe uma reserva com o id ${reserva.id}`);
    }
    this.#reservas.push(reserva);
  }
}
