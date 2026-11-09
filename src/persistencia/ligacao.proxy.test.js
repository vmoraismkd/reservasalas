import { afterEach, describe, expect, it, vi } from "vitest";
import { ErroLigacaoBD, criarConfiguracao, criarLigacao } from "./ligacao.js";
import { TunelProxy } from "./tunelProxy.js";
import { CERT_OUTRO, CERT_SERVIDOR, CHAVE_SERVIDOR } from "./__testes__/certificadosTeste.js";
import { criarPostgresFalso, criarProxyFalso } from "./__testes__/servidoresFalsos.js";

const URL_AIVEN = "postgres://utilizador:segredo@pg-exemplo.aivencloud.com:12345/defaultdb";
const CA = CERT_SERVIDOR;

const aFechar = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  while (aFechar.length) await aFechar.pop()();
});

function erroDe(funcao) {
  try {
    funcao();
  } catch (erro) {
    return erro;
  }
  throw new Error("era esperado um erro");
}

describe("criarConfiguracao com DATABASE_PROXY", () => {
  it("sem DATABASE_PROXY a configuração fica exatamente como antes (sem stream)", () => {
    vi.stubEnv("DATABASE_PROXY", "");
    const config = criarConfiguracao({ url: URL_AIVEN, caCert: CA });
    expect(Object.keys(config).sort()).toEqual(["connectionString", "ssl"]);
  });

  it("com DATABASE_PROXY entrega ao pg uma função que cria um túnel novo por ligação", () => {
    vi.stubEnv("DATABASE_PROXY", "http://192.168.0.205:3128/");
    const config = criarConfiguracao({ url: URL_AIVEN, caCert: CA });
    expect(typeof config.stream).toBe("function");
    const a = config.stream();
    const b = config.stream();
    expect(a).toBeInstanceOf(TunelProxy);
    expect(b).not.toBe(a);
    a.destroy();
    b.destroy();
  });

  it("o TLS e a verificação do certificado não mudam com o proxy", () => {
    const config = criarConfiguracao({ url: URL_AIVEN, caCert: CA, proxy: "192.168.0.205:3128" });
    expect(config.ssl).toEqual({ ca: CA, rejectUnauthorized: true });
  });

  it.each(["http://192.168.0.205:3128/", "http://192.168.0.205:3128", "192.168.0.205:3128", "  proxy.empresa.pt:8080  "])(
    "aceita o proxy %s",
    (proxy) => {
      expect(() => criarConfiguracao({ url: URL_AIVEN, caCert: CA, proxy })).not.toThrow();
    },
  );

  it.each([
    ["sem porta", "http://192.168.0.205"],
    ["https://", "https://192.168.0.205:3128"],
    ["outro protocolo", "socks5://192.168.0.205:1080"],
    ["porta inválida", "192.168.0.205:porta"],
    ["texto solto", "isto não é um proxy"],
  ])("recusa o proxy %s com uma mensagem clara", (_, proxy) => {
    const erro = erroDe(() => criarConfiguracao({ url: URL_AIVEN, caCert: CA, proxy }));
    expect(erro).toBeInstanceOf(ErroLigacaoBD);
    expect(erro.message).toMatch(/DATABASE_PROXY/);
  });

  it("recusa proxy com utilizador e palavra-passe sem os mostrar", () => {
    const erro = erroDe(() => criarConfiguracao({ url: URL_AIVEN, caCert: CA, proxy: "http://ana:Segredo123@192.168.0.205:3128" }));
    expect(erro).toBeInstanceOf(ErroLigacaoBD);
    expect(erro.message).not.toMatch(/ana|Segredo123/);
  });
});

describe("ligação pelo proxy até um PostgreSQL com TLS (servidores falsos em localhost)", () => {
  async function montar(modoProxy = "aceitar") {
    const pg = await criarPostgresFalso({ cert: CERT_SERVIDOR, key: CHAVE_SERVIDOR });
    const proxy = await criarProxyFalso(modoProxy);
    aFechar.push(pg.fechar, proxy.fechar);
    return { pg, proxy, url: `postgres://utilizador:segredo@localhost:${pg.porta}/defaultdb` };
  }

  async function tentar(ligacao) {
    try {
      await ligacao.consultar("SELECT 1");
      return null;
    } catch (erro) {
      return erro;
    } finally {
      await ligacao.fechar();
    }
  }

  it("o TLS faz-se por cima do túnel e o certificado é verificado com o CA certo", async () => {
    const { pg, proxy, url } = await montar();
    const erro = await tentar(criarLigacao({ url, caCert: CERT_SERVIDOR, proxy: `127.0.0.1:${proxy.porta}` }));

    expect(proxy.pedidos[0]).toMatch(new RegExp(`^CONNECT localhost:${pg.porta} HTTP/1.1`));
    expect(pg.estado.pedidosSsl).toBe(1);
    expect(pg.estado.tlsConcluido).toBe(true);
    // O servidor falso fecha depois do TLS: o erro que sobra não pode ser de certificado.
    expect(erro?.message ?? "").not.toMatch(/certificado|certificate/i);
  });

  it("erro de certificado por cima do túnel: com outro CA a ligação é recusada", async () => {
    const { pg, proxy, url } = await montar();
    const erro = await tentar(criarLigacao({ url, caCert: CERT_OUTRO, proxy: `127.0.0.1:${proxy.porta}` }));

    expect(pg.estado.pedidosSsl).toBe(1);
    expect(pg.estado.tlsConcluido).toBe(false);
    expect(erro).toBeInstanceOf(ErroLigacaoBD);
    expect(erro.message).toMatch(/certificado/);
    expect(erro.message).toMatch(/DATABASE_CA_CERT/);
  });

  it("se o proxy recusar, o erro da ligação explica-o em português", async () => {
    const { url, proxy } = await montar("recusar");
    const erro = await tentar(criarLigacao({ url, caCert: CERT_SERVIDOR, proxy: `127.0.0.1:${proxy.porta}` }));
    expect(erro).toBeInstanceOf(ErroLigacaoBD);
    expect(erro.code).toBe("PROXY_RECUSOU");
    expect(erro.message).toMatch(/proxy recusou/);
    expect(erro.message).not.toMatch(/segredo|utilizador/);
  });

  it("criarLigacao lê o DATABASE_PROXY do ambiente (como faz o npm run migrar)", async () => {
    const { pg, proxy, url } = await montar();
    vi.stubEnv("DATABASE_PROXY", `http://127.0.0.1:${proxy.porta}/`);
    await tentar(criarLigacao({ url, caCert: CERT_SERVIDOR }));
    expect(proxy.pedidos).toHaveLength(1);
    expect(pg.estado.tlsConcluido).toBe(true);
  });
});
