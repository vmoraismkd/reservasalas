// Ligação ao PostgreSQL (Aiven). Só para código do servidor, testes e scripts:
// lê credenciais de variáveis de ambiente e nunca deve ser importado por componentes do browser.
import pg from "pg";
import { TunelProxy } from "./tunelProxy.js";

export class ErroLigacaoBD extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = "ErroLigacaoBD";
  }
}

const FORMATO_URL = "postgres://utilizador:palavra-passe@anfitrião:porta/base";

// Parâmetros do endereço que o pg usa por cima da configuração dada em código:
// sslmode/ssl/sslrootcert... podiam desligar a cifra ou a verificação do certificado,
// e host/hostaddr podiam desviar a ligação para um socket local (sem TLS).
const PARAMETROS_RETIRADOS = /^(ssl.*|uselibpqcompat|host|hostaddr)$/i;

function lerEndereco(url) {
  if (!url) {
    throw new ErroLigacaoBD("Falta o endereço da base de dados: defina DATABASE_URL (ou passe-o ao módulo).");
  }
  let endereco;
  try {
    endereco = new URL(url);
  } catch {
    endereco = null;
  }
  if (!endereco || !["postgres:", "postgresql:"].includes(endereco.protocol) || !endereco.hostname) {
    // Nunca se inclui o valor recebido: pode conter a palavra-passe.
    throw new ErroLigacaoBD(`DATABASE_URL não é um endereço PostgreSQL válido (formato: ${FORMATO_URL}).`);
  }
  for (const chave of [...endereco.searchParams.keys()]) {
    if (PARAMETROS_RETIRADOS.test(chave)) endereco.searchParams.delete(chave);
  }
  return endereco.toString();
}

function lerCertificado(caCert) {
  if (!caCert) {
    throw new ErroLigacaoBD("Falta o certificado do Aiven: defina DATABASE_CA_CERT (ou passe-o ao módulo).");
  }
  // Alguns painéis de variáveis guardam as quebras de linha como o texto "\n".
  const texto = caCert.replaceAll("\\n", "\n").trim();
  const temInicio = texto.startsWith("-----BEGIN CERTIFICATE-----");
  const temFim = texto.includes("-----END CERTIFICATE-----");
  if (temInicio && !temFim) {
    throw new ErroLigacaoBD(
      "DATABASE_CA_CERT está incompleto: falta a linha -----END CERTIFICATE-----. " +
        "Num ficheiro .env, um valor com várias linhas tem de estar entre aspas duplas.",
    );
  }
  if (!temInicio || !temFim) {
    throw new ErroLigacaoBD("DATABASE_CA_CERT não é um certificado em formato PEM (-----BEGIN CERTIFICATE----- ...).");
  }
  return texto;
}

const EXEMPLO_PROXY = "http://192.168.0.205:3128/";

// Proxy HTTP opcional (DATABASE_PROXY), com ou sem "http://". Devolve null se não houver.
// O valor recebido nunca entra nas mensagens: podia ter credenciais.
function lerProxy(texto) {
  const valor = (texto ?? "").trim();
  if (!valor) return null;
  const comEsquema = /^[a-z][a-z0-9+.-]*:\/\//i.test(valor) ? valor : `http://${valor}`;
  let endereco;
  try {
    endereco = new URL(comEsquema);
  } catch {
    endereco = null;
  }
  if (!endereco || !endereco.hostname) {
    throw new ErroLigacaoBD(`DATABASE_PROXY não é um endereço de proxy válido (ex.: ${EXEMPLO_PROXY}).`);
  }
  if (endereco.protocol !== "http:") {
    throw new ErroLigacaoBD(
      `DATABASE_PROXY tem de ser um proxy http:// (ex.: ${EXEMPLO_PROXY}); o TLS até ao Aiven é feito por cima do túnel.`,
    );
  }
  if (endereco.username || endereco.password) {
    throw new ErroLigacaoBD("DATABASE_PROXY não pode ter utilizador nem palavra-passe: a autenticação no proxy não é suportada.");
  }
  // O URL esconde a porta 80 por ser a predefinida; aqui exige-se que seja escrita.
  const porta = endereco.port ? Number(endereco.port) : /:80(\/|$)/.test(comEsquema) ? 80 : null;
  if (!porta) throw new ErroLigacaoBD(`DATABASE_PROXY tem de indicar a porta (ex.: ${EXEMPLO_PROXY}).`);
  return { anfitriao: endereco.hostname.replace(/^\[|\]$/g, ""), porta };
}

/**
 * Configuração para o pg: ligação sempre cifrada e com o certificado do Aiven verificado.
 * Com DATABASE_PROXY, cada ligação passa por um túnel novo no proxy; o TLS continua a ser
 * feito pelo pg por cima do túnel, até ao Aiven. Sem DATABASE_PROXY nada muda.
 * Lança ErroLigacaoBD (com uma explicação, sem valores) se faltar ou estiver mal algum dado.
 */
export function criarConfiguracao({
  url = process.env.DATABASE_URL,
  caCert = process.env.DATABASE_CA_CERT,
  proxy = process.env.DATABASE_PROXY,
} = {}) {
  const connectionString = lerEndereco(url);
  const ca = lerCertificado(caCert);
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
    throw new ErroLigacaoBD(
      "NODE_TLS_REJECT_UNAUTHORIZED=0 desliga a verificação de certificados em todo o Node.js; retire-o para ligar à base de dados.",
    );
  }
  const config = { connectionString, ssl: { ca, rejectUnauthorized: true } };
  const enderecoProxy = lerProxy(proxy);
  if (enderecoProxy) config.stream = () => new TunelProxy(enderecoProxy);
  return config;
}

