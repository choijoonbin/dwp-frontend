import { FULL_PRODUCT_PERMISSIONS, fulfillSuccess, mockShellSession } from './shell-session';
import { elevatedAuthority } from './workplace-reservation-services-fixtures';
import { isolateWorkplaceDevelopmentUpdates } from './workplace-runtime-isolation';

import type { Page, Route } from '@playwright/test';

export const SAFETY_DECISION_REVISION = `psr-${'d'.repeat(64)}`;
const GOVERNED_PRODUCTS = [
  'approvals',
  'calendar',
  'communications',
  'dwaion',
  'hcm',
  'mail',
  'meetings',
  'messaging',
  'notifications',
  'services',
  'spaces',
  'workplace',
] as const;

export const SAFETY_IDS = {
  incident: '20000000-0000-4000-8000-000000000001',
  snapshot: '20000000-0000-4000-8000-000000000002',
  member: '20000000-0000-4000-8000-000000000003',
  site: '20000000-0000-4000-8000-000000000004',
  floor: '20000000-0000-4000-8000-000000000005',
  zone: '20000000-0000-4000-8000-000000000006',
  dispatch: '20000000-0000-4000-8000-000000000007',
  command: '20000000-0000-4000-8000-000000000008',
  activationPreview: '20000000-0000-4000-8000-000000000009',
  scopePreview: '20000000-0000-4000-8000-000000000010',
  closurePreview: '20000000-0000-4000-8000-000000000011',
  closure: '20000000-0000-4000-8000-000000000012',
  message: '20000000-0000-4000-8000-000000000013',
  assembly: '20000000-0000-4000-8000-000000000014',
  report: '20000000-0000-4000-8000-000000000015',
  export: '20000000-0000-4000-8000-000000000016',
} as const;

const NOW = '2026-09-16T12:00:00Z';

function accepted(route: Route, data: unknown) {
  return route.fulfill({
    status: 202,
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'Accepted', data }),
  });
}

function source(
  sourceName: string,
  freshness: 'FRESH' | 'STALE' | 'UNKNOWN' = 'FRESH',
  availability: 'AVAILABLE' | 'PARTIAL' | 'UNAVAILABLE' = 'AVAILABLE'
) {
  return {
    source: sourceName,
    candidateCount: 12,
    includedCount: 10,
    excludedCount: 1,
    unknownCount: 1,
    coveragePercent: 83.3,
    freshness,
    availability,
    sourceAt: NOW,
    receivedAt: NOW,
  };
}

export function safetyAudience() {
  return {
    audienceSnapshotId: SAFETY_IDS.snapshot,
    totalCandidates: 48,
    deduplicatedCount: 36,
    excludedCount: 4,
    unknownCount: 4,
    finalTargetCount: 32,
    sources: [
      source('RESERVATION'),
      source('ACTUAL_PRESENCE', 'STALE', 'PARTIAL'),
      source('VISITOR'),
      source('SCHEDULED_VISITOR'),
    ],
    members: [
      {
        audienceMemberId: SAFETY_IDS.member,
        subjectKeySha256: 'a'.repeat(64),
        subjectUserId: 20001,
        maskedLabel: 'K** J**',
        sources: ['RESERVATION', 'ACTUAL_PRESENCE'],
        included: true,
        exclusionCode: null,
        unknownIdentity: false,
      },
    ],
    asOf: NOW,
  };
}

function connector(kind: string, state = 'READY') {
  return {
    kind,
    providerCode: state === 'NOT_CONFIGURED' ? null : `provider-${kind.toLowerCase()}`,
    state,
    configurationVersion: state === 'NOT_CONFIGURED' ? 0 : 3,
    observedConfigurationVersion: state === 'READY' ? 3 : null,
    evidenceReference: state === 'READY' ? `evidence-${kind.toLowerCase()}` : null,
    sourceAt: state === 'NOT_CONFIGURED' ? null : NOW,
    receivedAt: state === 'NOT_CONFIGURED' ? null : NOW,
    lastSuccessAt: state === 'READY' ? NOW : null,
    errorCode: state === 'READY' ? null : 'PROVIDER_NOT_VERIFIED',
    version: state === 'NOT_CONFIGURED' ? 0 : 4,
    evaluatedAt: NOW,
  };
}

