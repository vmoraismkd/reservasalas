import CartaoReserva from "../../components/CartaoReserva";

export const metadata = {
  title: "As minhas reservas · Reserva de Salas",
};

// Dados de exemplo até existir a camada de persistência.
const reservas = [
  { id: 1, nomeSala: "Sala Atlântico", data: "2026-11-10", inicio: "09:00", fim: "10:30" },
  { id: 2, nomeSala: "Sala Douro", data: "2026-11-12", inicio: "14:00", fim: "15:00" },
  { id: 3, nomeSala: "Sala Tejo", data: "2026-11-18", inicio: "10:00", fim: "12:30" },
];

export default function MinhasReservas() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
          As minhas reservas
        </h1>
        <p className="mt-1 text-base text-zinc-600 dark:text-zinc-400">Reservas marcadas em seu nome.</p>
      </header>
      <ul className="grid gap-3 sm:gap-4">
        {reservas.map((reserva) => (
          <CartaoReserva
            key={reserva.id}
            nomeSala={reserva.nomeSala}
            data={reserva.data}
            inicio={reserva.inicio}
            fim={reserva.fim}
          />
        ))}
      </ul>
    </main>
  );
}
