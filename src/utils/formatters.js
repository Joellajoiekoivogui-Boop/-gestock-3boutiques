export const formatMoney = (amount, currency = 'GNF') => {
  if (amount === undefined || amount === null || isNaN(amount)) return `0 ${currency}`;
  const formatted = Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${formatted} ${currency}`;
};

export const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

export const formatDateTime = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const getPaymentMethodLabel = (method) => {
  switch (method) {
    case 'cash':
      return 'Espèces';
    case 'orange_money':
      return 'Orange Money';
    case 'credit':
      return 'Crédit / Dette';
    default:
      return method;
  }
};

export const getPaymentMethodColor = (method) => {
  switch (method) {
    case 'cash':
      return '#10b981'; // green
    case 'orange_money':
      return '#f97316'; // orange
    case 'credit':
      return '#ef4444'; // red
    default:
      return '#6b7280';
  }
};

export const getDebtStatusInfo = (status, dueDate) => {
  const now = new Date();
  const isOverdue = dueDate && new Date(dueDate) < now && status !== 'paid';

  if (status === 'paid') {
    return { label: 'Soldé', badgeClass: 'badge-success', color: '#10b981' };
  }
  if (isOverdue || status === 'overdue') {
    return { label: 'En Retard', badgeClass: 'badge-danger', color: '#ef4444' };
  }
  if (status === 'partial') {
    return { label: 'Partiellement Payé', badgeClass: 'badge-warning', color: '#f59e0b' };
  }
  return { label: 'En Cours', badgeClass: 'badge-info', color: '#3b82f6' };
};
