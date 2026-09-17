import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  arriveWorkplaceKioskVisit,
  createWorkplaceVisit,
  getAdminWorkplaceVisitExceptions,
  getWorkplaceKioskSession,
  getWorkplaceKioskVisit,
  getWorkplaceVisits,
} from './workplace-visits-api';
import {
  parseWorkplaceKioskVisit,
  parseWorkplaceRequesterVisit,
  parseWorkplaceVisitPreview,
} from './workplace-visits-parser';

const RESERVATION_ID = '17000000-0000-4000-8000-000000000001';
const VISIT_ID = '17000000-0000-4000-8000-000000000002';
const PREVIEW_ID = '17000000-0000-4000-8000-000000000003';
const SITE_ID = '17000000-0000-4000-8000-000000000004';
const ZONE_ID = '17000000-0000-4000-8000-000000000005';
const EVENT_ID = '17000000-0000-4000-8000-000000000006';
const COMMAND_ID = '17000000-0000-4000-8000-000000000007';
const DEVICE_ID = '17000000-0000-4000-8000-000000000008';
const NOW = '2026-09-18T01:00:00Z';
const DEVICE_HASH = 'a'.repeat(64);

function guest() {
  return {
    opaqueRef: 'vault://visitor/17',
    maskedLabel: 'K** J**',
    purpose: 'Business visit',
    fieldRetentionExpiresAt: { maskedLabel: '2026-12-18T01:00:00Z' },
  };
}

function requesterVisit(state = 'PREVIEWED') {
  return {
    visitId: VISIT_ID,
    reservation: { authority: 'WORKPLACE', id: RESERVATION_ID, version: 4 },
    visitType: 'BUSINESS',
    siteId: SITE_ID,
    startsAt: '2026-09-20T01:00:00Z',
    endsAt: '2026-09-20T02:00:00Z',
    zoneIds: [ZONE_ID],
    guests: [guest()],
    state,
    version: 2,
    recoveryByGetOnly: state === 'RESULT_UNKNOWN',
    recoveryHref: state === 'RESULT_UNKNOWN' ? `/v1/workplace/visits/${VISIT_ID}` : null,
    timeline: [
      {
        eventId: EVENT_ID,
        eventType: 'VISIT_PREVIEWED',
        state,
        detailCode: null,
        occurredAt: NOW,
      },
    ],
    updatedAt: NOW,
  };
}

function command(state = 'PREVIEWED', kiosk = false) {
  const visit = requesterVisit(state);
  return {
    visit: kiosk
      ? { ...visit, guests: visit.guests.map((item) => ({ ...item, opaqueRef: null })) }
      : visit,
    receipt: {
      commandId: COMMAND_ID,
      visitId: VISIT_ID,
      state: state === 'RESULT_UNKNOWN' ? 'RESULT_UNKNOWN' : 'SUCCEEDED',
      statusHref: `/v1/workplace/visits/${VISIT_ID}`,
      replayed: false,
      correlationId: 'screen-17-test',
      acceptedAt: NOW,
    },
  };
}

function kioskDevice(state = 'READY') {
  return {
    deviceId: DEVICE_ID,
    siteId: SITE_ID,
    policyId: null,
    privacyNoticeVersion: 'v1',
    privacyNoticeAccepted: true,
    lastHeartbeatAt: NOW,
    helpRequested: false,
    state,
    active: true,
    version: 3,
    updatedAt: NOW,
  };
}

function kioskVisit(state = 'READY') {
  return {
    visitId: VISIT_ID,
    maskedLabel: 'K** J**',
    purpose: 'Business visit',
    siteId: SITE_ID,
    startsAt: '2026-09-20T01:00:00Z',
    endsAt: '2026-09-20T02:00:00Z',
    state,
    version: 2,
  };
}

