// Variables publiques Supabase (URL du projet + clé « anon » / « publishable »).
// Ces deux valeurs sont prévues pour être visibles dans le navigateur : la
// sécurité repose sur les politiques RLS, pas sur leur secret.
export function getSupabaseEnv(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export class SupabaseConfigError extends Error {
  constructor() {
    super('Supabase n’est pas configuré : NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY sont requis.');
    this.name = 'SupabaseConfigError';
  }
}
