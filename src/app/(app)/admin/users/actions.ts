'use server';

import { revalidatePath } from 'next/cache';
import { authorizeAdmin } from '@/lib/auth';
import { DENIED, fail, toUserMessage, type ActionResult } from '@/lib/errors';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  createUserSchema,
  fieldErrorsOf,
  resetPasswordSchema,
  updateUserSchema,
  type CreateUserValues,
  type ResetPasswordValues,
  type UpdateUserValues,
} from '@/lib/validation';

const NO_SERVICE_KEY =
  'La gestion des comptes nécessite la variable SUPABASE_SERVICE_ROLE_KEY côté serveur (voir README).';
const BAN_FOREVER = '876000h'; // ~100 ans : bloque la connexion et le renouvellement de session

export async function createUserAction(values: CreateUserValues): Promise<ActionResult> {
  if (!(await authorizeAdmin())) return fail(DENIED);
  const parsed = createUserSchema.safeParse(values);
  if (!parsed.success) return fail('Vérifiez le formulaire.', fieldErrorsOf(parsed.error));
  const admin = createAdminClient();
  if (!admin) return fail(NO_SERVICE_KEY);

  const { email, password, fullName, role, permissions } = parsed.data;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) {
    if (error?.code === 'email_exists' || /already been registered/i.test(error?.message ?? '')) {
      return fail('Un compte existe déjà avec cet e-mail.', { email: ['E-mail déjà utilisé.'] });
    }
    if (error?.code === 'weak_password') return fail('Mot de passe trop faible.', { password: ['Mot de passe trop faible.'] });
    return fail('Le compte n’a pas pu être créé. Réessayez.');
  }

  // Le profil (créé inactif par la base) est activé avec la session de
  // l'administrateur : le journal d'activité garde son nom.
  const supabase = await createClient();
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ full_name: fullName, role, permissions: role === 'admin' ? [] : permissions, is_active: true })
    .eq('id', data.user.id);
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return fail(toUserMessage(profileError));
  }

  await supabase.rpc('log_admin_event', {
    p_action: 'user.created',
    p_entity_type: 'profiles',
    p_entity_id: data.user.id,
    p_details: { email, role },
  });
  revalidatePath('/admin/users');
  return { ok: true, data: undefined };
}

export async function updateUserAction(values: UpdateUserValues): Promise<ActionResult> {
  const session = await authorizeAdmin();
  if (!session) return fail(DENIED);
  const parsed = updateUserSchema.safeParse(values);
  if (!parsed.success) return fail('Vérifiez le formulaire.', fieldErrorsOf(parsed.error));
  const { id, fullName, role, permissions, isActive } = parsed.data;

  if (id === session.userId && (!isActive || role !== 'admin')) {
    return fail('Vous ne pouvez pas désactiver votre propre compte ni retirer votre rôle d’administrateur.');
  }

  const supabase = await createClient();
  const { data: before } = await supabase.from('profiles').select('is_active').eq('id', id).maybeSingle();
  if (!before) return fail('Utilisateur introuvable.');

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName, role, permissions: role === 'admin' ? [] : permissions, is_active: isActive })
    .eq('id', id);
  if (error) return fail(toUserMessage(error));

  // Désactivation : on coupe aussi les sessions côté Supabase Auth.
  if (before.is_active !== isActive) {
    const admin = createAdminClient();
    if (admin) await admin.auth.admin.updateUserById(id, { ban_duration: isActive ? 'none' : BAN_FOREVER });
  }

  revalidatePath('/admin/users');
  return { ok: true, data: undefined };
}

export async function resetPasswordAction(values: ResetPasswordValues): Promise<ActionResult> {
  if (!(await authorizeAdmin())) return fail(DENIED);
  const parsed = resetPasswordSchema.safeParse(values);
  if (!parsed.success) return fail('Vérifiez le formulaire.', fieldErrorsOf(parsed.error));
  const admin = createAdminClient();
  if (!admin) return fail(NO_SERVICE_KEY);

  const { error } = await admin.auth.admin.updateUserById(parsed.data.id, { password: parsed.data.password });
  if (error) return fail('Le mot de passe n’a pas pu être modifié. Réessayez.');

  const supabase = await createClient();
  await supabase.rpc('log_admin_event', {
    p_action: 'user.password_reset',
    p_entity_type: 'profiles',
    p_entity_id: parsed.data.id,
    p_details: {},
  });
  revalidatePath('/admin/users');
  return { ok: true, data: undefined };
}
