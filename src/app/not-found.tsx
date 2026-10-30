import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-4 text-center">
      <p className="text-5xl font-bold text-primary">404</p>
      <h1 className="text-xl font-semibold">Page introuvable</h1>
      <p className="text-sm text-muted-foreground">Cette page n’existe pas ou vous n’y avez pas accès.</p>
      <Button asChild>
        <Link href="/">Retour à l’accueil</Link>
      </Button>
    </main>
  );
}
