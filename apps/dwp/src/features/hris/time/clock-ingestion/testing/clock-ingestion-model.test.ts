import { describe, expect, it } from 'vitest';

import {
  combineClockWorkspace,
  parseClockExceptionWorkbench,
  parseClockWorkbench,
} from '../model/clock-ingestion-model';

const EVENT_ID = '30000000-0000-4000-8000-000000000001';
const EXCEPTION_ID = '30000000-0000-4000-8000-000000000002';
const CORRELATION_ID = '30000000-0000-4000-8000-000000000005';

function state(itemCount: number) {
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
    queryState: state(1),
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
        availableActions: [
          {
            actionKey: 'hris.action.tim.clock.void',
            method: 'POST',
            hrefTemplate: '/api/time/v1/clock-events/{eventId}/voids',
            idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
            stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
          },
        ],
      },
    ],
  };
}

function exceptionProjection() {
  return {
    projectionVersion: '1',
    asOf: '2026-10-12T02:00:00Z',
    variantKey: 'EXCEPTIONS',
    queryState: state(1),
    items: [
      {
        itemPublicId: EXCEPTION_ID,
        title: 'SOURCE_SEQUENCE_GAP',
        statusCode: 'OPEN',
        fieldGroups: {
          EXCEPTION: {
            decision: 'VIEW',
            value: { code: 'SOURCE_SEQUENCE_GAP', revision: 1 },
          },
          OWNER_DEEP_LINK: {
            decision: 'VIEW',
            value: { publicId: EVENT_ID, code: 'CLOCK_EVENT', label: 'Clock event', revision: 1 },
          },
          RECOVERY_METADATA: {
            decision: 'VIEW',
            value: {
              key: 'clock.exception.source.sequence.gap',
              version: '1',
              digest: 'b'.repeat(64),
            },
          },
        },
        deepLink: {
          route: '/hr/operations/time/exceptions',
          resourcePublicId: EXCEPTION_ID,
        },
        availableActions: [],
      },
    ],
  };
}

describe('clock ingestion IAQ projection boundary', () => {
  it('combines IAQ-034 with a failed IAQ-042 without losing owner facts', () => {
    const result = combineClockWorkspace(parseClockWorkbench(clockProjection()), null, [
      'TIME_EXCEPTIONS_UNAVAILABLE',
    ]);
    expect(result).toMatchObject({
      state: 'PARTIAL',
      freshness: 'CURRENT',
      failures: ['TIME_EXCEPTIONS_UNAVAILABLE'],
      events: [{ clockEventId: EVENT_ID, qualityCode: 'EVIDENCE_VERIFIED' }],
      exceptions: [],
    });
  });

  it('parses IAQ-042 field groups and rejects unverified cross-slice actions', () => {
    expect(parseClockExceptionWorkbench(exceptionProjection()).exceptions[0]).toMatchObject({
      code: 'SOURCE_SEQUENCE_GAP',
      clockEventId: EVENT_ID,
      evidenceDigest: 'b'.repeat(64),
    });
    const source = exceptionProjection();
    expect(() =>
      parseClockExceptionWorkbench({
        ...source,
        items: [
          {
            ...source.items[0],
            availableActions: [
              {
                actionKey: 'hris.action.tim.interpretation.run',
                method: 'POST',
                hrefTemplate: '/api/time/v1/interpretation-runs',
                idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
                stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
              },
            ],
          },
        ],
      })
    ).toThrow('Invalid available action key');
  });

  it('enforces no extra tenant fields and exact field-decision counts', () => {
    const source = clockProjection();
    expect(() => parseClockWorkbench({ ...source, tenantId: 41 })).toThrow(
      'Invalid clock workbench'
    );
    expect(() =>
      parseClockWorkbench({
        ...source,
        queryState: {
          ...source.queryState,
          fieldDecisionSummary: { viewCount: 2, maskedCount: 0, omittedCount: 0 },
        },
      })
    ).toThrow('Invalid field decision summary');
  });
});
