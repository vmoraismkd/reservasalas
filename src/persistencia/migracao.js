// Migração da base de dados: tabelas, salas de exemplo e permissões do utilizador da app.
// Corre com o utilizador de administração (DATABASE_ADMIN_URL), através de "npm run migrar".

export const UTILIZADOR_APP = "app_reservas";

export class ErroMigracao extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = "ErroMigracao";
  }
}

// Pode correr várias vezes: tudo é "se não existir", as salas não se repetem e as permissões
// são primeiro retiradas e depois dadas. Uma só transação: se algo falhar, nada fica a meio.
export const SQL_MIGRACAO = `
BEGIN;

CREATE TABLE IF NOT EXISTS public.salas (
  id          uuid     PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text     NOT NULL UNIQUE CHECK (btrim(nome) <> ''),
  capacidade  integer  NOT NULL CHECK (capacidade > 0)
);

CREATE TABLE IF NOT EXISTS public.reservas (
  id       uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  sala_id  uuid         NOT NULL REFERENCES public.salas (id),
  inicio   timestamptz  NOT NULL,
  fim      timestamptz  NOT NULL,
  CHECK (fim > inicio)
);

CREATE INDEX IF NOT EXISTS reservas_sala_inicio_idx ON public.reservas (sala_id, inicio);

INSERT INTO public.salas (nome, capacidade)
VALUES ('Sala A', 10), ('Sala B', 6), ('Sala C', 4)
ON CONFLICT (nome) DO NOTHING;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${UTILIZADOR_APP};
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ${UTILIZADOR_APP};
REVOKE CREATE ON SCHEMA public FROM ${UTILIZADOR_APP};
GRANT USAGE ON SCHEMA public TO ${UTILIZADOR_APP};
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salas, public.reservas TO ${UTILIZADOR_APP};

COMMIT;
`;

const SQL_PAPEL = `
SELECT r.rolsuper, r.rolcreaterole, r.rolcreatedb, r.rolbypassrls,
       (SELECT COUNT(*)::int FROM pg_auth_members m WHERE m.member = r.oid) AS membro_de
FROM pg_roles r
WHERE r.rolname = $1`;

const PRIVILEGIOS_PERMITIDOS = ["SELECT", "INSERT", "UPDATE", "DELETE"];
const SQL_PRIVILEGIOS = `
SELECT t.tabela, p.privilegio, has_table_privilege($1, 'public.' || t.tabela, p.privilegio) AS tem
FROM (VALUES ('salas'), ('reservas')) AS t (tabela)
CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) AS p (privilegio)`;

const SQL_ESQUEMA = `SELECT has_schema_privilege($1, 'public', 'CREATE') AS pode_criar`;
const SQL_DONO = `
SELECT tablename FROM pg_tables
WHERE schemaname = 'public' AND tablename IN ('salas', 'reservas') AND tableowner = $1`;
const SQL_TOTAL_SALAS = `SELECT COUNT(*)::int AS salas FROM public.salas`;

/** Endereço de administração. Nunca usa o DATABASE_URL da app, que deve ter só permissões de dados. */
export function lerEnderecoAdmin(env = process.env) {
  if (!env.DATABASE_ADMIN_URL) {
    throw new ErroMigracao(
      "Falta DATABASE_ADMIN_URL no .env.local: a migração cria tabelas e dá permissões, por isso precisa do utilizador de administração.",
    );
  }
  return env.DATABASE_ADMIN_URL;
}

/**
 * Corre a migração e confirma, na própria base de dados, que o utilizador da app
 * só pode ler, inserir, alterar e apagar dados nas duas tabelas.
 * @returns {{ salasInseridas: number, totalSalas: number, privilegios: object[], problemas: string[] }}
 */
export async function migrar(ligacao) {
  const papel = (await ligacao.consultar(SQL_PAPEL, [UTILIZADOR_APP])).rows[0];
  if (!papel) {
    throw new ErroMigracao(
      `O utilizador ${UTILIZADOR_APP} não existe, por isso nada foi alterado. ` +
        `Crie-o na consola do Aiven (separador Users, "Add service user") com o nome ${UTILIZADOR_APP} ` +
        "e volte a correr npm run migrar.",
    );
  }

  const resultados = await ligacao.consultar(SQL_MIGRACAO);
  const insercao = [].concat(resultados).find((r) => r?.command === "INSERT");

  const privilegios = (await ligacao.consultar(SQL_PRIVILEGIOS, [UTILIZADOR_APP])).rows;
  const { pode_criar: podeCriar } = (await ligacao.consultar(SQL_ESQUEMA, [UTILIZADOR_APP])).rows[0];
  const tabelasDoUtilizador = (await ligacao.consultar(SQL_DONO, [UTILIZADOR_APP])).rows;
  const { salas: totalSalas } = (await ligacao.consultar(SQL_TOTAL_SALAS)).rows[0];

  const problemas = [];
  for (const { tabela, privilegio, tem } of privilegios) {
    const devia = PRIVILEGIOS_PERMITIDOS.includes(privilegio);
    if (tem && !devia) problemas.push(`${UTILIZADOR_APP} tem ${privilegio} em ${tabela} (não devia).`);
    if (!tem && devia) problemas.push(`${UTILIZADOR_APP} não tem ${privilegio} em ${tabela} (devia ter).`);
  }
  if (podeCriar) problemas.push(`${UTILIZADOR_APP} pode criar objetos no esquema public (não devia).`);
  for (const { tablename } of tabelasDoUtilizador) {
    problemas.push(`${UTILIZADOR_APP} é dono da tabela ${tablename}: o dono pode tudo, incluindo apagá-la.`);
  }
  if (papel.rolsuper) problemas.push(`${UTILIZADOR_APP} é superutilizador: pode tudo na base de dados.`);
  if (papel.rolcreaterole) problemas.push(`${UTILIZADOR_APP} pode criar utilizadores.`);
  if (papel.rolcreatedb) problemas.push(`${UTILIZADOR_APP} pode criar bases de dados.`);
  if (papel.rolbypassrls) problemas.push(`${UTILIZADOR_APP} ignora as regras de segurança por linha.`);
  if (papel.membro_de > 0) {
    problemas.push(`${UTILIZADOR_APP} pertence a ${papel.membro_de} outro(s) papéis e pode herdar as permissões deles.`);
  }

  return { salasInseridas: insercao?.rowCount ?? 0, totalSalas, privilegios, problemas };
}
