import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  approveWorkplacePlanningScenario,
  createWorkplacePlanningScenario,
  getWorkplacePlanningOverview,
  previewWorkplacePlanningBookingImpact,
} from './workplace-planning-api';
import {
  parseWorkplacePlanningBookingImpact,
  parseWorkplacePlanningCommandResult,
  parseWorkplacePlanningOverview,
  parseWorkplacePlanningScenario,
} from './workplace-planning-contract';

const siteId = '22000000-0000-4000-8000-000000000001';
const scenarioId = '22000000-0000-4000-8000-000000000002';
const previewId = '22000000-0000-4000-8000-000000000003';
const forecastId = '22000000-0000-4000-8000-000000000004';
const impactId = '22000000-0000-4000-8000-000000000005';
const bookingId = '22000000-0000-4000-8000-000000000006';
const resourceId = '22000000-0000-4000-8000-000000000007';
const commandId = '22000000-0000-4000-8000-000000000008';
const outboxId = '22000000-0000-4000-8000-000000000009';
const now = '2026-09-17T01:00:00Z';
const later = '2026-09-24T01:00:00Z';
const series = [
  'WORK_PLAN',
  'RESERVATION',
  'CHECK_IN',
  'ACCESS',
  'SENSOR_OCCUPANCY',
  'NO_SHOW',
] as const;

function response(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    text: async () => JSON.stringify({ data }),
  } as Response;
}

function scope() {
  return {
    siteId,
    floorId: null,
    neighborhood: null,
    resourceType: 'DESK' as const,
    from: now,
    to: later,
  };
}

function sources() {
  return series.map((name, index) => ({
    series: name,
    availability: 'AVAILABLE',
    coveragePercent: 100,
    sourceAt: now,
    receivedAt: now,
    freshness: 'FRESH',
    exclusions: [],
    evidenceReference: `evidence:${name}`,
    points: [
      { bucketStart: now, value: 40 + index, lowerBound: 35, upperBound: 50, unit: 'PEOPLE' },
    ],
    observationId: `22000000-0000-4000-8000-${String(100 + index).padStart(12, '0')}`,
    sequence: 2,
  }));
}

function forecast(state = 'READY') {
  const ready = state === 'READY';
  return {
    forecastId: ready ? forecastId : null,
    state,
    calculationVersion: ready ? 'forecast-v22' : null,
    evidenceReference: ready ? 'model-run:22' : null,
    sourceObservationIds: ready ? sources().map((item) => item.observationId) : [],
    points: ready
      ? [
          {
            bucketStart: '2026-09-18T01:00:00Z',
            expectedDemand: 48,
            lowerBound: 44,
            upperBound: 53,
            unit: 'PEOPLE',
          },
          { bucketStart: now, expectedDemand: 52, lowerBound: 48, upperBound: 57, unit: 'PEOPLE' },
        ]
      : [],
    recommendationMetrics: ready
      ? {
          peakDemand: 52,
          lowUtilizationDemand: 18,
          confidencePercent: 91,
          calculationVersion: 'forecast-v22',
        }
      : null,
    limitations: ready ? [] : ['No evidence-backed forecast is available.'],
    sourceAt: ready ? now : null,
    receivedAt: ready ? now : null,
    evaluatedAt: now,
  };
}

function draft() {
  return {
    proposedCapacity: 120,
    proposedRoomCapacity: 24,
    proposedAccessibleResourceCount: 8,
    operatingStart: '08:00:00',
    operatingEnd: '19:00:00',
    policyReference: 'policy:hybrid-v4',
    affectedResourceIds: [resourceId],
    neighborhoodAllocations: [{ neighborhood: 'Product', capacity: 120 }],
    emissionEvidenceId: null,
  };
}

function comparison(ready = true) {
  return {
    currentCapacity: 100,
    proposedCapacity: 120,
    currentRoomCapacity: 20,
    proposedRoomCapacity: 24,
    currentAccessibleResourceCount: 6,
    proposedAccessibleResourceCount: 8,
    currentUtilizationPercent: ready ? 52 : null,
    proposedUtilizationPercent: ready ? 43.33 : null,
    peakDemand: ready ? 52 : null,
    currentExcessDemand: ready ? 0 : null,
    proposedExcessDemand: ready ? 0 : null,
    impactedBookingCount: 1,
  };
}

function scenario(state = 'DRAFT') {
  return {
    scenarioId,
    name: 'Q4 capacity proposal',
    description: 'Move capacity toward verified demand.',
    state,
    scope: scope(),
    draft: draft(),
    activePreview:
      state === 'PREVIEWED'
        ? {
            previewId,
            scenarioId,
            scenarioVersion: 1,
            forecastState: 'READY',
            forecast: forecast(),
            comparison: comparison(),
            emission: null,
            eligible: true,
            limitations: [],
            expiresAt: later,
            createdAt: now,
          }
        : null,
    version: state === 'PREVIEWED' ? 2 : 1,
    submittedAt: null,
    submittedBy: null,
    approvedAt: null,
    approvedBy: null,
    approvalAuthorityReference: null,
    publishedAt: null,
    publishedBy: null,
    lastRejectedAt: null,
    lastRejectedBy: null,
    lastRejectionReason: null,
    createdAt: now,
    updatedAt: now,
  };
}

