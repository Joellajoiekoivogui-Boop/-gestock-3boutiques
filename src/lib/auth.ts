import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import type { ProfileRow, SettingsRow } from '@/lib/database.types';
import { can, isAdmin, type Permission } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';

export type Session = { userId: string; email: string | null; profile: ProfileRow };

// Une seule vérification par requête (React cache). getUser() valide le jeton
// auprès de Supabase Auth : on ne se fie jamais au seul cookie.
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (!profile) return null;
  return { userId: user.id, email: user.email ?? null, profile };
});

export const getSettings = cache(async (): Promise<SettingsRow | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from('restaurant_settings').select('*').eq('id', 1).maybeSingle();
  return data;
});

export function homePathFor(profile: ProfileRow): string {
  return profile.role === 'admin' ? '/admin/dashboard' : '/pos';
}

// --- Gardes pour les pages (redirigent) -------------------------------------

export async function requireUser(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!session.profile.is_active) redirect('/login?error=inactive');
  return session;
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireUser();
  if (!isAdmin(session.profile)) redirect('/pos');
  return session;
}

export async function requirePermission(permission: Permission): Promise<Session> {
  const session = await requireUser();
  if (!can(session.profile, permission)) redirect(homePathFor(session.profile));
  return session;
}

// --- Gardes pour les actions serveur (renvoient null si refus) --------------

export async function authorizeAdmin(): Promise<Session | null> {
  const session = await getSession();
  return session && isAdmin(session.profile) ? session : null;
}

export async function authorizeUser(): Promise<Session | null> {
  const session = await getSession();
  return session && session.profile.is_active ? session : null;
}

export async function authorizePermission(permission: Permission): Promise<Session | null> {
  const session = await getSession();
  return session && can(session.profile, permission) ? session : null;
}
