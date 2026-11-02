import CartaoSala from "../components/CartaoSala";

// Dados de exemplo até existir a camada de persistência.
const salas = [
  { id: 1, nome: "Sala Atlântico", capacidade: 12 },
  { id: 2, nome: "Sala Douro", capacidade: 6 },
  { id: 3, nome: "Sala Tejo", capacidade: 20 },
  { id: 4, nome: "Sala Mondego", capacidade: 4 },
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 font-sans">
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Salas</h1>
      <ul className="space-y-3">
        {salas.map((sala) => (
          <CartaoSala key={sala.id} nome={sala.nome} capacidade={sala.capacidade} />
        ))}
      </ul>
    </main>
  );
}
