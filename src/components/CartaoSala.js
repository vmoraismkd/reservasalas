export default function CartaoSala({ nome, capacidade }) {
  return (
    <li className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{nome}</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Capacidade: {capacidade} {capacidade === 1 ? "pessoa" : "pessoas"}
        </p>
      </div>
      <button
        type="button"
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Reservar
      </button>
    </li>
  );
}
