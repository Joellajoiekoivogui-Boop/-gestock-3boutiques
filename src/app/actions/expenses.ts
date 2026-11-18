'use server';

import { revalidatePath } from 'next/cache';
import { authorizeAdmin, authorizeUser } from '@/lib/auth';
import { DENIED, fail, toUserMessage, type ActionResult } from '@/lib/errors';
import { isAdmin } from '@/lib/permissions';
import { getShopScope } from '@/lib/shop';
import { createClient } from '@/lib/supabase/server';
import { expenseSchema, fieldErrorsOf, idSchema, type ExpenseInput } from '@/lib/validation';
import { isDay } from '@/lib/dates';

function revalidateDay() {
  revalidatePath('/pos/sales');
  revalidatePath('/admin/dashboard');
}

/**
 * Noter une dépense payée avec l'argent de la caisse. Le caissier note
 * toujours dans sa boutique et pour la journée en cours (imposé par la base) ;
 * l'administrateur note dans la boutique choisie, pour le jour affiché.
 */
export async function addExpenseAction(input: ExpenseInput, day?: string): Promise<ActionResult> {
  const session = await authorizeUser();
  if (!session) return fail(DENIED);
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return fail('Vérifiez la dépense.', fieldErrorsOf(parsed.error));

  const admin = isAdmin(session.profile);
  const scope = await getShopScope();
  if (admin && !scope.current) return fail('Choisissez d’abord la boutique en haut de l’écran.');

  const supabase = await createClient();
  const { error } = await supabase.rpc('add_expense', {
    p_label: parsed.data.label,
    p_amount: parsed.data.amount,
    ...(admin ? { p_shop_id: scope.current?.id ?? null, p_day: isDay(day) ? day : null } : {}),
  });
  if (error) return fail(toUserMessage(error, 'La dépense n’a pas pu être enregistrée. Réessayez.'));
  revalidateDay();
  return { ok: true, data: undefined };
}

/** Supprimer une dépense mal saisie : administrateur seulement, tracé au journal. */
export async function deleteExpenseAction(id: string): Promise<ActionResult> {
  if (!(await authorizeAdmin())) return fail(DENIED);
  if (!idSchema.safeParse(id).success) return fail('Dépense invalide.');
  const supabase = await createClient();
  const { data: existing } = await supabase.from('expenses').select('id').eq('id', id).maybeSingle();
  if (!existing) return fail('Dépense introuvable.');
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) return fail(toUserMessage(error));
  revalidateDay();
  return { ok: true, data: undefined };
}
