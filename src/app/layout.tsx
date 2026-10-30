import type { Metadata, Viewport } from 'next';
import { MotionProvider } from '@/components/motion/motion-provider';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'MassaGui Fils SARL.U', template: '%s · MassaGui Fils' },
  description: 'Gestion du restaurant MassaGui Fils SARL.U : caisse, reçus, stocks et rapports.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#0ABF65',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <MotionProvider>{children}</MotionProvider>
        <Toaster />
      </body>
    </html>
  );
}
