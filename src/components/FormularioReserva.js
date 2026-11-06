"use client";

import { useEffect, useRef } from "react";

// text-base (16px) evita o zoom automático do iPhone ao tocar num campo.
const estiloCampo =
  "min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:border-zinc-50 dark:focus:ring-zinc-50/20";
const estiloRotulo = "block space-y-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300";

export default function FormularioReserva({ nomeSala, onFechar }) {
  const dialogo = useRef(null);

  // showModal dá o fundo escurecido, o foco preso no formulário e o fecho com Esc.
  useEffect(() => {
    dialogo.current.showModal();
  }, []);

  function aoSubmeter(e) {
    e.preventDefault();
    // Ainda não guarda nada: só fecha.
    dialogo.current.close();
  }

  return (
    <dialog
      ref={dialogo}
      onClose={onFechar}
      aria-labelledby="titulo-reserva"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-5 text-zinc-900 shadow-2xl backdrop:bg-black/50 sm:p-6 dark:bg-zinc-900 dark:text-zinc-50"
    >
      <form onSubmit={aoSubmeter} className="space-y-5">
        <div>
          <h2 id="titulo-reserva" className="text-xl font-semibold">
            Reservar sala
          </h2>
          <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">{nomeSala}</p>
        </div>

        <label className={estiloRotulo}>
          <span>Data da reserva</span>
          <input type="date" name="data" required className={estiloCampo} />
        </label>

        <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 min-[360px]:gap-3">
          <label className={estiloRotulo}>
            <span>Hora de início</span>
            <input type="time" name="inicio" required className={estiloCampo} />
          </label>
          <label className={estiloRotulo}>
            <span>Hora de fim</span>
            <input type="time" name="fim" required className={estiloCampo} />
          </label>
        </div>

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
            className="min-h-11 rounded-lg bg-zinc-900 px-4 text-base font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Confirmar
          </button>
        </div>
      </form>
    </dialog>
  );
}
