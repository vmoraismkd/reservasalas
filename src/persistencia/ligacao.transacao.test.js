import { afterEach, describe, expect, it, vi } from "vitest";
import pg from "pg";
import { ErroLigacaoBD, criarLigacao } from "./ligacao.js";

const UTILIZADOR = "utilizadorSecreto";
const PALAVRA_PASSE = "palavraSecreta";
const ANFITRIAO = "pg-exemplo-secreto.aivencloud.com";
const URL = `postgres://${UTILIZADOR}:${PALAVRA_PASSE}@${ANFITRIAO}:12345/defaultdb`;
const CA = "-----BEGIN CERTIFICATE-----\nMIIBfake\n-----END CERTIFICATE-----";

// Cliente falso devolvido por pool.connect(): regista as consultas pela ordem.
function clienteFalso({ falharEm } = {}) {
  const consultas = [];
  return {
    consultas,
    query: vi.fn(async (sql) => {
      consultas.push(sql);
      if (falharEm && sql.includes(falharEm)) {
        throw new Error(`falhou para o utilizador "${UTILIZADOR}" em ${ANFITRIAO} (${PALAVRA_PASSE})`);
      }
      return { rows: [], rowCount: 0 };
    }),
    release: vi.fn(),
    connection: {
      stream: { authorized: true, getProtocol: () => "TLSv1.3", getCipher: () => ({ name: "TLS_AES_256_GCM_SHA384" }) },
    },
  };
}

function ligacaoCom(cliente) {
  vi.spyOn(pg.Pool.prototype, "connect").mockResolvedValue(cliente);
  vi.stubEnv("DATABASE_PROXY", "");
  return criarLigacao({ url: URL, caCert: CA });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("transacaoAnulada", () => {
  it("usa um só cliente: BEGIN, as consultas da função e ROLLBACK no fim", async () => {
    const cliente = clienteFalso();
    const ligacao = ligacaoCom(cliente);

    const valor = await ligacao.transacaoAnulada(async ({ consultar }) => {
      await consultar("SELECT 1");
      await consultar("INSERT INTO x VALUES (1)");
      return "resultado";
    });

    expect(valor).toBe("resultado");
    expect(cliente.consultas).toEqual(["BEGIN", "SELECT 1", "INSERT INTO x VALUES (1)", "ROLLBACK"]);
    expect(cliente.release).toHaveBeenCalledTimes(1);
    await ligacao.fechar();
  });

  it("anula mesmo quando a função falha, e devolve o erro limpo", async () => {
    const cliente = clienteFalso({ falharEm: "DROP" });
    const ligacao = ligacaoCom(cliente);

    const erro = await ligacao
      .transacaoAnulada(async ({ consultar }) => {
        await consultar("DROP TABLE reservas");
      })
      .catch((e) => e);

    expect(cliente.consultas.at(-1)).toBe("ROLLBACK");
    expect(erro).toBeInstanceOf(ErroLigacaoBD);
    for (const segredo of [UTILIZADOR, PALAVRA_PASSE, ANFITRIAO]) expect(erro.message).not.toContain(segredo);
    await ligacao.fechar();
  });

  it("nunca faz COMMIT", async () => {
    const cliente = clienteFalso();
    const ligacao = ligacaoCom(cliente);
    await ligacao.transacaoAnulada(async ({ consultar }) => consultar("SELECT 1"));
    expect(cliente.consultas.join("\n")).not.toMatch(/COMMIT/i);
    await ligacao.fechar();
  });

  it("se o ROLLBACK falhar, o cliente é descartado em vez de voltar ao pool", async () => {
    const cliente = clienteFalso({ falharEm: "ROLLBACK" });
    const ligacao = ligacaoCom(cliente);
    await ligacao.transacaoAnulada(async () => {}).catch(() => {});
    expect(cliente.release).toHaveBeenCalledWith(expect.any(Error));
    await ligacao.fechar();
  });

  it("dá à função o estado do TLS visto pelo cliente", async () => {
    const ligacao = ligacaoCom(clienteFalso());
    const tls = await ligacao.transacaoAnulada(async ({ tls }) => tls);
    expect(tls).toEqual({ protocolo: "TLSv1.3", cifra: "TLS_AES_256_GCM_SHA384", certificadoConfirmado: true });
    await ligacao.fechar();
  });

  it("se nem conseguir ligar, devolve o erro limpo e não tenta consultas", async () => {
    vi.spyOn(pg.Pool.prototype, "connect").mockRejectedValue(new Error(`getaddrinfo ENOTFOUND ${ANFITRIAO}`));
    vi.stubEnv("DATABASE_PROXY", "");
    const ligacao = criarLigacao({ url: URL, caCert: CA });
    const fn = vi.fn();
    const erro = await ligacao.transacaoAnulada(fn).catch((e) => e);
    expect(fn).not.toHaveBeenCalled();
    expect(erro).toBeInstanceOf(ErroLigacaoBD);
    expect(erro.message).not.toContain(ANFITRIAO);
    await ligacao.fechar();
  });
});
