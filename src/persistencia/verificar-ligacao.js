// Uso: npm run verificar-ligacao   (na pasta do projeto, no seu computador)
// Liga com o DATABASE_URL da app (e o DATABASE_PROXY, se existir) e mostra se a ligação é segura.
// Nunca mostra o endereço nem a palavra-passe. Nada fica gravado nem apagado.
import { existsSync } from "node:fs";
import { ErroLigacaoBD, criarLigacao } from "./ligacao.js";
import { verificarLigacao } from "./verificacao.js";

const FICHEIRO_ENV = ".env.local";
const simNao = (valor, sim, nao) => (valor ? sim : nao);

async function principal() {
  if (!existsSync(FICHEIRO_ENV)) {
    console.error(`Não encontrei ${FICHEIRO_ENV}: corra o comando na pasta do projeto.`);
    process.exitCode = 1;
    return;
  }
  process.loadEnvFile(FICHEIRO_ENV);

  const ligacao = criarLigacao();
  try {
    console.log("A verificar a ligação (DATABASE_URL)...\n");
    const r = await verificarLigacao(ligacao);

    console.log(`Ligação:              ${simNao(r.ligou, "OK", "falhou")}`);
    if (r.ligou) {
      const detalhe = [r.protocolo, r.cifra, r.bits && `${r.bits} bits`].filter(Boolean).join(", ");
      console.log(`Cifrada:              ${simNao(r.cifrada, `sim (${detalhe})`, "NÃO")}`);
      console.log(`Certificado:          ${simNao(r.certificadoConfirmado, "confirmado com o DATABASE_CA_CERT", "NÃO confirmado")}`);
      console.log(`Utilizador:           ${r.utilizador}${r.superutilizador ? " (superutilizador)" : ""}`);
      console.log(`Gravar reserva:       ${simNao(r.gravou, "consegue (anulado no fim)", "não conseguiu")}`);
      if (r.apagouTabela !== null) {
        console.log(`Apagar a tabela:      ${simNao(r.apagouTabela, "CONSEGUE (anulado no fim)", `não consegue (${r.motivoApagar})`)}`);
      }
      if (r.nadaFicou !== null) {
        console.log(`Depois da anulação:   ${simNao(r.nadaFicou, "nada ficou gravado nem apagado", "ALGO FICOU (ver abaixo)")}`);
      }
    }

    if (r.problemas.length > 0) {
      console.log("\nATENÇÃO:");
      for (const problema of r.problemas) console.log(`  - ${problema}`);
      process.exitCode = 1;
    } else {
      console.log("\nOK: ligação cifrada, certificado confirmado e permissões limitadas.");
    }
  } finally {
    await ligacao.fechar();
  }
}

principal().catch((erro) => {
  // Só se mostram erros já limpos; outros podem conter dados de acesso.
  console.error(`Verificação falhou: ${erro instanceof ErroLigacaoBD ? erro.message : "erro inesperado (detalhes omitidos)."}`);
  process.exitCode = 1;
});
