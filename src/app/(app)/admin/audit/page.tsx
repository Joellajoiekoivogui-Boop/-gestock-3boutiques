import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState } from '@/components/app/empty-state';
import { PageHeader } from '@/components/app/page-header';
import { Pagination, parsePage } from '@/components/app/pagination';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getSettings, requireAdmin } from '@/lib/auth';
import type { Json } from '@/lib/database.types';
import { dayRangeUtc, isDay } from '@/lib/dates';
import { formatDateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Journal d’activité' };

const PAGE_SIZE = 30;

const ENTITY_LABELS: Record<string, string> = {
  sales: 'Ventes',
  products: 'Produits',
  categories: 'Catégories',
  profiles: 'Utilisateurs',
  payment_methods: 'Modes de paiement',
  restaurant_settings: 'Paramètres',
};

const ACTION_LABELS: Record<string, string> = {
  'sale.created': 'Vente enregistrée',
  'sale.cancelled': 'Vente annulée',
  'sale.refunded': 'Remboursement',
  'stock.restock': 'Approvisionnement',
  'stock.adjustment': 'Ajustement de stock',
  'user.created': 'Compte créé',
  'user.password_reset': 'Mot de passe réinitialisé',
};

function actionLabel(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  const [table, op] = action.split('.');
  const verb = op === 'insert' ? 'Création' : op === 'update' ? 'Modification' : op === 'delete' ? 'Suppression' : op;
  return `${verb} — ${ENTITY_LABELS[table ?? ''] ?? table}`;
}

function summarize(details: Json): string {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return '';
  const d = details as Record<string, Json | undefined>;
  if (d.changes && typeof d.changes === 'object' && !Array.isArray(d.changes)) {
    return Object.entries(d.changes as Record<string, { old?: Json; new?: Json }>)
      .map(([key, change]) => `${key} : ${JSON.stringify(change?.old ?? null)} → ${JSON.stringify(change?.new ?? null)}`)
      .join(' ; ');
  }
  if (d.record && typeof d.record === 'object' && !Array.isArray(d.record)) {
    const r = d.record as Record<string, Json | undefined>;
    return String(r.name ?? r.label ?? r.full_name ?? r.email ?? '');
  }
  return Object.entries(d)
    .map(([k, v]) => `${k} : ${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join(' ; ');
}

export default async function AuditPage({ searchParams }: PageProps<'/admin/audit'>) {
  await requireAdmin();
  const params = await searchParams;
  const entity = typeof params.entity === 'string' && params.entity in ENTITY_LABELS ? params.entity : '';
  const from = typeof params.from === 'string' && isDay(params.from) ? params.from : '';
  const to = typeof params.to === 'string' && isDay(params.to) ? params.to : '';
  const page = parsePage(params.page);
  const settings = await getSettings();
  const tz = settings?.timezone ?? 'Africa/Conakry';
  const supabase = await createClient();

  let query = supabase.from('audit_logs').select('*', { count: 'exact' });
  if (entity) query = query.eq('entity_type', entity);
  if (from) query = query.gte('created_at', dayRangeUtc(from, from, tz).start);
  if (to) query = query.lt('created_at', dayRangeUtc(to, to, tz).end);
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (error) throw new Error(error.message);

  return (
    <div>
      <PageHeader title="Journal d’activité" description="Trace inaltérable des opérations importantes : ventes, annulations, stocks, configuration, comptes." />
      <Card className="mb-4">
        <CardContent>
          <form method="get" action="/admin/audit" className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
            <div className="grid gap-1.5">
              <Label htmlFor="entity">Type</Label>
              <NativeSelect id="entity" name="entity" defaultValue={entity}>
                <option value="">Tout</option>
                {Object.entries(ENTITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="from">Du</Label>
              <Input id="from" name="from" type="date" defaultValue={from} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="to">Au</Label>
              <Input id="to" name="to" type="date" defaultValue={to} />
            </div>
            <div className="flex gap-2">
              <Button type="submit">Filtrer</Button>
              <Button asChild variant="ghost">
                <Link href="/admin/audit">Effacer</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card className="py-0">
        <CardContent className="px-0 pb-4">
          {(data ?? []).length === 0 ? (
            <EmptyState title="Aucune entrée" description="Aucune activité ne correspond à ces critères." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Détails</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">{formatDateTime(log.created_at, tz)}</TableCell>
                    <TableCell className="whitespace-nowrap">{log.user_name ?? 'Système'}</TableCell>
                    <TableCell className="whitespace-nowrap font-medium">
                      {log.entity_type === 'sales' && log.entity_id ? (
                        <Link href={`/admin/sales/${log.entity_id}`} className="hover:underline">
                          {actionLabel(log.action)}
                        </Link>
                      ) : (
                        actionLabel(log.action)
                      )}
                    </TableCell>
                    <TableCell className="max-w-xl text-xs break-words text-muted-foreground">{summarize(log.details)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="px-4">
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={count ?? 0}
              basePath="/admin/audit"
              params={{ entity: entity || undefined, from: from || undefined, to: to || undefined }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
