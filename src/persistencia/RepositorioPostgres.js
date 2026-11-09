// Repositório PostgreSQL. Cumpre a interface de src/aplicacional/repositorio.js.
// Usa o módulo de ligação segura (ligacao.js): TLS com o certificado do Aiven verificado,
// proxy opcional e erros sem dados de acesso.
// Todas as consultas usam parâmetros ($1, $2, ...): nenhum valor é colado no texto do SQL.
import { Reserva } from "../dominio/Reserva.js";
import { Sala } from "../dominio/Sala.js";

const SQL_SALAS = `SELECT id, nome, capacidade FROM public.salas ORDER BY nome`;
const SQL_RESERVAS = `SELECT id, sala_id, inicio, fim FROM public.reservas ORDER BY inicio`;
const SQL_RESERVAS_DA_SALA = `
SELECT id, sala_id, inicio, fim FROM public.reservas
WHERE sala_id = $1
ORDER BY inicio`;
// O id é gerado pela base de dados (gen_random_uuid). As datas vão como Date: o pg envia-as
// com o fuso horário e a coluna é timestamptz, por isso o instante guardado é exatamente o mesmo.
const SQL_GUARDAR = `
INSERT INTO public.reservas (sala_id, inicio, fim)
VALUES ($1, $2, $3)
RETURNING id, sala_id, inicio, fim`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const paraSala = (linha) => new Sala({ id: linha.id, nome: linha.nome, capacidade: linha.capacidade });
const paraReserva = (linha) => new Reserva({ id: linha.id, salaId: linha.sala_id, inicio: linha.inicio, fim: linha.fim });

export class RepositorioPostgres {
  #ligacao;

  /** @param {{ consultar(sql: string, parametros?: unknown[]): Promise<{ rows: object[] }> }} ligacao */
  constructor(ligacao) {
    this.#ligacao = ligacao;
  }

  async listarSalas() {
    return (await this.#ligacao.consultar(SQL_SALAS)).rows.map(paraSala);
  }

  async listarReservas() {
    return (await this.#ligacao.consultar(SQL_RESERVAS)).rows.map(paraReserva);
  }

  async listarReservasDaSala(salaId) {
    // Um id que não é UUID não pode existir na tabela (e o PostgreSQL daria erro ao convertê-lo).
    if (typeof salaId !== "string" || !UUID.test(salaId)) return [];
    return (await this.#ligacao.consultar(SQL_RESERVAS_DA_SALA, [salaId])).rows.map(paraReserva);
  }

  async guardarReserva(reserva) {
    if (reserva.id !== null) {
      throw new Error("Só se guardam reservas novas: esta reserva já tem id");
    }
    const { rows } = await this.#ligacao.consultar(SQL_GUARDAR, [reserva.salaId, reserva.inicio, reserva.fim]);
    return paraReserva(rows[0]);
  }
}
