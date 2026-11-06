import { Sala } from "../dominio/Sala.js";

// Salas fixas enquanto não existe base de dados.
// ATENÇÃO: src/app/page.js tem uma cópia desta lista para mostrar no ecrã; os ids têm de coincidir.
export const SALAS_FIXAS = [
  new Sala({ id: 1, nome: "Sala Atlântico", capacidade: 12 }),
  new Sala({ id: 2, nome: "Sala Douro", capacidade: 6 }),
  new Sala({ id: 3, nome: "Sala Tejo", capacidade: 20 }),
  new Sala({ id: 4, nome: "Sala Mondego", capacidade: 4 }),
];
