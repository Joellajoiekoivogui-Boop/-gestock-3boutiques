import { describe, expect, it } from 'vitest';
import { csvResponse, toCsv, toCsvSections } from '@/lib/csv';
import { formatAmount, formatMoney, plainText } from '@/lib/format';
import { pdfSafe } from '@/lib/receipt';

describe('montants GNF', () => {
  it('formate avec séparateur de milliers et sans décimales', () => {
    expect(plainText(formatMoney(60000))).toBe('60 000 GNF');
    expect(plainText(formatAmount(1234567))).toBe('1 234 567');
    expect(plainText(formatAmount('50000'))).toBe('50 000');
    expect(formatAmount(0)).toBe('0');
    expect(plainText(formatAmount(-1500))).toBe('-1 500');
    expect(formatAmount(Number.NaN)).toBe('0');
  });

  it('utilise des espaces insécables à l’écran', () => {
    expect(formatMoney(1000)).toBe('1 000 GNF');
  });
});

describe('CSV', () => {
  it('produit un CSV Excel français (BOM, ;) et échappe les cellules', () => {
    const csv = toCsv([{ a: 'Riz; "spécial"', b: 1000 }], [
      { header: 'Nom', value: (r) => r.a },
      { header: 'Prix', value: (r) => r.b },
    ]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('Nom;Prix\r\n');
    expect(csv).toContain('"Riz; ""spécial""";1000');
  });

  it('neutralise les formules (injection CSV)', () => {
    const csv = toCsv([{ a: '=HYPERLINK("x")' }, { a: '-2+3' }], [{ header: 'A', value: (r) => r.a }]);
    expect(csv).toContain(`'=HYPERLINK`);
    expect(csv).toContain(`'-2+3`);
    const numbers = toCsv([{ n: -5 }], [{ header: 'N', value: (r) => r.n }]);
    expect(numbers).toContain('\r\n-5\r\n');
  });

  it('assemble plusieurs sections', () => {
    const csv = toCsvSections([
      { title: 'Synthèse', headers: ['A', 'B'], rows: [['x', 1]] },
      { title: 'Jours', headers: ['J'], rows: [] },
    ]);
    expect(csv.split('\r\n')).toEqual(['﻿Synthèse', 'A;B', 'x;1', '', 'Jours', 'J', '', '']);
  });

  it('renvoie une réponse téléchargeable', () => {
    const res = csvResponse('x', 'ventes.csv');
    expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="ventes.csv"');
  });
});

describe('PDF', () => {
  it('garde les accents et remplace les caractères hors police standard', () => {
    expect(pdfSafe('Hôtellerie — Reçu « Payé » 60 000')).toBe('Hôtellerie — Reçu « Payé » 60 000');
    expect(pdfSafe('Thiéboudienne 🍲')).toBe('Thiéboudienne ?');
  });
});
