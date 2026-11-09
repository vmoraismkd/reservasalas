import { describe, expect, it, vi } from "vitest";
import { verificarLigacao } from "./verificacao.js";

function erroPg(code, message) {
  return Object.assign(new Error(message), { code });
}

/**
 * Ligação falsa. Simula as respostas do PostgreSQL e regista todo o SQL.
 * Opções: cifrada, certificado, utilizador, superutilizador, podeApagar, tabelaExiste,
 * temSalas, ficouGravada (a reserva de teste ainda existe depois do ROLLBACK).
 */
function ligacaoFalsa(o = {}) {
  const op = {
    cifrada: true,
    certificado: true,
    utilizador: "app_reservas",
    superutilizador: false,
    podeApagar: false,
    tabelaExiste: true,
    temSalas: true,
    ficouGravada: false,
    ...o,
  };
  const sqlNaTransacao = [];
  const sqlFora = [];

  const consultar = vi.fn(async (sql) => {
    sqlNaTransacao.push(sql);
    if (/current_user/.test(sql)) return { rows: [{ utilizador: op.utilizador, superutilizador: op.superutilizador }] };
    if (/pg_stat_ssl/.test(sql)) {
      return { rows: [{ ssl: op.cifrada, version: op.cifrada ? "TLSv1.3" : null, cipher: op.cifrada ? "TLS_AES_256_GCM_SHA384" : null, bits: op.cifrada ? 256 : null }] };
    }
    if (/INSERT INTO public\.reservas/.test(sql)) {
      if (!op.tabelaExiste) throw erroPg("42P01", 'relation "public.reservas" does not exist');
      return op.temSalas ? { rowCount: 1, rows: [{ id: "uuid-de-teste" }] } : { rowCount: 0, rows: [] };
    }
    if (/DROP TABLE/.test(sql)) {
      if (!op.tabelaExiste) throw erroPg("42P01", 'table "reservas" does not exist');
      if (!op.podeApagar) throw erroPg("42501", "must be owner of table reservas");
      return { rows: [] };
    }
    return { rows: [] };
  });

  return {
    sqlNaTransacao,
    sqlFora,
    transacaoAnulada: vi.fn(async (fn) =>
      fn({ consultar, tls: { protocolo: "TLSv1.3", cifra: "TLS_AES_256_GCM_SHA384", certificadoConfirmado: op.certificado } }),
    ),
    consultar: vi.fn(async (sql) => {
      sqlFora.push(sql);
      if (/to_regclass/.test(sql)) return { rows: [{ existe: op.tabelaExiste, ficou: op.ficouGravada }] };
      return { rows: [] };
    }),
  };
}

describe("verificarLigacao", () => {
  it("tudo certo: ligou, cifrada, certificado confirmado, grava mas não apaga a tabela, nada fica", async () => {
    const r = await verificarLigacao(ligacaoFalsa());
    expect(r).toMatchObject({
      ligou: true,
      cifrada: true,
      protocolo: "TLSv1.3",
      cifra: "TLS_AES_256_GCM_SHA384",
      certificadoConfirmado: true,
      utilizador: "app_reservas",
      gravou: true,
      apagouTabela: false,
      nadaFicou: true,
    });
    expect(r.problemas).toEqual([]);
  });

  it("corre tudo dentro de transacaoAnulada e nunca faz COMMIT", async () => {
    const ligacao = ligacaoFalsa();
    await verificarLigacao(ligacao);
    expect(ligacao.transacaoAnulada).toHaveBeenCalledTimes(1);
    expect([...ligacao.sqlNaTransacao, ...ligacao.sqlFora].join("\n")).not.toMatch(/COMMIT/i);
  });

  it("protege cada tentativa com um SAVEPOINT e volta a ele quando falha", async () => {
    const ligacao = ligacaoFalsa();
    await verificarLigacao(ligacao);
    const sql = ligacao.sqlNaTransacao;
    const drop = sql.findIndex((s) => /DROP TABLE/.test(s));
    expect(sql[drop - 1]).toMatch(/^SAVEPOINT/);
    expect(sql[drop + 1]).toMatch(/^ROLLBACK TO SAVEPOINT/);
    const insert = sql.findIndex((s) => /INSERT INTO public\.reservas/.test(s));
    expect(sql[insert - 1]).toMatch(/^SAVEPOINT/);
  });

  it("limita o tempo de espera por bloqueios, para não ficar preso", async () => {
    const ligacao = ligacaoFalsa();
    await verificarLigacao(ligacao);
    expect(ligacao.sqlNaTransacao[0]).toMatch(/SET LOCAL lock_timeout/);
  });

  it("depois da transação confirma que a reserva de teste não ficou e a tabela existe", async () => {
    const ligacao = ligacaoFalsa();
    await verificarLigacao(ligacao);
    expect(ligacao.consultar).toHaveBeenCalledWith(expect.stringMatching(/to_regclass/), ["uuid-de-teste"]);
  });

  it.each([
    ["a ligação não está cifrada", { cifrada: false }, /não está cifrada/],
    ["o certificado não foi confirmado", { certificado: false }, /certificado/],
    ["o utilizador consegue apagar a tabela", { podeApagar: true }, /consegue apagar a tabela/],
    ["o utilizador é superutilizador", { superutilizador: true, podeApagar: true }, /superutilizador/],
    ["a reserva de teste ficou gravada", { ficouGravada: true }, /ficou gravada/],
    ["não há salas para a reserva de teste", { temSalas: false }, /salas/],
  ])("acusa um problema quando %s", async (_, opcoes, mensagem) => {
    const r = await verificarLigacao(ligacaoFalsa(opcoes));
    expect(r.problemas.join("\n")).toMatch(mensagem);
  });

  it("se as tabelas não existirem, diz para correr primeiro npm run migrar", async () => {
    const r = await verificarLigacao(ligacaoFalsa({ tabelaExiste: false }));
    expect(r.gravou).toBe(false);
    expect(r.problemas.join("\n")).toMatch(/npm run migrar/);
  });

  it("se não conseguir ligar, devolve ligou=false e o motivo, sem lançar", async () => {
    const ligacao = ligacaoFalsa();
    ligacao.transacaoAnulada = vi.fn(async () => {
      throw Object.assign(new Error("Erro na base de dados: O proxy recusou abrir o túnel (HTTP 403 Forbidden)."), {
        code: "PROXY_RECUSOU",
      });
    });
    const r = await verificarLigacao(ligacao);
    expect(r.ligou).toBe(false);
    expect(r.problemas.join("\n")).toMatch(/proxy recusou/);
  });
});
