import { getSession, getSettings } from '@/lib/auth';
import { csvResponse, toCsvSections } from '@/lib/csv';
import { resolvePeriod } from '@/lib/dates';
import { can } from '@/lib/permissions';
import { reportSections } from '@/lib/report-sections';
import { buildXlsx } from '@/lib/xlsx';
import { getSalesReport } from '@/lib/reports';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !can(session.profile, 'view_reports')) {
    return new Response('Accès refusé', { status: 403 });
  }
  const url = new URL(request.url);
  const settings = await getSettings();
  const range = resolvePeriod(
    url.searchParams.get('period') ?? 'month',
    url.searchParams.get('from') ?? undefined,
    url.searchParams.get('to') ?? undefined,
    settings?.timezone ?? 'Africa/Conakry',
  );
  const report = await getSalesReport(range.from, range.to);
  const sections = reportSections(report, settings?.currency ?? 'GNF');
  const name = `rapport-${range.from}_${range.to}`;
  if (url.searchParams.get('format') === 'xlsx') {
    // Classeur Excel : un onglet par tableau.
    const bytes = buildXlsx(sections.map((s) => ({ name: s.sheet, title: s.title, headers: s.headers, rows: s.rows })));
    return new Response(new Blob([bytes as BlobPart]), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${name}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    });
  }
  return csvResponse(toCsvSections(sections), `${name}.csv`);
}
