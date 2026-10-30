import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/app/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PaymentMethodsCard } from './payment-methods';
import { LogoCard, SettingsForm } from './settings-form';

export const metadata: Metadata = { title: 'Paramètres' };

export default async function SettingsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [settings, methods] = await Promise.all([
    supabase.from('restaurant_settings').select('*').eq('id', 1).single(),
    supabase.from('payment_methods').select('*').order('sort_order'),
  ]);
  if (settings.error) throw new Error(settings.error.message);

  return (
    <div>
      <PageHeader title="Paramètres" description="Établissement, reçus, stocks et moyens de paiement." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <SettingsForm settings={settings.data} />
        <div className="space-y-6">
          <LogoCard settings={settings.data} />
          <PaymentMethodsCard methods={methods.data ?? []} />
          <Card>
            <CardHeader>
              <CardTitle>Catégories de produits</CardTitle>
              <CardDescription>Ajoutez, renommez ou désactivez les catégories de la caisse.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/admin/categories">Gérer les catégories</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
