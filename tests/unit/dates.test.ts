import { describe, expect, it } from 'vitest';
import { addDays, dayRangeUtc, diffDays, isDay, resolvePeriod, startOfDayUtc, startOfWeek, todayIn } from '@/lib/dates';

describe('dates', () => {
  it('valide les jours AAAA-MM-JJ', () => {
    expect(isDay('2026-10-30')).toBe(true);
    expect(isDay('2026-02-30')).toBe(false);
    expect(isDay('30/10/2026')).toBe(false);
    expect(isDay(undefined)).toBe(false);
  });

  it('calcule le jour courant dans le fuseau', () => {
    const instant = new Date('2026-10-30T23:30:00Z');
    expect(todayIn('Africa/Conakry', instant)).toBe('2026-10-30');
    expect(todayIn('Europe/Paris', instant)).toBe('2026-10-31');
  });

  it('semaine du lundi, mois, jours ajoutés', () => {
    expect(startOfWeek('2026-10-30')).toBe('2026-10-26'); // vendredi → lundi
    expect(startOfWeek('2026-10-26')).toBe('2026-10-26');
    expect(startOfWeek('2026-11-01')).toBe('2026-10-26'); // dimanche
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(diffDays('2026-01-01', '2026-12-31')).toBe(364);
  });

  it('résout les périodes du tableau de bord', () => {
    const now = new Date('2026-10-30T10:00:00Z');
    expect(resolvePeriod('today', undefined, undefined, 'Africa/Conakry', now)).toEqual({ period: 'today', from: '2026-10-30', to: '2026-10-30' });
    expect(resolvePeriod('week', undefined, undefined, 'Africa/Conakry', now)).toEqual({ period: 'week', from: '2026-10-26', to: '2026-10-30' });
    expect(resolvePeriod(undefined, undefined, undefined, 'Africa/Conakry', now)).toEqual({ period: 'month', from: '2026-10-01', to: '2026-10-30' });
    expect(resolvePeriod('custom', '2026-01-01', '2026-01-31', 'Africa/Conakry', now)).toEqual({ period: 'custom', from: '2026-01-01', to: '2026-01-31' });
    // Période invalide ou trop longue → mois en cours.
    expect(resolvePeriod('custom', '2026-02-01', '2026-01-01', 'Africa/Conakry', now).period).toBe('month');
    expect(resolvePeriod('custom', '2024-01-01', '2026-01-01', 'Africa/Conakry', now).period).toBe('month');
  });

  it('convertit un jour local en intervalle UTC', () => {
    expect(startOfDayUtc('2026-10-30', 'Africa/Conakry').toISOString()).toBe('2026-10-30T00:00:00.000Z');
    expect(startOfDayUtc('2026-07-01', 'Europe/Paris').toISOString()).toBe('2026-06-30T22:00:00.000Z');
    expect(dayRangeUtc('2026-10-01', '2026-10-31', 'Africa/Conakry')).toEqual({
      start: '2026-10-01T00:00:00.000Z',
      end: '2026-11-01T00:00:00.000Z',
    });
  });
});
