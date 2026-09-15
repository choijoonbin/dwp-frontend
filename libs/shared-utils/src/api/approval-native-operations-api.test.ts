import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetCsrfToken } from '../axios-instance';
import {
  deadLetterApprovalEvent,
  reassignApprovalTasks,
  replayApprovalEvent,
  runApprovalDeliveryBatch,
} from './approval-native-operations-api';

const outboxId = '11111111-1111-4111-8111-111111111111';
const operationId = '22222222-2222-4222-8222-222222222222';
const taskId = '33333333-3333-4333-8333-333333333333';
const personId = '44444444-4444-4444-8444-444444444444';
const revision = `psr-${'a'.repeat(64)}`;

function secure(version: number) {
  return {
    mode: 'SECURE',
    rolloutState: '110',
    expectedDecisionRevision: revision,
    contextKey: 'approval-admin',
    contextScopeKey: 'opaque-approval-scope',
    objectVersion: version,
    idempotencyKey: 'native-operation-key',
    stepUp: {
      challenge: 'signed-step-up',
      challengeId: operationId,
      decisionRevision: revision,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
  } as const;
}

function response(data: unknown) {
  return new Response(JSON.stringify({ status: 'SUCCESS', data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function receipt(mode: 'SINGLE' | 'BATCH', id = outboxId) {
  return {
    operationId,
    operation: 'DELIVERY_REPLAY',
    commandMode: mode,
    actorUserId: 71,
    managementResourceSetKey: 'RS_APPROVALS',
    itemCount: 1,
    committedAt: '2026-09-14T02:00:00Z',
    items: [
      {
        targetId: id,
        requestId: null,
        previousVersion: 7,
        committedVersion: 8,
        statusBefore: 'DEAD',
        statusAfter: 'PENDING',
        assigneeUserId: null,
      },
    ],
  };
}

function transport(result = receipt('SINGLE')) {
  const fetch = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    return url.includes('/csrf')
      ? response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' })
      : response(result);
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

function commandCall(fetch: ReturnType<typeof transport>, suffix: string) {
  const call = fetch.mock.calls.find(([, init]) => init?.method === 'POST');
  const input = call?.[0];
  const init = call?.[1];
  const pathname = input ? new URL(String(input), 'http://test.invalid').pathname : '';
  if (!input || !init || !pathname.endsWith(suffix)) {
    throw new Error(`Expected command request for ${suffix}`);
  }
  return [input, init] as const;
}

afterEach(() => {
  resetCsrfToken();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('native Approval operations API', () => {
  it.each([
    ['dead-letter', deadLetterApprovalEvent],
    ['replay', replayApprovalEvent],
  ] as const)('binds single %s to exact headers, reason and version', async (suffix, run) => {
    const guard = vi.fn();
    const fetch = transport();

    await expect(
      run(outboxId, 7, '  operator review  ', secure(7), { beforeDispatch: guard })
    ).resolves.toMatchObject({ commandMode: 'SINGLE', itemCount: 1 });

    const [, init] = commandCall(fetch, `/events/${outboxId}/${suffix}`);
    const headers = new Headers(init.headers);
    expect(headers.get('X-DWP-Expected-Object-Version')).toBe('7');
    expect(headers.get('X-DWP-Expected-Decision-Revision')).toBe(revision);
    expect(headers.get('Idempotency-Key')).toBe('native-operation-key');
    expect(JSON.parse(String(init.body))).toEqual({ reason: 'operator review' });
    expect(guard.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('binds every delivery batch route to version zero and immutable target material', async () => {
    for (const [action, suffix] of [
      ['RETRY', 'retry'],
      ['DEAD_LETTER', 'dead-letter'],
      ['REPLAY', 'replay'],
      ['RECONCILE', 'reconcile'],
    ] as const) {
      resetCsrfToken();
      const fetch = transport(receipt('BATCH'));
      await runApprovalDeliveryBatch(
        action,
        operationId,
        [{ targetId: outboxId, expectedVersion: 7 }],
        'all or nothing',
        secure(0),
        { beforeDispatch: vi.fn() }
      );
      const [, init] = commandCall(fetch, `/deliveries/${suffix}`);
      expect(new Headers(init.headers).get('X-DWP-Expected-Object-Version')).toBe('0');
      expect(JSON.parse(String(init.body))).toEqual({
        operationId,
        items: [{ targetId: outboxId, expectedVersion: 7 }],
        reason: 'all or nothing',
      });
      vi.unstubAllGlobals();
    }
  });

  it('sends a batch task assignment with canonical candidate identity', async () => {
    const fetch = transport(receipt('BATCH', taskId));
    await reassignApprovalTasks(
      operationId,
      [
        {
          targetId: taskId,
          expectedVersion: 7,
          assigneeUserId: 92,
          assigneePersonPublicId: personId,
        },
      ],
      'restore the queue',
      secure(0),
      { beforeDispatch: vi.fn() }
    );
    const [, init] = commandCall(fetch, '/tasks/reassign');
    expect(JSON.parse(String(init.body))).toEqual({
      operationId,
      items: [
        {
          targetId: taskId,
          expectedVersion: 7,
          assigneeUserId: 92,
          assigneePersonPublicId: personId,
        },
      ],
      reason: 'restore the queue',
    });
  });

  it('fails closed before transport for malformed, duplicate, oversized or stale commands', async () => {
    const fetch = transport();
    expect(() =>
      runApprovalDeliveryBatch(
        'RETRY',
        operationId,
        [
          { targetId: outboxId, expectedVersion: 7 },
          { targetId: outboxId, expectedVersion: 7 },
        ],
        'duplicate',
        secure(0),
        { beforeDispatch: vi.fn() }
      )
    ).toThrow('Invalid native Approval operation contract');
    expect(() =>
      runApprovalDeliveryBatch(
        'RETRY',
        operationId,
        Array.from({ length: 51 }, (_, index) => ({
          targetId: `${String(index).padStart(8, '0')}-1111-4111-8111-111111111111`,
          expectedVersion: 1,
        })),
        'oversized',
        secure(0),
        { beforeDispatch: vi.fn() }
      )
    ).toThrow('Invalid native Approval operation contract');
    await expect(
      replayApprovalEvent(outboxId, 7, 'reason', secure(8), { beforeDispatch: vi.fn() })
    ).rejects.toThrow('Invalid native Approval operation contract');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects malformed receipts instead of presenting partial success', async () => {
    transport({ ...receipt('BATCH'), itemCount: 2 });
    await expect(
      runApprovalDeliveryBatch(
        'REPLAY',
        operationId,
        [{ targetId: outboxId, expectedVersion: 7 }],
        'reason',
        secure(0),
        { beforeDispatch: vi.fn() }
      )
    ).rejects.toThrow('Invalid native Approval operation contract');
  });
});
