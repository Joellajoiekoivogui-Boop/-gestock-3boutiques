'use server';

import { revalidatePath } from 'next/cache';
import { authorizeUser } from '@/lib/auth';
import { DENIED, fail, toUserMessage, type ActionResult } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { customerSchema, fieldErrorsOf, idSchema, settleCreditSchema, type CustomerInput } from '@/lib/validation';

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

  revalidatePath('/credits', 'layout');
  revalidatePath('/pos/sales');
  revalidatePath('/admin/sales');
  revalidatePath('/admin/dashboard');
  return { ok: true, data: undefined };
}

// Ouvrir un dossier client (nom obligatoire, téléphone unique).
export async function createCustomerAction(input: CustomerInput): Promise<ActionResult<{ id: string }>> {
  const session = await authorizeUser();
  if (!session) return fail(DENIED);
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) return fail('Vérifiez le nom et le téléphone.', fieldErrorsOf(parsed.error));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_customer', {
    p_name: parsed.data.name,
    p_phone: parsed.data.phone ?? null,
    p_note: parsed.data.note ?? null,
  });
  if (error || !data) return fail(toUserMessage(error, 'Le dossier n’a pas pu être créé. Réessayez.'));
  revalidatePath('/credits', 'layout');
  return { ok: true, data: { id: data as string } };
}

// Corriger un dossier (administrateur uniquement, vérifié aussi par la base).
export async function updateCustomerAction(id: string, input: CustomerInput): Promise<ActionResult> {
  const session = await authorizeUser();
  if (!session || session.profile.role !== 'admin') return fail(DENIED);
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success || !idSchema.safeParse(id).success) return fail('Vérifiez le nom et le téléphone.');

  const supabase = await createClient();
  const { error } = await supabase
    .from('customers')
    .update({ name: parsed.data.name, phone: parsed.data.phone ?? null, note: parsed.data.note ?? null })
    .eq('id', id);
  if (error) return fail(toUserMessage(error, 'Le dossier n’a pas pu être modifié.'));
  revalidatePath('/credits', 'layout');
  return { ok: true, data: undefined };
}
