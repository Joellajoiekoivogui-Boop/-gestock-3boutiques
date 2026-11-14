import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/app/logo';
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
    <main className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)]">
      {/* Bandeau de marque : lisière noire, nom de l'établissement, coloris. */}
      <section className="flex flex-col justify-between gap-8 bg-foreground px-6 py-8 text-background sm:px-10 lg:py-12">
        <Logo logoUrl={branding.logo_url} name={branding.name} size={56} className="mg-pop-in" />
        <div className="mg-rise">
          <h1 className="font-display text-5xl leading-[0.95] font-bold tracking-tight sm:text-6xl lg:text-7xl">{branding.name}</h1>
          {branding.tagline && (
            <p className="mt-4 font-display text-lg font-semibold tracking-[0.16em] text-background/75 uppercase">
              {branding.tagline}
            </p>
          )}
        </div>
        <div aria-hidden className="flex gap-2">
          {[1, 2, 3, 4, 5, 6].map((t) => (
            <span key={t} className="h-2 flex-1 rounded-full" style={{ backgroundColor: `var(--cat-${t})` }} />
          ))}
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-10 sm:px-10">
        <div className="mg-rise w-full max-w-sm [animation-delay:120ms]">
          <h2 className="font-display text-4xl font-bold">Connexion</h2>
          <p className="mt-2 mb-8 text-muted-foreground">Accès réservé au personnel. Les comptes sont créés par l’administrateur.</p>
          <LoginForm next={next} initialError={inactive ? 'Votre compte est désactivé. Contactez l’administrateur.' : null} />
        </div>
      </section>
    </main>
  );
}
