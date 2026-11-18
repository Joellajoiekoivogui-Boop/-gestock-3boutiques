import type { Metadata } from 'next';
import { requireUser, getSettings } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { toneForIndex } from '@/components/app/product-thumb';
import { ShopChooser } from '@/components/app/shop-chooser';
import { getShopScope } from '@/lib/shop';
import { PosTerminal, type PosProduct } from './pos-terminal';

export const metadata: Metadata = { title: 'Caisse' };

export default async function PosPage() {
  const session = await requireUser();
  const supabase = await createClient();
  const [settings, scope] = await Promise.all([getSettings(), getShopScope()]);

  // On encaisse toujours dans UNE boutique : l'administrateur la choisit.
  if (scope.shops.length > 0 && !scope.current) {
    return scope.canChoose ? (
      <ShopChooser
        shops={scope.shops.filter((s) => s.is_active)}
        title="Dans quelle boutique encaissez-vous ?"
        description="Les produits, les prix et le stock sont propres à chaque boutique."
      />
    ) : (
      <ShopChooser shops={[]} title="Aucune boutique" description="Demandez à l’administrateur de vous rattacher à une boutique." />
    );
  }

  let productQuery = supabase
    .from('products')
    .select('id, name, description, price, image_url, category_id, track_stock, stock_quantity, is_available')
    .eq('is_archived', false)
    .eq('is_available', true);
  if (scope.current) productQuery = productQuery.eq('shop_id', scope.current.id);

  const [products, categories, methods, customers] = await Promise.all([
    productQuery.order('name'),
    supabase.from('categories').select('id, name, is_active').order('sort_order').order('name'),
    supabase.from('payment_methods').select('code, label').eq('is_active', true).order('sort_order'),
    // Dossiers clients, pour retrouver une personne lors d'une vente à crédit.
    supabase.from('customers').select('id, name, phone').eq('is_active', true).order('name').limit(2000),
  ]);

  const error = products.error ?? categories.error ?? methods.error;
  if (error) throw new Error(error.message);

  const stockEnabled = settings?.stock_enabled ?? true;
  const posProducts: PosProduct[] = (products.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price: Number(p.price),
    imageUrl: p.image_url,
    categoryId: p.category_id,
    maxQuantity: stockEnabled && p.track_stock ? p.stock_quantity : null,
  }));

  return (
    <PosTerminal
      products={posProducts}
      categories={(categories.data ?? []).flatMap((c, index) =>
        c.is_active ? [{ id: c.id, name: c.name, tone: toneForIndex(index) }] : [],
      )}
      paymentMethods={methods.data ?? []}
      currency={settings?.currency ?? 'GNF'}
      showImages={settings?.pos_show_images ?? true}
      canDiscount={can(session.profile, 'apply_discount')}
      customers={customers.error ? [] : (customers.data ?? [])}
    />
  );
}
