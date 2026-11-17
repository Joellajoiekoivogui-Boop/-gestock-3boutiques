import { Badge } from '@/components/ui/badge';
import type { SaleStatus } from '@/lib/database.types';
import { SALE_STATUS_LABELS } from '@/lib/format';

const VARIANTS: Record<SaleStatus, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  completed: 'success',
  partially_refunded: 'warning',
  refunded: 'secondary',
  cancelled: 'destructive',
};

export function SaleStatusBadge({ status, unpaid = false }: { status: SaleStatus; unpaid?: boolean }) {
  if (unpaid && status !== 'cancelled') return <Badge variant="warning">À crédit</Badge>;
  return <Badge variant={VARIANTS[status]}>{SALE_STATUS_LABELS[status]}</Badge>;
}
