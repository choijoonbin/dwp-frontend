import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  assignWorkplaceServiceTask,
  contactWorkplaceServiceOrder,
  createWorkplaceServiceProvider,
  getWorkplaceServiceAssignees,
  getWorkplaceServiceCapacity,
  getWorkplaceServiceInspection,
  getWorkplaceServiceProviders,
  issueWorkplaceServiceAccessCredential,
  recordWorkplaceServiceInspectionAttempt,
  updateWorkplaceServiceCapacity,
} from './workplace-services-operations-api';
import {
  parseWorkplaceServiceAccessCredentialGrant,
  parseWorkplaceServiceAssignees,
  parseWorkplaceServiceCapacityRange,
  parseWorkplaceServiceInspection,
  parseWorkplaceServiceProviders,
} from './workplace-services-operations-contract';

const orderId = '18000000-0000-4000-8000-000000000004';
const lineId = '18000000-0000-4000-8000-000000000005';
const taskId = '18000000-0000-4000-8000-000000000006';
const itemId = '18000000-0000-4000-8000-000000000002';
const providerId = '18000000-0000-4000-8000-000000000003';
const bucketId = '18000000-0000-4000-8000-000000000007';
const commandId = '18000000-0000-4000-8000-000000000008';
const grantId = '18000000-0000-4000-8000-000000000009';
const now = '2026-09-18T01:00:00Z';

function response(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    text: async () => JSON.stringify({ data }),
  } as Response;
}

function receipt() {
  return {
    commandId,
    state: 'SUCCEEDED',
    statusHref: `/v1/admin/workplace/commands/${commandId}`,
    replayed: false,
    correlationId: null,
    acceptedAt: now,
  };
}

function capacity() {
  return {
    catalogItemId: itemId,
    siteReference: 'site-1',
    from: now,
    to: '2026-09-18T02:00:00Z',
    mode: 'BUCKETED',
    buckets: [
      {
        capacityBucketId: bucketId,
        catalogItemId: itemId,
        siteReference: 'site-1',
        startsAt: now,
        endsAt: '2026-09-18T02:00:00Z',
        capacityLimit: 10,
        committedQuantity: 3,
        heldQuantity: 1,
        availableQuantity: 6,
        sourceVersion: 'source-3',
        sourceObservedAt: now,
        receivedAt: now,
        freshUntil: '2026-09-18T01:05:00Z',
        fresh: true,
        version: 2,
      },
    ],
    complete: true,
    limitations: [],
    generatedAt: now,
  };
}

function inspection() {
  return {
    serviceOrderId: orderId,
    serviceOrderLineId: lineId,
    mode: 'REQUESTER',
    required: true,
    fulfilledQuantityReady: true,
    accepted: false,
    remediationRequired: false,
    latestAttempt: null,
    generatedAt: now,
  };
}

function provider() {
  return {
    providerProfileId: providerId,
    providerCode: 'AV_GLOBAL',
    displayNameKo: '글로벌 AV',
    displayNameEn: 'Global AV',
    adapterType: 'AV_GATEWAY',
    lifecycleState: 'ACTIVE',
    siteScope: ['18000000-0000-4000-8000-000000000010'],
    capabilities: ['EPHEMERAL_CREDENTIAL', 'CAPACITY'],
    support: {
      labelKo: 'AV 데스크',
      labelEn: 'AV desk',
      channel: 'WEB',
      contactUri: 'https://support.example.test/av',
    },
    credentialBindingConfigured: true,
    configurationVersion: 3,
    readiness: 'READY',
    evidenceConfigurationVersion: 3,
    evidenceReference: 'evidence-3',
    evidenceObservedAt: now,
    evidenceReceivedAt: now,
    evidenceErrorCode: null,
    version: 4,
    updatedAt: now,
  };
}

function assignee() {
  return {
    directorySubjectId: 'subject:workplace:operator-1',
    displayName: 'Casey Kim',
    contactAvailable: true,
    capabilities: ['FULFILLMENT'],
    directoryVersion: 'directory-v3',
    verifiedAt: now,
    freshUntil: '2026-09-18T01:05:00Z',
  };
}

