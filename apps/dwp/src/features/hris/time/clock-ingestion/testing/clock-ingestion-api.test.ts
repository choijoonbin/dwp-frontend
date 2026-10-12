import { describe, expect, it, vi } from 'vitest';

import {
  CLOCK_COMMAND_MUTATION_API_CONTRACTS,
  CLOCK_INGESTION_API_CONTRACTS,
  ClockCommandOutcomeUnknownError,
  createClockIngestionDataSource,
} from '../api/clock-ingestion-api';

import type { ClockHttpClient } from '../api/clock-ingestion-api';
import type { ClockIngestionScope, RecordClockEventRequest } from '../model/clock-ingestion-model';
import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';

const scope: ClockIngestionScope = {
  ready: true,
  contextScopeKey: 'hcm-scope-clock-ingestion',
  decisionRevision: 'psr-clock-9',
  locale: 'ko-KR',
  timeZone: 'Asia/Seoul',
  correlationId: '10000000-0000-4000-8000-000000000006',
};
const signal = new AbortController().signal;
const EVENT_ID = '10000000-0000-4000-8000-000000000001';
const SOURCE_ID = '10000000-0000-4000-8000-000000000002';
const WORKER_ID = '10000000-0000-4000-8000-000000000003';
const ASSIGNMENT_ID = '10000000-0000-4000-8000-000000000004';
const RECEIPT_ID = '10000000-0000-4000-8000-000000000005';
const CORRELATION_ID = '10000000-0000-4000-8000-000000000006';
const COMMAND_ID = '10000000-0000-4000-8000-000000000007';

function envelope(data: unknown) {
  return { data: { success: true, data } } as never;
}

function queryState(itemCount: number) {
  return {
    state: itemCount === 0 ? 'EMPTY' : 'COMPLETE',
    scopeDecisionRevision: 'scope-revision-13',
    freshness: 'CURRENT',
    nextCursor: null,
    fieldDecisionSummary: { viewCount: itemCount * 3, maskedCount: 0, omittedCount: 0 },
    partialFailures: [],
    correlationId: CORRELATION_ID,
    cachePolicy: {
      authorizationDecisionRevision: 'psr-clock-9',
      invalidationEvent: 'dwp.hris.access.assignment.changed.v1',
      maxAgeSeconds: 0,
    },
  };
}

function clockProjection() {
  return {
    projectionVersion: '1',
    asOf: '2026-10-12T02:00:00Z',
    variantKey: 'CLOCK_INGESTION',
    queryState: queryState(1),
    items: [
      {
        itemPublicId: EVENT_ID,
        title: 'IN clock event',
        statusCode: 'ACCEPTED',
        fieldGroups: {
          CLOCK_EVENT: {
            decision: 'VIEW',
            value: { startAt: '2026-10-12T01:30:00Z', endAt: null, durationMinutes: 0 },
          },
          INGESTION_STATUS: {
            decision: 'VIEW',
            value: { code: 'ACCEPTED', revision: 1 },
          },
          QUALITY_FINDING: {
            decision: 'VIEW',
            value: {
              decisionCode: 'EVIDENCE_VERIFIED',
              evidenceDigest: 'b'.repeat(64),
              occurredAt: '2026-10-12T01:30:00Z',
              revision: 1,
            },
          },
        },
        deepLink: {
          route: '/hr/operations/time/clock-ingestion',
          resourcePublicId: EVENT_ID,
        },
        availableActions: [],
      },
    ],
  };
}

function exceptionProjection() {
  return {
    projectionVersion: '1',
    asOf: '2026-10-12T02:00:00Z',
    variantKey: 'EXCEPTIONS',
    queryState: queryState(0),
    items: [],
  };
}

function request(): RecordClockEventRequest {
  return {
    sourcePublicId: SOURCE_ID,
    sourceEventKey: 'source-1',
    sourceSequence: 1,
    sourceType: 'API',
    devicePublicId: null,
    captureMode: 'ONLINE',
    offlineBatchPublicId: null,
    workerPublicId: WORKER_ID,
    peopleAssignmentPublicId: ASSIGNMENT_ID,
    peopleAssignmentRevision: 7,
    eventType: 'IN',
    occurredAt: '2026-10-12T01:30:00Z',
    sourceLocalDateTime: '2026-10-12T10:30:00',
    sourceTimeZone: 'Asia/Seoul',
    sourceUtcOffsetMinutes: 540,
    dstResolution: 'EXACT_OFFSET_SUPPLIED',
    instantAuthority: 'SOURCE_INSTANT',
    tzdbVersion: '2026a',
    timeZoneRuleVersion: 'Asia/Seoul@2026a',
    sourceProvenanceDigest: 'a'.repeat(64),
    trustLevel: 'VERIFIED',
  };
}

