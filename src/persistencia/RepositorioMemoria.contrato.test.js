import { RepositorioMemoria } from "./RepositorioMemoria.js";
import { Sala } from "../dominio/Sala.js";
import { testarContratoRepositorio } from "./__testes__/contratoRepositorio.js";

// Em memória: um repositório novo por teste, por isso não há nada para apagar.
testarContratoRepositorio("RepositorioMemoria", async (salas) => ({
  repositorio: new RepositorioMemoria({
    salas: salas.map((s) => new Sala({ id: crypto.randomUUID(), nome: s.nome, capacidade: s.capacidade })),
  }),
  limpar: async () => {},
}));
