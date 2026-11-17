import { Boxes } from 'lucide-react';
import type { Metadata } from 'next';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { EmptyState } from '@/components/app/empty-state';
import { PageHeader } from '@/components/app/page-header';
import { Pagination, parsePage } from '@/components/app/pagination';
import { DayLine } from '@/components/app/day-line';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getSettings, requirePermission } from '@/lib/auth';
import { formatDateTime, MOVEMENT_TYPE_LABELS } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { StockMovementButton } from './stock-movement-dialog';

export const metadata: Metadata = { title: 'Stocks' };

function StockBar({ quantity, minimum, className }: { quantity: number; minimum: number; className?: string }) {
  return (
    <span aria-hidden className={cn('block h-2 overflow-hidden rounded-full bg-muted', className)}>
      <span
        className={cn(
          'block h-full rounded-full',
          quantity === 0 ? 'bg-destructive' : quantity <= minimum ? 'bg-warning-foreground' : 'bg-forest',
        )}
        style={{ width: `${Math.min(100, (quantity / Math.max(1, minimum * 3)) * 100)}%` }}
      />
    </span>
  );
}

function StockStateBadge({ quantity, minimum }: { quantity: number; minimum: number }) {
  if (quantity === 0) return <Badge variant="destructive">Rupture</Badge>;
  if (quantity <= minimum) return <Badge variant="warning">Stock faible</Badge>;
  return <Badge className="border-transparent bg-forest-soft text-forest">Suffisant</Badge>;
}

const PAGE_SIZE = 25;

