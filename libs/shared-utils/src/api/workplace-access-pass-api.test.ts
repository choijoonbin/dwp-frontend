import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  executeWorkplaceAccessPass,
  getWorkplaceAccessPassCommand,
  parseWorkplaceAccessPassContext,
  previewWorkplaceAccessPass,
} from './workplace-access-pass-api';

const SITE_ID = '19000000-0000-4000-8000-000000000001';
const FLOOR_ID = '19000000-0000-4000-8000-000000000002';
const RESOURCE_ID = '19000000-0000-4000-8000-000000000003';
const POI_ID = '19000000-0000-4000-8000-000000000004';
const PASS_ID = '19000000-0000-4000-8000-000000000005';
const PREVIEW_ID = '19000000-0000-4000-8000-000000000006';
const COMMAND_ID = '19000000-0000-4000-8000-000000000007';
const NOW = '2026-09-17T02:00:00Z';

function response(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    text: async () => JSON.stringify({ data }),
  } as Response;
}

function provider(capability: 'NFC' | 'SPEED_GATE') {
  return {
    capability,
    providerCode: capability === 'NFC' ? 'verified-nfc' : 'verified-gate',
    state: 'HEALTHY',
    configurationVersion: 8,
    observedConfigurationVersion: 8,
    evidenceReference: `evidence:${capability.toLowerCase()}`,
    sourceAt: NOW,
    receivedAt: NOW,
    lastSuccessAt: NOW,
    errorCode: null,
    version: 2,
    evaluatedAt: NOW,
  };
}

function pass() {
  return {
    passId: PASS_ID,
    sourceBookingId: '19000000-0000-4000-8000-000000000008',
    siteId: SITE_ID,
    floorId: FLOOR_ID,
    resourceId: RESOURCE_ID,
    destinationPoiId: POI_ID,
    state: 'ACTIVE',
    credentialLastFour: '7C2A',
    pairingAvailable: true,
    nfcEnabled: true,
    qrEnabled: true,
    nfcProviderCode: 'verified-nfc',
    nfcProviderConfigurationVersion: 8,
    nfcProviderEvidenceReference: 'evidence:nfc',
    qrProviderCode: 'verified-gate',
    qrProviderConfigurationVersion: 8,
    qrProviderEvidenceReference: 'evidence:speed_gate',
    version: 1,
    issuedAt: NOW,
    expiresAt: '2026-09-17T02:20:00Z',
    revokedAt: null,
    updatedAt: NOW,
  };
}

function preview() {
  return {
    previewId: PREVIEW_ID,
    commandType: 'ISSUE',
    passId: null,
    siteId: SITE_ID,
    floorId: FLOOR_ID,
    resourceId: RESOURCE_ID,
    destinationPoiId: POI_ID,
    expectedPassVersion: 0,
    nfcEnabled: true,
    qrEnabled: true,
    eligible: true,
    impact: ['NEW_ONE_TIME_CREDENTIAL_ISSUED', 'AUDIT_EVIDENCE_RECORDED'],
    limitations: [],
    expiresAt: '2026-09-17T02:05:00Z',
    createdAt: NOW,
  };
}

function command(oneTimeCredential: string | null, pairingCode: string | null, replayed: boolean) {
  return {
    receipt: {
      commandId: COMMAND_ID,
      passId: PASS_ID,
      commandType: 'ISSUE',
      state: 'SUCCEEDED',
      reason: 'Enter reserved room',
      resultCode: null,
      version: 1,
      recoveryByGetOnly: false,
      statusHref: `/v1/workplace/navigation/access-pass/commands/${COMMAND_ID}`,
      correlationId: 'screen-19-pass-correlation',
      acceptedAt: NOW,
      completedAt: NOW,
      updatedAt: NOW,
    },
    pass: pass(),
    oneTimeCredential,
    pairingCode,
    replayed,
  };
}

describe('Workplace access-pass API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('parses independent verified NFC and kiosk truth without inventing readiness', () => {
    const parsed = parseWorkplaceAccessPassContext({
      pass: pass(),
      providers: [
        provider('NFC'),
        {
          ...provider('SPEED_GATE'),
          state: 'NOT_CONFIGURED',
          providerCode: null,
          configurationVersion: 0,
          observedConfigurationVersion: null,
          evidenceReference: null,
          sourceAt: null,
          receivedAt: null,
          lastSuccessAt: null,
          version: 0,
        },
      ],
      bookingEligible: true,
      bookingEndsAt: '2026-09-17T03:00:00Z',
      evaluatedAt: NOW,
    });

    expect(parsed.pass).toMatchObject({ nfcEnabled: true, qrEnabled: true });
    expect(parsed.providers[1]).toMatchObject({
      capability: 'SPEED_GATE',
      state: 'NOT_CONFIGURED',
    });
  });

  it('uses idempotent preview and elevated execute then recovers only by GET without secrets', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ token: 'csrf-pass', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(response(preview()))
      .mockResolvedValueOnce(response(command('DWP1.one-time-secret', '8N5KQ7RM2W4C', false)))
      .mockResolvedValueOnce(response(command(null, null, true)));
    vi.stubGlobal('fetch', fetchMock);

    const impact = await previewWorkplaceAccessPass(
      {
        commandType: 'ISSUE',
        passId: null,
        siteId: SITE_ID,
        floorId: FLOOR_ID,
        resourceId: RESOURCE_ID,
        destinationPoiId: POI_ID,
        expectedPassVersion: 0,
      },
      'screen-19-pass-preview'
    );
    const issued = await executeWorkplaceAccessPass(
      {
        previewId: impact.previewId,
        expectedPassVersion: 0,
        reason: 'Enter reserved room',
        explicitConfirmation: true,
      },
      {
        idempotencyKey: 'screen-19-pass-issue',
        correlationId: 'screen-19-pass-correlation',
        activeAccessMode: 'ELEVATED',
      }
    );
    const recovered = await getWorkplaceAccessPassCommand(issued.receipt.commandId);

    expect(issued).toMatchObject({
      oneTimeCredential: 'DWP1.one-time-secret',
      pairingCode: '8N5KQ7RM2W4C',
      replayed: false,
    });
    expect(recovered).toMatchObject({
      oneTimeCredential: null,
      pairingCode: null,
      replayed: true,
    });
    const previewHeaders = new Headers((fetchMock.mock.calls[1]?.[1] as RequestInit).headers);
    const executeHeaders = new Headers((fetchMock.mock.calls[2]?.[1] as RequestInit).headers);
    expect(previewHeaders.get('Idempotency-Key')).toBe('screen-19-pass-preview');
    expect(previewHeaders.get('X-DWP-Active-Access-Mode')).toBeNull();
    expect(executeHeaders.get('Idempotency-Key')).toBe('screen-19-pass-issue');
    expect(executeHeaders.get('X-DWP-Active-Access-Mode')).toBe('ELEVATED');
    expect(fetchMock.mock.calls[3]?.[0]).toBe(
      `/api/platform/v1/workplace/navigation/access-pass/commands/${COMMAND_ID}`
    );
    expect((fetchMock.mock.calls[3]?.[1] as RequestInit).method).toBe('GET');
  });
});
