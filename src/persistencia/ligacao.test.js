import { afterEach, describe, expect, it, vi } from "vitest";
import pg from "pg";
import { ErroLigacaoBD, criarConfiguracao, criarLigacao } from "./ligacao.js";

// Dados falsos, só para os testes. A palavra-passe tem caracteres especiais,
// que no endereço vão codificados (%40 = @, %3A = :, %2F = /, %21 = !).
const UTILIZADOR = "utilizadorSecreto";
const PALAVRA_PASSE = "p@ss:w/rd!Secreta";
const PALAVRA_PASSE_CODIFICADA = encodeURIComponent(PALAVRA_PASSE);
const ANFITRIAO = "pg-exemplo-secreto.aivencloud.com";
const URL_VALIDA = `postgres://${UTILIZADOR}:${PALAVRA_PASSE_CODIFICADA}@${ANFITRIAO}:12345/defaultdb`;
const CA = "-----BEGIN CERTIFICATE-----\nMIIBfakecertificadoParaTestes\n-----END CERTIFICATE-----";

const SEGREDOS = [UTILIZADOR, PALAVRA_PASSE, PALAVRA_PASSE_CODIFICADA, ANFITRIAO, "p@ss"];

function semSegredos(texto) {
  for (const segredo of SEGREDOS) expect(texto).not.toContain(segredo);
}

