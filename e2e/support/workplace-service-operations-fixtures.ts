import { fulfillSuccess } from './shell-session';
import {
  ITEM_ID,
  LINE_ID,
  ORDER_ID,
  READY_ORDER_ID,
  READY_TASK_ID,
  SITE_ID,
} from './workplace-reservation-services-fixtures';

import type { Page, Request, Route } from '@playwright/test';

const PROVIDER_ID = '18000000-0000-4000-8000-000000000119';
const CONTACT_ID = '18000000-0000-4000-8000-000000000120';
const COMMAND_ID = '18000000-0000-4000-8000-000000000121';
const CAPACITY_BUCKET_ID = '18000000-0000-4000-8000-000000000122';
const INSPECTION_ATTEMPT_ID = '18000000-0000-4000-8000-000000000123';
const ASSIGNEE_ID = 'subject:workplace:operator-18';

function requestRecord(request: Request) {
  return {
    body: (request.postDataJSON() ?? null) as unknown,
    headers: request.headers(),
    url: request.url(),
  };
}

function receipt(statusHref: string) {
  return {
    commandId: COMMAND_ID,
    state: 'SUCCEEDED',
    statusHref,
    replayed: false,
    correlationId: 'screen-18-e2e',
    acceptedAt: '2026-09-17T00:07:00Z',
  };
}

function accepted(route: Route, data: unknown) {
  return route.fulfill({
    status: 202,
    contentType: 'application/json',
    headers: { Location: (data as { receipt: { statusHref: string } }).receipt.statusHref },
    body: JSON.stringify({ status: 'SUCCESS', message: 'Accepted', data }),
  });
}

function provider() {
  return {
    providerProfileId: PROVIDER_ID,
    providerCode: 'DWP_NATIVE_FULFILLMENT',
    displayNameKo: 'DWP 현장 서비스',
    displayNameEn: 'DWP onsite services',
    adapterType: 'DWP_NATIVE',
    lifecycleState: 'ACTIVE',
    siteScope: [SITE_ID],
    capabilities: ['FULFILLMENT', 'CAPACITY', 'EPHEMERAL_CREDENTIAL'],
    support: {
      channel: 'IN_APP',
      labelKo: '현장 서비스 데스크',
      labelEn: 'Onsite service desk',
      contactUri: null,
      hoursKo: '평일 08:00–18:00',
      hoursEn: 'Weekdays 08:00–18:00',
    },
    credentialBindingConfigured: true,
    configurationVersion: 3,
    readiness: 'READY',
    evidenceConfigurationVersion: 3,
    evidenceReference: 'provider-health-18',
    evidenceObservedAt: '2026-09-17T00:06:00Z',
    evidenceReceivedAt: '2026-09-17T00:06:01Z',
    evidenceErrorCode: null,
    version: 4,
    updatedAt: '2026-09-17T00:06:01Z',
  };
}

function assignee() {
  return {
    directorySubjectId: ASSIGNEE_ID,
    displayName: 'Casey Kim',
    contactAvailable: true,
    capabilities: ['FULFILLMENT'],
    directoryVersion: 'directory-v18',
    verifiedAt: '2026-09-17T00:06:00Z',
    freshUntil: '2026-09-17T00:21:00Z',
  };
}

function capacity() {
  return {
    catalogItemId: ITEM_ID,
    siteReference: SITE_ID,
    from: '2026-09-17T00:00:00Z',
    to: '2026-09-18T00:00:00Z',
    mode: 'BUCKETED',
    buckets: [
      {
        capacityBucketId: CAPACITY_BUCKET_ID,
        catalogItemId: ITEM_ID,
        siteReference: SITE_ID,
        startsAt: '2026-09-17T01:00:00Z',
        endsAt: '2026-09-17T02:00:00Z',
        capacityLimit: 10,
        committedQuantity: 3,
        heldQuantity: 1,
        availableQuantity: 6,
        sourceVersion: 'capacity-v18',
        sourceObservedAt: '2026-09-17T00:59:00Z',
        receivedAt: '2026-09-17T00:59:01Z',
        freshUntil: '2026-09-17T01:14:01Z',
        fresh: true,
        version: 2,
      },
    ],
    complete: true,
    limitations: [],
    generatedAt: '2026-09-17T01:00:00Z',
  };
}

function inspection(latestAttempt: unknown = null) {
  return {
    serviceOrderId: ORDER_ID,
    serviceOrderLineId: LINE_ID,
    mode: 'REQUESTER',
    required: true,
    fulfilledQuantityReady: true,
    accepted: Boolean(latestAttempt),
    remediationRequired: false,
    latestAttempt,
    generatedAt: '2026-09-17T01:00:00Z',
  };
}

