// Uso: npm run migrar   (na pasta do projeto, no seu computador)
// Lê o .env.local com o próprio Node.js (sem Next.js) e liga com o DATABASE_ADMIN_URL.
// Nunca mostra o endereço, o utilizador de administração nem a palavra-passe.
import { existsSync } from "node:fs";
import { ErroLigacaoBD, criarLigacao } from "./ligacao.js";
import { ErroMigracao, UTILIZADOR_APP, lerEnderecoAdmin, migrar } from "./migracao.js";

const FICHEIRO_ENV = ".env.local";

async function principal() {
  if (!existsSync(FICHEIRO_ENV)) {
    throw new ErroMigracao(`Não encontrei ${FICHEIRO_ENV}: corra o comando na pasta do projeto.`);
  }
  process.loadEnvFile(FICHEIRO_ENV);

  let ligacao;
  try {
    ligacao = criarLigacao({ url: lerEnderecoAdmin() });
  } catch (erro) {
    // O módulo de ligação fala em DATABASE_URL; aqui o endereço vem do DATABASE_ADMIN_URL.
    if (erro instanceof ErroLigacaoBD) throw new ErroMigracao(erro.message.replaceAll("DATABASE_URL", "DATABASE_ADMIN_URL"));
    throw erro;
  }

  try {
    console.log("A migrar a base de dados...");
    const r = await migrar(ligacao);

    console.log(`Tabelas salas e reservas: prontas.`);
    console.log(`Salas de exemplo: ${r.salasInseridas} inserida(s) agora, ${r.totalSalas} no total.`);
    console.log(`\nPermissões de ${UTILIZADOR_APP}:`);
    for (const tabela of ["salas", "reservas"]) {
      const tem = r.privilegios.filter((p) => p.tabela === tabela && p.tem).map((p) => p.privilegio);
      console.log(`  ${tabela}: ${tem.join(", ") || "nenhuma"}`);
    }

    if (r.problemas.length > 0) {
      console.log(`\nATENÇÃO: ${UTILIZADOR_APP} tem permissões a mais ou a menos:`);
      for (const problema of r.problemas) console.log(`  - ${problema}`);
      process.exitCode = 1;
    } else {
      console.log(`\nOK: ${UTILIZADOR_APP} só pode ler, inserir, alterar e apagar dados nas duas tabelas.`);
    }
  } finally {
    await ligacao.fechar();
  }
}

principal().catch((erro) => {
  // Só se mostram erros já limpos (ErroLigacaoBD/ErroMigracao); outros podem conter dados de acesso.
  const conhecido = erro instanceof ErroMigracao || erro instanceof ErroLigacaoBD;
  console.error(`Migração falhou: ${conhecido ? erro.message : "erro inesperado (detalhes omitidos)."}`);
  process.exitCode = 1;
});
