'use server';

import { revalidatePath } from 'next/cache';
import { authorizePermission } from '@/lib/auth';
import { DENIED, fail, toUserMessage, type ActionResult } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { cancelSaleSchema, fieldErrorsOf, refundSaleSchema, type CancelSaleValues, type RefundSaleValues } from '@/lib/validation';

function revalidateSale(id: string) {
  revalidatePath(`/admin/sales/${id}`);
  revalidatePath(`/pos/sales/${id}`);
  revalidatePath(`/receipts/${id}`);
  revalidatePath('/admin/sales');
  revalidatePath('/admin/dashboard');
}

export async function cancelSaleAction(values: CancelSaleValues): Promise<ActionResult> {
  if (!(await authorizePermission('cancel_sales'))) return fail(DENIED);
  const parsed = cancelSaleSchema.safeParse(values);
  if (!parsed.success) return fail('Vérifiez le formulaire.', fieldErrorsOf(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.rpc('cancel_sale', { p_sale_id: parsed.data.saleId, p_reason: parsed.data.reason });
  if (error) return fail(toUserMessage(error));

  revalidateSale(parsed.data.saleId);
  return { ok: true, data: undefined };
}

export async function refundSaleAction(values: RefundSaleValues): Promise<ActionResult> {
  if (!(await authorizePermission('refund_sales'))) return fail(DENIED);
  const parsed = refundSaleSchema.safeParse(values);
  if (!parsed.success) return fail('Vérifiez le formulaire.', fieldErrorsOf(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.rpc('refund_sale', {
    p_sale_id: parsed.data.saleId,
    p_amount: parsed.data.amount,
    p_reason: parsed.data.reason,
  });
  if (error) return fail(toUserMessage(error));

  revalidateSale(parsed.data.saleId);
  return { ok: true, data: undefined };
}