// Corre a função e devolve o erro lançado (falha se não lançar nenhum).
function erroDe(funcao) {
  try {
    funcao();
  } catch (erro) {
    return erro;
  }
  throw new Error("era esperado um erro");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("criarConfiguracao: não liga sem endereço", () => {
  it("recusa quando DATABASE_URL não está definido nem é passado", () => {
    vi.stubEnv("DATABASE_URL", "");
    const erro = erroDe(() => criarConfiguracao({ caCert: CA }));
    expect(erro).toBeInstanceOf(ErroLigacaoBD);
    expect(erro.message).toMatch(/DATABASE_URL/);
  });

  it("aceita o endereço passado ao módulo em vez do DATABASE_URL", () => {
    vi.stubEnv("DATABASE_URL", "");
    expect(() => criarConfiguracao({ url: URL_VALIDA, caCert: CA })).not.toThrow();
  });

  it("usa o DATABASE_URL quando não é passado endereço", () => {
    vi.stubEnv("DATABASE_URL", URL_VALIDA);
    expect(criarConfiguracao({ caCert: CA }).connectionString).toContain("defaultdb");
  });

  it.each([
    ["texto que não é endereço", `isto não é um endereço ${PALAVRA_PASSE}`],
    ["outro tipo de base de dados", `mysql://${UTILIZADOR}:${PALAVRA_PASSE_CODIFICADA}@${ANFITRIAO}/db`],
    ["endereço sem anfitrião", `postgres://${UTILIZADOR}:${PALAVRA_PASSE_CODIFICADA}@/db`],
  ])("recusa %s sem mostrar o que lá estava", (_, url) => {
    const erro = erroDe(() => criarConfiguracao({ url, caCert: CA }));
    expect(erro).toBeInstanceOf(ErroLigacaoBD);
    expect(erro.message).toMatch(/DATABASE_URL/);
    semSegredos(erro.message);
  });
});

describe("criarConfiguracao: não liga sem certificado", () => {
  it("recusa quando DATABASE_CA_CERT não está definido nem é passado", () => {
    vi.stubEnv("DATABASE_CA_CERT", "");
    const erro = erroDe(() => criarConfiguracao({ url: URL_VALIDA }));
    expect(erro).toBeInstanceOf(ErroLigacaoBD);
    expect(erro.message).toMatch(/DATABASE_CA_CERT/);
  });

  it("recusa um certificado incompleto (só a primeira linha) e explica porquê", () => {
    const erro = erroDe(() => criarConfiguracao({ url: URL_VALIDA, caCert: "-----BEGIN CERTIFICATE-----" }));
    expect(erro).toBeInstanceOf(ErroLigacaoBD);
    expect(erro.message).toMatch(/DATABASE_CA_CERT/);
    expect(erro.message).toMatch(/incompleto/i);
  });

  it("recusa texto que não é um certificado", () => {
    const erro = erroDe(() => criarConfiguracao({ url: URL_VALIDA, caCert: "abc" }));
    expect(erro).toBeInstanceOf(ErroLigacaoBD);
  });

  it("aceita o certificado com \\n escritos como texto (como em alguns painéis de variáveis)", () => {
    const umaLinha = CA.replaceAll("\n", "\\n");
    expect(criarConfiguracao({ url: URL_VALIDA, caCert: umaLinha }).ssl.ca).toBe(CA);
  });

  it("usa o DATABASE_CA_CERT quando não é passado certificado", () => {
    vi.stubEnv("DATABASE_CA_CERT", CA);
    expect(criarConfiguracao({ url: URL_VALIDA }).ssl.ca).toBe(CA);
  });
});

describe("criarConfiguracao: ligação sempre cifrada e com certificado verificado", () => {
  it("pede TLS com o certificado do Aiven e verificação ligada", () => {
    const config = criarConfiguracao({ url: URL_VALIDA, caCert: CA });
    expect(config.ssl).toEqual({ ca: CA, rejectUnauthorized: true });
  });

  it.each(["disable", "allow", "prefer", "require", "no-verify", "verify-ca", "verify-full"])(
    "retira sslmode=%s do endereço",
    (modo) => {
      const config = criarConfiguracao({ url: `${URL_VALIDA}?sslmode=${modo}`, caCert: CA });
      expect(config.connectionString).not.toMatch(/sslmode/i);
      expect(config.ssl).toEqual({ ca: CA, rejectUnauthorized: true });
    },
  );

  it("retira também os outros parâmetros ssl do endereço e mantém os restantes", () => {
    const url = `${URL_VALIDA}?sslrootcert=/tmp/ca.pem&application_name=reservas&sslcert=x&sslkey=y&uselibpqcompat=true&ssl=false`;
    const config = criarConfiguracao({ url, caCert: CA });
    expect(config.connectionString).not.toMatch(/ssl|uselibpqcompat/i);
    expect(config.connectionString).toContain("application_name=reservas");
  });

  it("retira host= do endereço, que podia desviar a ligação para um socket local sem cifra", () => {
    const config = criarConfiguracao({ url: `${URL_VALIDA}?host=/var/run/postgresql&hostaddr=10.0.0.1`, caCert: CA });
    expect(config.connectionString).not.toMatch(/host=|hostaddr=/);
    expect(new pg.Client(config).connectionParameters.host).toBe(ANFITRIAO);
  });

  it("o cliente do pg fica com a verificação ligada mesmo que o endereço tenha sslmode=no-verify", () => {
    const cliente = new pg.Client(criarConfiguracao({ url: `${URL_VALIDA}?sslmode=no-verify`, caCert: CA }));
    expect(cliente.connectionParameters.ssl).toMatchObject({ ca: CA, rejectUnauthorized: true });
  });

  it("recusa ligar se NODE_TLS_REJECT_UNAUTHORIZED=0 (desliga a verificação em todo o Node)", () => {
    vi.stubEnv("NODE_TLS_REJECT_UNAUTHORIZED", "0");
    const erro = erroDe(() => criarConfiguracao({ url: URL_VALIDA, caCert: CA }));
    expect(erro).toBeInstanceOf(ErroLigacaoBD);
    expect(erro.message).toMatch(/NODE_TLS_REJECT_UNAUTHORIZED/);
  });
});

describe("nunca mostra o endereço, o utilizador nem a palavra-passe", () => {
  it("a configuração não tem campos soltos com o utilizador ou a palavra-passe", () => {
    const config = criarConfiguracao({ url: URL_VALIDA, caCert: CA });
    expect(Object.keys(config).sort()).toEqual(["connectionString", "ssl"]);
  });

  it("esconde utilizador, palavra-passe e anfitrião quando o pg os põe na mensagem de erro", async () => {
    vi.spyOn(pg.Pool.prototype, "query").mockRejectedValue(
      Object.assign(
        new Error(
          `password authentication failed for user "${UTILIZADOR}" em ${ANFITRIAO} (${PALAVRA_PASSE} / ${PALAVRA_PASSE_CODIFICADA}) ${URL_VALIDA}`,
        ),
        { code: "28P01" },
      ),
    );
    const ligacao = criarLigacao({ url: URL_VALIDA, caCert: CA });

    const erro = await ligacao.consultar("SELECT 1").catch((e) => e);
    await ligacao.fechar();

    expect(erro).toBeInstanceOf(ErroLigacaoBD);
    expect(erro.code).toBe("28P01");
    expect(erro.message).toMatch(/password authentication failed/);
    semSegredos([erro.message, String(erro.stack), String(erro.cause)].join("\n"));
  });

  it("a falha de ligação devolve uma mensagem sem dados de acesso e não regista nada que os tenha", async () => {
    // Porta 1 em 127.0.0.1 está fechada: a ligação falha de imediato, sem sair do computador.
    const anfitriao = "127.0.0.1";
    const url = `postgres://${UTILIZADOR}:${PALAVRA_PASSE_CODIFICADA}@${anfitriao}:1/defaultdb`;
    const registos = [];
    for (const metodo of ["log", "info", "warn", "error"]) {
      vi.spyOn(console, metodo).mockImplementation((...args) => registos.push(args.map(String).join(" ")));
    }

    const ligacao = criarLigacao({ url, caCert: CA });
    let erro;
    try {
      await ligacao.consultar("SELECT 1");
    } catch (e) {
      erro = e;
    } finally {
      await ligacao.fechar();
    }

    expect(erro).toBeInstanceOf(ErroLigacaoBD);
    const tudo = [erro.message, String(erro.stack), JSON.stringify(erro), String(erro.cause), ...registos].join("\n");
    semSegredos(tudo);
    expect(tudo).not.toContain(anfitriao);
  });
});
