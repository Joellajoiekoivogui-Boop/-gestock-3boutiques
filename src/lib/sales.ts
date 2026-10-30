import 'server-only';
import type { RefundRow, SaleItemRow, SaleRow, SettingsRow } from '@/lib/database.types';
import { createClient } from '@/lib/supabase/server';

export type ReceiptData = {
  sale: SaleRow;
  items: SaleItemRow[];
  refunds: (RefundRow & { user_name: string | null })[];
  settings: Pick<
    SettingsRow,
    'name' | 'tagline' | 'logo_url' | 'address' | 'phone' | 'email' | 'currency' | 'receipt_footer' | 'receipt_format' | 'timezone'
  >;
};

const DEFAULT_SETTINGS: ReceiptData['settings'] = {
  name: 'MassaGui Fils SARL.U',
  tagline: 'Hôtellerie — Restaurant',
  logo_url: null,
  address: null,
  phone: null,
  email: null,
  currency: 'GNF',
  receipt_footer: 'Merci de votre visite !',
  receipt_format: '80mm',
  timezone: 'Africa/Conakry',
};

// Lecture d'une vente avec ses lignes. RLS décide de l'accès : un caissier
// n'obtient que ses propres ventes (null sinon).
export async function getSaleDetails(id: string): Promise<ReceiptData | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();

  const [sale, items, refunds, settings] = await Promise.all([
    supabase.from('sales').select('*').eq('id', id).maybeSingle(),
    supabase.from('sale_items').select('*').eq('sale_id', id).order('product_name'),
    supabase.from('refunds').select('*, profiles(full_name)').eq('sale_id', id).order('created_at'),
    supabase
      .from('restaurant_settings')
      .select('name, tagline, logo_url, address, phone, email, currency, receipt_footer, receipt_format, timezone')
      .eq('id', 1)
      .maybeSingle(),
  ]);

  const error = sale.error ?? items.error ?? refunds.error ?? settings.error;
  if (error) throw new Error(error.message);
  if (!sale.data) return null;

  return {
    sale: sale.data,
    items: items.data ?? [],
    refunds: (refunds.data ?? []).map(({ profiles, ...refund }) => ({
      ...refund,
      user_name: (profiles as { full_name: string } | null)?.full_name ?? null,
    })),
    settings: settings.data ?? DEFAULT_SETTINGS,
  };
}
