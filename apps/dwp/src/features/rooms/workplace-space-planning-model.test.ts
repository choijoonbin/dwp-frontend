import { describe, expect, it } from 'vitest';

import {
  availableWorkplacePlanningActions,
  buildWorkplacePlanningDraft,
  buildWorkplacePlanningScope,
  draftFormFromScenario,
  filterWorkplacePlanningResources,
  isWorkplacePlanningPreviewSubmittable,
  isWorkplacePlanningForecastRenderable,
  parseWorkplacePlanningUrl,
  workplacePlanningScenarioSnapshotsEqual,
  workplacePlanningScopesEqual,
  workplacePlanningSearchParams,
} from './workplace-space-planning-model';

import type {
  WorkplacePlanningForecast,
  WorkplacePlanningScenario,
} from '@dwp-frontend/shared-utils/api/workplace-planning-contract';

const readyForecast = {
  forecastId: 'e5212317-0435-42cb-a476-32846f614676',
  state: 'READY',
  calculationVersion: 'forecast-4',
  evidenceReference: 'evidence:forecast:4',
  sourceObservationIds: [],
  points: [
    {
      bucketStart: '2026-09-17T00:00:00Z',
      expectedDemand: 42,
      lowerBound: 38,
      upperBound: 46,
      unit: 'seats',
    },
  ],
  recommendationMetrics: {
    peakDemand: 46,
    lowUtilizationDemand: 18,
    confidencePercent: 82,
    calculationVersion: 'forecast-4',
  },
  limitations: [],
  sourceAt: '2026-09-17T00:00:00Z',
  receivedAt: '2026-09-17T00:01:00Z',
  evaluatedAt: '2026-09-17T00:02:00Z',
} satisfies WorkplacePlanningForecast;

