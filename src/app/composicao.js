// Ficheiro de composição: o único sítio da apresentação que importa da persistência.
// Cria o repositório e entrega-o aos casos de uso. Só pode ser importado por código do servidor
// (páginas sem "use client" e src/app/actions.js), porque usa o pg e as variáveis DATABASE_*.
import { obterLigacao } from "../persistencia/ligacao.js";
import { RepositorioMemoria } from "../persistencia/RepositorioMemoria.js";
import { RepositorioPostgres } from "../persistencia/RepositorioPostgres.js";
import { SALAS_FIXAS } from "../persistencia/salasFixas.js";

// A app usa o PostgreSQL (DATABASE_URL, ligação segura de ligacao.js).
// Só dentro do Vitest (variável VITEST, que nunca existe em produção) se usa o repositório em
// memória, para os testes da Server Action não dependerem de uma base de dados.
// Criado só no primeiro pedido: sem DATABASE_URL a app arranca e o erro aparece aí, explicado.
export function obterRepositorio() {
  if (process.env.VITEST === "true") {
    return (globalThis.__repositorioTestes ??= new RepositorioMemoria({ salas: SALAS_FIXAS }));
  }
  return (globalThis.__repositorioReservas ??= new RepositorioPostgres(obterLigacao()));
}
