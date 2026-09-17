import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  activateWorkplaceSafetyIncident,
  getActiveWorkplaceSafetySheets,
  getAdminWorkplaceSafetyCommand,
  getAdminWorkplaceSafetyIncidents,
  previewWorkplaceSafetyActivation,
  respondToWorkplaceSafetyIncident,
} from './workplace-safety-api';
import {
  parseWorkplaceSafetyConnectorTruth,
  parseWorkplaceSafetyIncident,
  parseWorkplaceSafetyIncidentMessage,
  parseWorkplaceSafetySheet,
} from './workplace-safety-parser';

const INCIDENT_ID = '20000000-0000-4000-8000-000000000001';
const SNAPSHOT_ID = '20000000-0000-4000-8000-000000000002';
const MEMBER_ID = '20000000-0000-4000-8000-000000000003';
const SITE_ID = '20000000-0000-4000-8000-000000000004';
const FLOOR_ID = '20000000-0000-4000-8000-000000000005';
const ZONE_ID = '20000000-0000-4000-8000-000000000006';
const DISPATCH_ID = '20000000-0000-4000-8000-000000000007';
const COMMAND_ID = '20000000-0000-4000-8000-000000000008';
const PREVIEW_ID = '20000000-0000-4000-8000-000000000009';
const NOW = '2026-09-16T12:00:00Z';

