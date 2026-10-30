import { Search } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/app/page-header';
import { Pagination, parsePage } from '@/components/app/pagination';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
      <Card className="mb-4">
        <CardContent>
          <form method="get" action="/admin/products" className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
            <div className="grid gap-1.5">
              <Label htmlFor="q">Recherche</Label>
              <Input id="q" name="q" defaultValue={q} placeholder="Nom du produit" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="category">Catégorie</Label>
              <NativeSelect id="category" name="category" defaultValue={category}>
                <option value="">Toutes</option>
                {(categories.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="status">Statut</Label>
              <NativeSelect id="status" name="status" defaultValue={status}>
                <option value="active">Actifs (non archivés)</option>
                <option value="available">Disponibles</option>
                <option value="unavailable">Indisponibles</option>
                <option value="archived">Archivés</option>
              </NativeSelect>
            </div>
            <div className="flex gap-2">
              <Button type="submit">
                <Search /> Filtrer
              </Button>
              <Button asChild variant="ghost">
                <Link href="/admin/products">Effacer</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card className="py-0">
        <CardContent className="px-0 pb-4">
          <ProductsTable
            products={products.data ?? []}
            categories={categories.data ?? []}
            currency={currency}
            stockEnabled={settings?.stock_enabled ?? true}
          />
          <div className="px-4">
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={products.count ?? 0}
              basePath="/admin/products"
              params={{ q: q || undefined, category: category || undefined, status: status === 'active' ? undefined : status }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
