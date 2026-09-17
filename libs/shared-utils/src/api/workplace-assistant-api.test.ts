import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  confirmWorkplaceAssistantRequest,
  createWorkplaceAssistantRequest,
  getWorkplaceAssistantAuditEvents,
  getWorkplaceAssistantExecution,
  getWorkplaceAssistantRequest,
  updateWorkplaceAssistantGovernance,
  validateWorkplaceAssistantRequest,
} from './workplace-assistant-api';
import {
  parseWorkplaceAssistantAuditEvents,
  parseWorkplaceAssistantCommandResult,
  parseWorkplaceAssistantRequest,
} from './workplace-assistant-parser';

const REQUEST_ID = '23000000-0000-4000-8000-000000000001';
const PROPOSAL_ID = '23000000-0000-4000-8000-000000000002';
const INTENT_ID = '23000000-0000-4000-8000-000000000003';
const INTENT_ITEM_ID = '23000000-0000-4000-8000-000000000004';
const RESOURCE_ID = '23000000-0000-4000-8000-000000000005';
const SITE_ID = '23000000-0000-4000-8000-000000000006';
const FLOOR_ID = '23000000-0000-4000-8000-000000000007';
const BATCH_ID = '23000000-0000-4000-8000-000000000008';
const BATCH_ITEM_ID = '23000000-0000-4000-8000-000000000009';
const HOLD_ID = '23000000-0000-4000-8000-000000000010';
const COMMAND_ID = '23000000-0000-4000-8000-000000000011';
const AUDIT_ID = '23000000-0000-4000-8000-000000000012';
const NOW = '2026-09-16T10:00:00Z';

function requestedItem() {
  return {
    clientItemKey: 'team-tuesday-desk',
    beneficiaryUserId: 10001,
    beneficiaryPersonPublicId: null,
    beneficiaryDisplayName: 'Current member',
    delegationGrantId: null,
    resourceType: 'DESK' as const,
    preferredResourceId: null,
    siteId: SITE_ID,
    floorId: FLOOR_ID,
    startsAt: '2026-09-22T00:00:00Z',
    endsAt: '2026-09-22T09:00:00Z',
    purpose: 'Team collaboration',
    visibleToColleagues: false,
    accessibleOnly: true,
    requiredFeatures: ['HEIGHT_ADJUSTABLE'],
  };
}

