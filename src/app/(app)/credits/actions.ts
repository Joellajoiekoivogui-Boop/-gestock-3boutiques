'use server';

import { revalidatePath } from 'next/cache';
import { authorizeUser } from '@/lib/auth';
import { DENIED, fail, toUserMessage, type ActionResult } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { settleCreditSchema } from '@/lib/validation';

// Le client vient payer son crédit : la fonction SQL settle_credit vérifie les
// droits, le statut et le mode de paiement, puis laisse une trace au journal.
export async function settleCreditAction(input: { saleId: string; paymentMethod: string }): Promise<ActionResult> {
  const session = await authorizeUser();
  if (!session) return fail(DENIED);

  const parsed = settleCreditSchema.safeParse(input);
  if (!parsed.success) return fail('Demande invalide.');

  const supabase = await createClient();
  const { error } = await supabase.rpc('settle_credit', {
    p_sale_id: parsed.data.saleId,
    p_payment_method: parsed.data.paymentMethod,
  });
  if (error) return fail(toUserMessage(error, 'Le crédit n’a pas pu être encaissé. Réessayez.'));

  revalidatePath('/credits');
  revalidatePath('/pos/sales');
  revalidatePath('/admin/sales');
  revalidatePath('/admin/dashboard');
  return { ok: true, data: undefined };
}
