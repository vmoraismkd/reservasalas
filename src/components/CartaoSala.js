"use client";

import { useState } from "react";
import FormularioReserva from "./FormularioReserva";

export default function CartaoSala({ nome, capacidade }) {
  const [formularioAberto, setFormularioAberto] = useState(false);

  return (
    <li className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="min-w-0">
        <h2 className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-50">{nome}</h2>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
            <path d="M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.5 1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.6 15.6A6 6 0 0 1 12.4 15a.9.9 0 0 1-.8 1.4H2.4a.9.9 0 0 1-.8-.8Zm12.6.8h3.4a.8.8 0 0 0 .8-1 4.5 4.5 0 0 0-6-3.1 7.4 7.4 0 0 1 1.8 4.1Z" />
          </svg>
          Capacidade: {capacidade} {capacidade === 1 ? "pessoa" : "pessoas"}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setFormularioAberto(true)}
        className="min-h-11 w-full rounded-lg bg-zinc-900 px-4 text-base font-medium text-white transition-colors hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus-visible:outline-zinc-50"
      >
        Reservar
      </button>
      {formularioAberto && (
        <FormularioReserva nomeSala={nome} onFechar={() => setFormularioAberto(false)} />
      )}
    </li>
  );
}
