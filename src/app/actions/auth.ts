'use server';

import { redirect } from 'next/navigation';
import { homePathFor } from '@/lib/auth';
import { fail, isNetworkError, type ActionResult } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { loginSchema, type LoginInput } from '@/lib/validation';

const SAFE_NEXT = /^\/(admin|pos|receipts)(\/[\w\-./]*)?$/;

export async function loginAction(values: LoginInput, next?: string | null): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(values);
  if (!parsed.success) return fail('Vérifiez l’e-mail et le mot de passe.');

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.user) {
    if (error && isNetworkError(error)) {
      return fail('Connexion au serveur impossible. Vérifiez votre connexion Internet puis réessayez.');
    }
    if (error?.status === 429) return fail('Trop de tentatives. Patientez quelques minutes avant de réessayer.');
    if (error?.code === 'email_not_confirmed') return fail('Adresse e-mail non confirmée. Contactez l’administrateur.');
    return fail('E-mail ou mot de passe incorrect.');
  }

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    return fail('Votre compte est désactivé ou pas encore activé. Contactez l’administrateur.');
  }

  const destination = next && SAFE_NEXT.test(next) && !next.includes('..') ? next : homePathFor(profile);
  redirect(destination);
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
