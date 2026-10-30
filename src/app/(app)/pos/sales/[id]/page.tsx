import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SaleDetail } from '@/components/sales/sale-detail';
import { requireUser } from '@/lib/auth';
import { getSaleDetails } from '@/lib/sales';

export const metadata: Metadata = { title: 'Détail de la vente' };

export default async function MySaleDetailPage({ params }: PageProps<'/pos/sales/[id]'>) {
  const session = await requireUser();
  const { id } = await params;
  // RLS : un caissier n'obtient que ses propres ventes.
  const data = await getSaleDetails(id);
  if (!data) notFound();
  return <SaleDetail data={data} profile={session.profile} backHref="/pos/sales" />;
}
