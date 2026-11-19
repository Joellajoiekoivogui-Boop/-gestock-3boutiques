import { describe, expect, it } from 'vitest';
import { bestDays, weekdayAverages, weekdayIndex } from '@/lib/report-insights';

const day = (d: string, net: number, count = net ? 1 : 0) => ({ day: d, gross: net, refunds: 0, net, count });

describe('analyses des rapports', () => {
  it('jour de la semaine, lundi = 0', () => {
    expect(weekdayIndex('2026-11-16')).toBe(0); // lundi
    expect(weekdayIndex('2026-11-22')).toBe(6); // dimanche
  });

  it('meilleurs jours : par CA net, sans les jours vides', () => {
    const r = { by_day: [day('2026-11-16', 100), day('2026-11-17', 0), day('2026-11-18', 300), day('2026-11-19', 200)] };
    expect(bestDays(r, 2).map((d) => d.day)).toEqual(['2026-11-18', '2026-11-19']);
  });

  it('moyenne par jour de la semaine sur deux semaines', () => {
    const days = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(Date.UTC(2026, 10, 16 + i)).toISOString().slice(0, 10);
      days.push(day(d, i < 7 ? 100 : 300)); // semaine 1 : 100/jour, semaine 2 : 300/jour
    }
    const avg = weekdayAverages({ by_day: days })!;
    expect(avg).toHaveLength(7);
    expect(avg[0]).toEqual({ label: 'Lundi', average: 200, averageCount: 1 });
    expect(weekdayAverages({ by_day: days.slice(0, 5) })).toBeNull();
  });
});
