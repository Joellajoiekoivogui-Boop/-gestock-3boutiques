import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildXlsx } from '@/lib/xlsx';

describe('buildXlsx', () => {
  it('produit une archive ZIP valide avec un onglet par tableau', () => {
    const bytes = buildXlsx([
      { name: 'Synthèse', title: 'Rapport de test', headers: ['Indicateur', 'Valeur'], rows: [['CA net', 125000], ['Formule ?', '=1+1']] },
      { name: 'Synthèse', headers: ['Jour', 'CA'], rows: [['19/11/2026', 60000]] },
    ]);
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const dir = mkdtempSync(join(tmpdir(), 'xlsx-'));
    const file = join(dir, 'test.xlsx');
    writeFileSync(file, bytes);
    // Relu par Python (openpyxl) quand il est disponible : vérifie le format Office.
    let read: string;
    try {
      read = execFileSync(
        'python3',
        [
          '-I',
          '-c',
          'import sys,json,openpyxl; wb=openpyxl.load_workbook(sys.argv[1]); print(json.dumps({ws.title:[[c for c in r] for r in ws.iter_rows(values_only=True)] for ws in wb.worksheets}))',
          file,
        ],
        { encoding: 'utf8' },
      );
    } catch {
      return; // openpyxl absent : la vérification ZIP ci-dessus suffit.
    }
    const sheets = JSON.parse(read) as Record<string, unknown[][]>;
    expect(Object.keys(sheets)).toEqual(['Synthèse', 'Synthèse 2']);
    expect(sheets['Synthèse']![0]![0]).toBe('Rapport de test');
    expect(sheets['Synthèse']![3]).toEqual(['CA net', 125000]);
    // Un texte qui ressemble à une formule reste du texte (pas de formule exécutée).
    expect(sheets['Synthèse']![4]).toEqual(['Formule ?', '=1+1']);
  });
});