export type WorkplaceServiceOperationsEvidence = Readonly<{
  assigneeQueries: string[];
  assignmentRequests: ReturnType<typeof requestRecord>[];
  capacityQueries: string[];
  capacityRequests: ReturnType<typeof requestRecord>[];
  contactRequests: ReturnType<typeof requestRecord>[];
  inspectionRequests: ReturnType<typeof requestRecord>[];
  providerReads: ReturnType<typeof requestRecord>[];
}>;

export async function mockWorkplaceServiceOperations(
  page: Page
): Promise<WorkplaceServiceOperationsEvidence> {
  const assigneeQueries: string[] = [];
  const assignmentRequests: ReturnType<typeof requestRecord>[] = [];
  const capacityQueries: string[] = [];
  const capacityRequests: ReturnType<typeof requestRecord>[] = [];
  const contactRequests: ReturnType<typeof requestRecord>[] = [];
  const inspectionRequests: ReturnType<typeof requestRecord>[] = [];
  const providerReads: ReturnType<typeof requestRecord>[] = [];

  await page.route('**/api/platform/v1/admin/workplace/service-providers**', (route) => {
    providerReads.push(requestRecord(route.request()));
    return fulfillSuccess(route, {
      items: [provider()],
      generatedAt: '2026-09-17T00:07:00Z',
    });
  });
  await page.route('**/api/platform/v1/admin/workplace/service-assignees**', (route) => {
    assigneeQueries.push(new URL(route.request().url()).search);
    return fulfillSuccess(route, {
      items: [assignee()],
      generatedAt: '2026-09-17T00:07:00Z',
    });
  });
  await page.route(
    '**/api/platform/v1/admin/workplace/service-orders/*/tasks/*:assign',
    (route) => {
      assignmentRequests.push(requestRecord(route.request()));
      return accepted(route, {
        serviceOrderId: READY_ORDER_ID,
        fulfillmentTaskId: READY_TASK_ID,
        assignee: assignee(),
        taskVersion: 5,
        receipt: receipt(
          `/v1/admin/workplace/service-orders/${READY_ORDER_ID}/tasks/${READY_TASK_ID}`
        ),
      });
    }
  );
  await page.route('**/api/platform/v1/workplace/service-orders/*/contacts', (route) => {
    contactRequests.push(requestRecord(route.request()));
    return accepted(route, {
      contactRequestId: CONTACT_ID,
      target: 'ASSIGNEE',
      resolvedTargetDisplayName: 'Casey Kim',
      state: 'QUEUED',
      receipt: receipt(`/v1/workplace/service-orders/${ORDER_ID}/contacts/${CONTACT_ID}`),
    });
  });
  await page.route('**/api/platform/v1/workplace/service-orders/*/lines/*/inspection*', (route) => {
    if (route.request().method() === 'GET') return fulfillSuccess(route, inspection());
    const request = requestRecord(route.request());
    inspectionRequests.push(request);
    const body = request.body as Record<string, unknown>;
    const latestAttempt = {
      inspectionAttemptId: INSPECTION_ATTEMPT_ID,
      serviceOrderId: ORDER_ID,
      serviceOrderLineId: LINE_ID,
      fulfillmentTaskId: '18000000-0000-4000-8000-000000000105',
      mode: 'REQUESTER',
      actorRole: 'REQUESTER',
      decision: body.decision,
      checklistSchema: [
        {
          key: 'equipment_ready',
          type: 'BOOLEAN',
          required: true,
          labelKo: '장비 준비 확인',
          labelEn: 'Equipment ready',
        },
      ],
      checklistResponses: body.checklistResponses,
      evidenceAttachmentIds: body.attachmentIds,
      reason: body.reason,
      remediationRequired: false,
      createdAt: '2026-09-17T01:00:00Z',
    };
    return accepted(route, {
      inspection: inspection(latestAttempt),
      receipt: receipt(`/v1/workplace/service-orders/${ORDER_ID}/lines/${LINE_ID}/inspection`),
    });
  });
  await page.route('**/api/platform/v1/admin/workplace/service-catalog/*/capacity**', (route) => {
    if (route.request().method() === 'GET') {
      capacityQueries.push(new URL(route.request().url()).search);
      return fulfillSuccess(route, capacity());
    }
    capacityRequests.push(requestRecord(route.request()));
    return accepted(route, {
      capacity: capacity(),
      receipt: receipt(`/v1/admin/workplace/service-catalog/${ITEM_ID}/capacity`),
    });
  });

  return {
    assigneeQueries,
    assignmentRequests,
    capacityQueries,
    capacityRequests,
    contactRequests,
    inspectionRequests,
    providerReads,
  };
}

export const WORKPLACE_SERVICE_OPERATIONS_IDS = {
  assigneeId: ASSIGNEE_ID,
  itemId: ITEM_ID,
  lineId: LINE_ID,
  providerId: PROVIDER_ID,
} as const;
