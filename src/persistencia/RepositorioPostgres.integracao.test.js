// Contrato do repositório contra o PostgreSQL real (DATABASE_URL e DATABASE_PROXY do .env.local).
// Só corre com "npm run test:postgres", nunca com "npm run test".
// Cria salas com o prefixo __contrato__ e apaga-as sempre (com as reservas delas) no fim de cada
// teste e também antes de começar, para limpar restos de uma execução interrompida.
import { it } from "vitest";
import { criarLigacao } from "./ligacao.js";
import { PREFIXO_SALAS_TESTE, testarContratoRepositorio } from "./__testes__/contratoRepositorio.js";

let RepositorioPostgres = null;
try {
  ({ RepositorioPostgres } = await import("./RepositorioPostgres.js"));
} catch {
  RepositorioPostgres = null;
}

// starts_with e não LIKE: no LIKE o "_" do prefixo é um curinga e podia apanhar salas reais.
const SQL_APAGAR_RESERVAS_TESTE = `
DELETE FROM public.reservas
WHERE sala_id IN (SELECT id FROM public.salas WHERE starts_with(nome, $1))`;
const SQL_APAGAR_SALAS_TESTE = `DELETE FROM public.salas WHERE starts_with(nome, $1)`;
const SQL_CRIAR_SALAS_TESTE = `
INSERT INTO public.salas (nome, capacidade)
SELECT * FROM unnest($1::text[], $2::int[])`;

async function apagarDadosDeTeste(ligacao) {
  await ligacao.consultar(SQL_APAGAR_RESERVAS_TESTE, [PREFIXO_SALAS_TESTE]);
  await ligacao.consultar(SQL_APAGAR_SALAS_TESTE, [PREFIXO_SALAS_TESTE]);
}

if (!RepositorioPostgres) {
  it("RepositorioPostgres existe em src/persistencia/RepositorioPostgres.js", () => {
    throw new Error(
      "Ainda não existe src/persistencia/RepositorioPostgres.js (export class RepositorioPostgres, " +
        "construída com new RepositorioPostgres(ligacao)). Os testes de contrato estão prontos para quando existir.",
    );
  });
} else {
  testarContratoRepositorio("RepositorioPostgres", async (salas) => {
    const ligacao = criarLigacao();
    try {
      await apagarDadosDeTeste(ligacao);
      await ligacao.consultar(SQL_CRIAR_SALAS_TESTE, [salas.map((s) => s.nome), salas.map((s) => s.capacidade)]);
    } catch (erro) {
      await ligacao.fechar();
      throw erro;
    }
    return {
      repositorio: new RepositorioPostgres(ligacao),
      limpar: async () => {
        try {
          await apagarDadosDeTeste(ligacao);
        } finally {
          await ligacao.fechar();
        }
      },
    };
  });
}
