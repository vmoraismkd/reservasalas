// Converte a data e a hora escritas no formulário (hora de Lisboa) para um instante em UTC.
// Não depende do fuso horário do servidor: o fuso de Lisboa é indicado explicitamente.
const FUSO = "Europe/Lisbon";
const UMA_HORA_MS = 60 * 60 * 1000;
const UM_DIA_MS = 24 * UMA_HORA_MS;

const relogioDeLisboa = new Intl.DateTimeFormat("en-US", {
  timeZone: FUSO,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

// Que horas marcava o relógio de Lisboa num dado instante, escrito como se fosse UTC (em ms).
function horaNoRelogio(instanteMs) {
  const p = Object.fromEntries(relogioDeLisboa.formatToParts(instanteMs).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, p.month - 1, +p.day, +p.hour, +p.minute);
}

// Diferença entre Lisboa e UTC num dado instante (0 no inverno, +1 h no verão).
function desvio(instanteMs) {
  return horaNoRelogio(instanteMs) - instanteMs;
}

/**
 * @param {string} data "AAAA-MM-DD", como vem de <input type="date">
 * @param {string} hora "HH:MM", como vem de <input type="time">
 * @returns {{ instante: Date } | { erro: string }}
 */
export function lisboaParaUTC(data, hora) {
  const d = typeof data === "string" && /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  const h = typeof hora === "string" && /^(\d{2}):(\d{2})$/.exec(hora);
  if (!d || !h) return { erro: "Indique uma data e horas válidas" };

  const [ano, mes, dia, horas, minutos] = [d[1], d[2], d[3], h[1], h[2]].map(Number);
  const relogio = Date.UTC(ano, mes - 1, dia, horas, minutos);
  // Date.UTC aceita 30 de fevereiro ou 25:00 e "dá a volta"; aqui isso conta como inválido.
  const confirmacao = new Date(relogio);
  if (
    confirmacao.getUTCFullYear() !== ano ||
    confirmacao.getUTCMonth() !== mes - 1 ||
    confirmacao.getUTCDate() !== dia ||
    confirmacao.getUTCHours() !== horas ||
    confirmacao.getUTCMinutes() !== minutos
  ) {
    return { erro: "Indique uma data e horas válidas" };
  }

  // Os desvios possíveis nesse dia são o da véspera e o do dia seguinte (diferem se houver mudança de hora).
  // Fica cada instante UTC em que o relógio de Lisboa marcaria exatamente a hora pedida.
  const desvios = new Set([desvio(relogio - UM_DIA_MS), desvio(relogio + UM_DIA_MS)]);
  const candidatos = [...desvios]
    .map((d) => relogio - d)
    .filter((instante) => horaNoRelogio(instante) === relogio)
    .sort((a, b) => a - b);

  // Nenhum: a hora foi saltada na passagem para a hora de verão (ex.: 01:30 do último domingo de março).
  if (candidatos.length === 0) {
    return { erro: `A hora ${hora} não existe em Lisboa no dia ${data} (mudança para a hora de verão)` };
  }
  // Dois: a hora repete-se na passagem para a hora de inverno; usa-se a primeira vez que acontece.
  return { instante: new Date(candidatos[0]) };
}
