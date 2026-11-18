// Calculs de dates dans le fuseau de l'établissement (Africa/Conakry par défaut).
// Les jours sont manipulés sous forme « AAAA-MM-JJ ».
//
// JOURNÉE DE VENTE : elle commence à 7h et finit le lendemain à 7h. Une vente
// faite le 17 à 2h du matin compte pour la journée du 16. La même heure est
// utilisée par la base (fonction public.day_start_hours).
export const DAY_START_HOUR = 7;
const DAY_START_MS = DAY_START_HOUR * 3_600_000;

export type PeriodKey = 'today' | 'week' | 'month' | 'custom';

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  today: 'Aujourd’hui',
  week: 'Cette semaine',
  month: 'Ce mois',
  custom: 'Période personnalisée',
};

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDay(value: unknown): value is string {
  if (typeof value !== 'string' || !DAY_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Journée de vente en cours (avant 7h, c'est encore celle de la veille). */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  // en-CA formate en AAAA-MM-JJ.
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(now.getTime() - DAY_START_MS),
  );
}

export function addDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function diffDays(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

// Lundi de la semaine du jour donné.
export function startOfWeek(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  const offset = (d.getUTCDay() + 6) % 7;
  return addDays(day, -offset);
}

export function startOfMonth(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

export const MAX_PERIOD_DAYS = 366;

export function resolvePeriod(
  period: string | undefined,
  from: string | undefined,
  to: string | undefined,
  timeZone: string,
  now: Date = new Date(),
): { period: PeriodKey; from: string; to: string } {
  const today = todayIn(timeZone, now);
  switch (period) {
    case 'today':
      return { period: 'today', from: today, to: today };
    case 'week':
      return { period: 'week', from: startOfWeek(today), to: today };
    case 'custom': {
      if (isDay(from) && isDay(to) && from <= to && diffDays(from, to) <= MAX_PERIOD_DAYS) {
        return { period: 'custom', from, to };
      }
      return { period: 'month', from: startOfMonth(today), to: today };
    }
    case 'month':
    default:
      return { period: 'month', from: startOfMonth(today), to: today };
  }
}

// Décalage (ms) du fuseau à un instant donné.
function zoneOffset(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(instant / 1000) * 1000;
}

// Instant UTC correspondant à minuit (heure locale) du jour donné.
export function startOfDayUtc(day: string, timeZone: string): Date {
  const guess = Date.parse(`${day}T00:00:00Z`);
  let result = guess - zoneOffset(guess, timeZone);
  // Second passage pour les changements d'heure.
  result = guess - zoneOffset(result, timeZone);
  return new Date(result);
}

// Intervalle [début, fin[ en UTC couvrant les journées de vente from..to
// incluses : du premier jour à 7h jusqu'au lendemain du dernier jour à 7h.
export function dayRangeUtc(from: string, to: string, timeZone: string): { start: string; end: string } {
  return {
    start: new Date(startOfDayUtc(from, timeZone).getTime() + DAY_START_MS).toISOString(),
    end: new Date(startOfDayUtc(addDays(to, 1), timeZone).getTime() + DAY_START_MS).toISOString(),
  };
}
