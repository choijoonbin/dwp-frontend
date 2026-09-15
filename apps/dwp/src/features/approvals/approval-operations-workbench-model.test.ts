import { describe, expect, it } from 'vitest';
import type { ApprovalIntegrationDelivery, ApprovalOperations } from '@dwp-frontend/shared-utils';
import {
  approvalOperationsDeliveryQueue,
  approvalOperationsQueueFromSearch,
  approvalOperationsRetrySnapshotCurrent,
  approvalOperationsSourceCurrent,
  parseApprovalOperationsProjection,
} from './approval-operations-workbench-model';

const now = Date.parse('2026-09-14T10:00:00Z');
const date = new Date(now).toISOString();
const delivery: ApprovalIntegrationDelivery = {
  outboxId: 'event-1',
  eventId: 'original-event',
  eventType: 'APPROVED',
  status: 'FAILED',
  attemptCount: 2,
  manualRetryCount: 0,
  version: 4,
  availableAt: date,
  createdAt: date,
  retryEligibility: { eligible: true, reason: 'ELIGIBLE', expectedVersion: 4, evaluatedAt: date },
};
const data: ApprovalOperations = {
  generatedAt: date,
  signals: [],
  breachedTasks: [],
  integrationDeliveries: [delivery],
};
const state = () => ({
  status: 'success',
  fetchStatus: 'idle',
  error: null,
  fetchFailureCount: 0,
  data: structuredClone(data),
});
const original = {
  outboxId: delivery.outboxId,
  expectedVersion: 4,
  deliveryFingerprint: JSON.stringify(delivery),
  scopeFingerprint: 'actor-1:scope-1',
};
const current = {
  selectedId: delivery.outboxId,
  scopeFingerprint: original.scopeFingerprint,
  canOperate: true,
};

