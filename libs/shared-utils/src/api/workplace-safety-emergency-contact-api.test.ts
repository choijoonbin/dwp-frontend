import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  executeWorkplaceEmergencyHandoff,
  getWorkplaceEmergencyHandoff,
  parseWorkplaceEmergencyContact,
  previewWorkplaceEmergencyHandoff,
  reconcileWorkplaceEmergencyHandoff,
} from './workplace-safety-emergency-contact-api';

const INCIDENT = '20000000-0000-4000-8000-000000000001';
const CONTACT = '20000000-0000-4000-8000-000000000002';
const PREVIEW = '20000000-0000-4000-8000-000000000003';
const HANDOFF = '20000000-0000-4000-8000-000000000004';
const COMMAND = '20000000-0000-4000-8000-000000000005';
const NOW = '2026-09-17T03:00:00Z';

function response(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    text: async () => JSON.stringify({ data }),
  } as Response;
}

function preview() {
  return {
    previewId: PREVIEW,
    incidentId: INCIDENT,
    contactId: CONTACT,
    expectedIncidentVersion: 4,
    expectedContactVersion: 2,
    providerState: 'READY',
    providerCode: 'national-emergency-relay',
    providerConfigurationVersion: 7,
    eligible: true,
    impact: [
      'EXTERNAL_PROVIDER_HANDOFF',
      'AUDIT_EVIDENCE_RECORDED',
      'NO_PERSONAL_CONTACT_DATA_SENT',
    ],
    limitations: [],
    expiresAt: '2026-09-17T03:05:00Z',
    createdAt: NOW,
  };
}

function receipt(state: 'SUCCEEDED' | 'RESULT_UNKNOWN') {
  return {
    handoffId: HANDOFF,
    commandId: COMMAND,
    previewId: PREVIEW,
    incidentId: INCIDENT,
    contactId: CONTACT,
    state,
    resultCode: state === 'SUCCEEDED' ? 'HANDOFF_ACCEPTED' : 'PROVIDER_RESULT_UNKNOWN',
    providerOperationReference: 'opaque-provider-operation',
    providerEvidenceReference: state === 'SUCCEEDED' ? 'opaque-provider-evidence' : null,
    version: 2,
    statusHref: `/v1/admin/workplace/safety/incidents/${INCIDENT}/emergency-handoffs/${COMMAND}`,
    correlationId: 'screen-20-emergency-correlation',
    acceptedAt: NOW,
    completedAt: state === 'SUCCEEDED' ? NOW : null,
    updatedAt: NOW,
    idempotentReplay: false,
  };
}

describe('Workplace safety emergency contact API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('exposes only a policy-approved organizational tel URI', () => {
    const contact = parseWorkplaceEmergencyContact({
      contactId: CONTACT,
      kind: 'PUBLIC_EMERGENCY',
      displayNameKo: '공공 긴급 서비스',
      displayNameEn: 'Public emergency service',
      actionMode: 'TEL_URI',
      telUri: 'tel:+82123456789',
      directTelAllowed: true,
      providerState: 'READY',
      providerCode: null,
      providerConfigurationVersion: null,
      active: true,
      sortOrder: 10,
      version: 1,
      evaluatedAt: NOW,
    });

    expect(contact).toMatchObject({ telUri: 'tel:+82123456789', providerState: 'READY' });
    expect(() =>
      parseWorkplaceEmergencyContact({ ...contact, telUri: 'javascript:alert(1)' })
    ).toThrow(/tel URI/u);
  });

  it('uses elevated idempotent preview and execute, then reconciles by lookup without resend', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ token: 'csrf-safety', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(
        response({
          preview: preview(),
          receipt: {
            commandId: '20000000-0000-4000-8000-000000000006',
            state: 'SUCCEEDED',
            statusHref: `/v1/admin/workplace/safety/incidents/${INCIDENT}/emergency-handoff-previews/${PREVIEW}`,
            idempotentReplay: false,
            correlationId: 'screen-20-preview',
            acceptedAt: NOW,
          },
        })
      )
      .mockResolvedValueOnce(response(receipt('RESULT_UNKNOWN')))
      .mockResolvedValueOnce(response(receipt('RESULT_UNKNOWN')))
      .mockResolvedValueOnce(response(receipt('SUCCEEDED')));
    vi.stubGlobal('fetch', fetchMock);

    const impact = await previewWorkplaceEmergencyHandoff(
      INCIDENT,
      {
        contactId: CONTACT,
        expectedIncidentVersion: 4,
        expectedContactVersion: 2,
        reason: 'Verify external handoff impact',
      },
      { idempotencyKey: 'screen20-preview', activeAccessMode: 'ELEVATED' }
    );
    const uncertain = await executeWorkplaceEmergencyHandoff(
      INCIDENT,
      {
        previewId: impact.preview.previewId,
        expectedIncidentVersion: 4,
        expectedContactVersion: 2,
        reason: 'Confirm one emergency handoff',
        explicitConfirmation: true,
      },
      { idempotencyKey: 'screen20-execute', activeAccessMode: 'ELEVATED' }
    );
    const rechecked = await getWorkplaceEmergencyHandoff(INCIDENT, uncertain.commandId);
    const reconciled = await reconcileWorkplaceEmergencyHandoff(
      INCIDENT,
      uncertain.commandId,
      'Lookup provider status without resending',
      { idempotencyKey: 'screen20-reconcile', activeAccessMode: 'ELEVATED' }
    );

    expect(rechecked.state).toBe('RESULT_UNKNOWN');
    expect(reconciled.state).toBe('SUCCEEDED');
    expect(fetchMock.mock.calls[3]?.[0]).toContain(`/emergency-handoffs/${COMMAND}`);
    expect((fetchMock.mock.calls[3]?.[1] as RequestInit).method).toBe('GET');
    const reconcileUrl = String(fetchMock.mock.calls[4]?.[0]);
    expect(reconcileUrl).toContain(`/emergency-handoffs/${COMMAND}:reconcile`);
    const executeHeaders = new Headers((fetchMock.mock.calls[2]?.[1] as RequestInit).headers);
    const reconcileHeaders = new Headers((fetchMock.mock.calls[4]?.[1] as RequestInit).headers);
    expect(executeHeaders.get('Idempotency-Key')).toBe('screen20-execute');
    expect(executeHeaders.get('X-DWP-Active-Access-Mode')).toBe('ELEVATED');
    expect(reconcileHeaders.get('Idempotency-Key')).toBe('screen20-reconcile');
  });
});
