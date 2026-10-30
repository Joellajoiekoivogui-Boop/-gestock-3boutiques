'use server';

import { revalidatePath } from 'next/cache';
import { authorizeUser } from '@/lib/auth';
import type { CreateSaleResult } from '@/lib/database.types';
import { DENIED, fail, toUserMessage, type ActionResult } from '@/lib/errors';
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
  const { items, paymentMethod, discount, idempotencyKey, note } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_sale', {
    p_items: items.map((item) => ({ product_id: item.productId, quantity: item.quantity })),
    p_payment_method: paymentMethod,
    p_idempotency_key: idempotencyKey,
    p_discount_amount: discount,
    p_note: note,
  });

  if (error || !data) {
    return fail(toUserMessage(error, 'La vente n’a pas pu être enregistrée. Réessayez.'));
  }

  revalidatePath('/pos');
  revalidatePath('/admin/dashboard');
  return { ok: true, data: data as CreateSaleResult };
}