describe('Approval operations workbench', () => {
  it('strictly tags full, auditor and oversight projections without inventing omitted data', () => {
    expect(parseApprovalOperationsProjection(data)).toMatchObject({ kind: 'full' });
    const auditor = parseApprovalOperationsProjection({
      generatedAt: date,
      signals: [{ key: 'DELIVERY', state: 'ATTENTION', count: 2 }],
      integrationDeliveries: [
        {
          eventType: 'APPROVED',
          status: 'FAILED',
          attemptCount: 2,
          manualRetryCount: 0,
          availableAt: date,
          publishedAt: null,
        },
      ],
    });
    expect(auditor).toMatchObject({ kind: 'auditor' });
    expect(Object.hasOwn(auditor.data, 'breachedTasks')).toBe(false);

    const oversight = parseApprovalOperationsProjection({
      generatedAt: date,
      signals: [
        {
          key: 'DELIVERY',
          state: 'ATTENTION',
          titleKo: '전달',
          titleEn: 'Delivery',
          count: 2,
        },
      ],
      integrationDeliveries: [
        {
          outboxId: 'outbox-1',
          eventType: 'APPROVED',
          status: 'FAILED',
          attemptCount: 2,
          manualRetryCount: 0,
          availableAt: date,
          publishedAt: null,
          createdAt: date,
          lastRetriedAt: null,
        },
      ],
    });
    expect(oversight).toMatchObject({ kind: 'oversight' });
    expect(Object.hasOwn(oversight.data.integrationDeliveries[0]!, 'version')).toBe(false);
  });

  it('rejects malformed or cross-projection operations and closes source currency', () => {
    const malformed = {
      generatedAt: date,
      signals: [{ key: 'DELIVERY', state: 'ATTENTION', count: 2, detailEn: 'secret' }],
      integrationDeliveries: [],
    };
    expect(() => parseApprovalOperationsProjection(malformed)).toThrow(
      /Invalid approval management projection/u
    );
    expect(
      approvalOperationsSourceCurrent(
        { ...state(), data: malformed as unknown as ApprovalOperations },
        now
      )
    ).toBe(false);
    const oversight = {
      generatedAt: date,
      signals: [],
      integrationDeliveries: [],
    } as unknown as ApprovalOperations;
    expect(approvalOperationsSourceCurrent({ ...state(), data: oversight }, now)).toBe(false);
  });

  it.each([
    ['', 'delivery'],
    ['queue=sla', 'sla'],
    ['queue=delivery', 'delivery'],
    ['queue=resolved', 'resolved'],
    ['queue=arbitrary-command', 'delivery'],
    ['queue=SLA', 'delivery'],
    ['queue=sla&queue=delivery', 'delivery'],
    ['queue=sla&queue=sla', 'delivery'],
    ['queue=resolved&policyId=untrusted', 'resolved'],
  ])('opens only an allowlisted queue from %s', (search, expected) => {
    expect(approvalOperationsQueueFromSearch(new URLSearchParams(search))).toBe(expected);
  });
  it('keeps completed delivery distinct from pending, failed and dead events without mutating input', () => {
    const items = [
      delivery,
      { ...delivery, outboxId: 'published', status: 'PUBLISHED' },
      { ...delivery, outboxId: 'pending', status: 'PENDING' },
      { ...delivery, outboxId: 'dead', status: 'DEAD' },
    ];
    const before = JSON.stringify(items);
    expect(approvalOperationsDeliveryQueue(items, 'delivery', 'ALL', 'OLDEST')).toHaveLength(3);
    expect(
      approvalOperationsDeliveryQueue(items, 'resolved', 'FAILED', 'OLDEST').map(
        (item) => item.outboxId
      )
    ).toEqual(['published']);
    expect(approvalOperationsDeliveryQueue(items, 'sla', 'ALL', 'OLDEST')).toEqual([]);
    expect(JSON.stringify(items)).toBe(before);
  });
  it.each(['PENDING', 'SENDING', 'FAILED', 'DEAD'] as const)(
    'filters exactly native %s status',
    (status) => {
      const items = ['PENDING', 'SENDING', 'FAILED', 'DEAD'].map((value) => ({
        ...delivery,
        status: value,
      }));
      expect(
        approvalOperationsDeliveryQueue(items, 'delivery', status, 'OLDEST').map(
          (item) => item.status
        )
      ).toEqual([status]);
    }
  );
  it.each(['OLDEST', 'NEWEST', 'AVAILABLE'] as const)(
    'keeps malformed dates last for %s',
    (sort) => {
      const items = [
        { ...delivery, outboxId: 'malformed', createdAt: 'bad', availableAt: 'bad' },
        delivery,
      ];
      expect(
        approvalOperationsDeliveryQueue(items, 'delivery', 'ALL', sort).map((item) => item.outboxId)
      ).toEqual(['event-1', 'malformed']);
    }
  );
  it('sorts native instants deterministically including offset timestamps', () => {
    const earlier = {
      ...delivery,
      outboxId: 'early',
      createdAt: '2026-09-14T18:59:59+09:00',
      availableAt: '2026-09-14T10:01:00Z',
    };
    expect(
      approvalOperationsDeliveryQueue([delivery, earlier], 'delivery', 'ALL', 'OLDEST')[0]?.outboxId
    ).toBe('early');
    expect(
      approvalOperationsDeliveryQueue([delivery, earlier], 'delivery', 'ALL', 'NEWEST')[0]?.outboxId
    ).toBe('event-1');
    expect(
      approvalOperationsDeliveryQueue([delivery, earlier], 'delivery', 'ALL', 'AVAILABLE')[0]
        ?.outboxId
    ).toBe('event-1');
  });
  it('accepts only the exact current selected native row and authority', () => {
    expect(approvalOperationsRetrySnapshotCurrent(state(), original, current, now)).toBe(true);
  });
  it.each([
    { status: 'error' },
    { fetchStatus: 'fetching' },
    { fetchStatus: 'paused' },
    { error: new Error('403') },
    { fetchFailureCount: 1 },
  ])('closes writes on the first query failure or non-idle state %j', (change) => {
    expect(
      approvalOperationsRetrySnapshotCurrent({ ...state(), ...change }, original, current, now)
    ).toBe(false);
  });
  it.each([-1, 45000, 45001])('rejects source age %s even without another render', (age) => {
    const value = state();
    value.data.generatedAt = new Date(now - age).toISOString();
    expect(approvalOperationsSourceCurrent(value, now)).toBe(false);
  });
  it.each([
    { selectedId: 'another' },
    { scopeFingerprint: 'actor-2:scope-1' },
    { canOperate: false },
  ])('never loans an original retry to another selection or authority %j', (change) => {
    expect(
      approvalOperationsRetrySnapshotCurrent(state(), original, { ...current, ...change }, now)
    ).toBe(false);
  });
  it('rejects same-version eligibility or error metadata drift and an expired eligibility proof', () => {
    for (const change of [
      { lastError: 'new cause' },
      { status: 'SENDING' },
      { version: 5 },
      { retryEligibility: { ...delivery.retryEligibility!, eligible: false } },
    ]) {
      const value = state();
      value.data.integrationDeliveries[0] = { ...delivery, ...change };
      expect(approvalOperationsRetrySnapshotCurrent(value, original, current, now)).toBe(false);
    }
    const expired = {
      ...delivery,
      retryEligibility: {
        ...delivery.retryEligibility!,
        evaluatedAt: new Date(now - 45000).toISOString(),
      },
    };
    const value = state();
    value.data.integrationDeliveries = [expired];
    expect(
      approvalOperationsRetrySnapshotCurrent(
        value,
        { ...original, deliveryFingerprint: JSON.stringify(expired) },
        current,
        now
      )
    ).toBe(false);
    expect(approvalOperationsRetrySnapshotCurrent(state(), null, current, now)).toBe(false);
  });
});