function receipt(commandType: 'CLOCK_RECORD' | 'CLOCK_VOID') {
  return {
    receiptId: RECEIPT_ID,
    commandType,
    originatingAction: commandType === 'CLOCK_RECORD' ? 'TIME_CLOCK_RECORD' : 'TIME_CLOCK_CORRECT',
    subjectPrincipalPublicId: '10000000-0000-4000-8000-000000000008',
    populationScopeDigest: 'e'.repeat(64),
    fieldPolicyRevision: 5,
    purposeCode: 'TIME_CAPTURE',
    authorizationRevision: 9,
    status: 'SUCCEEDED',
    requestDigest: 'c'.repeat(64),
    correlationId: CORRELATION_ID,
    createdAt: '2026-10-12T01:30:01Z',
    aggregateVersion: null,
    resultRef: EVENT_ID,
  };
}

function authority(
  highRisk = false,
  overrides: Readonly<{ contextScopeKey?: string; decisionRevision?: string }> = {}
): ProductSurfaceGovernedMutationAuthority {
  const decisionRevision = overrides.decisionRevision ?? scope.decisionRevision;
  return {
    mode: 'SECURE',
    rolloutState: '111',
    expectedDecisionRevision: decisionRevision,
    contextKey: 'psc-clock-9',
    contextScopeKey: overrides.contextScopeKey ?? scope.contextScopeKey,
    idempotencyKey: COMMAND_ID,
    ...(highRisk
      ? {
          objectVersion: 1,
          stepUp: {
            challenge: 'step-up-proof',
            challengeId: 'challenge-9',
            decisionRevision,
            expiresAt: '2099-10-12T02:00:00Z',
          },
        }
      : {}),
  };
}

