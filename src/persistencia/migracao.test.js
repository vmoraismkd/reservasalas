import { describe, expect, it, vi } from "vitest";
import { ErroMigracao, SQL_MIGRACAO, UTILIZADOR_APP, lerEnderecoAdmin, migrar } from "./migracao.js";

// Privilégios que a verificação final pergunta à base de dados, por tabela.
const PRIVILEGIOS = ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"];
const PERMITIDOS = ["SELECT", "INSERT", "UPDATE", "DELETE"];

function linhasPrivilegios(extra = []) {
  return ["salas", "reservas"].flatMap((tabela) =>
    PRIVILEGIOS.map((privilegio) => ({
      tabela,
      privilegio,
      tem: PERMITIDOS.includes(privilegio) || extra.includes(`${tabela}:${privilegio}`),
    })),
  );
}

// Ligação simulada: responde conforme a consulta e regista o SQL recebido.
function ligacaoFalsa({ utilizadorExiste = true, privilegiosExtra = [], papel = {}, salasNovas = 3 } = {}) {
  return {
    consultar: vi.fn(async (sql) => {
      if (sql.includes("FROM pg_roles")) {
        return {
          rows: utilizadorExiste
            ? [{ rolsuper: false, rolcreaterole: false, rolcreatedb: false, rolbypassrls: false, membro_de: 0, ...papel }]
            : [],
        };
      }
      if (sql.includes("has_table_privilege")) return { rows: linhasPrivilegios(privilegiosExtra) };
      if (sql.includes("has_schema_privilege")) return { rows: [{ pode_criar: privilegiosExtra.includes("esquema:CREATE") }] };
      if (sql.includes("tableowner")) return { rows: [] };
      if (sql.includes("COUNT(*)")) return { rows: [{ salas: 3 }] };
      // Várias instruções numa consulta: o pg devolve um resultado por instrução.
      if (sql === SQL_MIGRACAO) {
        return [{ command: "BEGIN" }, { command: "CREATE" }, { command: "INSERT", rowCount: salasNovas }, { command: "COMMIT" }];
      }
      return { rows: [] };
    }),
  };
}

