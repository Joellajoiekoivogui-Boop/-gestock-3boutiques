import type { Metadata } from 'next';
import { requireUser, getSettings } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { PosTerminal, type PosProduct } from './pos-terminal';

export const metadata: Metadata = { title: 'Caisse' };

export default async function PosPage() {
  const session = await requireUser();
  const supabase = await createClient();
  const settings = await getSettings();

  const [products, categories, methods] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, price, image_url, category_id, track_stock, stock_quantity, is_available')
      .eq('is_archived', false)
      .eq('is_available', true)
      .order('name'),
    supabase.from('categories').select('id, name').eq('is_active', true).order('sort_order').order('name'),
    supabase.from('payment_methods').select('code, label').eq('is_active', true).order('sort_order'),
  ]);

  const error = products.error ?? categories.error ?? methods.error;
  if (error) throw new Error(error.message);

  const stockEnabled = settings?.stock_enabled ?? true;
  const posProducts: PosProduct[] = (products.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    price: Number(p.price),
    imageUrl: p.image_url,
    categoryId: p.category_id,
    maxQuantity: stockEnabled && p.track_stock ? p.stock_quantity : null,
  }));

  return (
    <PosTerminal
      products={posProducts}
      categories={categories.data ?? []}
      paymentMethods={methods.data ?? []}
      currency={settings?.currency ?? 'GNF'}
      showImages={settings?.pos_show_images ?? true}
      canDiscount={can(session.profile, 'apply_discount')}
    />
  );
}
