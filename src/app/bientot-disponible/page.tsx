import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSupabaseEnv } from '@/lib/supabase/env';

export const metadata: Metadata = { title: 'Bientôt disponible' };
export const dynamic = 'force-dynamic';

// Page publique affichée tant que la base de données n'est pas branchée.
// Volontairement sans détail technique ; la mise en service est décrite
// dans le README.
export default function ComingSoonPage() {
  if (getSupabaseEnv()) redirect('/login');

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background p-4">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="mg-aurora mg-aurora-a top-[-10%] left-[-8%] size-[48vmax] bg-primary/45" />
        <div className="mg-aurora mg-aurora-b right-[-12%] bottom-[-14%] size-[42vmax] bg-chart-5/60" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0,var(--background)_70%)]" />
      </div>

      <div className="relative flex max-w-md flex-col items-center text-center">
        <span
          role="img"
          aria-label="Logo MassaGui Fils SARL.U"
          className="mg-pop-in mb-6 inline-flex size-20 items-center justify-center rounded-2xl bg-primary text-3xl font-bold text-primary-foreground shadow-lg"
        >
          MG
        </span>
        <h1 className="mg-rise text-3xl font-bold tracking-tight text-balance [animation-delay:120ms]">
          MassaGui Fils SARL.U
        </h1>
        <p className="mg-rise mt-1 text-sm font-medium tracking-wide text-muted-foreground uppercase [animation-delay:180ms]">
          Hôtellerie — Restaurant
        </p>
        <p className="mg-rise mt-8 text-lg text-balance [animation-delay:260ms]">
          Notre espace de caisse et de gestion ouvre très bientôt.
        </p>
        <p className="mg-rise mt-2 text-sm text-muted-foreground [animation-delay:320ms]">
          Merci de votre patience, et à très vite.
        </p>
        <span className="mg-rise mt-8 inline-flex items-center gap-2 rounded-full bg-card/80 px-4 py-2 text-sm font-medium shadow-sm backdrop-blur-sm [animation-delay:400ms]">
          <span className="relative flex size-2.5" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
          </span>
          Mise en service en cours
        </span>
      </div>
    </main>
  );
}
