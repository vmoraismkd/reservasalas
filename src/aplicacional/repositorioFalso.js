// Só para testes: persistência simulada que cumpre a interface do repositório.
// Cada método é um vi.fn, para os testes poderem ver se foi chamado e forçar falhas.
import { vi } from "vitest";
import { Reserva } from "../dominio/Reserva.js";

export function criarRepositorioFalso({ salas = [], reservas = [], idGerado = "id-gerado" } = {}) {
  const guardadas = [...reservas];
  return {
    listarSalas: vi.fn(async () => [...salas]),
    listarReservas: vi.fn(async () => [...guardadas]),
    listarReservasDaSala: vi.fn(async (salaId) => guardadas.filter((r) => r.salaId === salaId)),
    // Como a base de dados: atribui o id ao guardar e devolve a reserva guardada.
    guardarReserva: vi.fn(async (reserva) => {
      const guardada = new Reserva({ id: idGerado, salaId: reserva.salaId, inicio: reserva.inicio, fim: reserva.fim });
      guardadas.push(guardada);
      return guardada;
    }),
  };
}
