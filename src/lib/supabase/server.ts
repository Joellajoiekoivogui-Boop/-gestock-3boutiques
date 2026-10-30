import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/database.types';
import { getSupabaseEnv, SupabaseConfigError } from './env';

// Client Supabase lié à la session de l'utilisateur (cookies).
// Toutes les requêtes passent par les politiques RLS avec SON identité.
export async function createClient() {
  // cookies() d'abord : la page est ainsi toujours rendue à la demande
  // (jamais pré-générée au build, même sans configuration).
  const cookieStore = await cookies();
  const env = getSupabaseEnv();
  if (!env) throw new SupabaseConfigError();

  return createServerClient<Database>(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Appelé depuis un Server Component : le proxy rafraîchit la session.
        }
      },
    },
  });
}
