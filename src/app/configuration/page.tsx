import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getSupabaseEnv } from '@/lib/supabase/env';

export const metadata: Metadata = { title: 'Configuration requise' };
export const dynamic = 'force-dynamic';

// Affichée tant que les variables Supabase ne sont pas définies.
export default function ConfigurationPage() {
  if (getSupabaseEnv()) redirect('/login');
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Configuration Supabase manquante</CardTitle>
          <CardDescription>L’application ne peut pas encore se connecter à sa base de données.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>Définissez ces variables d’environnement (fichier <code>.env.local</code> en local, ou réglages du projet Vercel) puis redémarrez :</p>
          <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
{`NEXT_PUBLIC_SUPABASE_URL=https://<projet>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<clé anon / publishable>
SUPABASE_SERVICE_ROLE_KEY=<clé service_role — serveur uniquement>`}
          </pre>
          <p className="text-muted-foreground">La procédure complète est décrite dans le fichier README.md du projet.</p>
        </CardContent>
      </Card>
    </main>
  );
}
