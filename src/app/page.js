import CartaoSala from "../components/CartaoSala";

// Dados de exemplo até existir a camada de persistência.
// ATENÇÃO: os ids têm de coincidir com src/persistencia/salasFixas.js, que é onde as reservas são validadas.
const salas = [
  { id: 1, nome: "Sala Atlântico", capacidade: 12 },
  { id: 2, nome: "Sala Douro", capacidade: 6 },
  { id: 3, nome: "Sala Tejo", capacidade: 20 },
  { id: 4, nome: "Sala Mondego", capacidade: 4 },
];

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
      <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        {salas.map((sala) => (
          <CartaoSala key={sala.id} id={sala.id} nome={sala.nome} capacidade={sala.capacidade} />
        ))}
      </ul>
    </main>
  );
}
