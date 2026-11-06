"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { reservarSalaAction } from "../app/actions";

// text-base (16px) evita o zoom automático do iPhone ao tocar num campo.
const estiloCampo =
  "min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:border-zinc-50 dark:focus:ring-zinc-50/20";
const estiloRotulo = "block space-y-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300";

const estadoInicial = { sucesso: null, erro: "" };

export default function FormularioReserva({ salaId, nomeSala, onFechar }) {
  const dialogo = useRef(null);
  // A reserva é feita no servidor (Server Action); aqui só se envia o formulário e se mostra o resultado.
  const [estado, enviar, aEnviar] = useActionState(reservarSalaAction, estadoInicial);
  // Campos controlados: o React limpa o formulário depois de cada envio, e assim o que o
  // utilizador escreveu não se perde quando a reserva é recusada.
  const [valores, setValores] = useState({ data: "", inicio: "", fim: "" });
  const aoMudar = (e) => setValores((v) => ({ ...v, [e.target.name]: e.target.value }));

  // showModal dá o fundo escurecido, o foco preso no formulário e o fecho com Esc.
  useEffect(() => {
    dialogo.current.showModal();
  }, []);

  useEffect(() => {
    if (estado.sucesso) dialogo.current.close();
  }, [estado]);

  return (
    <dialog
      ref={dialogo}
      onClose={onFechar}
      aria-labelledby="titulo-reserva"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-5 text-zinc-900 shadow-2xl backdrop:bg-black/50 sm:p-6 dark:bg-zinc-900 dark:text-zinc-50"
    >
      <form action={enviar} className="space-y-5">
        <input type="hidden" name="salaId" value={salaId} />
        <div>
          <h2 id="titulo-reserva" className="text-xl font-semibold">
            Reservar sala
          </h2>
          <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">{nomeSala}</p>
        </div>

        <label className={estiloRotulo}>
          <span>Data da reserva</span>
          <input type="date" name="data" required value={valores.data} onChange={aoMudar} className={estiloCampo} />
        </label>

        <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 min-[360px]:gap-3">
          <label className={estiloRotulo}>
            <span>Hora de início</span>
            <input type="time" name="inicio" required value={valores.inicio} onChange={aoMudar} className={estiloCampo} />
          </label>
          <label className={estiloRotulo}>
            <span>Hora de fim</span>
            <input type="time" name="fim" required value={valores.fim} onChange={aoMudar} className={estiloCampo} />
          </label>
        </div>

        <p className="-mt-2 text-sm text-zinc-500 dark:text-zinc-400">Horas de Lisboa. Cada reserva dura no máximo 2 horas.</p>

        {estado.erro && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
          >
            {estado.erro}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => dialogo.current.close()}
            className="min-h-11 rounded-lg border border-zinc-300 px-4 text-base font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={aEnviar}
            className="min-h-11 rounded-lg bg-zinc-900 px-4 text-base font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {aEnviar ? "A reservar…" : "Confirmar"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
