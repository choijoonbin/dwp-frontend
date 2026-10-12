// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useClockIngestionCommands } from '../hooks/use-clock-ingestion-commands';

import type { ClockIngestionDataSource } from '../api/clock-ingestion-api';
import type {
  ClockEvent,
  ClockIngestionScope,
  RecordClockEventRequest,
} from '../model/clock-ingestion-model';
import type {
  ClockRecordAuthorityExecutor,
  ClockVoidAuthorityExecutor,
  ClockVoidCommandBinding,
} from '../hooks/use-clock-ingestion-commands';
import type {
  ProductSurfaceGovernedMutationAuthority,
  ProductSurfaceSecureMutationAuthority,
} from '@dwp-frontend/shared-utils';

const COMMAND_ID = '60000000-0000-4000-8000-000000000001';
const EVENT_ID = '60000000-0000-4000-8000-000000000002';
const CORRELATION_ID = '60000000-0000-4000-8000-000000000003';
const scope: ClockIngestionScope = {
  ready: true,
  contextScopeKey: 'clock-scope',
  decisionRevision: 'psr-clock-9',
  locale: 'en-US',
  timeZone: 'UTC',
  correlationId: CORRELATION_ID,
};
const request: RecordClockEventRequest = {
  sourcePublicId: '60000000-0000-4000-8000-000000000004',
  sourceEventKey: 'source-event-1',
  sourceSequence: 1,
  sourceType: 'API',
  devicePublicId: null,
  captureMode: 'ONLINE',
  offlineBatchPublicId: null,
  workerPublicId: '60000000-0000-4000-8000-000000000005',
  peopleAssignmentPublicId: '60000000-0000-4000-8000-000000000006',
  peopleAssignmentRevision: 7,
  eventType: 'IN',
  occurredAt: '2026-10-12T02:00:00Z',
  sourceLocalDateTime: '2026-10-12T02:00:00',
  sourceTimeZone: 'UTC',
  sourceUtcOffsetMinutes: 0,
  dstResolution: 'EXACT_OFFSET_SUPPLIED',
  instantAuthority: 'SOURCE_INSTANT',
  tzdbVersion: '2026a',
  timeZoneRuleVersion: 'UTC@2026a',
  sourceProvenanceDigest: 'a'.repeat(64),
  trustLevel: 'VERIFIED',
};

function receipt(commandType: 'CLOCK_RECORD' | 'CLOCK_VOID' = 'CLOCK_RECORD') {
  return {
    receiptId: '60000000-0000-4000-8000-000000000007',
    commandType,
    originatingAction:
      commandType === 'CLOCK_RECORD'
        ? ('TIME_CLOCK_RECORD' as const)
        : ('TIME_CLOCK_CORRECT' as const),
    subjectPrincipalPublicId: '60000000-0000-4000-8000-000000000008',
    populationScopeDigest: 'b'.repeat(64),
    fieldPolicyRevision: 5,
    purposeCode: 'TIME_CAPTURE' as const,
    authorizationRevision: 9,
    status: 'SUCCEEDED' as const,
    requestDigest: 'c'.repeat(64),
    correlationId: CORRELATION_ID,
    createdAt: '2026-10-12T02:00:01Z',
    aggregateVersion: null,
    resultRef: EVENT_ID,
  };
}

const event: ClockEvent = {
  clockEventId: EVENT_ID,
  deepLinkResourceId: EVENT_ID,
  title: 'IN clock event',
  statusCode: 'ACCEPTED',
  occurredAt: '2026-10-12T02:00:00Z',
  eventOrder: 17,
  qualityCode: null,
  evidenceDigest: 'd'.repeat(64),
  availableActions: [
    {
      actionKey: 'hris.action.tim.clock.void',
      method: 'POST',
      hrefTemplate: '/api/time/v1/clock-events/{eventId}/voids',
      idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
      stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
    },
  ],
};

function authority(): ProductSurfaceSecureMutationAuthority {
  return {
    mode: 'SECURE',
    rolloutState: '111',
    expectedDecisionRevision: scope.decisionRevision,
    contextKey: 'clock-context',
    contextScopeKey: scope.contextScopeKey,
  };
}

