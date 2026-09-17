import { FULL_PRODUCT_PERMISSIONS, fulfillSuccess, mockShellSession } from './shell-session';
import { isolateWorkplaceDevelopmentUpdates } from './workplace-runtime-isolation';

import type { Page, Route } from '@playwright/test';

export const ASSISTANT_IDS = {
  request: '23000000-0000-4000-8000-000000000001',
  proposal: '23000000-0000-4000-8000-000000000002',
  intent: '23000000-0000-4000-8000-000000000003',
  intentItem: '23000000-0000-4000-8000-000000000004',
  resource: '23000000-0000-4000-8000-000000000005',
  site: '23000000-0000-4000-8000-000000000006',
  floor: '23000000-0000-4000-8000-000000000007',
  batch: '23000000-0000-4000-8000-000000000008',
  batchItem: '23000000-0000-4000-8000-000000000009',
  hold: '23000000-0000-4000-8000-000000000010',
  command: '23000000-0000-4000-8000-000000000011',
  audit: '23000000-0000-4000-8000-000000000012',
  feedback: '23000000-0000-4000-8000-000000000013',
} as const;

const NOW = '2026-09-17T00:00:00Z';
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

function accepted(route: Route, data: unknown, status = 202) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'Accepted', data }),
  });
}

async function mockAuthority(page: Page, elevated: boolean) {
  await page.unroute('**/api/auth/product-surface-contexts');
  await page.route('**/api/auth/product-surface-contexts', (route) =>
    fulfillSuccess(route, {
      contractVersion: 'product-surfaces/v3',
      decisionRevision: `psr-${'e'.repeat(64)}`,
      sourceRevisions: { auth: '23', policy: '23', productRelationship: '23' },
      activeAccessMode: elevated ? 'ELEVATED' : 'NORMAL',
      generatedAt: NOW,
      contexts: [],
      rollouts: GOVERNED_PRODUCTS.map((productKey) => ({
        productKey,
        state: '000',
        flags: { contextShadow: false, capabilityEnforcement: false, surfaceUi: false },
        cohort: 'baseline',
        opaqueRevision: `rollout-${productKey}-baseline`,
        authorityStatus: 'NOT_EVALUATED',
      })),
    })
  );
}

function requestedItem() {
  return {
    clientItemKey: 'assistant-item-1',
    beneficiaryUserId: 10001,
    beneficiaryPersonPublicId: '23000000-0000-4000-8000-000000000019',
    beneficiaryDisplayName: 'Workspace Member',
    delegationGrantId: null,
    resourceType: 'DESK',
    preferredResourceId: null,
    siteId: ASSISTANT_IDS.site,
    floorId: ASSISTANT_IDS.floor,
    startsAt: '2026-09-22T00:00:00Z',
    endsAt: '2026-09-22T09:00:00Z',
    purpose: 'Team collaboration',
    visibleToColleagues: false,
    accessibleOnly: true,
    requiredFeatures: ['HEIGHT_ADJUSTABLE'],
  };
}

function proposal(validated: boolean) {
  return {
    proposalItemId: ASSISTANT_IDS.proposal,
    requestedItem: requestedItem(),
    rationale: 'Matches the requested site, time, and accessibility requirement.',
    constraintsUsed: ['site', 'time', 'accessibility'],
    exclusions: ['Unavailable neighborhood'],
    policyResult: validated ? 'ALLOWED' : 'UNVALIDATED',
    conflicts: [],
    alternatives: [
      {
        resourceId: '23000000-0000-4000-8000-000000000014',
        displayName: 'Desk 4B',
        resourceType: 'DESK',
        siteId: ASSISTANT_IDS.site,
        floorId: ASSISTANT_IDS.floor,
        startsAt: '2026-09-22T00:00:00Z',
        endsAt: '2026-09-22T09:00:00Z',
        waitlistEligible: true,
        rationale: 'Authoritative alternative in the same verified floor.',
      },
    ],
    authoritativeIntentItemId: validated ? ASSISTANT_IDS.intentItem : null,
    authoritativeIntentItemVersion: validated ? 1 : null,
    selectedResourceId: validated ? ASSISTANT_IDS.resource : null,
    selectedResourceVersion: validated ? 0 : null,
    selectedResourceName: validated ? 'Desk 4A' : null,
    version: 1,
  };
}

