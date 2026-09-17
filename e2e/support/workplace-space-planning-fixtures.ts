import path from 'node:path';
import { createHash } from 'node:crypto';

import type { Page, Route } from '@playwright/test';

export const PLANNING_IDS = {
  site: '22000000-0000-4000-8000-000000000001',
  floorA: '22000000-0000-4000-8000-000000000002',
  floorB: '22000000-0000-4000-8000-000000000003',
  scenario: '22000000-0000-4000-8000-000000000004',
  preview: '22000000-0000-4000-8000-000000000005',
  impact: '22000000-0000-4000-8000-000000000006',
  booking: '22000000-0000-4000-8000-000000000007',
  command: '22000000-0000-4000-8000-000000000008',
  outbox: '22000000-0000-4000-8000-000000000009',
  deskA: '22000000-0000-4000-8000-000000000010',
  deskB: '22000000-0000-4000-8000-000000000011',
  southDesk: '22000000-0000-4000-8000-000000000012',
  room: '22000000-0000-4000-8000-000000000013',
  retiredDesk: '22000000-0000-4000-8000-000000000014',
  reportPreview: '22000000-0000-4000-8000-000000000015',
  reportCommand: '22000000-0000-4000-8000-000000000016',
} as const;

const SOURCE_KINDS = [
  'WORK_PLAN',
  'RESERVATION',
  'CHECK_IN',
  'ACCESS',
  'SENSOR_OCCUPANCY',
  'NO_SHOW',
] as const;
const GENERATED_AT = '2026-09-17T23:30:00Z';
const SOURCE_AT = '2026-09-17T22:00:00Z';
const RECEIVED_AT = '2026-09-17T22:01:00Z';
const REPORT_PDF = Buffer.from('%PDF-1.7\nDWP aggregate board report\n', 'utf8');
const REPORT_SHA256 = createHash('sha256').update(REPORT_PDF).digest('hex');

function success(route: Route, data: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data }),
  });
}

function scopeFrom(url: URL) {
  return {
    siteId: url.searchParams.get('siteId') ?? PLANNING_IDS.site,
    floorId: url.searchParams.get('floorId'),
    neighborhood: url.searchParams.get('neighborhood'),
    resourceType: url.searchParams.get('resourceType'),
    from: url.searchParams.get('from') ?? '2026-09-16T15:00:00Z',
    to: url.searchParams.get('to') ?? '2026-09-30T14:59:59.999999999Z',
  };
}

function sourceStatuses() {
  return SOURCE_KINDS.map((series, index) => ({
    series,
    availability: index === 4 ? 'PARTIAL' : 'AVAILABLE',
    coveragePercent: index === 4 ? 72 : 100,
    sourceAt: SOURCE_AT,
    receivedAt: RECEIVED_AT,
    freshness: 'FRESH',
    exclusions: index === 4 ? ['ZONE_SENSOR_MAINTENANCE'] : [],
    evidenceReference: `evidence:${series}:22`,
    points: [
      {
        bucketStart: SOURCE_AT,
        value: 40 + index,
        lowerBound: null,
        upperBound: null,
        unit: 'PEOPLE',
      },
    ],
    observationId: `22000000-0000-4000-8000-${String(100 + index).padStart(12, '0')}`,
    sequence: 4,
  }));
}

function partialForecast() {
  return {
    forecastId: '22000000-0000-4000-8000-000000000020',
    state: 'PARTIAL',
    calculationVersion: 'forecast-v22',
    evidenceReference: 'forecast-run:22',
    sourceObservationIds: sourceStatuses().map((source) => source.observationId),
    points: [],
    recommendationMetrics: null,
    limitations: ['Sensor occupancy coverage is partial.'],
    sourceAt: SOURCE_AT,
    receivedAt: RECEIVED_AT,
    evaluatedAt: GENERATED_AT,
  };
}

function draft(resourceType: string | null) {
  const resourceId = resourceType === 'ROOM' ? PLANNING_IDS.room : PLANNING_IDS.deskA;
  return {
    proposedCapacity: resourceType === 'ROOM' ? 12 : 40,
    proposedRoomCapacity: resourceType === 'ROOM' ? 12 : 4,
    proposedAccessibleResourceCount: 2,
    operatingStart: '08:00:00',
    operatingEnd: '20:00:00',
    policyReference: 'policy:hybrid-v4',
    affectedResourceIds: [resourceId],
    neighborhoodAllocations: [
      { neighborhood: 'North', capacity: resourceType === 'ROOM' ? 12 : 40 },
    ],
    emissionEvidenceId: null,
  };
}

