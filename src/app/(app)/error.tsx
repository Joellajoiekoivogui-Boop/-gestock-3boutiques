'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const network = /fetch failed|network|ECONN/i.test(error.message);
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-warning text-warning-foreground">
        <AlertTriangle className="size-6" aria-hidden />
      </span>
      <h1 className="text-lg font-semibold">
        {network ? 'Connexion à la base de données impossible' : 'Une erreur est survenue'}
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {network
          ? 'Vérifiez votre connexion Internet. Aucune donnée n’a été perdue : réessayez dans un instant.'
          : 'La page n’a pas pu être chargée. Réessayez ; si le problème persiste, contactez l’administrateur.'}
      </p>
      {error.digest && <p className="text-xs text-muted-foreground">Référence : {error.digest}</p>}
      <Button onClick={() => reset()}>Réessayer</Button>
    </div>
  );
}