function receipt(state = 'DRAFT', correlationId: string | null = 'correlation-22') {
  return {
    commandId,
    commandType: 'CREATE',
    state: 'SUCCEEDED',
    scenarioId,
    scenarioState: state,
    scenarioVersion: state === 'PREVIEWED' ? 2 : 1,
    outboxId,
    outboxState: 'PUBLISHED',
    idempotentReplay: false,
    correlationId,
    acceptedAt: now,
  };
}

function overview(forecastState = 'READY') {
  const ready = forecastState === 'READY';
  return {
    scope: scope(),
    current: {
      capacity: 100,
      roomCapacity: 20,
      accessibleResourceCount: 6,
      resourceCount: 84,
      catalogAsOf: now,
    },
    sources: sources(),
    forecast: forecast(forecastState),
    emission: null,
    scenarios: [scenario()],
    generatedAt: now,
    ready,
  };
}

describe('Workplace planning contract and API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('accepts six distinct evidence series and suppresses all non-ready forecast output', () => {
    const parsed = parseWorkplacePlanningOverview(overview());
    expect(parsed.sources.map((item) => item.series)).toEqual(series);
    expect(parsed.forecast.recommendationMetrics?.calculationVersion).toBe('forecast-v22');
    expect(parsed.forecast.points.map((point) => point.bucketStart)).toEqual([
      '2026-09-18T01:00:00Z',
      now,
    ]);
    expect(parseWorkplacePlanningOverview(overview('STALE')).forecast.points).toEqual([]);
    expect(() =>
      parseWorkplacePlanningOverview({
        ...overview('STALE'),
        forecast: { ...forecast('STALE'), points: forecast().points },
      })
    ).toThrow(/forecast/u);
    expect(() =>
      parseWorkplacePlanningOverview({ ...overview(), sources: sources().slice(0, 5) })
    ).toThrow(/planningSources/u);
  });

  it('rejects ready forecasts whose provenance is incomplete or inconsistent', () => {
    const missingSource = overview();
    missingSource.forecast = {
      ...missingSource.forecast,
      sourceObservationIds: missingSource.forecast.sourceObservationIds.slice(0, 5),
    };
    expect(() => parseWorkplacePlanningOverview(missingSource)).toThrow(
      /Invalid Workplace Planning response/u
    );

    const mismatchedCalculation = overview();
    mismatchedCalculation.forecast = {
      ...mismatchedCalculation.forecast,
      recommendationMetrics: {
        ...mismatchedCalculation.forecast.recommendationMetrics!,
        calculationVersion: 'another-calculation',
      },
    };
    expect(() => parseWorkplacePlanningOverview(mismatchedCalculation)).toThrow(
      /Invalid Workplace Planning response/u
    );

    const mismatchedDisplayedSource = overview();
    mismatchedDisplayedSource.sources = mismatchedDisplayedSource.sources.map((source, index) =>
      index === 0 ? { ...source, observationId: '22000000-0000-4000-8000-000000009999' } : source
    );
    expect(() => parseWorkplacePlanningOverview(mismatchedDisplayedSource)).toThrow(
      /Invalid Workplace Planning response/u
    );

    const missingReadyEvidence = {
      ...overview(),
      sources: sources().map((source, index) =>
        index === 0 ? { ...source, evidenceReference: null } : source
      ),
    };
    expect(() => parseWorkplacePlanningOverview(missingReadyEvidence)).toThrow(
      /Invalid Workplace Planning response/u
    );

    expect(
      parseWorkplacePlanningOverview({
        ...overview(),
        forecast: {
          ...forecast(),
          receivedAt: '2026-09-17T01:01:00Z',
          evaluatedAt: now,
        },
      }).forecast.receivedAt
    ).toBe('2026-09-17T01:01:00Z');
    expect(() =>
      parseWorkplacePlanningOverview({
        ...overview(),
        forecast: {
          ...forecast(),
          receivedAt: '2026-09-17T01:01:00.001Z',
          evaluatedAt: now,
        },
      })
    ).toThrow(/Invalid Workplace Planning response/u);
  });

  it('normalizes clock precision and rejects stale preview or booking intervals', () => {
    const normalized = parseWorkplacePlanningScenario({
      ...scenario(),
      draft: { ...draft(), operatingStart: '08:15', operatingEnd: '19:45' },
    });
    expect(normalized.draft).toMatchObject({
      operatingStart: '08:15:00',
      operatingEnd: '19:45:00',
    });
    expect(() =>
      parseWorkplacePlanningScenario({
        ...scenario('PREVIEWED'),
        activePreview: {
          ...scenario('PREVIEWED').activePreview!,
          expiresAt: now,
        },
      })
    ).toThrow(/activePreview/u);

    const impact = {
      impactPreviewId: impactId,
      scenarioId,
      scenarioVersion: 1,
      state: 'READY',
      impactedBookingCount: 1,
      bookings: [
        {
          bookingId,
          resourceId,
          startsAt: now,
          endsAt: later,
          bookingStatus: 'CONFIRMED',
          impactReason: 'Resource is in the proposed change set.',
          automaticallyMoved: false,
        },
      ],
      limitations: [],
      expiresAt: later,
      createdAt: now,
    };
    expect(parseWorkplacePlanningBookingImpact(impact).bookings).toHaveLength(1);
    expect(() =>
      parseWorkplacePlanningBookingImpact({
        ...impact,
        bookings: [{ ...impact.bookings[0], endsAt: now }],
      })
    ).toThrow(/bookings/u);
    expect(() => parseWorkplacePlanningBookingImpact({ ...impact, expiresAt: now })).toThrow(
      /bookingImpact/u
    );
  });

  it('binds scenario command receipts to the exact state, version and identifier', () => {
    const parsed = parseWorkplacePlanningCommandResult({
      scenario: scenario('PREVIEWED'),
      receipt: receipt('PREVIEWED'),
    });
    expect(parsed.scenario.activePreview?.eligible).toBe(true);
    expect(() =>
      parseWorkplacePlanningCommandResult({
        scenario: scenario('PREVIEWED'),
        receipt: { ...receipt('PREVIEWED'), scenarioVersion: 4 },
      })
    ).toThrow(/receipt/u);
  });

  it('uses the exact overview query and create body with no-store and idempotency', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(overview()))
      .mockResolvedValueOnce(response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(response({ scenario: scenario(), receipt: receipt('DRAFT', null) }));
    vi.stubGlobal('fetch', fetchMock);

    await getWorkplacePlanningOverview(scope());
    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      `/api/platform/v1/admin/workplace/space-planning/overview?siteId=${siteId}`
    );
    expect(fetchMock.mock.calls[0]?.[0]).toContain('resourceType=DESK');

    const input = {
      name: 'Q4 capacity proposal',
      description: 'Move capacity toward verified demand.',
      scope: scope(),
      draft: draft(),
      reason: 'Create an evidence-backed capacity proposal',
      explicitConfirmation: true as const,
    };
    await createWorkplacePlanningScenario(input, {
      idempotencyKey: 'planning-create-22',
    });
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      '/api/platform/v1/admin/workplace/space-planning/scenarios'
    );
    const request = fetchMock.mock.calls[2]?.[1] as RequestInit;
    const headers = new Headers(request.headers);
    expect(headers.get('Idempotency-Key')).toBe('planning-create-22');
    expect(headers.has('X-Correlation-ID')).toBe(false);
    expect(headers.get('Cache-Control')).toBe('no-store');
    expect(JSON.parse(String(request.body))).toEqual(input);
  });

  it('keeps approval elevated and booking impact explicit without moving bookings', async () => {
    const impact = {
      impactPreviewId: impactId,
      scenarioId,
      scenarioVersion: 1,
      state: 'READY',
      impactedBookingCount: 1,
      bookings: [
        {
          bookingId,
          resourceId,
          startsAt: now,
          endsAt: later,
          bookingStatus: 'CONFIRMED',
          impactReason: 'Resource is in the proposed change set.',
          automaticallyMoved: false,
        },
      ],
      limitations: [],
      expiresAt: later,
      createdAt: now,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(response({ scenario: scenario(), receipt: receipt() }))
      .mockResolvedValueOnce(response({ preview: impact, receipt: receipt() }));
    vi.stubGlobal('fetch', fetchMock);

    await approveWorkplacePlanningScenario(
      scenarioId,
      {
        expectedVersion: 1,
        decision: 'REJECT',
        approvalAuthorityReference: 'authority:capacity-board',
        reason: 'Return for evidence correction',
        explicitConfirmation: true,
      },
      { idempotencyKey: 'planning-approve-22', activeAccessMode: 'ELEVATED' }
    );
    const approvalHeaders = new Headers((fetchMock.mock.calls[1]?.[1] as RequestInit).headers);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      `/api/platform/v1/admin/workplace/space-planning/scenarios/${scenarioId}:approve`
    );
    expect(approvalHeaders.get('X-DWP-Active-Access-Mode')).toBe('ELEVATED');

    const result = await previewWorkplacePlanningBookingImpact(
      scenarioId,
      { expectedVersion: 1, reason: 'Verify impacted bookings', explicitConfirmation: true },
      { idempotencyKey: 'planning-impact-22' }
    );
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      `/api/platform/v1/admin/workplace/space-planning/scenarios/${scenarioId}/booking-impact:preview`
    );
    expect(result.preview.bookings[0]?.automaticallyMoved).toBe(false);
  });
});
