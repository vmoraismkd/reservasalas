import { Suspense } from "react";
import { connection } from "next/server";
import CartaoReserva from "../../components/CartaoReserva";
import { listarReservas } from "../../aplicacional/listarReservas.js";
import { listarSalas } from "../../aplicacional/listarSalas.js";
import { obterRepositorio } from "../composicao.js";
import { utcParaLisboa } from "../horaLisboa.js";

export const metadata = {
  title: "As minhas reservas · Reserva de Salas",
};

const estiloAviso = "rounded-lg border px-4 py-3 text-base";

// As reservas vêm da base de dados em cada pedido (casos de uso "Listar reservas" e "Listar salas").
// Ainda não há identificação de utilizadores: aparecem todas as reservas.
async function ListaDeReservas() {
  // Espera por um pedido real: no "next build" nunca se liga à base de dados.
  await connection();

  let reservas;
  let salas;
  try {
    const repositorio = obterRepositorio();
    [reservas, salas] = await Promise.all([listarReservas(repositorio), listarSalas(repositorio)]);
  } catch (erro) {
    // As mensagens da persistência já vêm sem dados de acesso; o detalhe fica no registo do servidor.
    console.error("Não foi possível carregar as reservas:", erro.message);
    return (
      <p
        role="alert"
        className={`${estiloAviso} border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300`}
      >
        Não foi possível carregar as reservas. Tente novamente mais tarde.
      </p>
    );
  }

  if (reservas.length === 0) {
    return (
      <p className={`${estiloAviso} border-zinc-200 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400`}>
        Ainda não há reservas.
      </p>
    );
  }

  // As reservas só têm o id da sala; o nome vem da lista de salas.
  const nomeDaSala = new Map(salas.map((sala) => [sala.id, sala.nome]));

  return (
    <ul className="grid gap-3 sm:gap-4">
      {reservas.map((reserva) => {
        // Instantes em UTC mostrados em hora de Lisboa.
        const inicio = utcParaLisboa(reserva.inicio);
        const fim = utcParaLisboa(reserva.fim);
        return (
          <CartaoReserva
            key={reserva.id}
            nomeSala={nomeDaSala.get(reserva.salaId) ?? "Sala desconhecida"}
            data={inicio.data}
            inicio={inicio.hora}
            fim={fim.hora}
          />
        );
      })}
    </ul>
  );
}

export default function MinhasReservas() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
          As minhas reservas
        </h1>
        <p className="mt-1 text-base text-zinc-600 dark:text-zinc-400">Todas as reservas marcadas (horas de Lisboa).</p>
      </header>
      <Suspense fallback={<p className="text-base text-zinc-600 dark:text-zinc-400">A carregar as reservas…</p>}>
        <ListaDeReservas />
      </Suspense>
    </main>
  );
}
