import { describe, expect, it } from 'vitest';

import { approvalRequestBelongsToView } from './approval-request-lifecycle-deep-link';

describe('approval request lifecycle deep links', () => {
  it.each([
    ['drafts', 'DRAFT'],
    ['submitted', 'SUBMITTED'],
    ['submitted', 'IN_REVIEW'],
    ['submitted', 'NEEDS_INFO'],
    ['needs-info', 'NEEDS_INFO'],
    ['archive', 'APPROVED'],
    ['archive', 'REJECTED'],
    ['archive', 'WITHDRAWN'],
    ['archive', 'CANCELLED'],
  ] as const)('accepts %s/%s', (view, status) => {
    expect(approvalRequestBelongsToView(view, status)).toBe(true);
  });

  it.each([
    ['drafts', 'SUBMITTED'],
    ['needs-info', 'IN_REVIEW'],
    ['archive', 'NEEDS_INFO'],
    ['submitted', 'APPROVED'],
  ] as const)('rejects %s/%s', (view, status) => {
    expect(approvalRequestBelongsToView(view, status)).toBe(false);
  });
});