// Devolve uma função que troca por *** tudo o que identifique o acesso: endereço completo,
// utilizador, palavra-passe (codificada e não codificada), anfitrião e qualquer endereço IP.
function criarLimpador(url) {
  const segredos = new Set([url]);
  try {
    const endereco = new URL(url);
    for (const valor of [endereco.username, endereco.password, endereco.hostname]) {
      segredos.add(valor);
      segredos.add(decodeURIComponent(valor));
    }
  } catch {
    // Endereço inválido: nesse caso nunca se chega a ligar.
  }
  const lista = [...segredos].filter((s) => s && s.length >= 3).sort((a, b) => b.length - a.length);

  return (texto) => {
    let limpo = String(texto ?? "");
    for (const segredo of lista) limpo = limpo.replaceAll(segredo, "***");
    return limpo
      .replace(/\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b/g, "***") // IPv4 (e porta)
      .replace(/\[?\b[0-9a-f]{0,4}(?::[0-9a-f]{0,4}){2,7}\b\]?(?::\d+)?/gi, "***"); // IPv6
  };
}

// Erro novo, só com a mensagem limpa e o código (ex.: ECONNREFUSED, ou o código SQL 23P01).
// O erro original não é guardado (nem como "cause"), porque contém os dados de acesso.
// Códigos do Node.js quando o certificado do servidor não é aceite.
const ERROS_CERTIFICADO = new Set([
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "UNABLE_TO_GET_ISSUER_CERT",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "CERT_SIGNATURE_FAILURE",
  "CERT_UNTRUSTED",
  "CERT_HAS_EXPIRED",
  "CERT_NOT_YET_VALID",
  "ERR_TLS_CERT_ALTNAME_INVALID",
]);

function erroLimpo(erro, limpar) {
  if (ERROS_CERTIFICADO.has(erro?.code)) {
    const novo = new ErroLigacaoBD(
      `Ligação recusada: o certificado do servidor não foi validado pelo DATABASE_CA_CERT (${erro.code}).`,
    );
    novo.code = erro.code;
    return novo;
  }
  const mensagem = limpar(erro?.message || erro?.code || "erro desconhecido");
  const novo = new ErroLigacaoBD(`Erro na base de dados: ${mensagem}`);
  if (typeof erro?.code === "string") novo.code = erro.code;
  return novo;
}

/** Cria um conjunto de ligações (Pool). Para a app, usar obterLigacao(). */
export function criarLigacao({ url = process.env.DATABASE_URL, caCert, proxy } = {}) {
  const config = criarConfiguracao({ url, caCert, proxy });
  const limpar = criarLimpador(url);
  const pool = new pg.Pool({ ...config, connectionTimeoutMillis: 10_000 });

  // Sem este registo, um erro numa ligação inativa terminava o processo.
  pool.on("error", (erro) => console.error(erroLimpo(erro, limpar).message));

  return {
    async consultar(sql, parametros) {
      try {
        return await pool.query(sql, parametros);
      } catch (erro) {
        throw erroLimpo(erro, limpar);
      }
    },
    /**
     * Corre fn numa transação que é SEMPRE anulada (ROLLBACK), com um só cliente.
     * fn recebe { consultar, tls }: tls é o estado da cifra visto pelo lado da app.
     * Nunca faz COMMIT: nada do que fn fizer fica gravado nem apagado.
     */
    async transacaoAnulada(fn) {
      let cliente;
      try {
        cliente = await pool.connect();
      } catch (erro) {
        throw erroLimpo(erro, limpar);
      }
      const consultar = async (sql, parametros) => {
        try {
          return await cliente.query(sql, parametros);
        } catch (erro) {
          throw erroLimpo(erro, limpar);
        }
      };
      let erroAnular;
      try {
        await consultar("BEGIN");
        return await fn({ consultar, tls: estadoTls(cliente) });
      } finally {
        try {
          await cliente.query("ROLLBACK");
        } catch (erro) {
          erroAnular = erroLimpo(erro, limpar);
        }
        // Se o ROLLBACK falhou, o cliente é descartado: não pode voltar ao pool a meio de uma transação.
        cliente.release(erroAnular);
      }
    },
    async fechar() {
      await pool.end();
    },
  };
}

// Estado do TLS do lado da app (o socket que o pg usa depois da negociação SSL).
function estadoTls(cliente) {
  const socket = cliente.connection?.stream;
  return {
    protocolo: socket?.getProtocol?.() ?? null,
    cifra: socket?.getCipher?.()?.name ?? null,
    certificadoConfirmado: socket?.authorized === true,
  };
}

/** Ligação única para todo o servidor, criada na primeira utilização a partir das variáveis de ambiente. */
export function obterLigacao() {
  globalThis.__ligacaoBD ??= criarLigacao();
  return globalThis.__ligacaoBD;
}

/** Fecha a ligação única (para scripts e testes). */
export async function fecharLigacao() {
  const ligacao = globalThis.__ligacaoBD;
  globalThis.__ligacaoBD = undefined;
  await ligacao?.fechar();
}