describe('Workplace service operations contract', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('fails closed on inconsistent capacity, reveal and provider projections', () => {
    expect(parseWorkplaceServiceCapacityRange(capacity()).buckets[0]?.availableQuantity).toBe(6);
    expect(() =>
      parseWorkplaceServiceCapacityRange({
        ...capacity(),
        buckets: [{ ...capacity().buckets[0], availableQuantity: 7 }],
      })
    ).toThrow(/availableQuantity/u);
    expect(
      parseWorkplaceServiceAccessCredentialGrant({
        grantId,
        oneTimeCredential: '461 880',
        expiresAt: '2026-09-18T01:01:00Z',
        revealOnce: true,
        receipt: receipt(),
      }).oneTimeCredential
    ).toBe('461 880');
    expect(
      parseWorkplaceServiceAccessCredentialGrant({
        grantId,
        oneTimeCredential: null,
        expiresAt: '2026-09-18T01:01:00Z',
        revealOnce: true,
        receipt: { ...receipt(), replayed: true },
      }).oneTimeCredential
    ).toBeNull();
    expect(() =>
      parseWorkplaceServiceAccessCredentialGrant({
        grantId,
        oneTimeCredential: '461 880',
        expiresAt: '2026-09-18T01:01:00Z',
        revealOnce: false,
        receipt: receipt(),
      })
    ).toThrow(/revealOnce/u);
    expect(
      parseWorkplaceServiceProviders({ items: [provider()], generatedAt: now }).items[0]?.support
        .channel
    ).toBe('WEB');
    expect(
      parseWorkplaceServiceAssignees({ items: [assignee()], generatedAt: now }).items[0]
        ?.contactAvailable
    ).toBe(true);
    expect(parseWorkplaceServiceInspection(inspection()).fulfilledQuantityReady).toBe(true);
  });

  it('issues a one-time credential with no-store and exact bound command body', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(
        response({
          grantId,
          oneTimeCredential: '461 880',
          expiresAt: '2026-09-18T01:01:00Z',
          revealOnce: true,
          receipt: receipt(),
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    await issueWorkplaceServiceAccessCredential(
      orderId,
      lineId,
      {
        stepUpReceipt: 'step-up-receipt',
        expectedOrderVersion: 3,
        explicitConfirmation: true,
        reason: 'Open AV console',
      },
      { idempotencyKey: 'pin-issue', activeAccessMode: 'ELEVATED' }
    );

    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      `/api/platform/v1/workplace/service-orders/${orderId}/lines/${lineId}/access-credentials:issue`
    );
    const headers = new Headers((fetchMock.mock.calls[1]?.[1] as RequestInit).headers);
    expect(headers.get('Cache-Control')).toBe('no-store');
    expect(headers.get('Idempotency-Key')).toBe('pin-issue');
    expect(headers.get('X-DWP-Active-Access-Mode')).toBe('ELEVATED');
    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toEqual({
      stepUpReceipt: 'step-up-receipt',
      expectedOrderVersion: 3,
      explicitConfirmation: true,
      reason: 'Open AV console',
    });
  });

  it('uses exact inspection, capacity, provider directory and assignment routes', async () => {
    const inspectionResult = { inspection: inspection(), receipt: receipt() };
    const assignmentResult = {
      serviceOrderId: orderId,
      fulfillmentTaskId: taskId,
      assignee: assignee(),
      taskVersion: 3,
      receipt: receipt(),
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(inspection()))
      .mockResolvedValueOnce(response(capacity()))
      .mockResolvedValueOnce(response({ items: [provider()], generatedAt: now }))
      .mockResolvedValueOnce(response({ items: [assignee()], generatedAt: now }))
      .mockResolvedValueOnce(response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(response(inspectionResult))
      .mockResolvedValueOnce(response(assignmentResult));
    vi.stubGlobal('fetch', fetchMock);

    await getWorkplaceServiceInspection(orderId, lineId);
    await getWorkplaceServiceCapacity(itemId, 'site-1', now, '2026-09-18T02:00:00Z');
    await getWorkplaceServiceProviders();
    await getWorkplaceServiceAssignees({
      providerId,
      siteReference: 'site-1',
      query: 'Casey',
      limit: 30,
    });
    await recordWorkplaceServiceInspectionAttempt(
      orderId,
      lineId,
      {
        decision: 'PASSED',
        checklistResponses: { equipment_ready: true },
        attachmentIds: [],
        expectedOrderVersion: 3,
        expectedTaskVersion: 2,
        explicitConfirmation: true,
        reason: 'Verified in room',
      },
      { idempotencyKey: 'inspection-1' }
    );
    await assignWorkplaceServiceTask(
      orderId,
      taskId,
      {
        directorySubjectId: 'subject:workplace:operator-1',
        expectedTaskVersion: 2,
        explicitConfirmation: true,
        reason: 'Site rotation',
      },
      { idempotencyKey: 'assign-1', activeAccessMode: 'ELEVATED' }
    );

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      `/api/platform/v1/workplace/service-orders/${orderId}/lines/${lineId}/inspection`,
      `/api/platform/v1/workplace/service-catalog/${itemId}/capacity?siteReference=site-1&from=2026-09-18T01%3A00%3A00Z&to=2026-09-18T02%3A00%3A00Z`,
      '/api/platform/v1/admin/workplace/service-providers',
      `/api/platform/v1/admin/workplace/service-assignees?purpose=FULFILLMENT&providerId=${providerId}&siteReference=site-1&q=Casey&limit=30`,
      '/api/auth/csrf',
      `/api/platform/v1/workplace/service-orders/${orderId}/lines/${lineId}/inspection-attempts`,
      `/api/platform/v1/admin/workplace/service-orders/${orderId}/tasks/${taskId}:assign`,
    ]);
    expect(
      new Headers((fetchMock.mock.calls[6]?.[1] as RequestInit).headers).get(
        'X-DWP-Active-Access-Mode'
      )
    ).toBe('ELEVATED');
  });

  it('sends exact provider, capacity and contact command bodies', async () => {
    const providerInput = {
      providerCode: 'AV_GLOBAL',
      displayNameKo: '글로벌 AV',
      displayNameEn: 'Global AV',
      adapterType: 'AV_GATEWAY',
      siteScope: ['18000000-0000-4000-8000-000000000010'],
      capabilities: ['CAPACITY'],
      support: { channel: 'WEB' as const, labelKo: 'AV 데스크', labelEn: 'AV desk' },
      credentialBindingReference: 'vault-reference-18',
      explicitConfirmation: true as const,
      reason: 'Register the verified provider',
    };
    const capacityInput = {
      siteReference: 'site-1',
      buckets: [
        {
          startsAt: now,
          endsAt: '2026-09-18T02:00:00Z',
          capacityLimit: 10,
          sourceVersion: 'source-3',
          sourceObservedAt: now,
        },
      ],
      explicitConfirmation: true as const,
      reason: 'Publish the verified capacity feed',
    };
    const contactInput = {
      target: 'ASSIGNEE' as const,
      serviceOrderLineId: lineId,
      expectedOrderVersion: 3,
      message: 'Please confirm the delivery entrance.',
      explicitConfirmation: true as const,
      reason: 'Resolve a delivery blocker',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(response({ provider: provider(), receipt: receipt() }, 202))
      .mockResolvedValueOnce(response({ capacity: capacity(), receipt: receipt() }, 202))
      .mockResolvedValueOnce(
        response(
          {
            contactRequestId: '18000000-0000-4000-8000-000000000011',
            target: 'ASSIGNEE',
            resolvedTargetDisplayName: 'Casey Kim',
            state: 'QUEUED',
            receipt: receipt(),
          },
          202
        )
      );
    vi.stubGlobal('fetch', fetchMock);

    await createWorkplaceServiceProvider(providerInput, {
      idempotencyKey: 'provider-create-1',
      activeAccessMode: 'ELEVATED',
    });
    await updateWorkplaceServiceCapacity(itemId, capacityInput, {
      idempotencyKey: 'capacity-update-1',
      activeAccessMode: 'ELEVATED',
    });
    await contactWorkplaceServiceOrder(orderId, contactInput, {
      idempotencyKey: 'contact-1',
    });

    expect(fetchMock.mock.calls.slice(1).map((call) => call[0])).toEqual([
      '/api/platform/v1/admin/workplace/service-providers',
      `/api/platform/v1/admin/workplace/service-catalog/${itemId}/capacity`,
      `/api/platform/v1/workplace/service-orders/${orderId}/contacts`,
    ]);
    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toEqual(
      providerInput
    );
    expect(JSON.parse(String((fetchMock.mock.calls[2]?.[1] as RequestInit).body))).toEqual(
      capacityInput
    );
    expect(JSON.parse(String((fetchMock.mock.calls[3]?.[1] as RequestInit).body))).toEqual(
      contactInput
    );
    expect(
      new Headers((fetchMock.mock.calls[2]?.[1] as RequestInit).headers).get(
        'X-DWP-Active-Access-Mode'
      )
    ).toBe('ELEVATED');
    expect(
      new Headers((fetchMock.mock.calls[3]?.[1] as RequestInit).headers).get(
        'X-DWP-Active-Access-Mode'
      )
    ).toBeNull();
  });
});
