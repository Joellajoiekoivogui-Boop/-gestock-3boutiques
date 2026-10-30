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
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background p-4">
      {/* Halo vert de la marque, qui dérive lentement en arrière-plan. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="mg-aurora mg-aurora-a top-[-10%] left-[-8%] size-[48vmax] bg-primary/45" />
        <div className="mg-aurora mg-aurora-b right-[-12%] bottom-[-14%] size-[42vmax] bg-[#9be7bf]/60" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0,var(--background)_70%)]" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo logoUrl={branding.logo_url} name={branding.name} size={72} className="mg-pop-in mb-4 rounded-xl shadow-lg" />
          <h1 className="mg-rise text-2xl font-bold tracking-tight [animation-delay:120ms]">{branding.name}</h1>
          {branding.tagline && (
            <p className="mg-rise mt-1 text-sm text-muted-foreground [animation-delay:200ms]">{branding.tagline}</p>
          )}
        </div>
        <Card className="mg-rise border-white/60 bg-card/85 shadow-xl backdrop-blur-md [animation-delay:280ms]">
          <CardContent>
            <h2 className="mb-4 text-lg font-semibold">Connexion</h2>
            <LoginForm next={next} initialError={inactive ? 'Votre compte est désactivé. Contactez l’administrateur.' : null} />
          </CardContent>
        </Card>
        <p className="mg-rise mt-6 text-center text-xs text-muted-foreground [animation-delay:380ms]">
          Accès réservé au personnel. Les comptes sont créés par l’administrateur.
        </p>
      </div>
    </main>
  );
}
