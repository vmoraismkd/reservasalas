"use server";

// Server Actions: tudo o que está aqui corre só no servidor; o browser recebe apenas uma
// referência para as chamar. O repositório vem do ficheiro de composição (composicao.js).
import { reservarSala } from "../aplicacional/reservarSala.js";
import { obterRepositorio } from "./composicao.js";
import { lisboaParaUTC } from "./horaLisboa.js";

const ERRO_TECNICO = "Não foi possível concluir a reserva. Tente novamente mais tarde.";

// Usada pelo formulário com useActionState: recebe o estado anterior e os dados do formulário.
// Devolve só o que o ecrã precisa ({ sucesso, erro }), porque o resultado é enviado ao browser.
export async function reservarSalaAction(_estadoAnterior, formData) {
  const data = formData.get("data");
  const inicio = lisboaParaUTC(data, formData.get("inicio"));
  if (inicio.erro) return { sucesso: false, erro: inicio.erro };
  const fim = lisboaParaUTC(data, formData.get("fim"));
  if (fim.erro) return { sucesso: false, erro: fim.erro };

  let repositorio;
  try {
    repositorio = obterRepositorio();
  } catch (erro) {
    // Configuração em falta ou inválida (ex.: sem DATABASE_URL). A mensagem do módulo de ligação
    // já vem sem dados de acesso; fica no registo do servidor e o utilizador vê uma mensagem genérica.
    console.error("Repositório indisponível:", erro.message);
    return { sucesso: false, erro: ERRO_TECNICO };
  }

  const resultado = await reservarSala(repositorio, {
    // Os ids são texto (UUID na base de dados); um valor que não seja texto dá "A sala não existe".
    salaId: typeof formData.get("salaId") === "string" ? formData.get("salaId") : "",
    inicio: inicio.instante,
    fim: fim.instante,
  });

  return resultado.sucesso ? { sucesso: true, erro: "" } : { sucesso: false, erro: resultado.erro };
}
