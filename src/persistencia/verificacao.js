// Verifica a ligação da app (DATABASE_URL): cifra, certificado, utilizador e permissões.
// Tudo o que escreve ou apaga é feito numa transação que é sempre anulada no fim.

const SQL_QUEM = `
SELECT current_user AS utilizador,
       (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS superutilizador`;

// Estado do TLS visto pelo servidor, para esta ligação.
const SQL_TLS = `SELECT ssl, version, cipher, bits FROM pg_stat_ssl WHERE pid = pg_backend_pid()`;

// Reserva de teste numa data impossível de confundir com uma real (anulada no fim).
const SQL_GRAVAR = `
INSERT INTO public.reservas (sala_id, inicio, fim)
SELECT id, '2000-01-01T10:00:00Z', '2000-01-01T11:00:00Z' FROM public.salas ORDER BY nome LIMIT 1
RETURNING id`;

const SQL_APAGAR_TABELA = `DROP TABLE public.reservas`;

// Depois da anulação: a tabela continua a existir e a reserva de teste não ficou.
const SQL_DEPOIS = `
SELECT to_regclass('public.reservas') IS NOT NULL AS existe,
       EXISTS (SELECT 1 FROM public.reservas WHERE id = $1::uuid) AS ficou`;

const TABELA_NAO_EXISTE = "42P01";
const SEM_PERMISSAO = "42501";

/**
 * @returns {Promise<{ ligou: boolean, cifrada: boolean, protocolo: string|null, cifra: string|null,
 *   bits: number|null, certificadoConfirmado: boolean, utilizador: string|null, superutilizador: boolean|null,
 *   gravou: boolean, apagouTabela: boolean|null, motivoApagar: string|null, nadaFicou: boolean|null,
 *   problemas: string[] }>}
 */
export async function verificarLigacao(ligacao) {
  const r = {
    ligou: false,
    cifrada: false,
    protocolo: null,
    cifra: null,
    bits: null,
    certificadoConfirmado: false,
    utilizador: null,
    superutilizador: null,
    gravou: false,
    apagouTabela: null,
    motivoApagar: null,
    nadaFicou: null,
    problemas: [],
  };
  let idTeste = null;

  try {
    await ligacao.transacaoAnulada(async ({ consultar, tls }) => {
      r.ligou = true;
      // Um DROP TABLE espera por quem estiver a usar a tabela; não se fica preso à espera.
      await consultar("SET LOCAL lock_timeout = '5s'");
      await consultar("SET LOCAL statement_timeout = '15s'");

      const quem = (await consultar(SQL_QUEM)).rows[0];
      r.utilizador = quem.utilizador;
      r.superutilizador = quem.superutilizador === true;

      const estado = (await consultar(SQL_TLS)).rows[0] ?? {};
      r.cifrada = estado.ssl === true;
      r.protocolo = estado.version ?? tls.protocolo;
      r.cifra = estado.cipher ?? tls.cifra;
      r.bits = estado.bits ?? null;
      r.certificadoConfirmado = tls.certificadoConfirmado;

      // Cada tentativa tem o seu SAVEPOINT: um erro não estraga o resto da transação.
      await consultar("SAVEPOINT gravar");
      try {
        const gravada = await consultar(SQL_GRAVAR);
        if (gravada.rowCount === 1) {
          r.gravou = true;
          idTeste = gravada.rows[0].id;
        } else {
          r.problemas.push("Não há salas na base de dados para a reserva de teste: corra primeiro npm run migrar.");
        }
      } catch (erro) {
        await consultar("ROLLBACK TO SAVEPOINT gravar");
        r.problemas.push(
          erro.code === TABELA_NAO_EXISTE
            ? "As tabelas ainda não existem: corra primeiro npm run migrar."
            : `O utilizador não conseguiu gravar a reserva de teste: ${erro.message}`,
        );
      }

      await consultar("SAVEPOINT apagar");
      try {
        await consultar(SQL_APAGAR_TABELA);
        r.apagouTabela = true;
      } catch (erro) {
        await consultar("ROLLBACK TO SAVEPOINT apagar");
        if (erro.code === TABELA_NAO_EXISTE) return;
        r.apagouTabela = false;
        r.motivoApagar = erro.code === SEM_PERMISSAO ? "sem permissão: só o dono pode apagar a tabela" : erro.message;
      }
    });
  } catch (erro) {
    r.problemas.push(r.ligou ? `A verificação parou a meio (foi anulada): ${erro.message}` : `Não foi possível ligar: ${erro.message}`);
    return r;
  }

  if (idTeste) {
    const depois = (await ligacao.consultar(SQL_DEPOIS, [idTeste])).rows[0];
    r.nadaFicou = depois.existe && !depois.ficou;
    if (depois.ficou) r.problemas.push("A reserva de teste ficou gravada depois da anulação!");
    if (!depois.existe) r.problemas.push("A tabela de reservas já não existe depois da verificação!");
  }

  if (!r.cifrada) r.problemas.push("A ligação não está cifrada.");
  if (!r.certificadoConfirmado) r.problemas.push("O certificado do servidor não foi confirmado.");
  if (r.superutilizador) r.problemas.push(`O utilizador ${r.utilizador} é superutilizador: pode tudo na base de dados.`);
  if (r.apagouTabela) {
    r.problemas.push(
      `O utilizador ${r.utilizador} consegue apagar a tabela de reservas (foi anulado: nada ficou apagado). ` +
        "Use o app_reservas no DATABASE_URL.",
    );
  }
  return r;
}
