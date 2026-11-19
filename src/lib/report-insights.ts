import type { SalesReport } from '@/lib/database.types';

const WEEKDAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

/** Jour de la semaine (0 = lundi) d'un jour AAAA-MM-JJ. */
export function weekdayIndex(day: string): number {
  return (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;
}

/** Les meilleurs jours de la période, par CA net (jours sans vente exclus). */
export function bestDays(report: Pick<SalesReport, 'by_day'>, limit = 5) {
  return report.by_day
    .filter((d) => Number(d.count) > 0)
    .map((d) => ({ day: d.day, net: Number(d.net), count: Number(d.count) }))
    .sort((a, b) => b.net - a.net || a.day.localeCompare(b.day))
    .slice(0, limit);
}

/**
 * Moyenne par jour de la semaine : CA net moyen des lundis, mardis… de la
 * période (tous les jours comptés, même sans vente, pour comparer
 * honnêtement). Rend null quand la période fait moins d'une semaine.
 */
export function weekdayAverages(report: Pick<SalesReport, 'by_day'>) {
  if (report.by_day.length < 7) return null;
  const sums = WEEKDAYS.map((label) => ({ label, net: 0, days: 0, count: 0 }));
  for (const d of report.by_day) {
    const w = sums[weekdayIndex(d.day)]!;
    w.net += Number(d.net);
    w.count += Number(d.count);
    w.days += 1;
  }
  return sums.map((w) => ({
    label: w.label,
    average: w.days ? Math.round(w.net / w.days) : 0,
    averageCount: w.days ? Math.round((w.count / w.days) * 10) / 10 : 0,
  }));
}
