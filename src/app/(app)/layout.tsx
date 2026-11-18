import { AppShell } from '@/components/app/app-shell';
import { getSettings, requireUser } from '@/lib/auth';
import { getShopScope } from '@/lib/shop';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser();
  const [settings, scope] = await Promise.all([getSettings(), getShopScope()]);
  return (
    <AppShell
      profile={session.profile}
      brand={{ name: settings?.name ?? 'MassaGui Fils SARL.U', logoUrl: settings?.logo_url ?? null }}
      shop={{
        choices: scope.canChoose ? scope.shops.map(({ id, name }) => ({ id, name })) : [],
        currentId: scope.current?.id ?? null,
        label: scope.current?.name ?? null,
      }}
    >
      {children}
    </AppShell>
  );
}
