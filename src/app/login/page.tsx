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
    <main className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)]">
      {/* Bandeau de marque, vert sapin et or. */}
      <section className="flex flex-col justify-between gap-10 bg-forest px-6 py-8 text-forest-foreground sm:px-12 lg:py-14">
        <Logo logoUrl={branding.logo_url} name={branding.name} size={56} className="mg-pop-in rounded-2xl" />
        <div className="mg-rise max-w-xl">
          <h1 className="font-serif text-5xl leading-[1.05] font-bold sm:text-6xl">{branding.name}</h1>
          {branding.tagline && (
            <p className="mt-5 text-sm font-semibold tracking-[0.24em] text-gold uppercase">• {branding.tagline} •</p>
          )}
        </div>
        <p className="max-w-sm text-forest-foreground/75">Caisse, reçus, stocks et chiffres du restaurant, au même endroit.</p>
      </section>

      <section className="flex items-center justify-center px-6 py-12 sm:px-12">
        <div className="mg-rise w-full max-w-sm [animation-delay:120ms]">
          <h2 className="font-serif text-4xl font-bold">Connexion</h2>
          <p className="mt-2 mb-8 text-muted-foreground">Accès réservé au personnel. Les comptes sont créés par l’administrateur.</p>
          <LoginForm next={next} initialError={inactive ? 'Votre compte est désactivé. Contactez l’administrateur.' : null} />
        </div>
      </section>
    </main>
  );
}
