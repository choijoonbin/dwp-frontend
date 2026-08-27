import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import { getTenantExperiencePreview } from './tenant-experience-preview-api';

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data }),
  } as Response;
}

const tenantExperiencePreviewFixture = {
  contractVersion: 'tenant-experience-preview.v1',
  previewMode: 'TENANT_CONFIGURATION_ONLY',
  generatedAt: '2026-08-26T02:55:00.000Z',
  branding: {
    organizationName: 'SKAX',
    accentColor: '#2457D6',
    logoConfigured: true,
    logoWidth: 160,
    logoHeight: 40,
    version: 3,
  },
  home: {
    headline: 'Work together',
    subheadline: null,
    localizedContent: {},
    defaultLocale: 'ko',
    backgroundConfigured: true,
    backgroundPosition: 'CENTER',
    backgroundFocalX: 50,
    backgroundFocalY: 50,
    mobileBackgroundFocalX: 50,
    mobileBackgroundFocalY: 50,
    contentAlignment: 'LEFT',
    overlayOpacity: 20,
    backgroundWidth: 1920,
    backgroundHeight: 640,
    launchpadConfiguration: {
      schemaVersion: 1,
      groups: [
        {
          groupKey: 'work',
          labels: { ko: '업무', en: 'Work' },
          descriptions: {},
          sortOrder: 1,
          enabled: true,
        },
      ],
      placements: [],
    },
    compositionPolicy: {
      schemaVersion: 3,
      experienceVariant: 'FLOW_V1',
      personalCustomizationEnabled: true,
      governedZones: [
        {
          zoneKey: 'announcements',
          placement: 'CANVAS',
          visible: true,
          size: 'compact',
          height: 'short',
          sortOrder: 20,
        },
      ],
    },
    effectiveExperienceVariant: 'FLOW_V1',
    version: 7,
  },
  excludedData: [
    'USER_PERSONALIZATION',
    'USER_CONTENT',
    'WORKFORCE_DATA',
    'LIVE_ANNOUNCEMENTS',
    'ASSET_LOCATIONS',
    'AUDIT_ACTOR_METADATA',
  ],
};

describe('tenant experience preview API boundary', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('loads the redacted aggregate through the dedicated read-only endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(tenantExperiencePreviewFixture));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    await expect(getTenantExperiencePreview(controller.signal)).resolves.toEqual(
      tenantExperiencePreviewFixture
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/platform/v1/admin/tenant-experience-preview',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
        signal: expect.any(AbortSignal),
      })
    );
  });

  it.each([
    ['unknown field', { unexpectedTenantData: 'must-not-render' }],
    ['unsupported mode', { previewMode: 'LIVE_TENANT' }],
    ['invalid timestamp', { generatedAt: '2026-08-26 02:55' }],
    ['invalid calendar date', { generatedAt: '2026-02-31T02:55:00Z' }],
    [
      'incomplete exclusions',
      { excludedData: tenantExperiencePreviewFixture.excludedData.slice(0, -1) },
    ],
  ])('withholds an invalid %s contract before rendering', async (_label, patch) => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ ...tenantExperiencePreviewFixture, ...patch }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getTenantExperiencePreview()).rejects.toThrow(
      /Invalid tenant-experience-preview\.v1 contract/u
    );
  });

  it('rejects invalid nested enums and presentation bounds', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        ...tenantExperiencePreviewFixture,
        home: {
          ...tenantExperiencePreviewFixture.home,
          backgroundPosition: 'TILED',
          overlayOpacity: 101,
        },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(getTenantExperiencePreview()).rejects.toThrow(/home\.backgroundPosition/u);
  });

  it('propagates React Query cancellation to the in-flight HTTP request', async () => {
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Request aborted', 'AbortError'))
          );
        })
    );
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    const request = getTenantExperiencePreview(controller.signal);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const requestSignal = fetchMock.mock.calls[0]?.[1]?.signal as AbortSignal;

    controller.abort();

    expect(requestSignal.aborted).toBe(true);
    await expect(request).rejects.toBeDefined();
  });
});
