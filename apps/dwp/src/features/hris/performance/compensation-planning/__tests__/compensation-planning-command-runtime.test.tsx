// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCompensationPlanningRuntime } from '../use-compensation-planning-workspace';
import { verifyCompensationCommandResult } from '../compensation-planning-command';

import type { CompensationPlanningDataSource } from '../compensation-planning-api';
import type { PendingCompensationCommand } from '../compensation-planning-command';
import type { ProductSurfaceRequestScope } from '../../../../../components/use-product-surface-request-scope';

const ID = {
  cycle: '11111111-1111-4111-8111-111111111111',
  otherCycle: '22222222-2222-4222-8222-222222222222',
  receipt: '33333333-3333-4333-8333-333333333333',
  correlation: '44444444-4444-4444-8444-444444444444',
} as const;
const HASH = 'a'.repeat(64);
const NOW = '2026-10-13T08:00:00Z';
const cycle = {
  cycleId: ID.cycle,
  aggregateVersion: 4,
  cycleCode: 'FY27',
  effectiveFrom: '2027-01-01',
  effectiveTo: null,
  status: 'OPEN' as const,
  budgetMasked: true,
};

function scope(actor = 'actor-1'): ProductSurfaceRequestScope {
  return {
    governed: true,
    ready: true,
    contextScopeKey: 'scope:comp',
    cacheKey: ['tenant-1', actor, 'NORMAL', 'hcm.operations', 'scope:comp', 'decision-1'],
    queryMeta: {
      accessSensitive: true,
      tenantId: 'tenant-1',
      actorId: actor,
      accessMode: 'NORMAL',
      productId: 'hcm',
      surfaceId: 'hcm.operations',
      contextScopeKey: 'scope:comp',
      decisionRevision: 'decision-1',
    },
  };
}

function source(): CompensationPlanningDataSource {
  return {
    cycles: vi.fn().mockResolvedValue({
      items: [cycle], nextCursor: null, hasMore: false, asOf: NOW,
      scopeRevision: 1, fieldPolicyRevision: 1,
    }),
    cycle: vi.fn().mockResolvedValue({
      item: cycle, referenceEffectiveAt: NOW, freshnessWatermark: NOW,
      fieldPolicyRevision: 1,
    }),
    proposals: vi.fn().mockResolvedValue({
      items: [], nextCursor: null, hasMore: false, referenceEffectiveAt: NOW,
      freshnessWatermark: NOW, fieldPolicyRevision: 1,
    }),
    proposal: vi.fn(),
  };
}

const pending: PendingCompensationCommand = Object.freeze({
  command: 'REVISE_CYCLE',
  targetId: ID.cycle,
  envelope: Object.freeze({
    correlationId: ID.correlation,
    idempotencyKey: 'idem-1',
    expectedVersion: 4,
    body: Object.freeze({}),
  }),
});

let mount: HTMLDivElement;
let root: Root;
let client: QueryClient;
let latest: ReturnType<typeof useCompensationPlanningRuntime>;

function Harness(props: Parameters<typeof useCompensationPlanningRuntime>[0]) {
  latest = useCompensationPlanningRuntime(props);
  return null;
}

async function render(props: Parameters<typeof Harness>[0]) {
  await act(async () => {
    root.render(
      createElement(QueryClientProvider, { client }, createElement(Harness, props))
    );
  });
  await act(async () => {
    await vi.waitFor(() => expect(latest.status).toBe('READY'));
  });
}

describe('compensation command runtime', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    mount = document.createElement('div');
    document.body.append(mount);
    root = createRoot(mount);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    mount.remove();
    vi.restoreAllMocks();
  });

  it('fails closed when Central has not injected command registrations', async () => {
    await render({ requestScope: scope(), dataSource: source() });
    expect(latest.actions.canCreate).toBe(false);
    expect(latest.actions.canRevise).toBe(false);
    expect(latest.actions.canApprove).toBe(false);
    expect(latest.actions.canPublish).toBe(false);
  });

  it('replays the exact immutable envelope after an ambiguous result', async () => {
    const executor = vi
      .fn()
      .mockRejectedValueOnce(new HttpTransportError('NETWORK'))
      .mockResolvedValueOnce({
        commandReceiptId: ID.receipt,
        status: 'COMPLETED',
        correlationId: ID.correlation,
        completedAt: NOW,
        resultDigest: HASH,
        aggregatePublicId: ID.cycle,
        aggregateVersion: 5,
        childResults: [],
      });
    await render({
      requestScope: scope(),
      dataSource: source(),
      commandExecutors: { REVISE_CYCLE: executor },
      commandIntents: { revise: () => pending },
    });
    await act(async () => {
      await vi.waitFor(() => expect(latest.actions.canRevise).toBe(true));
    });

    await act(async () => latest.actions.onRevise?.());
    await act(async () => {
      await vi.waitFor(() => expect(latest.status).toBe('RESULT_UNKNOWN'));
    });
    expect(executor.mock.calls[0][0]).toBe(pending);

    await act(async () => latest.retryPending?.());
    await act(async () => {
      await vi.waitFor(() => expect(latest.pendingCommand).toBeNull());
    });
    expect(executor.mock.calls[1][0]).toBe(pending);
  });

  it('purges governed data on a command denial and does not accept cross-cycle publish results', async () => {
    const deniedExecutor = vi.fn().mockRejectedValue(
      new HttpError('denied', 403, { errorCode: 'POPULATION_SCOPE_DENIED' })
    );
    await render({
      requestScope: scope(),
      dataSource: source(),
      commandExecutors: { REVISE_CYCLE: deniedExecutor },
      commandIntents: { revise: () => pending },
    });
    await act(async () => {
      await vi.waitFor(() => expect(latest.actions.canRevise).toBe(true));
    });
    await act(async () => latest.actions.onRevise?.());
    await act(async () => {
      await vi.waitFor(() => expect(latest.status).toBe('DENIED'));
    });
    expect(latest.cycles).toEqual([]);

    expect(() =>
      verifyCompensationCommandResult(
        { ...pending, command: 'PUBLISH_SNAPSHOT' },
        {
          approvalReceiptId: ID.receipt,
          cycleId: ID.otherCycle,
          snapshotId: ID.receipt,
          snapshotRevision: 1,
          sourceVersion: 4,
          aggregateVersion: 5,
          lineCount: 1,
          payloadDigest: HASH,
          correlationId: ID.correlation,
          publishedAt: NOW,
        }
      )
    ).toThrow('governed target');
  });
});
