import { ErroDominio } from "./ErroDominio.js";

export const DURACAO_MAXIMA_HORAS = 2;
const DURACAO_MAXIMA_MS = DURACAO_MAXIMA_HORAS * 60 * 60 * 1000;

// Uma reserva pode durar no máximo 2 horas (exatamente 2 horas é permitido).
// Fica fora do construtor da Reserva: quem cria reservas novas é que chama esta regra.
export function garantirDuracaoMaxima(reserva) {
  if (reserva.fim.getTime() - reserva.inicio.getTime() > DURACAO_MAXIMA_MS) {
    throw new ErroDominio(`Uma reserva pode durar no máximo ${DURACAO_MAXIMA_HORAS} horas`);
  }
}
