import { describe, expect, it } from 'vitest';
import { parseMonth, shiftMonth } from '@/lib/months';

describe('mois du bilan', () => {
  const now = new Date('2026-11-19T12:00:00Z');
  it('mois en cours par défaut, jamais dans le futur', () => {
    expect(parseMonth(undefined, 'Africa/Conakry', now)).toBe('2026-11');
    expect(parseMonth('2026-10', 'Africa/Conakry', now)).toBe('2026-10');
    expect(parseMonth('2026-12', 'Africa/Conakry', now)).toBe('2026-11');
    expect(parseMonth('2026-13', 'Africa/Conakry', now)).toBe('2026-11');
  });
  it('le 1er du mois avant 7h, c’est encore le mois précédent (journée de vente)', () => {
    expect(parseMonth(undefined, 'Africa/Conakry', new Date('2026-12-01T05:00:00Z'))).toBe('2026-11');
  });
  it('mois précédent et suivant, avec changement d’année', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });
});
