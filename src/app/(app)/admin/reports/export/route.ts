import { getSession, getSettings } from '@/lib/auth';
import { csvResponse, toCsvSections } from '@/lib/csv';
import { resolvePeriod } from '@/lib/dates';
import { can } from '@/lib/permissions';
import { reportSections } from '@/lib/report-sections';
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
  const csv = toCsvSections(reportSections(report, settings?.currency ?? 'GNF'));
  return csvResponse(csv, `rapport-${range.from}_${range.to}.csv`);
}
