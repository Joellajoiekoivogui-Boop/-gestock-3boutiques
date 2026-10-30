// CSV compatible Excel en français : séparateur « ; », BOM UTF-8, CRLF.

export type CsvColumn<T> = { header: string; value: (row: T) => string | number | null | undefined };

function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let text = String(value).replace(/[\u00a0\u202f]/g, ' ');
  // Neutralise les formules (=, +, -, @) pour éviter l'injection dans Excel,
  // sauf pour les nombres.
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[";\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [columns.map((c) => escapeCell(c.header)).join(';')];
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCell(c.value(row))).join(';'));
  }
  return `\ufeff${lines.join('\r\n')}\r\n`;
}

export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

// Plusieurs tableaux dans un même fichier : titre, en-têtes, lignes, ligne vide.
export function toCsvSections(sections: { title: string; headers: string[]; rows: (string | number | null | undefined)[][] }[]): string {
  const lines: string[] = [];
  for (const section of sections) {
    lines.push(escapeCell(section.title));
    lines.push(section.headers.map(escapeCell).join(';'));
    for (const row of section.rows) lines.push(row.map(escapeCell).join(';'));
    lines.push('');
  }
  return `\ufeff${lines.join('\r\n')}\r\n`;
}
