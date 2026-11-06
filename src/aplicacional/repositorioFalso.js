// Só para testes: persistência simulada que cumpre a interface do repositório.
// Cada método é um vi.fn, para os testes poderem ver se foi chamado e forçar falhas.
import { vi } from "vitest";

export function criarRepositorioFalso({ salas = [], reservas = [], proximoId = 100 } = {}) {
  const guardadas = [...reservas];
  return {
    listarSalas: vi.fn(async () => [...salas]),
    listarReservas: vi.fn(async () => [...guardadas]),
    listarReservasDaSala: vi.fn(async (salaId) => guardadas.filter((r) => r.salaId === salaId)),
    proximoIdReserva: vi.fn(async () => proximoId),
    guardarReserva: vi.fn(async (reserva) => {
      guardadas.push(reserva);
    }),
  };
}