describe("SQL da migração", () => {
  it("corre numa só transação", () => {
    expect(SQL_MIGRACAO.trim()).toMatch(/^BEGIN;/);
    expect(SQL_MIGRACAO.trim()).toMatch(/COMMIT;$/);
  });

  it("cria as tabelas só se não existirem, com UUID gerado pela base de dados", () => {
    expect(SQL_MIGRACAO).toMatch(/CREATE TABLE IF NOT EXISTS public\.salas/);
    expect(SQL_MIGRACAO).toMatch(/CREATE TABLE IF NOT EXISTS public\.reservas/);
    expect(SQL_MIGRACAO.match(/id\s+uuid\s+PRIMARY KEY\s+DEFAULT gen_random_uuid\(\)/g)).toHaveLength(2);
  });

  it("guarda as datas com fuso horário e exige fim depois do início", () => {
    expect(SQL_MIGRACAO).toMatch(/inicio\s+timestamptz\s+NOT NULL/);
    expect(SQL_MIGRACAO).toMatch(/fim\s+timestamptz\s+NOT NULL/);
    expect(SQL_MIGRACAO).toMatch(/CHECK \(fim > inicio\)/);
  });

  it("cada reserva aponta para uma sala que existe", () => {
    expect(SQL_MIGRACAO).toMatch(/sala_id\s+uuid\s+NOT NULL REFERENCES public\.salas \(id\)/);
  });

  it("insere a Sala A, a Sala B e a Sala C sem as repetir", () => {
    for (const nome of ["Sala A", "Sala B", "Sala C"]) expect(SQL_MIGRACAO).toContain(`'${nome}'`);
    expect(SQL_MIGRACAO).toMatch(/nome\s+text\s+NOT NULL UNIQUE/);
    expect(SQL_MIGRACAO).toMatch(/ON CONFLICT \(nome\) DO NOTHING/);
  });

  it(`dá ao ${UTILIZADOR_APP} só SELECT, INSERT, UPDATE e DELETE nas duas tabelas`, () => {
    const concessoes = SQL_MIGRACAO.match(/GRANT [^;]+;/g);
    expect(concessoes).toEqual([
      `GRANT USAGE ON SCHEMA public TO ${UTILIZADOR_APP};`,
      `GRANT SELECT, INSERT, UPDATE, DELETE ON public.salas, public.reservas TO ${UTILIZADOR_APP};`,
    ]);
  });

  it("retira primeiro qualquer outra permissão que o utilizador tivesse", () => {
    expect(SQL_MIGRACAO).toContain(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${UTILIZADOR_APP};`);
    expect(SQL_MIGRACAO).toContain(`REVOKE CREATE ON SCHEMA public FROM ${UTILIZADOR_APP};`);
    expect(SQL_MIGRACAO.indexOf("REVOKE ALL")).toBeLessThan(SQL_MIGRACAO.indexOf("GRANT"));
  });
});

describe("migrar", () => {
  it(`não altera nada se o utilizador ${UTILIZADOR_APP} não existir e explica como o criar`, async () => {
    const ligacao = ligacaoFalsa({ utilizadorExiste: false });
    const erro = await migrar(ligacao).catch((e) => e);
    expect(erro).toBeInstanceOf(ErroMigracao);
    expect(erro.message).toMatch(/app_reservas/);
    expect(erro.message).toMatch(/Aiven/);
    expect(ligacao.consultar).not.toHaveBeenCalledWith(SQL_MIGRACAO);
  });

  it("corre o SQL numa só chamada e devolve um relatório sem problemas", async () => {
    const ligacao = ligacaoFalsa();
    const relatorio = await migrar(ligacao);
    expect(ligacao.consultar).toHaveBeenCalledWith(SQL_MIGRACAO);
    expect(relatorio.problemas).toEqual([]);
    expect(relatorio.salasInseridas).toBe(3);
    expect(relatorio.totalSalas).toBe(3);
  });

  it("numa segunda execução indica que não inseriu salas novas", async () => {
    const relatorio = await migrar(ligacaoFalsa({ salasNovas: 0 }));
    expect(relatorio.salasInseridas).toBe(0);
    expect(relatorio.problemas).toEqual([]);
  });

  it.each([
    ["TRUNCATE numa tabela", { privilegiosExtra: ["reservas:TRUNCATE"] }, /TRUNCATE/],
    ["criar objetos no esquema", { privilegiosExtra: ["esquema:CREATE"] }, /criar/i],
    ["ser superutilizador", { papel: { rolsuper: true } }, /superutilizador/i],
    ["pertencer a outros papéis", { papel: { membro_de: 2 } }, /papéis/i],
  ])("acusa um problema se o utilizador puder %s", async (_, opcoes, mensagem) => {
    const relatorio = await migrar(ligacaoFalsa(opcoes));
    expect(relatorio.problemas.join("\n")).toMatch(mensagem);
  });
});

describe("lerEnderecoAdmin", () => {
  it("recusa quando falta DATABASE_ADMIN_URL", () => {
    expect(() => lerEnderecoAdmin({})).toThrow(/DATABASE_ADMIN_URL/);
    expect(() => lerEnderecoAdmin({ DATABASE_ADMIN_URL: "" })).toThrow(ErroMigracao);
  });

  it("não usa o DATABASE_URL da app em vez do de administração", () => {
    expect(() => lerEnderecoAdmin({ DATABASE_URL: "postgres://app:x@h:1/db" })).toThrow(/DATABASE_ADMIN_URL/);
  });

  it("devolve o endereço de administração quando existe", () => {
    expect(lerEnderecoAdmin({ DATABASE_ADMIN_URL: "postgres://a:b@h:1/db" })).toBe("postgres://a:b@h:1/db");
  });
});
