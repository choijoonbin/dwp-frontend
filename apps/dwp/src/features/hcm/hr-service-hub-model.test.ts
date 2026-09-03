import { describe, expect, it } from 'vitest';

import { prioritizeHrServiceRequests } from './hr-service-hub-model';

import type { ServiceRequestSummary } from '@dwp-frontend/shared-utils';

function request(
  requestId: string,
  overrides: Partial<ServiceRequestSummary> = {}
): ServiceRequestSummary {
  return {
    requestId,
    requestNumber: requestId,
    serviceKey: 'people.employment-certificate',
    serviceNameKo: '재직 증명서',
    serviceNameEn: 'Employment certificate',
    summary: requestId,
    status: 'IN_PROGRESS',
    priority: 'NORMAL',
    assignedGroup: 'People Services',
    updatedAt: '2026-08-11T00:00:00Z',
    version: 1,
    ...overrides,
  };
}

describe('prioritizeHrServiceRequests', () => {
  it('places requests needing employee input ahead of every other lifecycle state', () => {
    const result = prioritizeHrServiceRequests([
      request('closed', { status: 'CLOSED' }),
      request('in-progress'),
      request('needs-response', { status: 'AWAITING_REQUESTER' }),
      request('draft', { status: 'DRAFT' }),
    ]);

    expect(result.map((item) => item.requestId)).toEqual([
      'needs-response',
      'draft',
      'in-progress',
      'closed',
    ]);
  });

  it('uses urgency, SLA, and latest update as deterministic tie breakers', () => {
    const result = prioritizeHrServiceRequests([
      request('normal'),
      request('urgent-later', {
        priority: 'URGENT',
        slaDueAt: '2026-08-11T06:00:00Z',
      }),
      request('urgent-sooner-old', {
        priority: 'URGENT',
        slaDueAt: '2026-08-11T02:00:00Z',
        updatedAt: '2026-08-10T00:00:00Z',
      }),
      request('urgent-sooner-new', {
        priority: 'URGENT',
        slaDueAt: '2026-08-11T02:00:00Z',
        updatedAt: '2026-08-11T01:00:00Z',
      }),
    ]);

    expect(result.map((item) => item.requestId)).toEqual([
      'urgent-sooner-new',
      'urgent-sooner-old',
      'urgent-later',
      'normal',
    ]);
  });

  it('does not mutate the API response order', () => {
    const input = [request('later'), request('first', { status: 'AWAITING_REQUESTER' })];

    prioritizeHrServiceRequests(input);

    expect(input.map((item) => item.requestId)).toEqual(['later', 'first']);
  });
});