describe('clock command orchestration', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it('preserves the exact record payload and idempotency key across an ambiguous retry', async () => {
    const record = vi
      .fn<ClockIngestionDataSource['record']>()
      .mockRejectedValueOnce(new HttpTransportError('NETWORK'))
      .mockResolvedValueOnce(receipt());
    const dataSource: ClockIngestionDataSource = {
      readEvents: vi.fn(),
      readExceptions: vi.fn(),
      record,
      voidEvent: vi.fn(),
    };
    const recordExecutor: ClockRecordAuthorityExecutor = <T,>(
      execute: (candidate: ProductSurfaceGovernedMutationAuthority) => Promise<T>
    ) => execute(authority());
    let runtime: ReturnType<typeof useClockIngestionCommands> | undefined;

    function Harness() {
      runtime = useClockIngestionCommands({
        dataSource,
        owner: {
          record: {
            routeContractKey: 'route.hcm.personal.time-clock-event-record.action',
            execute: recordExecutor,
          },
        },
        scope,
        reload: vi.fn(),
        idFactory: () => COMMAND_ID,
      });
      return null;
    }

    await act(async () => root.render(createElement(Harness)));
    await act(async () => runtime?.submitRecord(request));
    expect(runtime?.feedback).toMatchObject({ kind: 'RESULT_UNKNOWN', retryExact: true });
    expect(runtime?.pendingKind).toBe('RECORD');

    await act(async () =>
      runtime?.submitRecord({ ...request, sourceEventKey: 'must-not-replace-pending' })
    );
    expect(record).toHaveBeenCalledTimes(1);
    expect(runtime?.pendingKind).toBe('RECORD');

    await act(async () => runtime?.retryExact());
    expect(runtime?.feedback).toMatchObject({ kind: 'SUCCESS' });
    expect(record).toHaveBeenCalledTimes(2);
    expect(record.mock.calls[0]?.[0]).toEqual(record.mock.calls[1]?.[0]);
    expect(record.mock.calls[0]?.[2]).toMatchObject({ idempotencyKey: COMMAND_ID });
    expect(record.mock.calls[1]?.[2]).toMatchObject({ idempotencyKey: COMMAND_ID });
  });

  it('clears a deterministic 4xx command instead of replaying it', async () => {
    const record = vi
      .fn<ClockIngestionDataSource['record']>()
      .mockRejectedValue(new HttpError('invalid', 422));
    const dataSource: ClockIngestionDataSource = {
      readEvents: vi.fn(),
      readExceptions: vi.fn(),
      record,
      voidEvent: vi.fn(),
    };
    let runtime: ReturnType<typeof useClockIngestionCommands> | undefined;
    function Harness() {
      runtime = useClockIngestionCommands({
        dataSource,
        owner: {
          record: {
            routeContractKey: 'route.hcm.personal.time-clock-event-record.action',
            execute: (execute) => execute(authority()),
          },
        },
        scope,
        reload: vi.fn(),
        idFactory: () => COMMAND_ID,
      });
      return null;
    }

    await act(async () => root.render(createElement(Harness)));
    await act(async () => runtime?.submitRecord(request));
    expect(runtime?.feedback).toEqual({ kind: 'REJECTED', retryExact: false });
    expect(runtime?.pendingKind).toBeNull();
    await act(async () => runtime?.retryExact());
    expect(record).toHaveBeenCalledTimes(1);
  });

  it('gates a corrective void by availableActions and sends module-owned high-risk facts', async () => {
    const voidEvent = vi
      .fn<ClockIngestionDataSource['voidEvent']>()
      .mockResolvedValue(receipt('CLOCK_VOID'));
    const dataSource: ClockIngestionDataSource = {
      readEvents: vi.fn(),
      readExceptions: vi.fn(),
      record: vi.fn(),
      voidEvent,
    };
    let observedBinding: ClockVoidCommandBinding | undefined;
    const voidExecutor: ClockVoidAuthorityExecutor = <T,>(
      execute: (candidate: ProductSurfaceGovernedMutationAuthority) => Promise<T>,
      binding: ClockVoidCommandBinding
    ) => {
      observedBinding = binding;
      return execute({
        ...authority(),
        objectVersion: event.eventOrder ?? undefined,
        stepUp: {
          challenge: 'step-up-proof',
          challengeId: 'challenge-9',
          decisionRevision: scope.decisionRevision,
          expiresAt: '2099-10-12T02:00:00Z',
        },
      });
    };
    let runtime: ReturnType<typeof useClockIngestionCommands> | undefined;
    function Harness() {
      runtime = useClockIngestionCommands({
        dataSource,
        owner: {
          voidEvent: {
            routeContractKey: 'route.hcm.operations.time-clock-event-void.action',
            execute: voidExecutor,
          },
        },
        scope,
        reload: vi.fn(),
        idFactory: () => COMMAND_ID,
      });
      return null;
    }

    await act(async () => root.render(createElement(Harness)));
    await act(async () => runtime?.openVoid(event));
    await act(async () => runtime?.submitVoid('DEVICE_DUPLICATE'));
    expect(observedBinding).toEqual({
      eventId: EVENT_ID,
      expectedObjectVersion: 17,
      idempotencyKey: COMMAND_ID,
      request: { reasonCode: 'DEVICE_DUPLICATE' },
    });
    expect(voidEvent.mock.calls[0]?.[4]).toMatchObject({
      idempotencyKey: COMMAND_ID,
      stepUp: { challenge: 'step-up-proof' },
    });
    expect(runtime?.feedback).toMatchObject({ kind: 'SUCCESS' });
  });
});
