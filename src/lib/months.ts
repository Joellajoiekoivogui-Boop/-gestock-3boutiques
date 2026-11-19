import { todayIn } from '@/lib/dates';

/** Mois AAAA-MM valide, jamais dans le futur ; le mois de la journée de vente en cours par défaut. */
export function parseMonth(value: unknown, timeZone: string, now: Date = new Date()): string {
  const current = todayIn(timeZone, now).slice(0, 7);
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && value <= current && value >= '2000-01'
    ? value
    : current;
}

/** Mois décalé de `delta` (AAAA-MM). */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}
