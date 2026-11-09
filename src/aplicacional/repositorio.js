// Interface do repositório de que os casos de uso precisam.
// JavaScript não tem interfaces: este ficheiro descreve o contrato que qualquer
// repositório (em memória, PostgreSQL, ...) tem de cumprir. Todos os métodos são assíncronos.
// Os ids são texto (ex.: UUID gerado pela base de dados).
//
// @typedef {import("../dominio/Sala.js").Sala} Sala
// @typedef {import("../dominio/Reserva.js").Reserva} Reserva
//
// @typedef {Object} RepositorioReservas
// @property {() => Promise<Sala[]>} listarSalas
//   Todas as salas.
// @property {() => Promise<Reserva[]>} listarReservas
//   Todas as reservas, de todas as salas.
// @property {(salaId: string) => Promise<Reserva[]>} listarReservasDaSala
//   Só as reservas da sala indicada.
// @property {(reserva: Reserva) => Promise<Reserva>} guardarReserva
//   Guarda uma reserva nova (ainda sem id), já validada pelo domínio, e devolve-a
//   com o id atribuído pela persistência.

export const METODOS_DO_REPOSITORIO = ["listarSalas", "listarReservas", "listarReservasDaSala", "guardarReserva"];
