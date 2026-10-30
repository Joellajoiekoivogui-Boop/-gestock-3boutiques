import type { Metadata } from 'next';
import { PageHeader } from '@/components/app/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { CategoriesManager } from './categories-manager';

export const metadata: Metadata = { title: 'Catégories' };

export default async function CategoriesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [categories, products] = await Promise.all([
    supabase.from('categories').select('*').order('sort_order').order('name'),
    supabase.from('products').select('category_id').eq('is_archived', false),
  ]);
  if (categories.error) throw new Error(categories.error.message);

  const counts = new Map<string, number>();
  for (const p of products.data ?? []) {
    if (p.category_id) counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1);
  }

  return (
    <div>
      <PageHeader title="Catégories" description="Organisation du catalogue et de la caisse." />
      <Card>
        <CardContent>
          <CategoriesManager categories={(categories.data ?? []).map((c) => ({ ...c, productCount: counts.get(c.id) ?? 0 }))} />
        </CardContent>
      </Card>
    </div>
  );
}
