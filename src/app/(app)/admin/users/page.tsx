import type { Metadata } from 'next';
import { PageHeader } from '@/components/app/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { UsersManager } from './users-manager';

export const metadata: Metadata = { title: 'Utilisateurs' };

export default async function UsersPage() {
  const session = await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from('profiles').select('*').order('is_active', { ascending: false }).order('full_name');
  if (error) throw new Error(error.message);

  return (
    <div>
      <PageHeader title="Utilisateurs" description="Comptes, rôles et permissions du personnel." />
      <Card>
        <CardContent>
          <UsersManager
            users={data ?? []}
            currentUserId={session.userId}
            canManageAuth={Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