function connectors(unverifiedEbs = false) {
  return [
    connector('EMERGENCY_119', 'CONFIGURED_UNVERIFIED'),
    connector('EBS', unverifiedEbs ? 'CONFIGURED_UNVERIFIED' : 'READY'),
    connector('BLE_MESH'),
    connector('WORM'),
    connector('GOVERNMENT_LOG'),
  ];
}

function dispatch(state: string) {
  return {
    dispatchBatchId: SAFETY_IDS.dispatch,
    state,
    attemptCount: 32,
    deliveredCount: state === 'SUCCEEDED' ? 32 : 28,
    failedCount: state === 'PARTIAL' || state === 'FAILED' ? 3 : 0,
    unknownCount: state === 'RESULT_UNKNOWN' ? 1 : 0,
    channels: ['APP_PUSH', 'SMS'],
    updatedAt: NOW,
  };
}

export function safetyIncident(
  dispatchState = 'PARTIAL',
  state = 'ACTIVE',
  version = 4,
  unverifiedEbs = false
) {
  return {
    incidentId: SAFETY_IDS.incident,
    incidentNumber: 'INC-20260916-0001',
    incidentType: 'EVACUATION',
    severity: 'CRITICAL',
    state,
    siteId: SAFETY_IDS.site,
    floorIds: [SAFETY_IDS.floor],
    zoneIds: [SAFETY_IDS.zone],
    message: 'Evacuate the affected area.',
    safetyAction: 'Use the marked exit and go to the assembly point.',
    assemblyPoint: 'North assembly point',
    channels: ['APP_PUSH', 'SMS'],
    audience: safetyAudience(),
    responses: { safe: 32, needsHelp: 0, noResponse: 0 },
    assembly: { confirmed: 31, pending: 1 },
    dispatches: [dispatch(dispatchState)],
    connectorTruth: connectors(unverifiedEbs),
    version,
    activatedAt: NOW,
    closedAt: state === 'CLOSED' ? NOW : null,
    updatedAt: NOW,
  };
}

function safetySheet(currentResponse: string | null = null, version = 4) {
  return {
    incidentId: SAFETY_IDS.incident,
    incidentNumber: 'INC-20260916-0001',
    severity: 'CRITICAL',
    message: 'Evacuate the affected area.',
    safetyAction: 'Use the marked exit and go to the assembly point.',
    assemblyPoint: 'North assembly point',
    scopeLabels: ['Seoul HQ', '12F', 'East zone'],
    currentResponse,
    accessibleAlternativeContact: 'Site security desk 02-0000-119',
    version,
    asOf: NOW,
  };
}

function receipt(state = 'SUCCEEDED', commandId = SAFETY_IDS.command) {
  return {
    commandId,
    state,
    statusHref: `/v1/admin/workplace/safety/incidents/${SAFETY_IDS.incident}/commands/${commandId}`,
    idempotentReplay: false,
    correlationId: 'screen-20-e2e',
    acceptedAt: NOW,
  };
}

function activationPreview(input: Record<string, unknown>, eligible = true) {
  return {
    activationPreviewId: SAFETY_IDS.activationPreview,
    incidentType: input.incidentType,
    severity: input.severity,
    siteId: input.siteId,
    floorIds: input.floorIds,
    zoneIds: input.zoneIds,
    message: input.message,
    safetyAction: input.safetyAction,
    assemblyPoint: input.assemblyPoint,
    channels: input.channels,
    audience: safetyAudience(),
    connectorTruth: connectors(!eligible),
    eligible,
    limitations: eligible ? [] : ['EBS_PROVIDER_UNVERIFIED'],
    expiresAt: '2026-09-16T12:10:00Z',
    createdAt: NOW,
  };
}

function scopePreview() {
  return {
    scopeRevisionId: SAFETY_IDS.scopePreview,
    incidentId: SAFETY_IDS.incident,
    incidentVersion: 5,
    previousFloorIds: [SAFETY_IDS.floor],
    previousZoneIds: [SAFETY_IDS.zone],
    proposedFloorIds: [SAFETY_IDS.floor],
    proposedZoneIds: [SAFETY_IDS.zone],
    proposedMessage: 'Updated verified scope.',
    audience: safetyAudience(),
    newlyIncluded: 2,
    noLongerIncluded: 1,
    expiresAt: '2026-09-16T12:10:00Z',
    createdAt: NOW,
  };
}

