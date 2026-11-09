import { Sala } from "../dominio/Sala.js";

// Salas do repositório em memória, usado só nos testes (a app lê as salas do PostgreSQL).
export const SALAS_FIXAS = [
  new Sala({ id: "1", nome: "Sala Atlântico", capacidade: 12 }),
  new Sala({ id: "2", nome: "Sala Douro", capacidade: 6 }),
  new Sala({ id: "3", nome: "Sala Tejo", capacidade: 20 }),
  new Sala({ id: "4", nome: "Sala Mondego", capacidade: 4 }),
];