function provider(kind: 'VISITOR' | 'ACCESS', state = 'READY') {
  return {
    kind,
    state,
    configurationVersion: 3,
    observedConfigurationVersion: state === 'READY' ? 3 : null,
    evidenceReference: state === 'READY' ? `${kind.toLowerCase()}-evidence-17` : null,
    lastSuccessAt: state === 'READY' ? NOW : null,
    sourceAt: NOW,
    receivedAt: NOW,
    limitationCode: state === 'READY' ? null : 'PROVIDER_UNVERIFIED',
    manualOwner: 'Site security',
    manualProcedure: 'Confirm with the security desk.',
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

describe('Workplace visitor access contract', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('parses verified preview evidence without promoting an unverified provider', () => {
    const preview = parseWorkplaceVisitPreview({
      previewId: PREVIEW_ID,
      version: 1,
      reservation: { authority: 'WORKPLACE', id: RESERVATION_ID, version: 4 },
      visitType: 'BUSINESS',
      siteId: SITE_ID,
      startsAt: '2026-09-20T01:00:00Z',
      endsAt: '2026-09-20T02:00:00Z',
      zoneIds: [ZONE_ID],
      guestCount: 1,
      approvalRequired: true,
      ndaRequired: false,
      identityVerificationRequired: true,
      minimumCollectionFields: ['maskedLabel', 'purpose'],
      visitorProvider: provider('VISITOR'),
      accessProvider: provider('ACCESS', 'CONFIGURED_UNVERIFIED'),
      eligible: false,
      limitations: ['ACCESS_PROVIDER_UNVERIFIED'],
      expiresAt: '2026-09-18T01:10:00Z',
      generatedAt: NOW,
    });

    expect(preview.accessProvider.state).toBe('CONFIGURED_UNVERIFIED');
    expect(preview.eligible).toBe(false);
    expect(preview.accessProvider.manualOwner).toBe('Site security');
  });

  it('rejects raw personal data and projection-specific privilege leaks', () => {
    expect(() =>
      parseWorkplaceRequesterVisit({ ...requesterVisit(), requesterUserId: 18001 })
    ).toThrow(/requesterUserId/u);
    expect(() =>
      parseWorkplaceRequesterVisit({
        ...requesterVisit(),
        guests: [{ ...guest(), email: 'raw@example.test' }],
      })
    ).toThrow(/email/u);
    expect(() => parseWorkplaceKioskVisit({ ...kioskVisit(), opaqueRef: 'vault://leak' })).toThrow(
      /opaqueRef/u
    );
  });

  it('uses canonical requester and admin reads and preserves RESULT_UNKNOWN recovery fields', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({ items: [requesterVisit('RESULT_UNKNOWN')], generatedAt: NOW })
      )
      .mockResolvedValueOnce(
        response({
          items: [
            {
              visitId: VISIT_ID,
              kind: 'RESULT_UNKNOWN',
              state: 'RESULT_UNKNOWN',
              maskedGuestLabel: 'K** J**',
              siteId: SITE_ID,
              startsAt: '2026-09-20T01:00:00Z',
              version: 2,
              limitationCode: 'PROVIDER_RESULT_UNKNOWN',
              updatedAt: NOW,
            },
          ],
          generatedAt: NOW,
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const requester = await getWorkplaceVisits('WORKPLACE', RESERVATION_ID);
    const admin = await getAdminWorkplaceVisitExceptions();

    expect(requester.items[0]?.recoveryByGetOnly).toBe(true);
    expect(admin.items[0]?.kind).toBe('RESULT_UNKNOWN');
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      `/api/platform/v1/workplace/visits?reservationAuthority=WORKPLACE&reservationId=${RESERVATION_ID}`,
      '/api/platform/v1/admin/workplace/visits/exceptions',
    ]);
  });

  it('keeps a mutation idempotent and sends the explicit command identity', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(response(command(), 202));
    vi.stubGlobal('fetch', fetchMock);

    await createWorkplaceVisit(
      {
        previewId: PREVIEW_ID,
        expectedPreviewVersion: 1,
        guests: [guest()],
        reason: 'Prepare verified visitor access',
        explicitConfirmation: true,
      },
      { idempotencyKey: 'screen-17-create', correlationId: 'screen-17-test' }
    );

    const headers = new Headers((fetchMock.mock.calls[1]?.[1] as RequestInit).headers);
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/platform/v1/workplace/visits');
    expect(headers.get('Idempotency-Key')).toBe('screen-17-create');
    expect(headers.get('X-Correlation-ID')).toBe('screen-17-test');
  });

  it('sends device identity only as kiosk headers and consumes the restricted GET projection', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(kioskDevice()))
      .mockResolvedValueOnce(response(kioskVisit()))
      .mockResolvedValueOnce(response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(response(command('ARRIVED', true)));
    vi.stubGlobal('fetch', fetchMock);
    const auth = { tenantId: '17', deviceIdentitySha256: DEVICE_HASH };

    await getWorkplaceKioskSession(auth);
    const visit = await getWorkplaceKioskVisit(VISIT_ID, auth);
    const result = await arriveWorkplaceKioskVisit(
      VISIT_ID,
      {
        expectedVersion: visit.version,
        reason: 'Visitor confirmed arrival',
        explicitConfirmation: true,
      },
      { idempotencyKey: 'screen-17-arrive' },
      auth
    );

    expect(visit.maskedLabel).toBe('K** J**');
    expect(result.visit.state).toBe('ARRIVED');
    for (const index of [0, 1, 3]) {
      const headers = new Headers((fetchMock.mock.calls[index]?.[1] as RequestInit).headers);
      expect(headers.get('X-DWP-Tenant-ID')).toBe('17');
      expect(headers.get('X-DWP-Device-Identity-SHA256')).toBe(DEVICE_HASH);
    }
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/api/platform/v1/workplace/kiosk/session',
      `/api/platform/v1/workplace/kiosk/visits/${VISIT_ID}`,
      '/api/auth/csrf',
      `/api/platform/v1/workplace/kiosk/visits/${VISIT_ID}:arrive`,
    ]);
  });
});
