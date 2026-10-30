import { Badge } from '@/components/ui/badge';
import type { SaleStatus } from '@/lib/database.types';
import { SALE_STATUS_LABELS } from '@/lib/format';

const VARIANTS: Record<SaleStatus, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  completed: 'success',
  partially_refunded: 'warning',
  refunded: 'secondary',
  cancelled: 'destructive',
};

export function SaleStatusBadge({ status }: { status: SaleStatus }) {
  return <Badge variant={VARIANTS[status]}>{SALE_STATUS_LABELS[status]}</Badge>;
}
