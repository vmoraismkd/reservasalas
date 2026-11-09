// Só para testes: servidores falsos em localhost (proxy HTTP CONNECT, eco e PostgreSQL com TLS).
import net from "node:net";
import tls from "node:tls";

function arrancar(servidor) {
  const sockets = new Set();
  servidor.on("connection", (s) => {
    sockets.add(s);
    s.on("close", () => sockets.delete(s));
    s.on("error", () => {});
  });
  return new Promise((resolve) => {
    servidor.listen(0, "127.0.0.1", () =>
      resolve({
        porta: servidor.address().port,
        fechar: () =>
          new Promise((r) => {
            for (const s of sockets) s.destroy();
            servidor.close(() => r());
          }),
      }),
    );
  });
}

/** Servidor que devolve tudo o que recebe. */
export function criarServidorEco() {
  return arrancar(net.createServer((s) => s.pipe(s)));
}

/**
 * Proxy HTTP falso. Modos:
 *  aceitar  – responde 200 e liga ao destino pedido
 *  juntos   – como aceitar, mas envia "EXTRA" na mesma escrita do 200
 *  partido  – envia o cabeçalho 200 aos bocados
 *  recusar  – responde 403
 *  mudo     – nunca responde
 *  fechar   – fecha a ligação sem responder
 *  lixo     – responde algo que não é HTTP
 */
export async function criarProxyFalso(modo) {
  const pedidos = [];
  const servidor = net.createServer((cliente) => {
    let recebido = Buffer.alloc(0);
    const aoReceber = (dados) => {
      recebido = Buffer.concat([recebido, dados]);
      const fim = recebido.indexOf("\r\n\r\n");
      if (fim === -1) return;
      cliente.off("data", aoReceber);
      // Sem ouvintes o socket continuaria a ler e os bytes perdiam-se até ao pipe().
      cliente.pause();
      const cabecalho = recebido.subarray(0, fim).toString("latin1");
      const resto = recebido.subarray(fim + 4);
      pedidos.push(cabecalho);
      responder(cliente, cabecalho, resto);
    };
    cliente.on("data", aoReceber);
  });

  function responder(cliente, cabecalho, resto) {
    if (modo === "mudo") return;
    if (modo === "fechar") return cliente.destroy();
    if (modo === "recusar") return cliente.end("HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n");
    if (modo === "lixo") return cliente.end("SSH-2.0-OpenSSH_9.6\r\n\r\n");

    const [, destino] = cabecalho.split("\r\n")[0].split(" ");
    const separador = destino.lastIndexOf(":");
    const anfitriao = destino.slice(0, separador).replace(/^localhost$/, "127.0.0.1");
    const alvo = net.connect(Number(destino.slice(separador + 1)), anfitriao, () => {
      const ok = "HTTP/1.1 200 Connection established\r\nProxy-Agent: falso\r\n\r\n";
      if (modo === "juntos") cliente.write(ok + "EXTRA");
      else if (modo === "partido") {
        cliente.write(ok.slice(0, 5));
        setTimeout(() => cliente.write(ok.slice(5, 20)), 20);
        setTimeout(() => cliente.write(ok.slice(20)), 40);
      } else cliente.write(ok);
      if (resto.length) alvo.write(resto);
      setTimeout(() => {
        cliente.pipe(alvo);
        alvo.pipe(cliente);
      }, modo === "partido" ? 50 : 0);
    });
    alvo.on("error", () => cliente.destroy());
    cliente.on("close", () => alvo.destroy());
  }

  return { ...(await arrancar(servidor)), pedidos };
}

/**
 * PostgreSQL falso: responde "S" ao pedido de SSL e faz o TLS com o certificado dado.
 * Depois do TLS fecha a ligação (não fala o resto do protocolo).
 */
export async function criarPostgresFalso({ cert, key }) {
  const estado = { tlsConcluido: false, pedidosSsl: 0 };
  const servidor = net.createServer((socket) => {
    socket.once("data", (dados) => {
      // Pedido de SSL: 8 bytes, comprimento 8 e o código 80877103.
      if (dados.length >= 8 && dados.readInt32BE(4) === 80877103) {
        estado.pedidosSsl += 1;
        socket.write("S");
        const seguro = new tls.TLSSocket(socket, { isServer: true, cert, key });
        seguro.on("secure", () => {
          estado.tlsConcluido = true;
          seguro.end();
        });
        seguro.on("error", () => socket.destroy());
      } else socket.destroy();
    });
  });
  return { ...(await arrancar(servidor)), estado };
}

/** Porta onde nada está à escuta (o servidor é aberto e logo fechado). */
export async function portaFechada() {
  const { porta, fechar } = await arrancar(net.createServer());
  await fechar();
  return porta;
}
