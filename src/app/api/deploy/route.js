import { execFile } from "node:child_process";

const ERRO_CONFIGURACAO = "Variáveis GIT_ do .env.local não configuradas";
const HOSTS_LOCAIS = new Set(["localhost", "127.0.0.1", "::1"]);
const IPS_LOCAIS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

function emDesenvolvimento() {
  return process.env.NODE_ENV === "development";
}

function lerConfiguracao() {
  const { GIT_TOKEN, GIT_REPO_URL, GIT_USER_NAME, GIT_USER_EMAIL } = process.env;
  if (!GIT_TOKEN || !GIT_REPO_URL || !GIT_USER_NAME || !GIT_USER_EMAIL) return null;
  return {
    token: GIT_TOKEN,
    tokenB64: Buffer.from(`x-access-token:${GIT_TOKEN}`).toString("base64"),
    url: `https://${GIT_REPO_URL}`,
    nome: GIT_USER_NAME,
    email: GIT_USER_EMAIL,
  };
}

// Defesa extra contra outros sites no browser; o isolamento da rede vem do "next dev -H 127.0.0.1"
// (o x-forwarded-for pode ser forjado se o dev for arrancado noutra interface).
function pedidoLocal(request, exigirOrigem) {
  const host = request.headers.get("host") ?? "";
  const nomeHost = host.replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  if (!HOSTS_LOCAIS.has(nomeHost) || !IPS_LOCAIS.has(ip)) return false;
  if (!exigirOrigem) return true;
  return request.headers.get("origin") === `http://${host}`;
}

function esconderToken(texto, cfg) {
  return texto.replaceAll(cfg.token, "***").replaceAll(cfg.tokenB64, "***");
}

// O cabeçalho com o token vai por variáveis de ambiente do processo, não nos argumentos,
// para não aparecer na lista de processos.
function git(args, cfg, { comToken = false } = {}) {
  const env = { ...process.env, GIT_TERMINAL_PROMPT: "0" };
  if (comToken) {
    env.GIT_CONFIG_COUNT = "1";
    env.GIT_CONFIG_KEY_0 = "http.extraHeader";
    env.GIT_CONFIG_VALUE_0 = `Authorization: Basic ${cfg.tokenB64}`;
  }
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      ["-c", "credential.helper=", ...args],
      { cwd: process.cwd(), env, timeout: 60_000, windowsHide: true },
      (erro, stdout, stderr) => {
        if (erro) reject(new Error(esconderToken((stderr || erro.message).trim(), cfg)));
        else resolve(stdout);
      },
    );
  });
}

async function calcularPendente(cfg) {
  const alteracoes = await git(["status", "--porcelain"], cfg);
  if (alteracoes.trim()) return true;
  const head = (await git(["rev-parse", "HEAD"], cfg)).trim();
  const remoto = await git(["ls-remote", cfg.url, "main"], cfg, { comToken: true });
  const linhaMain = remoto.split("\n").find((linha) => linha.endsWith("\trefs/heads/main"));
  return linhaMain?.split("\t")[0] !== head;
}

function naoEncontrado() {
  return new Response(null, { status: 404 });
}

function erro(status, mensagem) {
  return Response.json({ erro: mensagem }, { status });
}

export async function GET(request) {
  if (!emDesenvolvimento()) return naoEncontrado();
  if (!pedidoLocal(request, false)) return erro(403, "Só disponível a partir deste computador");
  const cfg = lerConfiguracao();
  if (!cfg) return erro(500, ERRO_CONFIGURACAO);
  try {
    return Response.json({ pendente: await calcularPendente(cfg) });
  } catch (e) {
    return erro(500, e.message);
  }
}

export async function POST(request) {
  if (!emDesenvolvimento()) return naoEncontrado();
  if (!pedidoLocal(request, true)) return erro(403, "Só disponível a partir deste computador");
  const cfg = lerConfiguracao();
  if (!cfg) return erro(500, ERRO_CONFIGURACAO);

  const corpo = await request.json().catch(() => ({}));
  const mensagem = typeof corpo.mensagem === "string" ? corpo.mensagem.trim() : "";
  if (!mensagem) return erro(400, "A mensagem do commit não pode estar vazia");

  try {
    await git(["add", "-A"], cfg);
    // Sem alterações o commit falharia; ainda assim pode haver commits por enviar.
    const preparados = (await git(["diff", "--cached", "--name-only"], cfg)).trim();
    if (preparados) {
      await git(
        ["-c", `user.name=${cfg.nome}`, "-c", `user.email=${cfg.email}`, "commit", "-m", mensagem],
        cfg,
      );
    }
    await git(["push", cfg.url, "main"], cfg, { comToken: true });
    return Response.json({ ok: true, commit: Boolean(preparados) });
  } catch (e) {
    return erro(500, e.message);
  }
}
