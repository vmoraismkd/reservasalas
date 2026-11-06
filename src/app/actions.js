"use server";

// Ficheiro de composição: o único sítio da apresentação que importa da persistência.
// Tudo o que está aqui corre só no servidor; o browser recebe apenas uma referência para o chamar.
import { reservarSala } from "../aplicacional/reservarSala.js";
import { RepositorioMemoria } from "../persistencia/RepositorioMemoria.js";
import { SALAS_FIXAS } from "../persistencia/salasFixas.js";
import { lisboaParaUTC } from "./horaLisboa.js";

// Um único repositório para todo o servidor. Guardado em globalThis para sobreviver às
// recargas de código do "next dev"; os dados perdem-se quando o servidor reinicia.
const repositorio = (globalThis.__repositorioReservas ??= new RepositorioMemoria({ salas: SALAS_FIXAS }));

// Usada pelo formulário com useActionState: recebe o estado anterior e os dados do formulário.
// Devolve só o que o ecrã precisa ({ sucesso, erro }), porque o resultado é enviado ao browser.
export async function reservarSalaAction(_estadoAnterior, formData) {
  const data = formData.get("data");
  const inicio = lisboaParaUTC(data, formData.get("inicio"));
  if (inicio.erro) return { sucesso: false, erro: inicio.erro };
  const fim = lisboaParaUTC(data, formData.get("fim"));
  if (fim.erro) return { sucesso: false, erro: fim.erro };

  const resultado = await reservarSala(repositorio, {
    salaId: Number(formData.get("salaId")),
    inicio: inicio.instante,
    fim: fim.instante,
  });

  return resultado.sucesso ? { sucesso: true, erro: "" } : { sucesso: false, erro: resultado.erro };
}
