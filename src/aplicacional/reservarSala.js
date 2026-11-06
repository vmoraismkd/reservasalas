import { Reserva, garantirSemSobreposicao } from "../dominio/Reserva.js";
import { ErroDominio } from "../dominio/ErroDominio.js";

const ERRO_TECNICO = "Não foi possível concluir a reserva. Tente novamente mais tarde.";

// Caso de uso "Reservar sala".
// Nunca lança exceções: devolve { sucesso: true, reserva } ou { sucesso: false, erro }.
export async function reservarSala(repositorio, { salaId, inicio, fim } = {}) {
  try {
    const salas = await repositorio.listarSalas();
    if (!salas.some((sala) => sala.id === salaId)) {
      return { sucesso: false, erro: "A sala não existe" };
    }

    // As validações das datas são feitas pelo domínio ao criar a Reserva.
    const id = await repositorio.proximoIdReserva();
    const reserva = new Reserva({ id, salaId, inicio, fim });

    const existentes = await repositorio.listarReservasDaSala(salaId);
    garantirSemSobreposicao(reserva, existentes);

    await repositorio.guardarReserva(reserva);
    return { sucesso: true, reserva };
  } catch (erro) {
    // Regras do negócio: a mensagem é pensada para o utilizador.
    if (erro instanceof ErroDominio) return { sucesso: false, erro: erro.message };
    // Falhas técnicas: o detalhe fica no registo do servidor, nunca na resposta (pode ter credenciais).
    console.error("reservarSala falhou:", erro);
    return { sucesso: false, erro: ERRO_TECNICO };
  }
}
