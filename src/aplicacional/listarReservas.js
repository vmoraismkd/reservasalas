// Caso de uso "Listar reservas": todas as reservas, da mais próxima para a mais distante.
export async function listarReservas(repositorio) {
  const reservas = await repositorio.listarReservas();
  return [...reservas].sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
}
