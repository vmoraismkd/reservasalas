// Túnel por um proxy HTTP (método CONNECT), para redes que não deixam ligar diretamente ao Aiven.
// O pg usa-o no lugar de um socket TCP: chama connect(porta, anfitrião), espera pelo evento
// "connect" e depois faz o TLS por cima dele. O proxy só vê bytes cifrados.
import net from "node:net";
import { Duplex } from "node:stream";

export class ErroProxy extends Error {
  constructor(mensagem, code) {
    super(mensagem);
    this.name = "ErroProxy";
    this.code = code;
  }
}

const LIMITE_CABECALHO = 16 * 1024;
const RESPOSTA_INVALIDA = "O proxy respondeu algo que não é HTTP ao pedido de túnel. Confirme o DATABASE_PROXY.";

export class TunelProxy extends Duplex {
  #proxy;
  #tempoLimiteMs;
  #socket = null;
  #aberto = false;
  #pendentes = [];

  /** @param {{ anfitriao: string, porta: number, tempoLimiteMs?: number }} proxy */
  constructor({ anfitriao, porta, tempoLimiteMs = 8000 }) {
    super({ allowHalfOpen: false });
    this.#proxy = { anfitriao, porta };
    this.#tempoLimiteMs = tempoLimiteMs;
  }

  get connecting() {
    return !this.#aberto && !this.destroyed;
  }

  /** Abre o túnel até anfitriao:porta. Emite "connect" quando o proxy responde 200. */
  connect(porta, anfitriao) {
    const destino = `${anfitriao.includes(":") ? `[${anfitriao}]` : anfitriao}:${porta}`;
    const socket = net.connect(this.#proxy.porta, this.#proxy.anfitriao);
    this.#socket = socket;
    for (const [metodo, args] of this.#pendentes) socket[metodo](...args);
    this.#pendentes = [];

    let ligadoAoProxy = false;
    let recebido = Buffer.alloc(0);

    const parar = () => {
      clearTimeout(temporizador);
      socket.off("connect", aoLigar);
      socket.off("data", aoReceber);
      socket.off("error", aoErro);
      socket.off("close", aoFechar);
    };
    const falhar = (mensagem, code) => {
      parar();
      socket.destroy();
      this.destroy(new ErroProxy(mensagem, code));
    };

    const temporizador = setTimeout(
      () =>
        falhar(
          `O proxy não respondeu ao pedido de túnel em ${Math.round(this.#tempoLimiteMs / 100) / 10} s. Confirme o DATABASE_PROXY e a rede.`,
          "PROXY_SEM_RESPOSTA",
        ),
      this.#tempoLimiteMs,
    );

    const aoLigar = () => {
      ligadoAoProxy = true;
      socket.write(`CONNECT ${destino} HTTP/1.1\r\nHost: ${destino}\r\n\r\n`);
    };

    const aoErro = (erro) => {
      if (ligadoAoProxy) {
        falhar(`O proxy fechou a ligação antes de abrir o túnel (${erro.code ?? "erro de rede"}).`, "PROXY_FECHOU");
      } else {
        falhar(
          `Não foi possível ligar ao proxy (${erro.code ?? "erro de rede"}). Confirme o DATABASE_PROXY e a rede.`,
          "PROXY_INACESSIVEL",
        );
      }
    };

    const aoFechar = () => falhar("O proxy fechou a ligação antes de abrir o túnel.", "PROXY_FECHOU");

    const aoReceber = (dados) => {
      recebido = Buffer.concat([recebido, dados]);
      if (recebido.length >= 5 && recebido.subarray(0, 5).toString("latin1") !== "HTTP/") {
        return falhar(RESPOSTA_INVALIDA, "PROXY_RESPOSTA_INVALIDA");
      }
      const fim = recebido.indexOf("\r\n\r\n");
      if (fim === -1) {
        if (recebido.length > LIMITE_CABECALHO) falhar(RESPOSTA_INVALIDA, "PROXY_RESPOSTA_INVALIDA");
        return;
      }

      const linha = recebido.subarray(0, recebido.indexOf("\r\n")).toString("latin1");
      const estado = /^HTTP\/1\.[01] (\d{3})(?: (.*))?$/.exec(linha);
      if (!estado) return falhar(RESPOSTA_INVALIDA, "PROXY_RESPOSTA_INVALIDA");
      if (estado[1] !== "200") {
        const motivo = estado[2] ? ` ${estado[2].trim()}` : "";
        return falhar(`O proxy recusou abrir o túnel para a base de dados (HTTP ${estado[1]}${motivo}).`, "PROXY_RECUSOU");
      }

      // Túnel aberto: daqui em diante é um socket normal até ao destino.
      parar();
      this.#aberto = true;
      socket.on("data", (d) => {
        if (!this.push(d)) socket.pause();
      });
      socket.on("end", () => this.push(null));
      socket.on("error", (erro) => this.destroy(erro));
      socket.on("close", () => {
        if (!this.destroyed) this.destroy();
      });
      this.emit("connect");
      // Bytes que vieram na mesma leitura que a resposta 200 já são do destino.
      const resto = recebido.subarray(fim + 4);
      if (resto.length) this.push(resto);
    };

    socket.once("connect", aoLigar);
    socket.on("data", aoReceber);
    socket.on("error", aoErro);
    socket.on("close", aoFechar);
    return this;
  }

  _read() {
    if (this.#aberto) this.#socket.resume();
  }

  _write(dados, codificacao, feito) {
    if (!this.#aberto) return feito(new ErroProxy("O túnel do proxy ainda não está aberto.", "PROXY_NAO_ABERTO"));
    this.#socket.write(dados, codificacao, feito);
  }

  _final(feito) {
    this.#socket?.end();
    feito();
  }

  _destroy(erro, feito) {
    // Como num socket TCP, o "close" só acontece depois de a ligação fechar de facto.
    // Se fosse imediato, o pg veria o "close" antes do erro de certificado do TLS
    // e mostraria "Connection terminated unexpectedly" em vez do motivo real.
    const socket = this.#socket;
    if (socket && !socket.closed) {
      socket.once("close", () => feito(erro));
      socket.destroy();
    } else {
      feito(erro);
    }
  }

  // Métodos de socket que o pg chama; antes de connect() ficam guardados.
  #aplicar(metodo, args) {
    if (this.#socket) this.#socket[metodo](...args);
    else this.#pendentes.push([metodo, args]);
    return this;
  }

  setNoDelay(...args) {
    return this.#aplicar("setNoDelay", args);
  }

  setKeepAlive(...args) {
    return this.#aplicar("setKeepAlive", args);
  }

  ref() {
    return this.#aplicar("ref", []);
  }

  unref() {
    return this.#aplicar("unref", []);
  }
}