function closurePreview() {
  return {
    closurePreviewId: SAFETY_IDS.closurePreview,
    incidentId: SAFETY_IDS.incident,
    incidentVersion: 7,
    needsHelpCount: 0,
    noResponseCount: 0,
    deliveredCount: 32,
    failedOrUnknownCount: 0,
    eligible: true,
    warnings: ['Verify the final follow-up owner.'],
    expiresAt: '2026-09-16T12:10:00Z',
    createdAt: NOW,
  };
}

export type WorkplaceSafetyEvidence = {
  postPaths: string[];
  postBodies: unknown[];
  commandHeaders: Array<Record<string, string>>;
  postCount: () => number;
  detailGets: () => number;
  exportGets: () => number;
};

export async function mockWorkplaceSafety(
  page: Page,
  options: {
    locale?: 'en' | 'ko';
    readOnly?: boolean;
    responseUnknown?: boolean;
    incidentUnknown?: boolean;
    unverifiedEbs?: boolean;
  } = {}
): Promise<WorkplaceSafetyEvidence> {
  await isolateWorkplaceDevelopmentUpdates(page);
  await page.clock.setFixedTime(new Date(NOW));
  const viewOnlyPermissions = [
    {
      resourceType: 'APP',
      resourceKey: 'APP.WORKPLACE',
      permissionCode: 'VIEW',
      effect: 'ALLOW' as const,
    },
    {
      resourceType: 'ADMIN',
      resourceKey: 'ADMIN.WORKPLACE',
      permissionCode: 'VIEW',
      effect: 'ALLOW' as const,
    },
  ];
  await mockShellSession(page, options.readOnly ? ['EMPLOYEE'] : ['TENANT_ADMIN'], {
    locale: options.locale ?? 'en',
    permissions: options.readOnly
      ? viewOnlyPermissions
      : [
          ...FULL_PRODUCT_PERMISSIONS,
          {
            resourceType: 'ADMIN',
            resourceKey: 'ADMIN.WORKPLACE',
            permissionCode: 'EXPORT',
            effect: 'ALLOW' as const,
          },
        ],
  });
  await elevatedAuthority(page);
  await page.unroute('**/api/auth/product-surface-contexts');
  await page.route('**/api/auth/product-surface-contexts', (route) =>
    fulfillSuccess(route, {
      contractVersion: 'product-surfaces/v3',
      decisionRevision: SAFETY_DECISION_REVISION,
      sourceRevisions: { auth: '20', policy: '20', productRelationship: '20' },
      activeAccessMode: 'ELEVATED',
      generatedAt: NOW,
      contexts: [],
      rollouts: GOVERNED_PRODUCTS.map((productKey) => ({
        productKey,
        state: '000',
        flags: {
          contextShadow: false,
          capabilityEnforcement: false,
          surfaceUi: false,
        },
        cohort: 'baseline',
        opaqueRevision: `rollout-${productKey}-baseline`,
        authorityStatus: 'NOT_EVALUATED',
      })),
    })
  );

  let currentSheet = safetySheet();
  let currentIncident = safetyIncident(
    options.incidentUnknown ? 'RESULT_UNKNOWN' : 'PARTIAL',
    'ACTIVE',
    4,
    options.unverifiedEbs
  );
  let activePreview = activationPreview(
    {
      incidentType: 'EVACUATION',
      severity: 'CRITICAL',
      siteId: SAFETY_IDS.site,
      floorIds: [SAFETY_IDS.floor],
      zoneIds: [SAFETY_IDS.zone],
      message: 'Evacuate.',
      safetyAction: 'Use the marked exit.',
      assemblyPoint: null,
      channels: ['APP_PUSH'],
    },
    true
  );
  const messages = [
    {
      messageId: SAFETY_IDS.message,
      incidentId: SAFETY_IDS.incident,
      targetUserId: 20001,
      direction: 'COMMAND_TO_USER',
      maskedBody: 'Proceed to the [masked] assembly area.',
      createdAt: NOW,
    },
  ];
  const postPaths: string[] = [];
  const postBodies: unknown[] = [];
  const commandHeaders: Array<Record<string, string>> = [];
  let detailGets = 0;
  let exportGets = 0;
  let responsePosts = 0;

  const record = (route: Route) => {
    const request = route.request();
    postPaths.push(new URL(request.url()).pathname);
    postBodies.push(request.postDataJSON());
    commandHeaders.push(request.headers());
  };

  await page.route('**/api/platform/v1/workplace/safety/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/incidents/active')) {
      return fulfillSuccess(route, [currentSheet]);
    }
    if (request.method() === 'GET' && path.endsWith('/messages')) {
      return fulfillSuccess(route, messages);
    }
    if (request.method() === 'GET') return fulfillSuccess(route, currentSheet);
    record(route);
    if (path.endsWith('/responses')) {
      responsePosts += 1;
      const body = request.postDataJSON() as { response: string };
      currentSheet = safetySheet(body.response, currentSheet.version + 1);
      return accepted(route, {
        sheet: currentSheet,
        receipt: receipt(
          options.responseUnknown && responsePosts === 1 ? 'RESULT_UNKNOWN' : 'SUCCEEDED'
        ),
      });
    }
    const body = request.postDataJSON() as { targetUserId: number | null };
    const next = {
      messageId: `20000000-0000-4000-8000-${String(messages.length + 20).padStart(12, '0')}`,
      incidentId: SAFETY_IDS.incident,
      targetUserId: body.targetUserId,
      direction: 'USER_TO_COMMAND',
      maskedBody: 'Status update received from [masked] member.',
      createdAt: NOW,
    };
    messages.push(next);
    return accepted(route, { message: next, receipt: receipt() });
  });

  await page.route('**/api/platform/v1/admin/workplace/safety/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    if (method === 'GET' && path.endsWith('/connectors')) {
      return fulfillSuccess(route, connectors(options.unverifiedEbs));
    }
    if (method === 'GET' && path.includes('/connectors/commands/')) {
      return fulfillSuccess(route, receipt('SUCCEEDED'));
    }
    if (method === 'GET' && path.includes('/activation-previews/')) {
      return fulfillSuccess(route, activePreview);
    }
    if (method === 'GET' && path.includes('/scope-revisions/')) {
      return fulfillSuccess(route, scopePreview());
    }
    if (method === 'GET' && path.includes('/closure-previews/')) {
      return fulfillSuccess(route, closurePreview());
    }
    if (method === 'GET' && path.endsWith('/messages')) {
      return fulfillSuccess(route, messages);
    }
    if (method === 'GET' && path.endsWith('/report')) {
      return fulfillSuccess(route, {
        reportId: SAFETY_IDS.report,
        incidentId: SAFETY_IDS.incident,
        summary: { outcome: 'CLOSED', safe: 32, needsHelp: 0 },
        version: currentIncident.version,
        generatedAt: NOW,
      });
    }
    if (method === 'GET' && path.endsWith('/content')) {
      exportGets += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        headers: { 'Cache-Control': 'private, no-store, max-age=0' },
        body: '%PDF-1.4 screen-20 verified export',
      });
    }
    if (method === 'GET' && path.includes('/commands/')) {
      return fulfillSuccess(route, receipt('SUCCEEDED'));
    }
    if (method === 'GET' && path.endsWith('/incidents')) {
      return fulfillSuccess(route, [currentIncident]);
    }
    if (method === 'GET' && path.includes('/incidents/')) {
      detailGets += 1;
      if (options.incidentUnknown && detailGets > 1) {
        currentIncident = safetyIncident('FAILED', 'ACTIVE', currentIncident.version + 1);
      }
      return fulfillSuccess(route, currentIncident);
    }

    record(route);
    const body = (request.postDataJSON() ?? {}) as Record<string, unknown>;
    if (method === 'PUT' && path.includes('/connectors/')) {
      return accepted(route, {
        connector: connector(String(body.kind), 'CONFIGURED_UNVERIFIED'),
        receipt: receipt(),
      });
    }
    if (path.endsWith('/incidents:preview')) {
      const requestedChannels = Array.isArray(body.channels) ? body.channels : [];
      const eligible = !(options.unverifiedEbs && requestedChannels.includes('EBS'));
      activePreview = activationPreview(body, eligible);
      return accepted(route, { preview: activePreview, receipt: receipt() });
    }
    if (path.endsWith('/incidents')) {
      currentIncident = safetyIncident('PARTIAL', 'ACTIVE', currentIncident.version + 1);
      return accepted(route, { incident: currentIncident, receipt: receipt() });
    }
    if (path.endsWith('/scope-revisions:preview')) {
      return accepted(route, { preview: scopePreview(), receipt: receipt() });
    }
    if (path.endsWith('/scope-revisions')) {
      currentIncident = { ...currentIncident, version: currentIncident.version + 1 };
      return accepted(route, { incident: currentIncident, receipt: receipt() });
    }
    if (path.endsWith('/dispatches:resend')) {
      currentIncident = safetyIncident('SUCCEEDED', 'ACTIVE', currentIncident.version + 1);
      return accepted(route, { incident: currentIncident, receipt: receipt() });
    }
    if (path.endsWith('/assembly-confirmations')) {
      return accepted(route, {
        confirmation: {
          assemblyConfirmationId: SAFETY_IDS.assembly,
          incidentId: SAFETY_IDS.incident,
          subjectKeySha256: body.subjectKeySha256,
          subjectUserId: body.subjectUserId,
          confirmed: true,
          observedAt: body.observedAt,
          confirmedBy: 90001,
          evidenceReference: body.evidenceReference,
          version: 1,
          updatedAt: NOW,
        },
        receipt: receipt(),
      });
    }
    if (path.endsWith('/messages')) {
      const next = {
        messageId: `20000000-0000-4000-8000-${String(messages.length + 20).padStart(12, '0')}`,
        incidentId: SAFETY_IDS.incident,
        targetUserId: body.targetUserId,
        direction: body.targetUserId ? 'COMMAND_TO_USER' : 'COMMAND_BROADCAST',
        maskedBody: 'Command update for [masked] recipients.',
        createdAt: NOW,
      };
      messages.push(next);
      return accepted(route, { message: next, receipt: receipt() });
    }
    if (path.endsWith('/closures:preview')) {
      return accepted(route, { preview: closurePreview(), receipt: receipt() });
    }
    if (path.endsWith('/closure-requests')) {
      currentIncident = safetyIncident('SUCCEEDED', 'CLOSURE_PENDING', currentIncident.version + 1);
      return accepted(route, {
        closure: {
          closureRequestId: SAFETY_IDS.closure,
          incidentId: SAFETY_IDS.incident,
          requestedBy: 10001,
          designatedApproverId: body.designatedApproverId,
          closureReason: body.closureReason,
          followUpActions: body.followUpActions,
          state: 'PENDING',
          version: 1,
          requestedAt: NOW,
        },
        receipt: receipt(),
      });
    }
    if (path.endsWith(':approve')) {
      currentIncident = safetyIncident('SUCCEEDED', 'CLOSED', currentIncident.version + 1);
      return accepted(route, { incident: currentIncident, receipt: receipt() });
    }
    if (path.endsWith('/exports')) {
      return accepted(route, {
        export: {
          exportId: SAFETY_IDS.export,
          incidentId: SAFETY_IDS.incident,
          format: body.format,
          purpose: body.purpose,
          reason: body.reason,
          requestedBy: 10001,
          correlationId: 'screen-20-export',
          stepUpEvidence: 'ELEVATED_VERIFIED_BY_CONTROLLER',
          contentType: body.format === 'PDF' ? 'application/pdf' : 'text/csv',
          sha256: 'b'.repeat(64),
          sizeBytes: 4096,
          downloadHref: `/v1/admin/workplace/safety/exports/${SAFETY_IDS.export}/content`,
          createdAt: NOW,
          expiresAt: '2026-09-16T12:10:00Z',
        },
        receipt: receipt(),
      });
    }
    return route.fulfill({ status: 404, body: '' });
  });

  return {
    postPaths,
    postBodies,
    commandHeaders,
    postCount: () => postPaths.length,
    detailGets: () => detailGets,
    exportGets: () => exportGets,
  };
}
