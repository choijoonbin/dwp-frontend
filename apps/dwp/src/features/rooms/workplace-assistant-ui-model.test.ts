import { describe, expect, it } from 'vitest';

import {
  workplaceAssistantActions,
  workplaceAssistantCanManageGovernance,
  workplaceAssistantExecutionCounts,
  workplaceAssistantGovernanceAvailability,
} from './workplace-assistant-ui-model';

import type {
  WorkplaceAssistantGovernance,
  WorkplaceAssistantRequest,
} from '@dwp-frontend/shared-utils/api/workplace-assistant-contract';

function request(state: WorkplaceAssistantRequest['state']): WorkplaceAssistantRequest {
  return {
    requestId: '23000000-0000-4000-8000-000000000001',
    state,
    redactedRequestText: 'Book a desk for [redacted].',
    redactionState: 'APPLIED',
    consent: {
      requestProcessingConsent: true,
      feedbackUseConsent: false,
      tenantOptIn: true,
      feedbackUseEnabled: true,
    },
    modelProviderReference: null,
    modelVersion: null,
    promptVersion: null,
    toolVersion: null,
    proposals: [],
    validation:
      state === 'VALIDATED'
        ? {
            bookingIntentId: '23000000-0000-4000-8000-000000000002',
            bookingIntentVersion: 1,
            bookingIntentState: 'HELD',
            allSelectedItemsValid: true,
            validatedAt: '2026-09-17T00:00:00Z',
            limitations: [],
          }
        : null,
    bookingBatchId: null,
    batchStatusHref: null,
    requeryRequired: state === 'RESULT_UNKNOWN',
    lastResultCode: null,
    limitations: [],
    version: 1,
    retentionExpiresAt: '2026-10-17T00:00:00Z',
    createdAt: '2026-09-17T00:00:00Z',
    updatedAt: '2026-09-17T00:00:00Z',
  };
}

function governance(
  overrides: Partial<WorkplaceAssistantGovernance> = {}
): WorkplaceAssistantGovernance {
  return {
    tenantOptIn: true,
    killSwitch: false,
    modelProviderReference: 'approved-provider',
    modelVersion: 'model-1',
    promptVersion: 'prompt-1',
    toolVersion: 'tool-1',
    retentionDays: 30,
    feedbackUseEnabled: false,
    redactionState: 'READY',
    version: 1,
    updatedAt: null,
    updatedBy: null,
    ...overrides,
  };
}

describe('Workplace Assistant UI policy', () => {
  it('requires authority validation before explicit confirmation', () => {
    expect(
      workplaceAssistantActions({
        request: request('SUGGESTED'),
        canUpdate: true,
        online: true,
        selectedCount: 1,
      })
    ).toMatchObject({ canValidate: true, canConfirm: false });
    expect(
      workplaceAssistantActions({
        request: request('VALIDATED'),
        canUpdate: true,
        online: true,
        selectedCount: 1,
      })
    ).toMatchObject({ canValidate: false, canConfirm: true });
  });

  it('makes result unknown GET-only', () => {
    expect(
      workplaceAssistantActions({
        request: request('RESULT_UNKNOWN'),
        canUpdate: true,
        online: true,
        selectedCount: 1,
      })
    ).toMatchObject({ recoverOnly: true, canValidate: false, canConfirm: false, canRefresh: true });
  });

  it('blocks expired or already submitted feedback', () => {
    const retained: WorkplaceAssistantRequest = {
      ...request('SUCCEEDED'),
      redactionState: 'RETAINED_CONTENT_DELETED',
      redactedRequestText: null,
    };
    expect(
      workplaceAssistantActions({
        request: retained,
        canUpdate: true,
        online: true,
        selectedCount: 1,
      }).canFeedback
    ).toBe(false);
    expect(
      workplaceAssistantActions({
        request: request('SUCCEEDED'),
        canUpdate: true,
        online: true,
        selectedCount: 1,
        feedbackReceipt: {
          feedbackId: '23000000-0000-4000-8000-000000000031',
          requestId: '23000000-0000-4000-8000-000000000001',
          rating: 'HELPFUL',
          redactedComment: null,
          eligibleForModelImprovementUse: false,
          auditEventId: '23000000-0000-4000-8000-000000000032',
          createdAt: '2026-09-17T00:00:00Z',
        },
      }).canFeedback
    ).toBe(false);
  });

  it('fails governance availability closed for kill switch, redaction, or missing evidence', () => {
    expect(workplaceAssistantGovernanceAvailability(governance())).toBe('AVAILABLE');
    expect(workplaceAssistantGovernanceAvailability(governance({ killSwitch: true }))).toBe(
      'PAUSED'
    );
    expect(
      workplaceAssistantGovernanceAvailability(governance({ redactionState: 'BLOCKED' }))
    ).toBe('BLOCKED');
    expect(workplaceAssistantGovernanceAvailability(governance({ modelVersion: null }))).toBe(
      'BLOCKED'
    );
  });

  it('requires permission, elevation, online state and resolved command truth for governance', () => {
    expect(
      workplaceAssistantCanManageGovernance({ permission: true, elevated: true, online: true })
    ).toBe(true);
    expect(
      workplaceAssistantCanManageGovernance({
        permission: true,
        elevated: true,
        online: true,
        receipt: {
          commandId: '23000000-0000-4000-8000-000000000009',
          state: 'RESULT_UNKNOWN',
          statusHref: '/v1/admin/workplace/assistant/governance',
          replayed: false,
          correlationId: null,
          resultCode: 'RESULT_UNKNOWN',
          acceptedAt: '2026-09-17T00:00:00Z',
          completedAt: '2026-09-17T00:00:01Z',
        },
      })
    ).toBe(false);
  });

  it('keeps authoritative batch outcome counts separate', () => {
    expect(
      workplaceAssistantExecutionCounts(request('PARTIAL'), [
        'SUCCEEDED',
        'FAILED',
        'RESULT_UNKNOWN',
        'PROCESSING',
      ])
    ).toMatchObject({ total: 4, succeeded: 1, failed: 1, unknown: 1, pending: 1 });
  });
});