function source(source: string, freshness = 'FRESH', availability = 'AVAILABLE') {
  return {
    source,
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

function audience() {
  return {
    audienceSnapshotId: SNAPSHOT_ID,
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
        audienceMemberId: MEMBER_ID,
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
    providerCode: `provider-${kind.toLowerCase()}`,
    state,
    configurationVersion: 3,
    observedConfigurationVersion: state === 'READY' ? 3 : null,
    evidenceReference: state === 'READY' ? `evidence-${kind.toLowerCase()}` : null,
    sourceAt: NOW,
    receivedAt: NOW,
    lastSuccessAt: state === 'READY' ? NOW : null,
    errorCode: null,
    version: 4,
    evaluatedAt: NOW,
  };
}

function incident(dispatchState = 'PARTIAL') {
  return {
    incidentId: INCIDENT_ID,
    incidentNumber: 'INC-20260916-0001',
    incidentType: 'EVACUATION',
    severity: 'CRITICAL',
    state: 'ACTIVE',
    siteId: SITE_ID,
    floorIds: [FLOOR_ID],
    zoneIds: [ZONE_ID],
    message: 'Evacuate the affected area.',
    safetyAction: 'Use the marked exit and go to the assembly point.',
    assemblyPoint: 'North assembly point',
    channels: ['APP_PUSH', 'SMS'],
    audience: audience(),
    responses: { safe: 20, needsHelp: 2, noResponse: 10 },
    assembly: { confirmed: 18, pending: 14 },
    dispatches: [
      {
        dispatchBatchId: DISPATCH_ID,
        state: dispatchState,
        attemptCount: 32,
        deliveredCount: 28,
        failedCount: dispatchState === 'SUCCEEDED' ? 0 : 3,
        unknownCount: dispatchState === 'RESULT_UNKNOWN' ? 1 : 0,
        channels: ['APP_PUSH', 'SMS'],
        updatedAt: NOW,
      },
    ],
    connectorTruth: [
      connector('EMERGENCY_119', 'CONFIGURED_UNVERIFIED'),
      connector('EBS'),
      connector('BLE_MESH'),
      connector('WORM'),
      connector('GOVERNMENT_LOG'),
    ],
    version: 4,
    activatedAt: NOW,
    closedAt: null,
    updatedAt: NOW,
  };
}

function sheet(responseState: string | null = null) {
  return {
    incidentId: INCIDENT_ID,
    incidentNumber: 'INC-20260916-0001',
    severity: 'CRITICAL',
    message: 'Evacuate the affected area.',
    safetyAction: 'Use the marked exit.',
    assemblyPoint: 'North assembly point',
    scopeLabels: [`SITE:${SITE_ID}`, `FLOOR:${FLOOR_ID}`, `ZONE:${ZONE_ID}`],
    currentResponse: responseState,
    accessibleAlternativeContact: 'Contact the site security desk or local emergency services.',
    version: 4,
    asOf: NOW,
  };
}

function activationPreview() {
  return {
    activationPreviewId: PREVIEW_ID,
    incidentType: 'EVACUATION',
    severity: 'CRITICAL',
    siteId: SITE_ID,
    floorIds: [FLOOR_ID],
    zoneIds: [ZONE_ID],
    message: 'Evacuate the affected area.',
    safetyAction: 'Use the marked exit.',
    assemblyPoint: 'North assembly point',
    channels: ['APP_PUSH'],
    audience: audience(),
    connectorTruth: [connector('EBS')],
    eligible: true,
    limitations: [],
    expiresAt: '2026-09-16T12:10:00Z',
    createdAt: NOW,
  };
}

function receipt(state = 'SUCCEEDED') {
  return {
    commandId: COMMAND_ID,
    state,
    statusHref: `/v1/admin/workplace/safety/incidents/${INCIDENT_ID}`,
    idempotentReplay: false,
    correlationId: 'screen-20-correlation',
    acceptedAt: NOW,
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

describe('Workplace safety API contract', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('preserves source-separated coverage and rejects raw personal data', () => {
    const parsed = parseWorkplaceSafetyIncident(incident());
    expect(parsed.audience.sources.map((item) => item.source)).toEqual([
      'RESERVATION',
      'ACTUAL_PRESENCE',
      'VISITOR',
      'SCHEDULED_VISITOR',
    ]);
    expect(parsed.audience.sources[1]).toMatchObject({
      freshness: 'STALE',
      availability: 'PARTIAL',
    });
    expect(() =>
      parseWorkplaceSafetySheet({ ...sheet(), email: 'raw-person@example.test' })
    ).toThrow(/Sensitive field/u);
    expect(() =>
      parseWorkplaceSafetyIncidentMessage({
        messageId: MEMBER_ID,
        incidentId: INCIDENT_ID,
        targetUserId: 20001,
        direction: 'COMMAND_TO_USER',
        maskedBody: 'Contact raw-person@example.test',
        createdAt: NOW,
      })
    ).toThrow(/raw email/u);
    expect(
      parseWorkplaceSafetyConnectorTruth({
        ...connector('EMERGENCY_119', 'NOT_CONFIGURED'),
        providerCode: null,
        configurationVersion: 0,
        version: 0,
      }).providerCode
    ).toBeNull();
  });

  it('loads user sheets and sends a versioned, confirmed response with command identity', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response([sheet()]))
      .mockResolvedValueOnce(response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(response({ sheet: sheet('SAFE'), receipt: receipt() }, 202));
    vi.stubGlobal('fetch', fetchMock);

    const active = await getActiveWorkplaceSafetySheets();
    const result = await respondToWorkplaceSafetyIncident(
      active[0]!.incidentId,
      {
        expectedIncidentVersion: active[0]!.version,
        response: 'SAFE',
        assistanceNote: null,
        reason: 'Confirm my current safety status',
        explicitConfirmation: true,
      },
      { idempotencyKey: 'screen-20-safe', correlationId: 'screen-20-correlation' }
    );

    expect(result.sheet.currentResponse).toBe('SAFE');
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/platform/v1/workplace/safety/incidents/active');
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      `/api/platform/v1/workplace/safety/incidents/${INCIDENT_ID}/responses`
    );
    const headers = new Headers((fetchMock.mock.calls[2]?.[1] as RequestInit).headers);
    expect(headers.get('Idempotency-Key')).toBe('screen-20-safe');
    expect(headers.get('X-Correlation-ID')).toBe('screen-20-correlation');
  });

  it('uses elevated canonical activation and returns the command receipt', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(
        response({ incident: incident('SUCCEEDED'), receipt: receipt('ACCEPTED') }, 202)
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await activateWorkplaceSafetyIncident(
      {
        activationPreviewId: PREVIEW_ID,
        reason: 'Activate the verified incident',
        explicitConfirmation: true,
      },
      {
        idempotencyKey: 'screen-20-activate',
        correlationId: 'screen-20-correlation',
        activeAccessMode: 'ELEVATED',
      }
    );

    expect(result.receipt.state).toBe('ACCEPTED');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/platform/v1/admin/workplace/safety/incidents');
    const headers = new Headers((fetchMock.mock.calls[1]?.[1] as RequestInit).headers);
    expect(headers.get('X-DWP-Active-Access-Mode')).toBe('ELEVATED');
    expect(headers.get('Idempotency-Key')).toBe('screen-20-activate');
  });

  it('parses the governed activation preview wrapper and sends preview command headers', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(
        response({ preview: activationPreview(), receipt: receipt('SUCCEEDED') }, 202)
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await previewWorkplaceSafetyActivation(
      {
        incidentType: 'EVACUATION',
        severity: 'CRITICAL',
        siteId: SITE_ID,
        floorIds: [FLOOR_ID],
        zoneIds: [ZONE_ID],
        message: 'Evacuate the affected area.',
        safetyAction: 'Use the marked exit.',
        assemblyPoint: 'North assembly point',
        channels: ['APP_PUSH'],
        excludedSubjectKeys: [],
        reason: 'Preview the authoritative target and delivery impact',
        explicitConfirmation: true,
      },
      {
        idempotencyKey: 'screen-20-preview',
        correlationId: 'screen-20-correlation',
        activeAccessMode: 'ELEVATED',
      }
    );

    expect(result.preview.audience.finalTargetCount).toBe(32);
    expect(result.receipt.state).toBe('SUCCEEDED');
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/platform/v1/admin/workplace/safety/incidents:preview'
    );
    const headers = new Headers((fetchMock.mock.calls[1]?.[1] as RequestInit).headers);
    expect(headers.get('Idempotency-Key')).toBe('screen-20-preview');
    expect(headers.get('X-DWP-Active-Access-Mode')).toBe('ELEVATED');
  });

  it('recovers RESULT_UNKNOWN through the canonical GET command endpoint', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response([incident('RESULT_UNKNOWN')]))
      .mockResolvedValueOnce(response(receipt('RESULT_UNKNOWN')));
    vi.stubGlobal('fetch', fetchMock);

    const incidents = await getAdminWorkplaceSafetyIncidents('ACTIVE');
    const checked = await getAdminWorkplaceSafetyCommand(incidents[0]!.incidentId, COMMAND_ID);

    expect(incidents[0]!.dispatches[0]?.state).toBe('RESULT_UNKNOWN');
    expect(checked.state).toBe('RESULT_UNKNOWN');
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/api/platform/v1/admin/workplace/safety/incidents?state=ACTIVE',
      `/api/platform/v1/admin/workplace/safety/incidents/${INCIDENT_ID}/commands/${COMMAND_ID}`,
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