function comparison(resourceType: string | null) {
  const capacity = resourceType === 'ROOM' ? 12 : 40;
  return {
    currentCapacity: capacity,
    proposedCapacity: capacity,
    currentRoomCapacity: resourceType === 'ROOM' ? 12 : 4,
    proposedRoomCapacity: resourceType === 'ROOM' ? 12 : 4,
    currentAccessibleResourceCount: 2,
    proposedAccessibleResourceCount: 2,
    currentUtilizationPercent: null,
    proposedUtilizationPercent: null,
    peakDemand: null,
    currentExcessDemand: null,
    proposedExcessDemand: null,
    impactedBookingCount: 1,
  };
}

function scenario(scope: ReturnType<typeof scopeFrom>, version: number) {
  const previewVersion = version - 1;
  return {
    scenarioId: PLANNING_IDS.scenario,
    name: scope.resourceType === 'ROOM' ? 'North room plan' : 'North desk plan',
    description: 'Evidence-backed capacity proposal.',
    state: 'PREVIEWED',
    scope,
    draft: draft(scope.resourceType),
    activePreview: {
      previewId: version === 2 ? PLANNING_IDS.preview : '22000000-0000-4000-8000-000000000021',
      scenarioId: PLANNING_IDS.scenario,
      scenarioVersion: previewVersion,
      forecastState: 'PARTIAL',
      forecast: partialForecast(),
      comparison: comparison(scope.resourceType),
      emission: null,
      eligible: false,
      limitations: ['Sensor occupancy coverage is partial.'],
      expiresAt: '2027-09-17T01:00:00Z',
      createdAt: '2026-09-17T00:00:00Z',
    },
    version,
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
    createdAt: '2020-09-16T00:00:00Z',
    updatedAt: GENERATED_AT,
  };
}

function overview(url: URL, version: number) {
  const scope = scopeFrom(url);
  return {
    scope,
    current: {
      capacity: scope.resourceType === 'ROOM' ? 12 : 40,
      roomCapacity: scope.resourceType === 'ROOM' ? 12 : 4,
      accessibleResourceCount: 2,
      resourceCount: 2,
      catalogAsOf: SOURCE_AT,
    },
    sources: sourceStatuses(),
    forecast: partialForecast(),
    emission: null,
    scenarios: [scenario(scope, version)],
    generatedAt: GENERATED_AT,
  };
}

function site() {
  return {
    siteId: PLANNING_IDS.site,
    campusId: null,
    code: 'SEL',
    name: 'Seoul Workplace',
    nameKo: '서울 사업장',
    nameEn: 'Seoul Workplace',
    type: 'HEADQUARTERS',
    address: 'Seoul',
    timeZone: 'Asia/Seoul',
    totalFloorCount: 2,
    configuredFloorCount: 2,
    resourceCount: 5,
    state: 'ACTIVE',
    version: 1,
  };
}

function floor(floorId: string, floorNumber: number, name: string) {
  return {
    floorId,
    siteId: PLANNING_IDS.site,
    siteName: 'Seoul Workplace',
    floorNumber,
    name,
    nameKo: `${floorNumber}층`,
    nameEn: name,
    planWidth: 1200,
    planHeight: 800,
    backgroundAssetPath: null,
    state: 'ACTIVE',
    resourceCount: floorNumber === 1 ? 2 : 3,
    version: 1,
  };
}

function resource(
  resourceId: string,
  floorId: string,
  code: string,
  name: string,
  type: 'DESK' | 'ROOM',
  neighborhood: string,
  state: 'AVAILABLE' | 'RETIRED' = 'AVAILABLE'
) {
  return {
    resourceId,
    floorId,
    siteId: PLANNING_IDS.site,
    calendarResourceId: null,
    code,
    name,
    nameKo: name,
    nameEn: name,
    type,
    mode: 'RESERVABLE',
    state,
    neighborhood,
    capacity: type === 'ROOM' ? 12 : 1,
    features: [],
    accessible: true,
    approvalRequired: false,
    positionX: 0,
    positionY: 0,
    widthPercent: 10,
    heightPercent: 10,
    rotationDegrees: 0,
    assignedToCurrentUser: false,
    assignedUserId: null,
    assignedPersonPublicId: null,
    assignedDisplayName: null,
    version: 1,
  };
}

