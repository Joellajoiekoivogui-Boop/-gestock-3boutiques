'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'grid', placeItems: 'center', minHeight: '100dvh' }}>
        <div style={{ textAlign: 'center', padding: 16 }}>
          <h1>Une erreur est survenue</h1>
          <p>L’application a rencontré un problème inattendu.</p>
          <button onClick={() => reset()} style={{ padding: '8px 16px', background: '#0ABF65', border: 0, borderRadius: 8 }}>
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
