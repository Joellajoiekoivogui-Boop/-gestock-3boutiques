// Traduit les erreurs Supabase / PostgreSQL en messages compréhensibles.
// Les fonctions SQL lèvent des messages métier déjà rédigés en français
// (code P0001) : ils sont affichés tels quels. Les messages techniques
// (en anglais) ne sont jamais montrés à l'utilisateur.

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

type ErrorLike = { code?: string; message?: string } | null | undefined;

const NETWORK_MESSAGE =
  'Connexion à la base de données impossible. Vérifiez votre connexion Internet puis réessayez.';

export function isNetworkError(error: ErrorLike): boolean {
  const message = error?.message ?? '';
  return /fetch failed|Failed to fetch|NetworkError|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|network/i.test(message);
}

export function toUserMessage(error: ErrorLike, fallback = 'Une erreur inattendue est survenue. Réessayez.'): string {
  if (!error) return fallback;
  const code = error.code ?? '';
  const message = error.message ?? '';

  if (isNetworkError(error)) return NETWORK_MESSAGE;

  switch (code) {
    case 'P0001':
      return message || fallback;
    case '42501':
      return /permission denied|row-level security/i.test(message) ? 'Action non autorisée.' : message;
    case '28000':
    case 'PGRST301':
      return 'Votre session a expiré. Reconnectez-vous.';
    case '23503':
      return 'Cet élément est utilisé ailleurs (ventes, produits ou historique) : il ne peut pas être supprimé. Désactivez-le plutôt.';
    case '23505':
      return /duplicate key/i.test(message) ? 'Cette valeur existe déjà.' : message;
    case '23514':
    case '22P02':
    case '22023':
      return /^[A-ZÀ-Ý]/.test(message) && !/violates|invalid input/i.test(message)
        ? message
        : 'Une valeur saisie est invalide.';
    default:
      return fallback;
  }
}

export function fail(error: string, fieldErrors?: Record<string, string[] | undefined>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

export const DENIED = 'Accès refusé : vous n’avez pas les droits nécessaires.';
