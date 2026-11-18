import type { Metadata } from 'next';
import { PageHeader } from '@/components/app/page-header';
import { requireAdmin } from '@/lib/auth';
import { getShopScope } from '@/lib/shop';
import { createClient } from '@/lib/supabase/server';
import { UsersManager } from './users-manager';

export const metadata: Metadata = { title: 'Utilisateurs' };

export default async function UsersPage() {
  const session = await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from('profiles').select('*').order('is_active', { ascending: false }).order('full_name');
  if (error) throw new Error(error.message);
  const { shops } = await getShopScope();

  return (
    <div>
      <PageHeader title="Utilisateurs" description="Comptes, rôles, boutiques et permissions du personnel." />
      <UsersManager
        users={data ?? []}
        currentUserId={session.userId}
        canManageAuth={Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)}
        shops={shops.map(({ id, name }) => ({ id, name }))}
      />
    </div>
  );
}
