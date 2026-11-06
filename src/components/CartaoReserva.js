// A data vem como "AAAA-MM-DD"; formatar em UTC evita que o fuso horário mude o dia.
function formatarData(data) {
  return new Date(`${data}T00:00:00Z`).toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function CartaoReserva({ nomeSala, data, inicio, fim }) {
  return (
    <li className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-900">
      <div className="min-w-0">
        <h2 className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-50">{nomeSala}</h2>
        <p className="mt-1 text-sm text-zinc-600 first-letter:uppercase dark:text-zinc-400">
          <time dateTime={data}>{formatarData(data)}</time>
        </p>
        <p className="mt-0.5 text-base font-medium text-zinc-800 dark:text-zinc-200">
          <time dateTime={inicio}>{inicio}</time> – <time dateTime={fim}>{fim}</time>
        </p>
      </div>
      <button
        type="button"
        className="min-h-11 w-full rounded-lg border border-red-300 px-4 text-base font-medium text-red-700 transition-colors hover:bg-red-50 sm:w-auto dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
      >
        Cancelar
      </button>
    </li>
  );
}