function assistantRequest(state = 'SUGGESTED', requeryRequired = false) {
  return {
    requestId: REQUEST_ID,
    state,
    redactedRequestText: 'Book a nearby team desk and parking for [redacted].',
    redactionState: 'APPLIED',
    consent: {
      requestProcessingConsent: true,
      feedbackUseConsent: false,
      tenantOptIn: true,
      feedbackUseEnabled: true,
    },
    modelProviderReference: 'approved-provider',
    modelVersion: 'model-governed-1',
    promptVersion: 'prompt-23',
    toolVersion: 'tool-23',
    proposals: [
      {
        proposalItemId: PROPOSAL_ID,
        requestedItem: requestedItem(),
        rationale: 'Matches the requested site, time, and accessibility requirement.',
        constraintsUsed: ['site', 'time', 'accessibility'],
        exclusions: ['Unavailable neighborhood'],
        policyResult: state === 'SUGGESTED' ? 'UNVALIDATED' : 'ALLOWED',
        conflicts: [],
        alternatives: [],
        authoritativeIntentItemId: state === 'SUGGESTED' ? null : INTENT_ITEM_ID,
        authoritativeIntentItemVersion: state === 'SUGGESTED' ? null : 1,
        selectedResourceId: state === 'SUGGESTED' ? null : RESOURCE_ID,
        selectedResourceVersion: state === 'SUGGESTED' ? null : 0,
        selectedResourceName: state === 'SUGGESTED' ? null : 'Desk 4A',
        version: 1,
      },
    ],
    validation:
      state === 'SUGGESTED'
        ? null
        : {
            bookingIntentId: INTENT_ID,
            bookingIntentVersion: 2,
            bookingIntentState: 'HELD',
            allSelectedItemsValid: true,
            validatedAt: NOW,
            limitations: [],
          },
    bookingBatchId: ['PROCESSING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'RESULT_UNKNOWN'].includes(
      state
    )
      ? BATCH_ID
      : null,
    batchStatusHref: ['PROCESSING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'RESULT_UNKNOWN'].includes(
      state
    )
      ? `/v1/workplace/booking-batches/${BATCH_ID}`
      : null,
    requeryRequired,
    lastResultCode: requeryRequired ? 'RESULT_UNKNOWN' : null,
    limitations: ['Suggestions require authoritative validation.'],
    version: 2,
    retentionExpiresAt: '2026-10-16T10:00:00Z',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function receipt(state = 'SUCCEEDED') {
  return {
    commandId: COMMAND_ID,
    state,
    statusHref: `/v1/workplace/assistant/requests/${REQUEST_ID}`,
    replayed: false,
    correlationId: 'screen-23-correlation',
    resultCode: state === 'ACCEPTED' ? null : state,
    acceptedAt: NOW,
    completedAt: state === 'ACCEPTED' ? null : NOW,
  };
}

function batch(state = 'RESULT_UNKNOWN') {
  return {
    batchId: BATCH_ID,
    intentId: INTENT_ID,
    actorUserId: 10001,
    state,
    failurePolicy: 'KEEP_SUCCEEDED',
    reason: 'Confirm reviewed Workplace Assistant proposals',
    items: [
      {
        batchItemId: BATCH_ITEM_ID,
        intentItemId: INTENT_ITEM_ID,
        holdId: HOLD_ID,
        clientItemKey: 'team-tuesday-desk',
        beneficiaryUserId: 10001,
        beneficiaryPersonPublicId: null,
        beneficiaryDisplayName: 'Current member',
        delegationGrantId: null,
        resourceType: 'DESK',
        resourceId: RESOURCE_ID,
        resourceDisplayName: 'Desk 4A',
        siteId: SITE_ID,
        floorId: FLOOR_ID,
        timeZone: 'Asia/Seoul',
        startsAt: '2026-09-22T00:00:00Z',
        endsAt: '2026-09-22T09:00:00Z',
        authority: 'WORKPLACE',
        state,
        ownerReferenceId: null,
        ownerVersion: 0,
        errorCode: state === 'RESULT_UNKNOWN' ? 'PROVIDER_TIMEOUT' : null,
        errorMessage: null,
        compensationAvailable: false,
        requeryRequired: state === 'RESULT_UNKNOWN',
        version: 1,
        updatedAt: NOW,
      },
    ],
    terminal: state !== 'PROCESSING',
    requeryRequired: state === 'RESULT_UNKNOWN',
    version: 2,
    createdAt: NOW,
    startedAt: NOW,
    completedAt: null,
    updatedAt: NOW,
  };
}

function response(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    text: async () => JSON.stringify({ data }),
  } as Response;
}

afterEach(() => {
  resetCsrfToken();
  vi.unstubAllGlobals();
});

describe('Workplace Assistant API contract', () => {
  it('keeps suggestions separate from authority evidence and rejects unredacted data', () => {
    const suggested = parseWorkplaceAssistantRequest(assistantRequest());
    expect(suggested.proposals[0]).toMatchObject({
      policyResult: 'UNVALIDATED',
      authoritativeIntentItemId: null,
    });
    expect(suggested.validation).toBeNull();
    expect(
      parseWorkplaceAssistantRequest({
        ...assistantRequest('SUCCEEDED'),
        redactedRequestText: null,
        redactionState: 'RETAINED_CONTENT_DELETED',
        proposals: [],
      })
    ).toMatchObject({
      redactedRequestText: null,
      redactionState: 'RETAINED_CONTENT_DELETED',
      proposals: [],
    });
    expect(
      parseWorkplaceAssistantRequest(assistantRequest('VALIDATED')).proposals[0]
    ).toMatchObject({
      selectedResourceVersion: 0,
    });
    expect(() =>
      parseWorkplaceAssistantRequest({
        ...assistantRequest(),
        redactedRequestText: 'Book for raw.person@example.test',
      })
    ).toThrow(/unredacted personal data/u);
    expect(() =>
      parseWorkplaceAssistantRequest({
        ...assistantRequest(),
        redactedRequestText: 'Book for 900101-1234567',
      })
    ).toThrow(/unredacted personal data/u);
    expect(() =>
      parseWorkplaceAssistantAuditEvents({
        items: [
          {
            auditEventId: AUDIT_ID,
            requestId: REQUEST_ID,
            eventType: 'UnsafeEvent',
            actorUserId: 10001,
            metadata: { credentialToken: 'secret' },
            correlationId: null,
            createdAt: NOW,
          },
        ],
        generatedAt: NOW,
      })
    ).toThrow(/sensitive field/u);
    expect(
      parseWorkplaceAssistantCommandResult({
        request: assistantRequest('VALIDATED'),
        receipt: {
          ...receipt('FAILED'),
          replayed: true,
          resultCode: 'VERSION_CONFLICT',
        },
      }).receipt
    ).toMatchObject({
      state: 'FAILED',
      replayed: true,
      resultCode: 'VERSION_CONFLICT',
      completedAt: NOW,
    });
    expect(() =>
      parseWorkplaceAssistantCommandResult({
        request: assistantRequest('VALIDATED'),
        receipt: { ...receipt('FAILED'), resultCode: 'unsafe result text' },
      })
    ).toThrow(/safe result code/u);
  });

  it('uses canonical create, validate and confirm paths with versioned command evidence', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(response({ request: assistantRequest(), receipt: receipt() }, 201))
      .mockResolvedValueOnce(
        response({ request: assistantRequest('VALIDATED'), receipt: receipt() })
      )
      .mockResolvedValueOnce(
        response({ request: assistantRequest('PROCESSING'), receipt: receipt('ACCEPTED') }, 202)
      );
    vi.stubGlobal('fetch', fetchMock);

    await createWorkplaceAssistantRequest(
      {
        requestText: 'Book a team desk near three colleagues next Tuesday.',
        requestedItems: [requestedItem()],
        requestProcessingConsent: true,
        feedbackUseConsent: false,
        reason: 'Generate a reviewed booking proposal',
      },
      { idempotencyKey: 'assistant-create', correlationId: 'screen-23-correlation' }
    );
    await validateWorkplaceAssistantRequest(
      REQUEST_ID,
      {
        expectedVersion: 2,
        selectionMode: 'SELECTED',
        selectedProposalItemIds: [PROPOSAL_ID],
        requestedHoldTtlSeconds: 120,
        allowAlternatives: true,
        reason: 'Validate selected proposals against authority APIs',
      },
      { idempotencyKey: 'assistant-validate', correlationId: 'screen-23-correlation' }
    );
    await confirmWorkplaceAssistantRequest(
      REQUEST_ID,
      {
        expectedVersion: 2,
        selectionMode: 'SELECTED',
        selectedProposalItemIds: [PROPOSAL_ID],
        failurePolicy: 'KEEP_SUCCEEDED',
        explicitConfirmation: true,
        reason: 'Confirm the reviewed authoritative selection',
      },
      { idempotencyKey: 'assistant-confirm', correlationId: 'screen-23-correlation' }
    );

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/api/auth/csrf',
      '/api/platform/v1/workplace/assistant/requests',
      `/api/platform/v1/workplace/assistant/requests/${REQUEST_ID}:validate`,
      `/api/platform/v1/workplace/assistant/requests/${REQUEST_ID}:confirm`,
    ]);
    expect(
      fetchMock.mock.calls
        .slice(1)
        .map(([, init]) => new Headers((init as RequestInit).headers).get('Idempotency-Key'))
    ).toEqual(['assistant-create', 'assistant-validate', 'assistant-confirm']);
    expect(JSON.parse((fetchMock.mock.calls[3]?.[1] as RequestInit).body as string)).toMatchObject({
      expectedVersion: 2,
      explicitConfirmation: true,
      reason: 'Confirm the reviewed authoritative selection',
    });
  });

  it('recovers result unknown through request and execution GETs only', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(assistantRequest('RESULT_UNKNOWN', true)))
      .mockResolvedValueOnce(
        response({
          requestId: REQUEST_ID,
          state: 'RESULT_UNKNOWN',
          bookingIntentId: INTENT_ID,
          bookingBatchId: BATCH_ID,
          authoritativeBatch: batch(),
          requeryRequired: true,
          recoveryGuidance: 'Do not repeat confirmation; re-query this execution endpoint.',
          refreshedAt: NOW,
          requestVersion: 3,
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    await getWorkplaceAssistantRequest(REQUEST_ID);
    const execution = await getWorkplaceAssistantExecution(REQUEST_ID);

    expect(execution).toMatchObject({ state: 'RESULT_UNKNOWN', requeryRequired: true });
    expect(execution.authoritativeBatch.items[0]?.ownerVersion).toBe(0);
    expect(
      fetchMock.mock.calls.map((call) => (call[1] as RequestInit | undefined)?.method ?? 'GET')
    ).toEqual(['GET', 'GET']);
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      `/api/platform/v1/workplace/assistant/requests/${REQUEST_ID}`,
      `/api/platform/v1/workplace/assistant/requests/${REQUEST_ID}/execution`,
    ]);
  });

  it('guards governance updates with elevated access and exposes bounded audit reads', async () => {
    const governance = {
      tenantOptIn: true,
      killSwitch: false,
      modelProviderReference: 'approved-provider',
      modelVersion: 'model-governed-1',
      promptVersion: 'prompt-23',
      toolVersion: 'tool-23',
      retentionDays: 30,
      feedbackUseEnabled: true,
      redactionState: 'READY',
      version: 2,
      updatedAt: NOW,
      updatedBy: 10001,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(
        response(
          {
            governance,
            receipt: { ...receipt(), statusHref: '/v1/admin/workplace/assistant/governance' },
          },
          202
        )
      )
      .mockResolvedValueOnce(response({ items: [], generatedAt: NOW }));
    vi.stubGlobal('fetch', fetchMock);

    await updateWorkplaceAssistantGovernance(
      {
        expectedVersion: 2,
        tenantOptIn: true,
        killSwitch: false,
        modelProviderReference: 'approved-provider',
        modelVersion: 'model-governed-1',
        promptVersion: 'prompt-23',
        toolVersion: 'tool-23',
        retentionDays: 30,
        feedbackUseEnabled: true,
        redactionState: 'READY',
        explicitConfirmation: true,
        reason: 'Publish reviewed assistant governance',
      },
      {
        idempotencyKey: 'assistant-governance',
        correlationId: 'screen-23-correlation',
        activeAccessMode: 'ELEVATED',
      }
    );
    await getWorkplaceAssistantAuditEvents({ requestId: REQUEST_ID, limit: 50 });

    const headers = new Headers((fetchMock.mock.calls[1]?.[1] as RequestInit).headers);
    expect(headers.get('X-DWP-Active-Access-Mode')).toBe('ELEVATED');
    expect(headers.get('Idempotency-Key')).toBe('assistant-governance');
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      `/api/platform/v1/admin/workplace/assistant/audit-events?requestId=${REQUEST_ID}&limit=50`
    );
    await expect(
      updateWorkplaceAssistantGovernance(
        {
          expectedVersion: 2,
          tenantOptIn: true,
          killSwitch: true,
          modelProviderReference: '',
          modelVersion: '',
          promptVersion: '',
          toolVersion: '',
          retentionDays: 30,
          feedbackUseEnabled: false,
          redactionState: 'BLOCKED',
          explicitConfirmation: true,
          reason: 'Emergency stop',
        },
        { idempotencyKey: 'not-elevated' }
      )
    ).rejects.toThrow(/Elevated access/u);
  });
});
