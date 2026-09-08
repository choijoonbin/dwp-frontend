import { describe, expect, it, vi } from 'vitest';

import {
  consumeWorkHubReturnIntent,
  recordWorkHubReturnIntent,
  workHubApprovalHandoffRoute,
  workHubCurrentLocation,
} from './work-hub-return-handoff';
import { hubItem } from './work-hub.test-support';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    removeItem: vi.fn((key: string) => void values.delete(key)),
    setItem: vi.fn((key: string, value: string) => void values.set(key, value)),
  };
}

const approval = hubItem({
  key: 'APPROVAL_TASK:approval-1:SECURITY_REVIEW',
  reference: {
    sourceSystem: 'APPROVAL_TASK',
    sourceReference: 'approval-1',
    obligationKey: 'SECURITY_REVIEW',
  },
  sourceRoute: '/approvals/inbox?task=approval-1',
});

describe('Work approval return handoff', () => {
  it('adds the exact canonical Work selection, filters, and hash to approval task and request URLs', () => {
    const returnTo = '/work/queue?q=risk&source=APPROVAL_TASK&work=approval-1#evidence';
    expect(workHubApprovalHandoffRoute(approval.sourceRoute!, returnTo)).toBe(
      `/approvals/inbox?task=approval-1&returnTo=${encodeURIComponent(returnTo)}`
    );
    expect(
      workHubApprovalHandoffRoute('/approvals/requests/needs-info?request=request%2F1', returnTo)
    ).toBe(
      `/approvals/requests/needs-info?request=request%2F1&returnTo=${encodeURIComponent(returnTo)}`
    );
  });

  it('leaves other owner apps unchanged and rejects an unsafe Work return target', () => {
    const service = hubItem({
      reference: { sourceSystem: 'SERVICE_REQUEST', sourceReference: 'service-1' },
      sourceRoute: '/services/my/service-1',
    });
    expect(workHubApprovalHandoffRoute(service.sourceRoute!, '/work/queue')).toBe(
      '/services/my/service-1'
    );
    expect(workHubApprovalHandoffRoute('/services/my/service-1', '/work/queue')).toBe(
      '/services/my/service-1'
    );
    expect(workHubApprovalHandoffRoute(approval.sourceRoute!, 'https://evil.test/work')).toBeNull();
    expect(workHubCurrentLocation({ pathname: '/work/queue', search: '?q=a', hash: '#b' })).toBe(
      '/work/queue?q=a#b'
    );
  });

  it('binds returnTo by the approval destination for linked personal work and citations', () => {
    const personal = hubItem({
      key: 'PERSONAL_TASK:personal-1:',
      reference: { sourceSystem: 'PERSONAL_TASK', sourceReference: 'personal-1' },
      sourceRoute: '/approvals/inbox?task=approval-1',
    });
    expect(workHubApprovalHandoffRoute(personal.sourceRoute!, '/work/queue')).toBe(
      '/approvals/inbox?task=approval-1&returnTo=%2Fwork%2Fqueue'
    );
  });

  it('consumes a matching focus intent once and discards stale or mismatched provenance', () => {
    const storage = memoryStorage();
    const returnTo = '/work/queue?work=approval-1#detail';
    expect(recordWorkHubReturnIntent(approval, returnTo, 'ASSIST', storage, 1_000)).toBe(true);
    expect(consumeWorkHubReturnIntent(returnTo, approval.key, storage, 1_500)).toBe('ASSIST');
    expect(consumeWorkHubReturnIntent(returnTo, approval.key, storage, 1_500)).toBeNull();

    expect(recordWorkHubReturnIntent(approval, returnTo, 'SOURCE', storage, 1_000)).toBe(true);
    expect(consumeWorkHubReturnIntent(returnTo, 'another-item', storage, 1_500)).toBeNull();
    expect(recordWorkHubReturnIntent(approval, returnTo, 'SOURCE', storage, 1_000)).toBe(true);
    expect(consumeWorkHubReturnIntent(returnTo, approval.key, storage, 1_000_000)).toBeNull();
  });
});
