export const TICKET_STATUS_ORDER = ['OPEN', 'AWAITING_USER', 'CLOSED'] as const;

export const TICKET_STATUS_LABEL: Record<string, string> = {
  OPEN: 'مفتوحة',
  AWAITING_USER: 'بانتظار الطالب',
  CLOSED: 'مغلقة'
};