describe('workplace space planning model', () => {
  it('builds a bounded canonical scope and rejects reversed ranges', () => {
    expect(
      buildWorkplacePlanningScope(
        {
          siteId: '45efe3f7-c956-48a5-b10f-066b550d3940',
          floorId: '',
          neighborhood: 'North',
          resourceType: 'DESK',
          from: '2026-09-17',
          to: '2026-09-30',
        },
        'Asia/Seoul'
      )
    ).toMatchObject({
      neighborhood: 'North',
      resourceType: 'DESK',
      floorId: null,
      from: '2026-09-16T15:00:00Z',
    });
    expect(
      buildWorkplacePlanningScope({
        siteId: '45efe3f7-c956-48a5-b10f-066b550d3940',
        floorId: '',
        neighborhood: '',
        resourceType: '',
        from: '2026-09-30',
        to: '2026-09-17',
      })
    ).toBeNull();
  });

  it('uses the selected site time zone for local planning-day boundaries', () => {
    const form = {
      siteId: '45efe3f7-c956-48a5-b10f-066b550d3940',
      floorId: '',
      neighborhood: '',
      resourceType: '' as const,
      from: '2026-09-27',
      to: '2026-09-27',
    };
    expect(buildWorkplacePlanningScope(form, 'Pacific/Auckland')).toMatchObject({
      from: '2026-09-26T12:00:00Z',
      to: '2026-09-27T10:59:59.999999999Z',
    });
  });

  it('restores a safe deep link and removes invalid or sensitive values', () => {
    const params = new URLSearchParams({
      site: '45efe3f7-c956-48a5-b10f-066b550d3940',
      floor: 'not-a-floor',
      type: 'desk',
      from: '2026-09-17',
      to: 'bad-date',
      scenario: '58d080fc-0997-4e25-af0f-20b731c69f41',
      reason: 'must-never-survive',
    });
    const restored = parseWorkplacePlanningUrl(params, {
      siteId: '',
      floorId: '',
      neighborhood: '',
      resourceType: '',
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(restored.form).toMatchObject({
      siteId: '45efe3f7-c956-48a5-b10f-066b550d3940',
      floorId: '',
      resourceType: 'DESK',
      from: '2026-09-17',
      to: '2026-09-30',
    });
    expect(restored.scenarioId).toBe('58d080fc-0997-4e25-af0f-20b731c69f41');
    expect(restored.canonicalSearchParams.has('reason')).toBe(false);
    expect(restored.corrected).toBe(true);
  });

  it('serializes scope and selected scenario without editor data', () => {
    const params = workplacePlanningSearchParams(
      {
        siteId: '45efe3f7-c956-48a5-b10f-066b550d3940',
        floorId: '',
        neighborhood: 'North',
        resourceType: 'ROOM',
        from: '2026-09-17',
        to: '2026-09-30',
      },
      '58d080fc-0997-4e25-af0f-20b731c69f41'
    );
    expect(params.toString()).toContain('scenario=58d080fc-0997-4e25-af0f-20b731c69f41');
    expect(params.toString()).not.toContain('reason');
  });

  it('requires internally consistent proposed capacity', () => {
    const valid = {
      ...draftFormFromScenario(null),
      name: 'North floor reset',
      proposedCapacity: '40',
      proposedRoomCapacity: '12',
      proposedAccessibleResourceCount: '4',
      neighborhoodAllocations: [
        { neighborhood: 'North', capacity: '25' },
        { neighborhood: 'South', capacity: '15' },
      ],
    };
    expect(buildWorkplacePlanningDraft(valid)).toMatchObject({
      proposedCapacity: 40,
      neighborhoodAllocations: [
        { neighborhood: 'North', capacity: 25 },
        { neighborhood: 'South', capacity: 15 },
      ],
    });
    expect(buildWorkplacePlanningDraft({ ...valid, proposedRoomCapacity: '41' })).toBeNull();
    expect(
      buildWorkplacePlanningDraft({
        ...valid,
        operatingStart: '08:15',
        operatingEnd: '19:45:30',
      })
    ).toMatchObject({ operatingStart: '08:15:00', operatingEnd: '19:45:30' });
    expect(
      buildWorkplacePlanningDraft({
        ...valid,
        neighborhoodAllocations: [
          { neighborhood: 'North', capacity: '20' },
          { neighborhood: 'South', capacity: '15' },
        ],
      })
    ).toBeNull();
    expect(buildWorkplacePlanningDraft({ ...valid, operatingStart: '8:00' })).toBeNull();
    expect(
      buildWorkplacePlanningDraft({
        ...valid,
        neighborhoodAllocations: [
          { neighborhood: 'North', capacity: '20' },
          { neighborhood: 'north', capacity: '20' },
        ],
      })
    ).toBeNull();
  });

  it('filters the authoritative catalog to the exact non-retired planning scope', () => {
    const scope = {
      siteId: '45efe3f7-c956-48a5-b10f-066b550d3940',
      floorId: null,
      neighborhood: 'North',
      resourceType: 'DESK' as const,
      from: '2026-09-17T00:00:00Z',
      to: '2026-09-30T23:59:59Z',
    };
    const resource = {
      resourceId: '58d080fc-0997-4e25-af0f-20b731c69f41',
      floorId: '58d080fc-0997-4e25-af0f-20b731c69f42',
      siteId: scope.siteId,
      calendarResourceId: null,
      code: 'N-1',
      name: 'North desk',
      nameKo: '북측 데스크',
      nameEn: 'North desk',
      type: 'DESK' as const,
      mode: 'RESERVABLE' as const,
      state: 'AVAILABLE' as const,
      neighborhood: 'North',
      capacity: 1,
      features: [],
      accessible: false,
      approvalRequired: false,
      positionX: 0,
      positionY: 0,
      widthPercent: 1,
      heightPercent: 1,
      rotationDegrees: 0,
      assignedToCurrentUser: false,
      assignedUserId: null,
      assignedPersonPublicId: null,
      assignedDisplayName: null,
      version: 1,
    };
    expect(
      filterWorkplacePlanningResources(
        [
          resource,
          { ...resource, resourceId: '58d080fc-0997-4e25-af0f-20b731c69f43', type: 'ROOM' },
          {
            ...resource,
            resourceId: '58d080fc-0997-4e25-af0f-20b731c69f44',
            state: 'RETIRED',
          },
        ],
        scope
      ).map((item) => item.resourceId)
    ).toEqual([resource.resourceId]);
  });

  it('suppresses chart and recommendation data unless the forecast is fully ready', () => {
    expect(isWorkplacePlanningForecastRenderable(readyForecast)).toBe(true);
    expect(
      isWorkplacePlanningForecastRenderable({
        ...readyForecast,
        state: 'STALE',
        points: [],
        recommendationMetrics: null,
      })
    ).toBe(false);
  });

  it('exposes only valid lifecycle actions', () => {
    expect(availableWorkplacePlanningActions('PREVIEWED')).toEqual([
      'UPDATE',
      'PREVIEW',
      'BOOKING_IMPACT',
      'SUBMIT',
    ]);
    expect(availableWorkplacePlanningActions('SUBMITTED')).toEqual(['APPROVE', 'REJECT']);
    expect(availableWorkplacePlanningActions('PUBLISHED')).toEqual([]);
  });

  it('hydrates a form from the frozen scenario version', () => {
    const scenario = {
      scenarioId: '58d080fc-0997-4e25-af0f-20b731c69f41',
      name: 'North floor reset',
      description: null,
      state: 'DRAFT',
      scope: {
        siteId: '45efe3f7-c956-48a5-b10f-066b550d3940',
        floorId: null,
        neighborhood: null,
        resourceType: null,
        from: '2026-09-17T00:00:00Z',
        to: '2026-09-30T23:59:59Z',
      },
      draft: {
        proposedCapacity: 40,
        proposedRoomCapacity: 12,
        proposedAccessibleResourceCount: 4,
        operatingStart: '08:00:00',
        operatingEnd: '20:00:00',
        policyReference: null,
        affectedResourceIds: [],
        neighborhoodAllocations: [{ neighborhood: 'North', capacity: 40 }],
        emissionEvidenceId: null,
      },
      activePreview: null,
      version: 3,
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
      createdAt: '2026-09-17T00:00:00Z',
      updatedAt: '2026-09-17T00:00:00Z',
    } satisfies WorkplacePlanningScenario;
    expect(draftFormFromScenario(scenario)).toMatchObject({
      name: 'North floor reset',
      neighborhoodAllocations: [{ neighborhood: 'North', capacity: '40' }],
      proposedCapacity: '40',
    });
    expect(workplacePlanningScopesEqual(scenario.scope, { ...scenario.scope })).toBe(true);
    expect(
      workplacePlanningScopesEqual(scenario.scope, { ...scenario.scope, neighborhood: 'North' })
    ).toBe(false);
    const previewed = {
      ...scenario,
      state: 'PREVIEWED' as const,
      version: 4,
      activePreview: {
        previewId: '58d080fc-0997-4e25-af0f-20b731c69f49',
        scenarioId: scenario.scenarioId,
        scenarioVersion: 3,
        forecastState: 'READY' as const,
        forecast: readyForecast,
        comparison: {
          currentCapacity: 40,
          proposedCapacity: 40,
          currentRoomCapacity: 12,
          proposedRoomCapacity: 12,
          currentAccessibleResourceCount: 4,
          proposedAccessibleResourceCount: 4,
          currentUtilizationPercent: 50,
          proposedUtilizationPercent: 50,
          peakDemand: 20,
          currentExcessDemand: 0,
          proposedExcessDemand: 0,
          impactedBookingCount: 0,
        },
        emission: null,
        eligible: true,
        limitations: [],
        expiresAt: '2026-09-18T00:00:00Z',
        createdAt: '2026-09-17T00:00:00Z',
      },
    } satisfies WorkplacePlanningScenario;
    expect(
      isWorkplacePlanningPreviewSubmittable(previewed, Date.parse('2026-09-17T12:00:00Z'))
    ).toBe(true);
    expect(
      isWorkplacePlanningPreviewSubmittable(previewed, Date.parse('2026-09-18T00:00:00Z'))
    ).toBe(false);
    expect(
      isWorkplacePlanningPreviewSubmittable(
        {
          ...previewed,
          activePreview: { ...previewed.activePreview!, scenarioVersion: 2 },
        },
        Date.parse('2026-09-17T12:00:00Z')
      )
    ).toBe(false);
    expect(workplacePlanningScenarioSnapshotsEqual(previewed, { ...previewed })).toBe(true);
    expect(
      workplacePlanningScenarioSnapshotsEqual(previewed, {
        ...previewed,
        draft: { ...previewed.draft, proposedCapacity: 41 },
      })
    ).toBe(false);
  });
});
