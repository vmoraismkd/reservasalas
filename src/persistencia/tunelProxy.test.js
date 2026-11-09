import { afterEach, describe, expect, it } from "vitest";
import { ErroProxy, TunelProxy } from "./tunelProxy.js";
import { criarProxyFalso, criarServidorEco, portaFechada } from "./__testes__/servidoresFalsos.js";

const aFechar = [];
afterEach(async () => {
  while (aFechar.length) await aFechar.pop()();
});

async function servidores(modo) {
  const eco = await criarServidorEco();
  const proxy = await criarProxyFalso(modo);
  aFechar.push(eco.fechar, proxy.fechar);
  return { eco, proxy };
}

// Abre o túnel como o pg faz: connect(porta, anfitrião) e espera pelo evento "connect".
function abrir(tunel, porta, anfitriao = "localhost") {
  return new Promise((resolve, reject) => {
    tunel.once("connect", () => resolve(tunel));
    tunel.once("error", reject);
    tunel.connect(porta, anfitriao);
  });
}

function proximosDados(tunel) {
  return new Promise((resolve) => tunel.once("data", (d) => resolve(d.toString())));
}

function erroAoAbrir(tunel, porta) {
  let ligou = false;
  tunel.once("connect", () => (ligou = true));
  return abrir(tunel, porta).then(
    () => {
      throw new Error("o túnel não devia ter aberto");
    },
    (erro) => ({ erro, ligou }),
  );
}

describe("TunelProxy", () => {
  it("túnel aceite: pede CONNECT anfitrião:porta e depois os dados passam nos dois sentidos", async () => {
    const { eco, proxy } = await servidores("aceitar");
    const tunel = new TunelProxy({ anfitriao: "127.0.0.1", porta: proxy.porta });
    aFechar.push(async () => tunel.destroy());

    await abrir(tunel, eco.porta);
    expect(proxy.pedidos[0].split("\r\n")).toEqual(
      expect.arrayContaining([`CONNECT localhost:${eco.porta} HTTP/1.1`, `Host: localhost:${eco.porta}`]),
    );

    const resposta = proximosDados(tunel);
    tunel.write("olá através do túnel");
    expect(await resposta).toBe("olá através do túnel");
  });

  it("aceita os métodos de socket que o pg chama (setNoDelay, setKeepAlive, ref, unref)", async () => {
    const { eco, proxy } = await servidores("aceitar");
    const tunel = new TunelProxy({ anfitriao: "127.0.0.1", porta: proxy.porta });
    aFechar.push(async () => tunel.destroy());
    tunel.setNoDelay(true); // o pg chama antes de connect
    await abrir(tunel, eco.porta);
    expect(() => {
      tunel.setKeepAlive(true, 0);
      tunel.unref();
      tunel.ref();
    }).not.toThrow();
  });

  it("não perde os bytes que chegam juntos com a resposta 200", async () => {
    const { eco, proxy } = await servidores("juntos");
    const tunel = new TunelProxy({ anfitriao: "127.0.0.1", porta: proxy.porta });
    aFechar.push(async () => tunel.destroy());
    const primeiros = proximosDados(tunel);
    await abrir(tunel, eco.porta);
    expect(await primeiros).toBe("EXTRA");
  });

  it("junta a resposta do proxy quando chega aos bocados", async () => {
    const { eco, proxy } = await servidores("partido");
    const tunel = new TunelProxy({ anfitriao: "127.0.0.1", porta: proxy.porta });
    aFechar.push(async () => tunel.destroy());
    await abrir(tunel, eco.porta);
    const resposta = proximosDados(tunel);
    tunel.write("depois do cabeçalho partido");
    expect(await resposta).toBe("depois do cabeçalho partido");
  });

  it("proxy recusa (403): erro claro e o túnel nunca abre", async () => {
    const { eco, proxy } = await servidores("recusar");
    const { erro, ligou } = await erroAoAbrir(new TunelProxy({ anfitriao: "127.0.0.1", porta: proxy.porta }), eco.porta);
    expect(ligou).toBe(false);
    expect(erro).toBeInstanceOf(ErroProxy);
    expect(erro.code).toBe("PROXY_RECUSOU");
    expect(erro.message).toMatch(/recusou/);
    expect(erro.message).toMatch(/403/);
  });

  it("proxy sem resposta: erro ao fim do tempo limite", async () => {
    const { eco, proxy } = await servidores("mudo");
    const tunel = new TunelProxy({ anfitriao: "127.0.0.1", porta: proxy.porta, tempoLimiteMs: 200 });
    const { erro } = await erroAoAbrir(tunel, eco.porta);
    expect(erro.code).toBe("PROXY_SEM_RESPOSTA");
    expect(erro.message).toMatch(/não respondeu/);
  });

  it("proxy fecha a ligação sem responder: erro claro", async () => {
    const { eco, proxy } = await servidores("fechar");
    const { erro } = await erroAoAbrir(new TunelProxy({ anfitriao: "127.0.0.1", porta: proxy.porta }), eco.porta);
    expect(erro.code).toBe("PROXY_FECHOU");
    expect(erro.message).toMatch(/fechou/);
  });

  it("proxy responde algo que não é HTTP: erro claro", async () => {
    const { eco, proxy } = await servidores("lixo");
    const { erro } = await erroAoAbrir(new TunelProxy({ anfitriao: "127.0.0.1", porta: proxy.porta }), eco.porta);
    expect(erro.code).toBe("PROXY_RESPOSTA_INVALIDA");
  });

  it("proxy inacessível: erro claro", async () => {
    const porta = await portaFechada();
    const { erro } = await erroAoAbrir(new TunelProxy({ anfitriao: "127.0.0.1", porta }), 5432);
    expect(erro.code).toBe("PROXY_INACESSIVEL");
    expect(erro.message).toMatch(/proxy/);
  });

  it("as mensagens de erro estão em português e não mostram endereços", async () => {
    const { eco, proxy } = await servidores("recusar");
    const { erro } = await erroAoAbrir(new TunelProxy({ anfitriao: "127.0.0.1", porta: proxy.porta }), eco.porta);
    expect(erro.message).not.toMatch(/127\.0\.0\.1|localhost|:\d{4,5}/);
  });
});
