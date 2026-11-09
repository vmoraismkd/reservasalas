import { ErroDominio } from "./ErroDominio.js";
import { ehIdValido } from "./Sala.js";

function ehDataValida(valor) {
  return valor instanceof Date && !Number.isNaN(valor.getTime());
}

// Uma marcação de uma sala entre dois instantes.
// Um Date guarda sempre um instante absoluto (em UTC); o fuso horário só conta na hora de o mostrar.
export class Reserva {
  // Guardam-se cópias das datas: um Date pode ser alterado por fora (ex.: setHours),
  // e isso mudaria a reserva sem passar pelas validações.
  #inicio;
  #fim;

  constructor({ id, salaId, inicio, fim }) {
    // Uma reserva nova ainda não tem id: é a persistência que o atribui ao guardar.
    if (id !== undefined && id !== null && !ehIdValido(id)) {
      throw new ErroDominio("O id da reserva, quando existe, tem de ser texto não vazio");
    }
    if (!ehIdValido(salaId)) {
      throw new ErroDominio("O id da sala é obrigatório (texto não vazio)");
    }
    if (!ehDataValida(inicio)) {
      throw new ErroDominio("O início da reserva tem de ser uma data válida");
    }
    if (!ehDataValida(fim)) {
      throw new ErroDominio("O fim da reserva tem de ser uma data válida");
    }
    if (fim.getTime() <= inicio.getTime()) {
      throw new ErroDominio("O fim da reserva tem de ser depois do início");
    }

    this.id = id ?? null;
    this.salaId = salaId;
    this.#inicio = new Date(inicio.getTime());
    this.#fim = new Date(fim.getTime());
    Object.freeze(this);
  }

  get inicio() {
    return new Date(this.#inicio.getTime());
  }

  get fim() {
    return new Date(this.#fim.getTime());
  }

  // Duas reservas chocam se forem da mesma sala e cada uma começar antes de a outra acabar.
  // A sala fica ocupada de [início, fim[: o fim não conta, por isso reservas seguidas não chocam.
  sobrepoeCom(outra) {
    return (
      this.salaId === outra.salaId &&
      this.#inicio.getTime() < outra.#fim.getTime() &&
      outra.#inicio.getTime() < this.#fim.getTime()
    );
  }
}

// Recusa a nova reserva se chocar com alguma das reservas existentes.
export function garantirSemSobreposicao(nova, existentes) {
  const conflito = existentes.find((existente) => nova.sobrepoeCom(existente));
  if (conflito) {
    throw new ErroDominio(`A sala já está ocupada nesse horário (reserva ${conflito.id})`);
  }
}