function impactResult(state: 'RESULT_UNKNOWN' | 'SUCCEEDED', scenarioVersion: number) {
  return {
    preview: {
      impactPreviewId: PLANNING_IDS.impact,
      scenarioId: PLANNING_IDS.scenario,
      scenarioVersion,
      state: 'READY',
      impactedBookingCount: 1,
      bookings: [
        {
          bookingId: PLANNING_IDS.booking,
          resourceId: PLANNING_IDS.deskA,
          startsAt: '2026-09-20T23:00:00Z',
          endsAt: '2026-09-21T00:00:00Z',
          bookingStatus: 'CONFIRMED',
          impactReason: 'Resource belongs to the governed change set.',
          automaticallyMoved: false,
        },
      ],
      limitations: [],
      expiresAt: '2027-09-17T02:00:00Z',
      createdAt: '2026-09-17T02:00:00Z',
    },
    receipt: {
      commandId: PLANNING_IDS.command,
      commandType: 'BOOKING_IMPACT_PREVIEW',
      state,
      scenarioId: PLANNING_IDS.scenario,
      scenarioState: 'PREVIEWED',
      scenarioVersion,
      outboxId: PLANNING_IDS.outbox,
      outboxState: state === 'SUCCEEDED' ? 'PENDING' : 'RESULT_UNKNOWN',
      idempotentReplay: state === 'SUCCEEDED',
      correlationId: 'screen-22-e2e',
      acceptedAt: GENERATED_AT,
    },
  };
}

function reportPreview(scenarioVersion: number, format: 'PDF' | 'XLSX' = 'PDF') {
  return {
    previewId: PLANNING_IDS.reportPreview,
    scenarioId: PLANNING_IDS.scenario,
    siteId: PLANNING_IDS.site,
    floorId: null,
    format,
    scenarioVersion,
    previewVersion: 1,
    confirmationToken: '22000000-0000-4000-8000-000000000017',
    snapshotSha256: 'a'.repeat(64),
    snapshot: {
      scenarioId: PLANNING_IDS.scenario,
      scenarioVersion,
      scenarioName: 'North desk plan',
      scenarioState: 'PREVIEWED',
      siteId: PLANNING_IDS.site,
      siteCode: 'SEL',
      siteName: 'Seoul Workplace',
      floorId: null,
      floorName: null,
      windowStart: '2026-09-16T15:00:00Z',
      windowEnd: '2026-09-30T14:59:59Z',
      currentCapacity: 40,
      proposedCapacity: 44,
      currentRoomCapacity: 4,
      proposedRoomCapacity: 5,
      currentAccessibleResourceCount: 2,
      proposedAccessibleResourceCount: 3,
      currentUtilizationPercent: 73.4,
      proposedUtilizationPercent: 79.1,
      peakDemand: 38,
      forecastConfidencePercent: 92,
      forecastState: 'READY',
      calculationVersion: 'forecast-v22',
      energyValue: 120.5,
      energyUnit: 'kWh',
      co2eValue: 52.2,
      co2eUnit: 'kgCO2e',
      emissionFactorVersion: 'factor-kr-2026',
      emissionRegionCode: 'KR',
      affectedResourceCount: 2,
      impactedBookingCount: 1,
      personLevelDataIncluded: false,
      personLevelRowCount: 0,
      capturedAt: GENERATED_AT,
    },
    createdAt: GENERATED_AT,
    expiresAt: '2027-09-17T23:45:00Z',
    idempotentReplay: false,
  };
}

function reportReceipt(scenarioVersion: number) {
  return {
    commandId: PLANNING_IDS.reportCommand,
    previewId: PLANNING_IDS.reportPreview,
    scenarioId: PLANNING_IDS.scenario,
    siteId: PLANNING_IDS.site,
    floorId: null,
    format: 'PDF',
    state: 'SUCCEEDED',
    scenarioVersion,
    commandVersion: 1,
    mimeType: 'application/pdf',
    fileName: 'workplace-space-planning-board-report-22000000.pdf',
    byteSize: REPORT_PDF.byteLength,
    contentSha256: REPORT_SHA256,
    contentHref:
      `/v1/admin/workplace/space-planning/reports/${PLANNING_IDS.reportCommand}` +
      `/content?siteId=${PLANNING_IDS.site}`,
    acceptedAt: GENERATED_AT,
    completedAt: GENERATED_AT,
    expiresAt: '2027-09-18T23:30:00Z',
    idempotentReplay: false,
    correlationId: 'screen-21-board-report',
  };
}

