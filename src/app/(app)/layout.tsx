import { AppShell } from '@/components/app/app-shell';
import { getSettings, requireUser } from '@/lib/auth';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser();
  const settings = await getSettings();
  return (
    <AppShell
      profile={session.profile}
      brand={{ name: settings?.name ?? 'MassaGui Fils SARL.U', logoUrl: settings?.logo_url ?? null }}
    >
      {children}
    </AppShell>
  );
}
