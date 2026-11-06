// Caso de uso "Listar salas": todas as salas, por ordem alfabética do nome.
export async function listarSalas(repositorio) {
  const salas = await repositorio.listarSalas();
  return [...salas].sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
}