describe('clock ingestion owner adapter', () => {
  it('publishes the ACTION mutation boundaries without changing the owner contract shape', () => {
    expect(CLOCK_INGESTION_API_CONTRACTS).toEqual([
      {
        bindingId: 'IAQ-034',
        method: 'GET',
        path: '/api/time/v1/hris/workbench/clock-ingestion',
      },
      {
        bindingId: 'IAQ-042',
        method: 'GET',
        path: '/api/time/v1/hris/workbench/time-exceptions',
      },
      { bindingId: 'PEP-TIM-007', method: 'POST', path: '/api/time/v1/clock-events' },
      {
        bindingId: 'PEP-TIM-008',
        method: 'POST',
        path: '/api/time/v1/clock-events/{eventId}/voids',
      },
    ]);
    expect(CLOCK_COMMAND_MUTATION_API_CONTRACTS).toEqual([
      {
        apiFunction: 'recordClockEvent',
        routeContractKey: 'route.hcm.personal.time-clock-event-record.action',
        method: 'POST',
        path: '/api/time/v1/clock-events',
      },
      {
        apiFunction: 'voidClockEvent',
        routeContractKey: 'route.hcm.operations.time-clock-event-void.action',
        method: 'POST',
        path: '/api/time/v1/clock-events/{eventId}/voids',
      },
    ]);
  });

  it('binds both IAQ reads to the exact governed scope', async () => {
    const get = vi.fn(async (url: string) =>
      url.includes('time-exceptions')
        ? envelope(exceptionProjection())
        : envelope(clockProjection())
    );
    const client: ClockHttpClient = { get, post: vi.fn() };
    const dataSource = createClockIngestionDataSource(client);

    await expect(dataSource.readEvents(scope, {}, signal)).resolves.toMatchObject({ events: [{}] });
    await expect(dataSource.readExceptions(scope, {}, signal)).resolves.toMatchObject({
      exceptions: [],
    });
    expect(get).toHaveBeenNthCalledWith(
      1,
      `/api/time/v1/hris/workbench/clock-ingestion?limit=100&sort=clockEvent%3ADESC&sort=itemPublicId%3AASC&locale=ko-KR&timeZone=Asia%2FSeoul&correlationId=${CORRELATION_ID}`,
      {
        contextScopeKey: scope.contextScopeKey,
        signal,
      }
    );
    expect(get).toHaveBeenNthCalledWith(
      2,
      `/api/time/v1/hris/workbench/time-exceptions?limit=100&sort=exception%3ADESC&sort=itemPublicId%3AASC&locale=ko-KR&timeZone=Asia%2FSeoul&correlationId=${CORRELATION_ID}`,
      {
        contextScopeKey: scope.contextScopeKey,
        signal,
      }
    );
  });

  it('keeps each continuation bound to its first asOf and opaque cursor', async () => {
    const get = vi.fn(async (_url: string) => envelope(clockProjection()));
    const dataSource = createClockIngestionDataSource({ get, post: vi.fn() });
    const cursor = 'abcdefghijklmnop';

    await dataSource.readEvents(scope, { asOf: '2026-10-12T02:00:00Z', cursor }, signal);

    expect(get.mock.calls[0]?.[0]).toContain('asOf=2026-10-12T02%3A00%3A00Z');
    expect(get.mock.calls[0]?.[0]).toContain(`cursor=${cursor}`);
    await expect(dataSource.readEvents(scope, { cursor }, signal)).rejects.toThrow(
      'Invalid TIM clock continuation request'
    );
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('binds a personal record to its own governed authority and the visible correlation', async () => {
    const post = vi.fn(async () => envelope(receipt('CLOCK_RECORD')));
    const dataSource = createClockIngestionDataSource({ get: vi.fn(), post });
    const personalScope = 'hcm-scope-clock-self';
    const personalRevision = 'psr-clock-self-10';

    await expect(
      dataSource.record(
        request(),
        scope,
        authority(false, {
          contextScopeKey: personalScope,
          decisionRevision: personalRevision,
        }),
        signal
      )
    ).resolves.toMatchObject({
      commandType: 'CLOCK_RECORD',
      originatingAction: 'TIME_CLOCK_RECORD',
    });
    expect(post).toHaveBeenCalledWith('/api/time/v1/clock-events', request(), {
      contextScopeKey: personalScope,
      signal,
      headers: {
        'Idempotency-Key': COMMAND_ID,
        'X-DWP-Expected-Decision-Revision': personalRevision,
        'X-Correlation-ID': CORRELATION_ID,
      },
    });
  });

  it('requires fresh step-up proof and sends the bound object version for corrective void', async () => {
    const post = vi.fn<ClockHttpClient['post']>(async () => envelope(receipt('CLOCK_VOID')));
    const dataSource = createClockIngestionDataSource({ get: vi.fn(), post });

    await expect(
      dataSource.voidEvent(EVENT_ID, 'DEVICE_DUPLICATE', 1, scope, authority(true), signal)
    ).resolves.toMatchObject({ commandType: 'CLOCK_VOID' });
    expect(post).toHaveBeenCalledWith(
      `/api/time/v1/clock-events/${EVENT_ID}/voids`,
      { reasonCode: 'DEVICE_DUPLICATE' },
      {
        contextScopeKey: scope.contextScopeKey,
        signal,
        headers: {
          'Idempotency-Key': COMMAND_ID,
          'X-DWP-Expected-Decision-Revision': scope.decisionRevision,
          'X-DWP-Expected-Object-Version': '1',
          'X-DWP-Step-Up-Challenge': 'step-up-proof',
          'X-Correlation-ID': CORRELATION_ID,
        },
      }
    );
  });

  it('fails before I/O for stale scope, malformed provenance, or missing step-up', async () => {
    const post = vi.fn();
    const dataSource = createClockIngestionDataSource({ get: vi.fn(), post });
    await expect(
      dataSource.record({ ...request(), sourceProvenanceDigest: 'bad' }, scope, authority(), signal)
    ).rejects.toThrow('Invalid TIM clock evidence request');
    await expect(
      dataSource.voidEvent(EVENT_ID, 'DEVICE_DUPLICATE', 1, scope, authority(), signal)
    ).rejects.toThrow('Governed TIM clock authority is invalid');
    await expect(
      dataSource.record(request(), { ...scope, ready: false }, authority(), signal)
    ).rejects.toThrow('Invalid TIM clock operation scope');
    expect(post).not.toHaveBeenCalled();
  });

  it('marks a malformed post-dispatch receipt as unknown so the exact command can be retried', async () => {
    const post = vi.fn(async () =>
      envelope({ ...receipt('CLOCK_RECORD'), idempotencyKey: COMMAND_ID })
    );
    const dataSource = createClockIngestionDataSource({ get: vi.fn(), post });

    await expect(dataSource.record(request(), scope, authority(), signal)).rejects.toBeInstanceOf(
      ClockCommandOutcomeUnknownError
    );
    expect(post).toHaveBeenCalledTimes(1);
  });
});