export async function installWorkplaceSpacePlanningHarness(page: Page) {
  const harnessPath = path.resolve(
    process.cwd(),
    'e2e/support/workplace-space-planning-harness.tsx'
  );
  await page.route('**/__screen22_space_planning**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Workplace space planning</title></head><body><div id="root"></div><script type="module" src="/@fs/${harnessPath}"></script></body></html>`,
    })
  );
}

export async function mockWorkplaceSpacePlanning(
  page: Page,
  options: {
    roomOverviewDelayMs?: number;
    postCommandOverviewDelayMs?: number;
    failResourceCatalog?: boolean;
    denyReportExport?: boolean;
    failReportPreview?: boolean;
    expiredScenarioPreview?: boolean;
  } = {}
) {
  let scenarioVersion = 2;
  let impactCalls = 0;
  let failNextCommand = false;
  let postCommandOverviewPending = false;
  let markRoomOverviewStarted = () => undefined;
  const roomOverviewStarted = new Promise<void>((resolve) => {
    markRoomOverviewStarted = resolve;
  });
  let releaseRoomOverview = () => undefined;
  const roomOverviewRelease = new Promise<void>((resolve) => {
    releaseRoomOverview = resolve;
  });
  let lastScope = scopeFrom(new URL(`https://screen22.test?siteId=${PLANNING_IDS.site}`));
  const resourceFloorRequests: string[] = [];
  const commandKeys: string[] = [];
  const commandBodies: unknown[] = [];
  const reportRequests: string[] = [];
  const reportHeaders: Record<string, string>[] = [];

  await page.route('**/api/auth/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me') {
      return success(route, {
        userId: 22,
        personPublicId: 'screen-22-admin',
        displayName: 'Planning Admin',
        jobTitle: 'Workplace planner',
        email: 'planner@example.test',
        tenantId: 1,
        tenantCode: 'default',
        tenantName: 'DWP',
        identityPlane: 'TENANT',
        preferredLocale: 'en',
        tenantDefaultLocale: 'en',
        roles: ['ADMIN'],
        groups: [],
        resourceRoles: [],
      });
    }
    if (path === '/api/auth/permissions') {
      return success(
        route,
        ['VIEW', 'MANAGE', 'APPROVE', ...(options.denyReportExport ? [] : ['EXPORT'])].map(
          (permissionCode) => ({
            resourceType: 'APPLICATION',
            resourceKey: 'ADMIN.WORKPLACE',
            permissionCode,
            effect: 'ALLOW',
          })
        )
      );
    }
    if (path === '/api/auth/product-surface-contexts') {
      return success(route, {
        contractVersion: 'product-surfaces/v3',
        decisionRevision: `psr-${'a'.repeat(64)}`,
        sourceRevisions: { auth: '22', policy: '22', productRelationship: '22' },
        activeAccessMode: 'ELEVATED',
        generatedAt: new Date().toISOString(),
        contexts: [],
        rollouts: [
          {
            productKey: 'workplace',
            state: '000',
            flags: { contextShadow: false, capabilityEnforcement: false, surfaceUi: false },
            cohort: 'baseline',
            opaqueRevision: 'screen-22-baseline',
            authorityStatus: 'NOT_EVALUATED',
          },
        ],
      });
    }
    if (path === '/api/auth/csrf') {
      return success(route, { token: 'screen-22-csrf', headerName: 'X-XSRF-TOKEN' });
    }
    return route.fulfill({ status: 404, body: '{}' });
  });

  await page.route('**/api/platform/v1/admin/workplace/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path.endsWith('/admin/workplace/sites')) return success(route, [site()]);
    if (path.endsWith('/admin/workplace/floors')) {
      return success(route, [
        floor(PLANNING_IDS.floorA, 1, 'First floor'),
        floor(PLANNING_IDS.floorB, 2, 'Second floor'),
      ]);
    }
    const resourceMatch = path.match(/\/floors\/([^/]+)\/resources$/u);
    if (resourceMatch) {
      const floorId = decodeURIComponent(resourceMatch[1]!);
      resourceFloorRequests.push(floorId);
      if (options.failResourceCatalog && floorId === PLANNING_IDS.floorB) {
        return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
      }
      return success(
        route,
        floorId === PLANNING_IDS.floorA
          ? [
              resource(PLANNING_IDS.deskA, floorId, 'N-A', 'North desk A', 'DESK', 'North'),
              resource(PLANNING_IDS.southDesk, floorId, 'S-A', 'South desk', 'DESK', 'South'),
            ]
          : [
              resource(PLANNING_IDS.deskB, floorId, 'N-B', 'North desk B', 'DESK', 'North'),
              resource(PLANNING_IDS.room, floorId, 'R-B', 'North room', 'ROOM', 'North'),
              resource(
                PLANNING_IDS.retiredDesk,
                floorId,
                'N-X',
                'Retired north desk',
                'DESK',
                'North',
                'RETIRED'
              ),
            ]
      );
    }
    if (path.endsWith('/space-planning/overview')) {
      lastScope = scopeFrom(url);
      if (url.searchParams.get('resourceType') === 'ROOM' && options.roomOverviewDelayMs) {
        markRoomOverviewStarted();
        await roomOverviewRelease;
      }
      if (postCommandOverviewPending && options.postCommandOverviewDelayMs) {
        postCommandOverviewPending = false;
        await new Promise((resolve) => setTimeout(resolve, options.postCommandOverviewDelayMs));
      }
      const payload = overview(url, scenarioVersion);
      if (options.expiredScenarioPreview) {
        payload.scenarios[0]!.activePreview!.expiresAt = '2026-09-17T00:30:00Z';
      }
      return success(route, payload);
    }
    if (path.endsWith('/space-planning/reports:preview') && request.method() === 'POST') {
      reportRequests.push('preview');
      reportHeaders.push(request.headers());
      commandKeys.push(request.headers()['idempotency-key'] ?? '');
      commandBodies.push(request.postDataJSON());
      if (options.failReportPreview) {
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'FAIL', message: 'Unavailable', data: null }),
        });
      }
      const body = request.postDataJSON() as { format?: 'PDF' | 'XLSX' };
      return success(route, reportPreview(scenarioVersion, body.format));
    }
    if (path.endsWith('/space-planning/reports') && request.method() === 'POST') {
      reportRequests.push('execute');
      reportHeaders.push(request.headers());
      commandKeys.push(request.headers()['idempotency-key'] ?? '');
      commandBodies.push(request.postDataJSON());
      return success(route, reportReceipt(scenarioVersion));
    }
    if (
      path.endsWith(`/space-planning/reports/${PLANNING_IDS.reportCommand}`) &&
      request.method() === 'GET'
    ) {
      reportRequests.push('receipt');
      reportHeaders.push(request.headers());
      return success(route, reportReceipt(scenarioVersion));
    }
    if (
      path.endsWith(`/space-planning/reports/${PLANNING_IDS.reportCommand}/content`) &&
      request.method() === 'GET'
    ) {
      reportRequests.push('content');
      reportHeaders.push(request.headers());
      return route.fulfill({ status: 200, contentType: 'application/pdf', body: REPORT_PDF });
    }
    if (path.endsWith('/booking-impact:preview') && request.method() === 'POST') {
      commandKeys.push(request.headers()['idempotency-key'] ?? '');
      commandBodies.push(request.postDataJSON());
      impactCalls += 1;
      return success(
        route,
        impactResult(impactCalls === 1 ? 'RESULT_UNKNOWN' : 'SUCCEEDED', scenarioVersion),
        202
      );
    }
    if (path.includes('/space-planning/scenarios/') && request.method() !== 'GET') {
      commandKeys.push(request.headers()['idempotency-key'] ?? '');
      commandBodies.push(request.postDataJSON());
      if (failNextCommand) {
        failNextCommand = false;
        return route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'FAIL', message: 'Conflict', data: null }),
        });
      }
      if (path.endsWith(':preview')) {
        scenarioVersion += 1;
        postCommandOverviewPending = true;
        return success(
          route,
          {
            scenario: scenario(lastScope, scenarioVersion),
            receipt: {
              commandId: PLANNING_IDS.command,
              commandType: 'PREVIEW',
              state: 'SUCCEEDED',
              scenarioId: PLANNING_IDS.scenario,
              scenarioState: 'PREVIEWED',
              scenarioVersion,
              outboxId: PLANNING_IDS.outbox,
              outboxState: 'PENDING',
              idempotentReplay: false,
              correlationId: 'screen-22-e2e',
              acceptedAt: GENERATED_AT,
            },
          },
          202
        );
      }
    }
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });

  return {
    resourceFloorRequests,
    commandKeys,
    commandBodies,
    reportRequests,
    reportHeaders,
    roomOverviewStarted,
    releaseRoomOverview,
    setScenarioVersion(value: number) {
      scenarioVersion = value;
    },
    failNextMutation() {
      failNextCommand = true;
    },
  };
}
