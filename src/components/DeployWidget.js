"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const CHAVE_POSICAO = "deploy-widget-posicao";
const TAMANHO = 96;
const LIMIAR_ARRASTO = 5;
const INTERVALO_ESTADO = 15_000;

function limitarAoEcra({ x, y }) {
  return {
    x: Math.min(Math.max(0, x), window.innerWidth - TAMANHO),
    y: Math.min(Math.max(0, y), window.innerHeight - TAMANHO),
  };
}

async function lerEstado() {
  try {
    const resposta = await fetch("/api/deploy", { cache: "no-store" });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(dados.erro ?? `HTTP ${resposta.status}`);
    return { pendente: dados.pendente, erro: "" };
  } catch (e) {
    return { pendente: true, erro: e.message };
  }
}

function DeployWidget() {
  const contentor = useRef(null);
  const posicao = useRef(null);
  const arrasto = useRef(null);
  const arrastou = useRef(false);

  const [pendente, setPendente] = useState(true);
  const [erroEstado, setErroEstado] = useState("");
  const [painel, setPainel] = useState(null);
  const [mensagem, setMensagem] = useState("WIP: sessão em curso");
  const [envio, setEnvio] = useState({ tipo: "parado", texto: "" });

  // A posição é aplicada diretamente ao DOM para não re-renderizar a cada movimento do rato.
  const aplicarPosicao = useCallback((nova) => {
    posicao.current = limitarAoEcra(nova);
    const estilo = contentor.current.style;
    estilo.left = `${posicao.current.x}px`;
    estilo.top = `${posicao.current.y}px`;
    estilo.right = "auto";
    estilo.bottom = "auto";
  }, []);

  const atualizarEstado = useCallback(
    () =>
      lerEstado().then(({ pendente, erro }) => {
        setPendente(pendente);
        setErroEstado(erro);
      }),
    [],
  );

  useEffect(() => {
    try {
      const guardada = JSON.parse(localStorage.getItem(CHAVE_POSICAO));
      if (Number.isFinite(guardada?.x) && Number.isFinite(guardada?.y)) aplicarPosicao(guardada);
    } catch {}

    const aoRedimensionar = () => posicao.current && aplicarPosicao(posicao.current);
    window.addEventListener("resize", aoRedimensionar);
    return () => window.removeEventListener("resize", aoRedimensionar);
  }, [aplicarPosicao]);

  useEffect(() => {
    atualizarEstado();
    const id = setInterval(atualizarEstado, INTERVALO_ESTADO);
    return () => clearInterval(id);
  }, [atualizarEstado]);

  function aoPressionar(e) {
    if (e.button !== 0) return;
    const r = contentor.current.getBoundingClientRect();
    arrasto.current = {
      inicioX: e.clientX,
      inicioY: e.clientY,
      desvioX: e.clientX - r.left,
      desvioY: e.clientY - r.top,
      moveu: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function aoMover(e) {
    const a = arrasto.current;
    if (!a) return;
    if (!a.moveu && Math.hypot(e.clientX - a.inicioX, e.clientY - a.inicioY) < LIMIAR_ARRASTO) return;
    a.moveu = true;
    aplicarPosicao({ x: e.clientX - a.desvioX, y: e.clientY - a.desvioY });
  }

  function aoLargar() {
    const a = arrasto.current;
    arrasto.current = null;
    if (!a?.moveu) return;
    arrastou.current = true;
    try {
      localStorage.setItem(CHAVE_POSICAO, JSON.stringify(posicao.current));
    } catch {}
  }

  function aoClicar() {
    // O click chega também no fim de um arrasto; esse não abre o painel.
    if (arrastou.current) {
      arrastou.current = false;
      return;
    }
    if (painel) {
      setPainel(null);
      return;
    }
    const r = contentor.current.getBoundingClientRect();
    setPainel({
      paraCima: r.top > window.innerHeight / 2,
      paraEsquerda: r.left > window.innerWidth / 2,
    });
  }

  async function commitPush() {
    setEnvio({ tipo: "a-correr", texto: "A correr…" });
    try {
      const resposta = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagem }),
      });
      const dados = await resposta.json().catch(() => ({}));
      if (!resposta.ok) throw new Error(dados.erro ?? `HTTP ${resposta.status}`);
      setEnvio({
        tipo: "sucesso",
        texto: dados.commit ? "Commit e push concluídos." : "Nada para commit; push concluído.",
      });
    } catch (e) {
      setEnvio({ tipo: "erro", texto: e.message });
    } finally {
      atualizarEstado();
    }
  }

  const corEnvio = {
    parado: "text-gray-500",
    "a-correr": "text-amber-600",
    sucesso: "text-green-700",
    erro: "text-red-700",
  }[envio.tipo];

  return (
    <div ref={contentor} className="fixed bottom-4 right-4 z-50" style={{ width: TAMANHO, height: TAMANHO }}>
      <button
        type="button"
        onPointerDown={aoPressionar}
        onPointerMove={aoMover}
        onPointerUp={aoLargar}
        onPointerCancel={aoLargar}
        onClick={aoClicar}
        title={pendente ? "Há alterações por enviar" : "Tudo enviado"}
        className={`relative flex h-full w-full cursor-grab touch-none select-none items-center justify-center rounded-full text-center text-sm font-semibold leading-tight text-white shadow-lg active:cursor-grabbing ${
          pendente ? "bg-gray-500" : "bg-green-600"
        }`}
      >
        Deploy
        <br />
        ONLINE
        {pendente && (
          <span className="absolute right-2 top-2 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
          </span>
        )}
      </button>

      {painel && (
        <div
          className={`absolute w-72 space-y-2 rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-900 shadow-xl ${
            painel.paraCima ? "bottom-full mb-2" : "top-full mt-2"
          } ${painel.paraEsquerda ? "right-0" : "left-0"}`}
        >
          <label className="block text-xs font-medium text-gray-600" htmlFor="deploy-mensagem">
            Mensagem do commit
          </label>
          <input
            id="deploy-mensagem"
            type="text"
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1"
          />
          <button
            type="button"
            onClick={commitPush}
            disabled={envio.tipo === "a-correr" || !mensagem.trim()}
            className="w-full rounded bg-gray-900 px-3 py-1.5 font-medium text-white disabled:opacity-50"
          >
            Commit + Push
          </button>
          {envio.tipo !== "parado" && (
            <p className={`whitespace-pre-wrap break-words text-xs ${corEnvio}`}>{envio.texto}</p>
          )}
          {erroEstado && (
            <p className="whitespace-pre-wrap break-words text-xs text-red-700">Estado: {erroEstado}</p>
          )}
        </div>
      )}
    </div>
  );
}

// Em produção o código do widget fica fora do bundle do browser.
export default process.env.NODE_ENV === "development" ? DeployWidget : () => null;