export default async function InventoryPage({ searchParams }: PageProps<'/admin/inventory'>) {
  await requirePermission('manage_stock');
  const params = await searchParams;
  const lowOnly = params.low === '1';
  const productFilter =
    typeof params.product === 'string' && /^[0-9a-f-]{36}$/i.test(params.product) ? params.product : '';
  const page = parsePage(params.page);
  const settings = await getSettings();
  const tz = settings?.timezone ?? 'Africa/Conakry';
  const supabase = await createClient();

  let movementsQuery = supabase
    .from('stock_movements')
    .select('*, products(name), profiles(full_name)', { count: 'exact' })
    .order('created_at', { ascending: false });
  if (productFilter) movementsQuery = movementsQuery.eq('product_id', productFilter);

  const [products, movements] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, stock_quantity, minimum_stock, is_available')
      .eq('track_stock', true)
      .eq('is_archived', false)
      .order('name'),
    movementsQuery.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
  ]);
  if (products.error) throw new Error(products.error.message);
  if (movements.error) throw new Error(movements.error.message);

  const tracked = products.data ?? [];
  const lowCount = tracked.filter((p) => p.stock_quantity <= p.minimum_stock).length;
  const outCount = tracked.filter((p) => p.stock_quantity === 0).length;
  const shown = lowOnly ? tracked.filter((p) => p.stock_quantity <= p.minimum_stock) : tracked;

  return (
    <div className="space-y-6">
      <PageHeader title="Stocks" description="Approvisionnements, ajustements et historique des mouvements." />

      {settings && !settings.stock_enabled && (
        <p role="status" className="rounded-lg border border-warning-foreground/30 bg-warning px-4 py-3 text-sm text-warning-foreground">
          La gestion des stocks est désactivée dans les Paramètres : les ventes ne décrémentent pas les stocks et ne sont pas
          bloquées.
        </p>
      )}

      <DayLine
        label="État du stock"
        value={
          outCount === 1
            ? `${tracked.find((p) => p.stock_quantity === 0)?.name} en rupture`
            : outCount > 1
              ? `${outCount} produits en rupture`
              : lowCount > 0
                ? `${lowCount} à commander`
                : 'Tout est en stock'
        }
        facts={[
          { label: 'Produits suivis', value: tracked.length },
          { label: 'Sous le seuil', value: lowCount },
        ]}
      />

      <Card className="py-0">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 pt-5">
          <div>
            <CardTitle>Stock disponible</CardTitle>
            <CardDescription>Seuls les produits avec « Suivre le stock » activé apparaissent ici.</CardDescription>
          </div>
          <Button asChild variant={lowOnly ? 'default' : 'outline'} size="sm">
            <Link href={lowOnly ? '/admin/inventory' : '/admin/inventory?low=1'}>
              {lowOnly ? 'Afficher tout' : 'Stock faible uniquement'}
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="px-0 pb-3">
          {shown.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title={lowOnly ? 'Aucun stock faible' : 'Aucun produit suivi'}
              description={lowOnly ? 'Tous les stocks sont au-dessus de leur seuil.' : 'Activez le suivi de stock dans la fiche d’un produit.'}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Minimum</TableHead>
                  <TableHead className="hidden md:table-cell">État</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      <Link href={`/admin/inventory?product=${p.id}`} className="hover:underline">
                        {p.name}
                      </Link>
                      {/* Téléphone : seuil, état et actions sous le nom. */}
                      <StockBar quantity={p.stock_quantity} minimum={p.minimum_stock} className="mt-2 w-full md:hidden" />
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm font-normal text-muted-foreground md:hidden">
                        <span>Seuil {p.minimum_stock}</span>
                        <StockStateBadge quantity={p.stock_quantity} minimum={p.minimum_stock} />
                      </div>
                      <div className="mt-2 flex gap-2 md:hidden [&>*]:flex-1">
                        <StockMovementButton product={p} type="restock" />
                        <StockMovementButton product={p} type="adjustment" />
                      </div>
                    </TableCell>
                    <TableCell className="text-right align-top font-semibold tabular-nums md:align-middle">
                      <span className="inline-flex items-center gap-3">
                        <StockBar quantity={p.stock_quantity} minimum={p.minimum_stock} className="hidden w-20 md:block" />
                        {p.stock_quantity}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">{p.minimum_stock}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <StockStateBadge quantity={p.stock_quantity} minimum={p.minimum_stock} />
                    </TableCell>
                    <TableCell className="hidden text-right md:table-cell">
                      <div className="flex justify-end gap-2">
                        <StockMovementButton product={p} type="restock" />
                        <StockMovementButton product={p} type="adjustment" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="py-0">
        <CardHeader className="flex-row flex-wrap items-end justify-between gap-3 pt-5">
          <div>
            <CardTitle>Historique des mouvements</CardTitle>
            <CardDescription>Entrées, sorties et ajustements, avec leur auteur.</CardDescription>
          </div>
          <form method="get" action="/admin/inventory" className="flex items-end gap-2">
            <div className="grid gap-1">
              <Label htmlFor="product" className="text-xs text-muted-foreground">
                Produit
              </Label>
              <NativeSelect id="product" name="product" defaultValue={productFilter} className="w-56">
                <option value="">Tous les produits</option>
                {tracked.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <Button type="submit" variant="outline">
              Filtrer
            </Button>
          </form>
        </CardHeader>
        <CardContent className="px-0 pb-4">
          {(movements.data ?? []).length === 0 ? (
            <EmptyState title="Aucun mouvement" description="Les ventes, approvisionnements et ajustements apparaîtront ici." />
          ) : (
            <>
            <Table className="hidden md:table">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Produit</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Quantité</TableHead>
                  <TableHead className="text-right">Stock après</TableHead>
                  <TableHead>Motif</TableHead>
                  <TableHead>Par</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(movements.data ?? []).map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-sm whitespace-nowrap">{formatDateTime(m.created_at, tz)}</TableCell>
                    <TableCell>{(m.products as { name: string } | null)?.name ?? '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{MOVEMENT_TYPE_LABELS[m.movement_type]}</TableCell>
                    <TableCell
                      className={`text-right font-medium tabular-nums ${m.quantity > 0 ? 'text-accent-foreground' : 'text-destructive'}`}
                    >
                      {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{m.stock_after}</TableCell>
                    <TableCell className="max-w-xs truncate">{m.reason ?? '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{(m.profiles as { full_name: string } | null)?.full_name || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ul className="divide-y md:hidden">
              {(movements.data ?? []).map((m) => (
                <li key={m.id} className="px-5 py-3">
                  <p className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold">{(m.products as { name: string } | null)?.name ?? '—'}</span>
                    <span className={`font-bold tabular-nums ${m.quantity > 0 ? 'text-accent-foreground' : 'text-destructive'}`}>
                      {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(m.created_at, tz)} · {m.reason ?? MOVEMENT_TYPE_LABELS[m.movement_type]} · reste {m.stock_after}
                  </p>
                </li>
              ))}
            </ul>
            </>
          )}
          <div className="px-4">
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={movements.count ?? 0}
              basePath="/admin/inventory"
              params={{ product: productFilter || undefined, low: lowOnly ? '1' : undefined }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
