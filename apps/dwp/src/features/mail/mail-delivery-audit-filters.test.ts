import { describe, expect, it } from 'vitest';

import {
  mailDeliveryAuditFiltersFromSearch,
  updateMailDeliveryAuditFilterSearch,
} from './mail-delivery-audit-filters';

describe('mail delivery audit filters', () => {
  it('round trips server filters and pagination through the URL', () => {
    const filters = mailDeliveryAuditFiltersFromSearch(
      new URLSearchParams(
        'query=correlation-51&accountId=account-1&provider=GOOGLE_GMAIL&command=SEND&dateFrom=2026-09-01&dateTo=2026-09-17&state=UNKNOWN&page=1&pageSize=50'
      )
    );
    expect(filters).toEqual({
      query: 'correlation-51',
      accountId: 'account-1',
      provider: 'GOOGLE_GMAIL',
      command: 'SEND',
      dateFrom: '2026-09-01',
      dateTo: '2026-09-17',
      state: 'UNKNOWN',
      page: 1,
      pageSize: 50,
    });
    expect(updateMailDeliveryAuditFilterSearch(new URLSearchParams(), filters).toString()).toBe(
      'query=correlation-51&accountId=account-1&provider=GOOGLE_GMAIL&command=SEND&dateFrom=2026-09-01&dateTo=2026-09-17&state=UNKNOWN&page=1'
    );
  });
});
