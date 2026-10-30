import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SaleDetail } from '@/components/sales/sale-detail';
import { requirePermission } from '@/lib/auth';
import { getSaleDetails } from '@/lib/sales';

export const metadata: Metadata = { title: 'Détail de la vente' };

export default async function SaleDetailPage({ params }: PageProps<'/admin/sales/[id]'>) {
  const session = await requirePermission('view_all_sales');
  const { id } = await params;
  const data = await getSaleDetails(id);
  if (!data) notFound();
  return <SaleDetail data={data} profile={session.profile} backHref="/admin/sales" />;
}
