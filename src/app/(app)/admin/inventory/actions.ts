'use server';

import { revalidatePath } from 'next/cache';
import { authorizePermission } from '@/lib/auth';
import { DENIED, fail, toUserMessage, type ActionResult } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { fieldErrorsOf, stockMovementSchema, type StockMovementValues } from '@/lib/validation';

export async function recordStockMovementAction(values: StockMovementValues): Promise<ActionResult<{ stock: number }>> {
  if (!(await authorizePermission('manage_stock'))) return fail(DENIED);
  const parsed = stockMovementSchema.safeParse(values);
  if (!parsed.success) return fail('Vérifiez le formulaire.', fieldErrorsOf(parsed.error));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('record_stock_movement', {
    p_product_id: parsed.data.productId,
    p_movement_type: parsed.data.type,
    p_quantity: parsed.data.quantity,
    p_reason: parsed.data.reason,
  });
  if (error) return fail(toUserMessage(error));

  revalidatePath('/admin/inventory');
  revalidatePath('/admin/products');
  revalidatePath('/pos');
  return { ok: true, data: { stock: Number(data) } };
}