function assistantRequest(
  state: string,
  version: number,
  options: { unknown?: boolean; retained?: boolean; tenantOptOut?: boolean } = {}
) {
  const validated = state !== 'SUGGESTED';
  const hasBatch = ['PROCESSING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'RESULT_UNKNOWN'].includes(
    state
  );
  return {
    requestId: ASSISTANT_IDS.request,
    state,
    redactedRequestText: options.retained
      ? null
      : 'Book a nearby team desk and parking for [redacted].',
    redactionState: options.retained ? 'RETAINED_CONTENT_DELETED' : 'APPLIED',
    consent: {
      requestProcessingConsent: true,
      feedbackUseConsent: true,
      tenantOptIn: !options.tenantOptOut,
      feedbackUseEnabled: true,
    },
    modelProviderReference: 'approved-provider',
    modelVersion: 'governed-model-23',
    promptVersion: 'prompt-23',
    toolVersion: 'booking-tool-23',
    proposals: options.retained ? [] : [proposal(validated)],
    validation: validated
      ? {
          bookingIntentId: ASSISTANT_IDS.intent,
          bookingIntentVersion: 2,
          bookingIntentState: 'HELD',
          allSelectedItemsValid: true,
          validatedAt: NOW,
          limitations: ['Authority evidence expires with the reservation hold.'],
        }
      : null,
    bookingBatchId: hasBatch ? ASSISTANT_IDS.batch : null,
    batchStatusHref: hasBatch ? `/v1/workplace/booking-batches/${ASSISTANT_IDS.batch}` : null,
    requeryRequired: options.unknown || state === 'PARTIAL',
    lastResultCode: options.unknown ? 'RESULT_UNKNOWN' : state === 'PARTIAL' ? 'PARTIAL' : null,
    limitations: ['Suggestions require authoritative validation.'],
    version,
    retentionExpiresAt: '2026-10-17T00:00:00Z',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function receipt(state = 'SUCCEEDED') {
  return {
    commandId: ASSISTANT_IDS.command,
    state,
    statusHref: `/v1/workplace/assistant/requests/${ASSISTANT_IDS.request}`,
    replayed: false,
    correlationId: 'screen-23-correlation',
    resultCode: state === 'ACCEPTED' ? null : state,
    acceptedAt: NOW,
    completedAt: state === 'ACCEPTED' ? null : NOW,
  };
}

function batch(state: 'PARTIAL' | 'RESULT_UNKNOWN') {
  const firstState = state === 'RESULT_UNKNOWN' ? 'RESULT_UNKNOWN' : 'SUCCEEDED';
  const secondState = state === 'RESULT_UNKNOWN' ? 'RESULT_UNKNOWN' : 'FAILED';
  return {
    batchId: ASSISTANT_IDS.batch,
    intentId: ASSISTANT_IDS.intent,
    actorUserId: 10001,
    state,
    failurePolicy: 'KEEP_SUCCEEDED',
    reason: 'Confirm reviewed authority results',
    items: [
      {
        batchItemId: ASSISTANT_IDS.batchItem,
        intentItemId: ASSISTANT_IDS.intentItem,
        holdId: ASSISTANT_IDS.hold,
        clientItemKey: 'assistant-item-1',
        beneficiaryUserId: 10001,
        beneficiaryPersonPublicId: null,
        beneficiaryDisplayName: 'Workspace Member',
        delegationGrantId: null,
        resourceType: 'DESK',
        resourceId: ASSISTANT_IDS.resource,
        resourceDisplayName: 'Desk 4A',
        siteId: ASSISTANT_IDS.site,
        floorId: ASSISTANT_IDS.floor,
        timeZone: 'Asia/Seoul',
        startsAt: '2026-09-22T00:00:00Z',
        endsAt: '2026-09-22T09:00:00Z',
        authority: 'WORKPLACE',
        state: firstState,
        ownerReferenceId: null,
        ownerVersion: 0,
        errorCode: state === 'RESULT_UNKNOWN' ? 'PROVIDER_TIMEOUT' : null,
        errorMessage: null,
        compensationAvailable: false,
        requeryRequired: state === 'RESULT_UNKNOWN',
        version: 1,
        updatedAt: NOW,
      },
      {
        batchItemId: '23000000-0000-4000-8000-000000000015',
        intentItemId: '23000000-0000-4000-8000-000000000016',
        holdId: '23000000-0000-4000-8000-000000000017',
        clientItemKey: 'assistant-item-2',
        beneficiaryUserId: 10001,
        beneficiaryPersonPublicId: null,
        beneficiaryDisplayName: 'Workspace Member',
        delegationGrantId: null,
        resourceType: 'ROOM',
        resourceId: '23000000-0000-4000-8000-000000000018',
        resourceDisplayName: 'Room 4C',
        siteId: ASSISTANT_IDS.site,
        floorId: ASSISTANT_IDS.floor,
        timeZone: 'Asia/Seoul',
        startsAt: '2026-09-22T00:00:00Z',
        endsAt: '2026-09-22T09:00:00Z',
        authority: 'CALENDAR',
        state: secondState,
        ownerReferenceId: null,
        ownerVersion: 0,
        errorCode: secondState === 'FAILED' ? 'POLICY_DENIED' : 'PROVIDER_TIMEOUT',
        errorMessage: null,
        compensationAvailable: false,
        requeryRequired: secondState === 'RESULT_UNKNOWN',
        version: 1,
        updatedAt: NOW,
      },
    ],
    terminal: true,
    requeryRequired: true,
    version: 2,
    createdAt: NOW,
    startedAt: NOW,
    completedAt: null,
    updatedAt: NOW,
  };
}

function execution(state: 'PARTIAL' | 'RESULT_UNKNOWN') {
  return {
    requestId: ASSISTANT_IDS.request,
    state,
    bookingIntentId: ASSISTANT_IDS.intent,
    bookingBatchId: ASSISTANT_IDS.batch,
    authoritativeBatch: batch(state),
    requeryRequired: true,
    recoveryGuidance:
      state === 'RESULT_UNKNOWN'
        ? 'Do not repeat confirmation; re-query this execution endpoint.'
        : 'Review authoritative item results before keeping successes.',
    refreshedAt: NOW,
    requestVersion: 4,
  };
}

function governance() {
  return {
    tenantOptIn: true,
    killSwitch: false,
    modelProviderReference: 'approved-provider',
    modelVersion: 'governed-model-23',
    promptVersion: 'prompt-23',
    toolVersion: 'booking-tool-23',
    retentionDays: 30,
    feedbackUseEnabled: true,
    redactionState: 'READY',
    version: 3,
    updatedAt: NOW,
    updatedBy: 10001,
  };
}

export type WorkplaceAssistantEvidence = {
  commandBodies: unknown[];
  commandHeaders: Array<Record<string, string>>;
  commandPaths: string[];
  executionGets: () => number;
  governanceGets: () => number;
};

export async function mockWorkplaceAssistant(
  page: Page,
  options: {
    locale?: 'en' | 'ko';
    readOnly?: boolean;
    resultUnknown?: boolean;
    confirmFailedReplay?: boolean;
    governanceUnknown?: boolean;
    retained?: boolean;
    tenantOptOut?: boolean;
    beneficiaryDenied?: boolean;
    beneficiaryStale?: boolean;
  } = {}
): Promise<WorkplaceAssistantEvidence> {
  await isolateWorkplaceDevelopmentUpdates(page);
  await page.clock.setFixedTime(new Date(NOW));
  const readOnlyPermissions = [
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
    displayName: 'Workspace Member',
    permissions: options.readOnly ? readOnlyPermissions : FULL_PRODUCT_PERMISSIONS,
  });
  await mockAuthority(page, !options.readOnly);

  const commandPaths: string[] = [];
  const commandBodies: unknown[] = [];
  const commandHeaders: Array<Record<string, string>> = [];
  const terminalInitialRequest = options.retained || options.tenantOptOut;
  let current = assistantRequest(terminalInitialRequest ? 'SUCCEEDED' : 'SUGGESTED', 1, {
    retained: options.retained,
    tenantOptOut: options.tenantOptOut,
  });
  let currentGovernance = governance();
  let executionGets = 0;
  let governanceGets = 0;
  const record = (route: Route) => {
    const request = route.request();
    commandPaths.push(new URL(request.url()).pathname);
    commandBodies.push(request.postDataJSON());
    commandHeaders.push(request.headers());
  };

  await page.route('**/api/platform/v1/workplace/explore?**', (route) =>
    fulfillSuccess(route, {
      sites: [
        {
          siteId: ASSISTANT_IDS.site,
          code: 'SEOUL',
          name: 'Seoul Workplace',
          nameKo: '서울 사업장',
          nameEn: 'Seoul Workplace',
          type: 'HEADQUARTERS',
          address: null,
          timeZone: 'Asia/Seoul',
          totalFloorCount: 1,
          configuredFloorCount: 1,
          resourceCount: 2,
          state: 'ACTIVE',
          version: 1,
        },
      ],
      floors: [
        {
          floorId: ASSISTANT_IDS.floor,
          siteId: ASSISTANT_IDS.site,
          siteName: 'Seoul Workplace',
          floorNumber: 4,
          name: 'Floor 4',
          nameKo: '4층',
          nameEn: 'Floor 4',
          planWidth: 1200,
          planHeight: 800,
          backgroundAssetPath: null,
          state: 'ACTIVE',
          version: 1,
        },
      ],
      selectedFloor: null,
      resources: [],
      occupancy: [],
      policy: {},
      generatedAt: NOW,
    })
  );

  await page.route('**/api/platform/v1/workplace/booking-intents/beneficiaries', (route) => {
    if (options.beneficiaryDenied) {
      return route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ERROR', message: 'Forbidden', data: null }),
      });
    }
    return fulfillSuccess(route, {
      beneficiaries: [
        {
          beneficiaryUserId: 10001,
          beneficiaryPersonPublicId: '23000000-0000-4000-8000-000000000019',
          displayName: 'Workspace Member',
          delegationGrantId: null,
          resourceTypes: ['DESK', 'ROOM', 'PARKING'],
          validUntil: null,
          self: true,
        },
        {
          beneficiaryUserId: 10002,
          beneficiaryPersonPublicId: '23000000-0000-4000-8000-000000000020',
          displayName: 'Delegated Member',
          delegationGrantId: '23000000-0000-4000-8000-000000000021',
          resourceTypes: ['DESK', 'ROOM'],
          validUntil: '2026-09-30T00:00:00Z',
          self: false,
        },
        {
          beneficiaryUserId: 10003,
          beneficiaryPersonPublicId: '23000000-0000-4000-8000-000000000022',
          displayName: 'Expired Delegate',
          delegationGrantId: '23000000-0000-4000-8000-000000000023',
          resourceTypes: ['DESK'],
          validUntil: '2026-09-16T23:59:59Z',
          self: false,
        },
      ],
      generatedAt: options.beneficiaryStale ? '2026-09-16T00:00:00Z' : NOW,
    });
  });

  await page.route('**/api/platform/v1/workplace/assistant/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/execution')) {
      executionGets += 1;
      return fulfillSuccess(route, execution(options.resultUnknown ? 'RESULT_UNKNOWN' : 'PARTIAL'));
    }
    if (request.method() === 'GET') return fulfillSuccess(route, current);
    record(route);
    if (path.endsWith(':validate')) {
      current = assistantRequest('VALIDATED', 2);
      return fulfillSuccess(route, { request: current, receipt: receipt() });
    }
    if (path.endsWith(':confirm')) {
      if (options.confirmFailedReplay) {
        current = assistantRequest('VALIDATED', 2);
        return accepted(route, {
          request: current,
          receipt: {
            ...receipt('FAILED'),
            replayed: true,
            resultCode: 'VERSION_CONFLICT',
          },
        });
      }
      current = assistantRequest(options.resultUnknown ? 'RESULT_UNKNOWN' : 'PARTIAL', 3, {
        unknown: options.resultUnknown,
      });
      return accepted(route, {
        request: current,
        receipt: receipt(options.resultUnknown ? 'RESULT_UNKNOWN' : 'SUCCEEDED'),
      });
    }
    if (path.endsWith(':feedback')) {
      return accepted(
        route,
        {
          feedbackId: ASSISTANT_IDS.feedback,
          requestId: ASSISTANT_IDS.request,
          rating: 'HELPFUL',
          redactedComment: 'The explanation was useful.',
          eligibleForModelImprovementUse: true,
          auditEventId: ASSISTANT_IDS.audit,
          createdAt: NOW,
        },
        201
      );
    }
    current = assistantRequest('SUGGESTED', 1);
    return accepted(route, { request: current, receipt: receipt() }, 201);
  });

  await page.route('**/api/platform/v1/admin/workplace/assistant/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/governance')) {
      governanceGets += 1;
      return fulfillSuccess(route, currentGovernance);
    }
    if (request.method() === 'GET' && path.endsWith('/audit-events')) {
      return fulfillSuccess(route, {
        items: [
          {
            auditEventId: ASSISTANT_IDS.audit,
            requestId: ASSISTANT_IDS.request,
            eventType: 'WorkplaceAssistantValidated',
            actorUserId: 10001,
            metadata: { selectedCount: 1, promptVersion: 'prompt-23' },
            correlationId: 'screen-23-correlation',
            createdAt: NOW,
          },
        ],
        generatedAt: NOW,
      });
    }
    record(route);
    const body = request.postDataJSON() as Record<string, unknown>;
    if (!options.governanceUnknown) {
      currentGovernance = {
        ...currentGovernance,
        ...body,
        version: currentGovernance.version + 1,
        updatedAt: NOW,
        updatedBy: 10001,
      };
    }
    return accepted(route, {
      governance: currentGovernance,
      receipt: {
        ...receipt(options.governanceUnknown ? 'RESULT_UNKNOWN' : 'SUCCEEDED'),
        statusHref: '/v1/admin/workplace/assistant/governance',
      },
    });
  });

  return {
    commandBodies,
    commandHeaders,
    commandPaths,
    executionGets: () => executionGets,
    governanceGets: () => governanceGets,
  };
}
