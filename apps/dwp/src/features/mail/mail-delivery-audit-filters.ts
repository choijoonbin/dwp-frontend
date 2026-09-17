export type MailDeliveryAuditFilters = Readonly<{
  query?: string;
  accountId?: string;
  provider?: string;
  command?: 'SEND';
  dateFrom?: string;
  dateTo?: string;
  state?: string;
  page: number;
  pageSize: number;
}>;

const DATE = /^\d{4}-\d{2}-\d{2}$/u;

export function mailDeliveryAuditFiltersFromSearch(
  search: URLSearchParams
): MailDeliveryAuditFilters {
  const page = Number(search.get('page') ?? 0);
  const pageSize = Number(search.get('pageSize') ?? 50);
  const dateFrom = search.get('dateFrom');
  const dateTo = search.get('dateTo');
  const command = search.get('command');
  return {
    ...(search.get('query') || search.get('correlationId')
      ? { query: (search.get('query') || search.get('correlationId'))! }
      : {}),
    ...(search.get('accountId') ? { accountId: search.get('accountId')! } : {}),
    ...(search.get('provider') ? { provider: search.get('provider')! } : {}),
    ...(command === 'SEND' ? { command } : {}),
    ...(dateFrom && DATE.test(dateFrom) ? { dateFrom } : {}),
    ...(dateTo && DATE.test(dateTo) ? { dateTo } : {}),
    ...(search.get('state') ? { state: search.get('state')! } : {}),
    page: Number.isInteger(page) && page >= 0 ? page : 0,
    pageSize: Number.isInteger(pageSize) && pageSize > 0 && pageSize <= 100 ? pageSize : 50,
  };
}

export function updateMailDeliveryAuditFilterSearch(
  current: URLSearchParams,
  filters: MailDeliveryAuditFilters
) {
  const next = new URLSearchParams(current);
  next.delete('correlationId');
  for (const key of [
    'query',
    'accountId',
    'provider',
    'command',
    'dateFrom',
    'dateTo',
    'state',
  ] as const) {
    const value = filters[key];
    if (value) next.set(key, value);
    else next.delete(key);
  }
  if (filters.page > 0) next.set('page', String(filters.page));
  else next.delete('page');
  if (filters.pageSize !== 50) next.set('pageSize', String(filters.pageSize));
  else next.delete('pageSize');
  return next;
}
