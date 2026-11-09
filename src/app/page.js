import { Suspense } from "react";
import { connection } from "next/server";
import CartaoSala from "../components/CartaoSala";
import { listarSalas } from "../aplicacional/listarSalas.js";
import { obterRepositorio } from "./composicao.js";

const estiloAviso = "rounded-lg border px-4 py-3 text-base";

// As salas vêm da base de dados em cada pedido (caso de uso "Listar salas").
async function ListaDeSalas() {
  // Espera por um pedido real: no "next build" nunca se liga à base de dados.
  await connection();

  let salas;
  try {
    salas = await listarSalas(obterRepositorio());
  } catch (erro) {
    // As mensagens da persistência já vêm sem dados de acesso; o detalhe fica no registo do servidor.
    console.error("Não foi possível carregar as salas:", erro.message);
    return (
      <p
        role="alert"
        className={`${estiloAviso} border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300`}
      >
        Não foi possível carregar as salas. Tente novamente mais tarde.
      </p>
    );
  }

  if (salas.length === 0) {
    return (
      <p className={`${estiloAviso} border-zinc-200 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400`}>
        Ainda não há salas para reservar.
      </p>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4">
      {salas.map((sala) => (
        <CartaoSala key={sala.id} id={sala.id} nome={sala.nome} capacidade={sala.capacidade} />
      ))}
    </ul>
  );
}

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
          Reserva de Salas
        </h1>
        <p className="mt-1 text-base text-zinc-600 dark:text-zinc-400">
          Escolha uma sala e indique quando a quer usar.
        </p>
      </header>
      <Suspense fallback={<p className="text-base text-zinc-600 dark:text-zinc-400">A carregar as salas…</p>}>
        <ListaDeSalas />
      </Suspense>
    </main>
  );
}
