import { Ban, Boxes, type LucideIcon, Receipt, Settings, UserRound } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CollapsibleFilters } from '@/components/app/collapsible-filters';
import { EmptyState } from '@/components/app/empty-state';
import { PageHeader } from '@/components/app/page-header';
import { Pagination, parsePage } from '@/components/app/pagination';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { getSettings, requireAdmin } from '@/lib/auth';
import type { Json } from '@/lib/database.types';
import { dayRangeUtc, isDay } from '@/lib/dates';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Journal d’activité' };

const PAGE_SIZE = 30;

function formatTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(iso));
}

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

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Espèces',
  orange_money: 'Orange Money',
  mtn_momo: 'MTN Mobile Money',
  bank_transfer: 'Virement bancaire',
  other: 'Autre',
};

const FIELD_LABELS: Record<string, string> = {
  name: 'nom',
  price: 'prix',
  is_available: 'disponible',
  is_archived: 'archivé',
  is_active: 'actif',
  role: 'rôle',
  permissions: 'permissions',
  full_name: 'nom',
  stock_quantity: 'stock',
  minimum_stock: 'seuil',
  track_stock: 'suivi du stock',
  category_id: 'catégorie',
  image_url: 'photo',
  description: 'description',
  sort_order: 'ordre',
  label: 'libellé',
  address: 'adresse',
  phone: 'téléphone',
  email: 'e-mail',
  logo_url: 'logo',
  receipt_footer: 'pied de reçu',
};

function money(value: Json | undefined) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? formatMoney(n) : String(value);
}

function plain(value: Json | undefined): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'oui' : 'non';
  if (typeof value === 'string') return value.length > 40 ? `${value.slice(0, 40)}…` : value;
  if (typeof value === 'number') return String(value);
  return '…';
}

// Une phrase courte et lisible à la place du détail technique.
function summarize(action: string, details: Json): string {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return '';
  const d = details as Record<string, Json | undefined>;
  if (action === 'sale.created' || action === 'sale.cancelled') {
    const parts = [String(d.receipt_number ?? ''), money(d.total_amount)];
    if (d.payment_method) parts.push(PAYMENT_LABELS[String(d.payment_method)] ?? String(d.payment_method));
    if (Number(d.discount_amount ?? 0) > 0) parts.push(`remise ${money(d.discount_amount)}`);
    if (d.reason) parts.push(`motif : ${String(d.reason)}`);
    return parts.filter(Boolean).join(' · ');
  }
  if (action === 'sale.refunded') {
    return [String(d.receipt_number ?? ''), money(d.amount), d.reason ? `motif : ${String(d.reason)}` : '']
      .filter(Boolean)
      .join(' · ');
  }
  if (action.startsWith('stock.')) {
    return [String(d.product_name ?? ''), d.quantity !== undefined ? `quantité ${String(d.quantity)}` : '', d.reason ? String(d.reason) : '']
      .filter(Boolean)
      .join(' · ');
  }
  if (d.changes && typeof d.changes === 'object' && !Array.isArray(d.changes)) {
    return Object.entries(d.changes as Record<string, { old?: Json; new?: Json }>)
      .filter(([key]) => key !== 'updated_at')
      .map(([key, change]) => `${FIELD_LABELS[key] ?? key} : ${plain(change?.old)} → ${plain(change?.new)}`)
      .join(' · ');
  }
  if (d.record && typeof d.record === 'object' && !Array.isArray(d.record)) {
    const r = d.record as Record<string, Json | undefined>;
    return String(r.name ?? r.label ?? r.full_name ?? r.email ?? '');
  }
  return Object.entries(d)
    .map(([k, v]) => `${FIELD_LABELS[k] ?? k} : ${plain(v)}`)
    .join(' · ');
}

type Tone = 'sale' | 'cancel' | 'stock' | 'user' | 'config';
function toneOf(action: string): Tone {
  if (action === 'sale.cancelled' || action === 'sale.refunded' || action.endsWith('.delete')) return 'cancel';
  if (action.startsWith('sale.')) return 'sale';
  if (action.startsWith('stock.') || action.startsWith('products.') || action.startsWith('categories.')) return 'stock';
  if (action.startsWith('user.') || action.startsWith('profiles.')) return 'user';
  return 'config';
}
const TONE_ICON: Record<Tone, LucideIcon> = {
  sale: Receipt,
  cancel: Ban,
  stock: Boxes,
  user: UserRound,
  config: Settings,
};
const TONE_CLASS: Record<Tone, string> = {
  sale: 'bg-forest-soft text-forest',
  cancel: 'bg-destructive/10 text-destructive-strong',
  stock: 'bg-warning text-warning-foreground',
  user: 'bg-[#e6eef5] text-[#1f5a73]',
  config: 'bg-muted text-muted-foreground',
};

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

  // Regroupement par jour (heure locale de l'établissement).
  const dayLabel = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: tz });
  const groups: [string, NonNullable<typeof data>][] = [];
  for (const log of data ?? []) {
    const raw = dayLabel.format(new Date(log.created_at));
    const label = raw.charAt(0).toUpperCase() + raw.slice(1);
    const last = groups[groups.length - 1];
    if (last && last[0] === label) last[1].push(log);
    else groups.push([label, [log]]);
  }

  return (
    <div>
      <PageHeader title="Journal d’activité" description="Trace inaltérable des opérations importantes : ventes, annulations, stocks, configuration, comptes." />
      <Card className="mb-4">
        <CardContent>
          <CollapsibleFilters activeCount={[entity, from, to].filter(Boolean).length}>
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
          </CollapsibleFilters>
        </CardContent>
      </Card>
      <Card className="overflow-hidden py-0">
        <CardContent className="px-0 pt-0 pb-4">
          {(data ?? []).length === 0 ? (
            <EmptyState title="Aucune entrée" description="Aucune activité ne correspond à ces critères." />
          ) : (
            <ol className="divide-y">
              {groups.map(([day, logs]) => (
                <li key={day}>
                  <h2 className="border-b bg-muted/40 px-5 pt-3 pb-2 font-serif text-lg font-bold">
                    {day}
                  </h2>
                  <ol className="pb-2">
                    {logs.map((log) => {
                      const tone = toneOf(log.action);
                      const Icon = TONE_ICON[tone];
                      const label = actionLabel(log.action);
                      const detail = summarize(log.action, log.details);
                      return (
                        <li key={log.id} className="flex gap-4 px-5 py-3">
                          <span className={cn('mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-full', TONE_CLASS[tone])}>
                            <Icon className="size-5" aria-hidden />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                              <span className="font-semibold">
                                {log.entity_type === 'sales' && log.entity_id ? (
                                  <Link href={`/admin/sales/${log.entity_id}`} className="hover:underline">
                                    {label}
                                  </Link>
                                ) : (
                                  label
                                )}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {formatTime(log.created_at, tz)} · {log.user_name ?? 'Système'}
                              </span>
                            </p>
                            {detail && <p className="mt-0.5 text-[15px] break-words text-muted-foreground">{detail}</p>}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </li>
              ))}
            </ol>
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
