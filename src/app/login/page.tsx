import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/app/logo';
import { Card, CardContent } from '@/components/ui/card';
import { getSession, homePathFor } from '@/lib/auth';
import type { Branding } from '@/lib/database.types';
import { createClient } from '@/lib/supabase/server';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Connexion' };

async function getBranding(): Promise<Branding> {
  const fallback: Branding = { name: 'MassaGui Fils SARL.U', tagline: 'Hôtellerie — Restaurant', logo_url: null };
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc('get_branding');
    return data ? { ...fallback, ...(data as Branding) } : fallback;
  } catch {
    return fallback;
  }
}

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const params = await searchParams;
  const session = await getSession().catch(() => null);
  if (session?.profile.is_active) redirect(homePathFor(session.profile));

  const branding = await getBranding();
  const next = typeof params.next === 'string' ? params.next : null;
  const inactive = params.error === 'inactive';

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo logoUrl={branding.logo_url} name={branding.name} size={72} className="mb-4 rounded-xl" />
          <h1 className="text-2xl font-bold tracking-tight">{branding.name}</h1>
          {branding.tagline && <p className="mt-1 text-sm text-muted-foreground">{branding.tagline}</p>}
        </div>
        <Card>
          <CardContent>
            <h2 className="mb-4 text-lg font-semibold">Connexion</h2>
            <LoginForm next={next} initialError={inactive ? 'Votre compte est désactivé. Contactez l’administrateur.' : null} />
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Accès réservé au personnel. Les comptes sont créés par l’administrateur.
        </p>
      </div>
    </main>
  );
}
