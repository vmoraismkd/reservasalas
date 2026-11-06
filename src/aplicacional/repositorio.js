// Interface do repositório de que os casos de uso precisam.
// JavaScript não tem interfaces: este ficheiro descreve o contrato que qualquer
// repositório (em memória, PostgreSQL, ...) tem de cumprir. Todos os métodos são assíncronos.
//
// @typedef {import("../dominio/Sala.js").Sala} Sala
// @typedef {import("../dominio/Reserva.js").Reserva} Reserva
//
// @typedef {Object} RepositorioReservas
// @property {() => Promise<Sala[]>} listarSalas
//   Todas as salas.
// @property {() => Promise<Reserva[]>} listarReservas
//   Todas as reservas, de todas as salas.
// @property {(salaId: number) => Promise<Reserva[]>} listarReservasDaSala
//   Só as reservas da sala indicada.
// @property {() => Promise<number>} proximoIdReserva
//   Um id novo e ainda não usado para uma reserva. É preciso porque o domínio
//   exige o id ao criar a Reserva, antes de ela ser guardada.
// @property {(reserva: Reserva) => Promise<void>} guardarReserva
//   Guarda uma reserva já validada pelo domínio.

export const METODOS_DO_REPOSITORIO = [
  "listarSalas",
  "listarReservas",
  "listarReservasDaSala",
  "proximoIdReserva",
  "guardarReserva",
];
