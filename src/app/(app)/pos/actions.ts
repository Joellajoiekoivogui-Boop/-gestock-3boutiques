'use server';

import { revalidatePath } from 'next/cache';
import { authorizeUser } from '@/lib/auth';
import type { CreateSaleResult } from '@/lib/database.types';
import { DENIED, fail, toUserMessage, type ActionResult } from '@/lib/errors';
import { isAdmin } from '@/lib/permissions';
import { getShopScope } from '@/lib/shop';
import { createClient } from '@/lib/supabase/server';
import { fieldErrorsOf, saleSchema, type SaleInput } from '@/lib/validation';

// Validation d'une vente. Le navigateur n'envoie que des identifiants de
// produits et des quantités : prix, totaux, stock et numéro de reçu sont
// calculés par la fonction SQL create_sale, dans une transaction.
export async function createSaleAction(input: SaleInput): Promise<ActionResult<CreateSaleResult>> {
  const session = await authorizeUser();
  if (!session) return fail(DENIED);

  const parsed = saleSchema.safeParse(input);
  if (!parsed.success) return fail('Le panier contient des données invalides.', fieldErrorsOf(parsed.error));
  const { items, paymentMethod, discount, idempotencyKey, note, customerName, customerPhone, customerId } = parsed.data;
  if (paymentMethod === 'credit' && !customerId && (!customerName || customerName.length < 2)) {
    return fail('Vente à crédit : indiquez le nom du client.');
  }

  // L'administrateur encaisse dans la boutique choisie en haut de l'écran ;
  // le caissier, toujours dans la sienne (imposée par la base).
  const scope = await getShopScope();
  const admin = isAdmin(session.profile);
  if (admin && scope.shops.length > 0 && !scope.current) {
    return fail('Choisissez d’abord la boutique en haut de l’écran.');
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_sale', {
    p_items: items.map((item) => ({ product_id: item.productId, quantity: item.quantity })),
    p_payment_method: paymentMethod,
    p_idempotency_key: idempotencyKey,
    p_discount_amount: discount,
    p_note: note,
    // Paramètres envoyés seulement pour une vente à crédit : une base qui n'a
    // pas encore la migration des crédits continue d'accepter les autres ventes.
    ...(paymentMethod === 'credit'
      ? { p_customer_name: customerName, p_customer_phone: customerPhone, p_customer_id: customerId ?? null }
      : {}),
    ...(admin && scope.current ? { p_shop_id: scope.current.id } : {}),
  });

  if (error || !data) {
    return fail(toUserMessage(error, 'La vente n’a pas pu être enregistrée. Réessayez.'));
  }

  revalidatePath('/pos');
  revalidatePath('/credits', 'layout');
  revalidatePath('/admin/dashboard');
  return { ok: true, data: data as CreateSaleResult };
}
