import { Search } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/app/page-header';
import { Pagination, parsePage } from '@/components/app/pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { getSettings, requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { NewProductButton, ProductsTable } from './products-manager';

export const metadata: Metadata = { title: 'Produits' };

const PAGE_SIZE = 20;
const STATUSES = ['active', 'available', 'unavailable', 'archived'] as const;
type Status = (typeof STATUSES)[number];

export default async function ProductsPage({ searchParams }: PageProps<'/admin/products'>) {
  await requireAdmin();
  const params = await searchParams;
  const q = typeof params.q === 'string' ? params.q.replace(/[%_\\]/g, '').trim().slice(0, 60) : '';
  const category = typeof params.category === 'string' && /^[0-9a-f-]{36}$/i.test(params.category) ? params.category : '';
  const status: Status = STATUSES.includes(params.status as Status) ? (params.status as Status) : 'active';
  const page = parsePage(params.page);
  const settings = await getSettings();
  const supabase = await createClient();

  let query = supabase.from('products').select('*', { count: 'exact' });
  if (q) query = query.ilike('name', `%${q}%`);
  if (category) query = query.eq('category_id', category);
  if (status === 'archived') query = query.eq('is_archived', true);
  else {
    query = query.eq('is_archived', false);
    if (status === 'available') query = query.eq('is_available', true);
    if (status === 'unavailable') query = query.eq('is_available', false);
  }

  const [products, categories] = await Promise.all([
    query.order('name').range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    supabase.from('categories').select('id, name, is_active').order('sort_order').order('name'),
  ]);
  if (products.error) throw new Error(products.error.message);
  const currency = settings?.currency ?? 'GNF';

  return (
    <div>
      <PageHeader
        title="Produits"
        description="Catalogue, prix, disponibilité et photos."
        actions={<NewProductButton categories={categories.data ?? []} currency={currency} />}
      />
      <div className="mb-5 flex flex-col gap-4">
        <div role="group" aria-label="Filtrer par catégorie" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
          {[{ id: '', name: 'Toutes' }, ...(categories.data ?? [])].map((c) => {
            const active = category === c.id;
            const params = new URLSearchParams();
            if (q) params.set('q', q);
            if (c.id) params.set('category', c.id);
            if (status !== 'active') params.set('status', status);
            const href = `/admin/products${params.size ? `?${params}` : ''}`;
            return (
              <Link
                key={c.id || 'all'}
                href={href}
                aria-current={active ? 'true' : undefined}
                className={
                  active
                    ? 'inline-flex h-10 shrink-0 items-center rounded-full bg-forest px-4 text-sm font-semibold text-forest-foreground'
                    : 'inline-flex h-10 shrink-0 items-center rounded-full border bg-card px-4 text-sm font-semibold text-muted-foreground hover:text-foreground'
                }
              >
                {c.name}
              </Link>
            );
          })}
        </div>
        <form method="get" action="/admin/products" className="flex flex-wrap items-end gap-3">
          {category && <input type="hidden" name="category" value={category} />}
          <div className="relative min-w-0 flex-[2_1_16rem]">
            <Label htmlFor="q" className="sr-only">
              Recherche
            </Label>
            <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input id="q" name="q" defaultValue={q} placeholder="Rechercher un produit" className="h-12 rounded-full border-transparent bg-card pl-12 shadow-card" />
          </div>
          <div className="min-w-0 flex-[1_1_12rem]">
            <Label htmlFor="status" className="sr-only">
              Statut
            </Label>
            <NativeSelect id="status" name="status" defaultValue={status} className="h-12 rounded-full bg-card">
              <option value="active">Actifs (non archivés)</option>
              <option value="available">En caisse</option>
              <option value="unavailable">Retirés de la caisse</option>
              <option value="archived">Archivés</option>
            </NativeSelect>
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="dark" size="lg">
              Filtrer
            </Button>
            <Button asChild variant="ghost" size="lg">
              <Link href="/admin/products">Effacer</Link>
            </Button>
          </div>
        </form>
        <p className="text-sm text-muted-foreground">
          {products.count ?? 0} produit{(products.count ?? 0) > 1 ? 's' : ''}
        </p>
      </div>
      <ProductsTable
        products={products.data ?? []}
        categories={categories.data ?? []}
        currency={currency}
        stockEnabled={settings?.stock_enabled ?? true}
      />
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={products.count ?? 0}
        basePath="/admin/products"
        params={{ q: q || undefined, category: category || undefined, status: status === 'active' ? undefined : status }}
      />
    </div>
  );
}
