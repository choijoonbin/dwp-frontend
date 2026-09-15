import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  HOME_DEVICE_CLASSES,
  applyHomeComposerProposal,
  createHomeComposerProposal,
  createHomeView,
  getHomeDeviceLayouts,
  getHomeViews,
  homeDeviceClassRequestValue,
  resetHomeView,
  restoreHomeViewRevision,
  updateHomeDeviceLayout,
} from './home-personalization-api';

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data }),
  } as Response;
}

function mutationFetch(data: unknown) {
  return vi
    .fn()
    .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
    .mockResolvedValueOnce(jsonResponse(data));
}

const layout = {
  appLayout: null,
  presentation: 'balanced' as const,
  widgets: [{ widgetKey: 'schedule', visible: true }],
};

describe('home personalization API boundary', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('keeps the default Classic read compatible with pre-Wave 1 servers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    await getHomeViews('workspace-home');

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/platform/v1/home-views?surfaceKey=workspace-home'
    );
  });

  it('only sends an explicit Classic mode after the caller selects that contract', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    await getHomeViews('workspace-home', 'CLASSIC');

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/platform/v1/home-views?surfaceKey=workspace-home&modeKey=CLASSIC'
    );
  });

  it('scopes Flow view reads and rejects a cross-mode response', async () => {
    const flowFetch = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal('fetch', flowFetch);

    await getHomeViews('workspace-home', 'FLOW_V1');

    expect(flowFetch.mock.calls[0]?.[0]).toBe(
      '/api/platform/v1/home-views?surfaceKey=workspace-home&modeKey=FLOW_V1'
    );

    const mismatchedFetch = vi.fn().mockResolvedValue(
      jsonResponse([
        {
          viewId: 'classic-view',
          modeKey: 'CLASSIC',
        },
      ])
    );
    vi.stubGlobal('fetch', mismatchedFetch);
    await expect(getHomeViews('workspace-home', 'FLOW_V1')).rejects.toThrow(
      /belongs to CLASSIC, not requested mode FLOW_V1/u
    );
  });

  it('maps a pre-mode response only to Classic for rolling compatibility', async () => {
    const classicFetch = vi.fn().mockResolvedValue(jsonResponse([{ viewId: 'legacy-view' }]));
    vi.stubGlobal('fetch', classicFetch);

    await expect(getHomeViews('workspace-home', 'CLASSIC')).resolves.toEqual([
      { viewId: 'legacy-view', modeKey: 'CLASSIC' },
    ]);

    const flowFetch = vi.fn().mockResolvedValue(jsonResponse([{ viewId: 'legacy-view' }]));
    vi.stubGlobal('fetch', flowFetch);
    await expect(getHomeViews('workspace-home', 'FLOW_V1')).rejects.toThrow(/belongs to CLASSIC/u);
  });

  it('creates a view through a retry-safe command', async () => {
    const fetchMock = mutationFetch({ viewId: 'view-1' });
    vi.stubGlobal('fetch', fetchMock);

    await createHomeView(
      { viewKey: 'focus', name: 'Focus', modeKey: 'FLOW_V1', makeDefault: false, layout },
      '11111111-1111-4111-8111-111111111111'
    );

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/platform/v1/home-views');
    expect(new Headers(request.headers).get('Idempotency-Key')).toBe(
      '11111111-1111-4111-8111-111111111111'
    );
    expect(JSON.parse(String(request.body))).toMatchObject({
      viewKey: 'focus',
      modeKey: 'FLOW_V1',
      makeDefault: false,
    });
  });

  it('omits modeKey from a legacy-compatible create request', async () => {
    const fetchMock = mutationFetch({ viewId: 'view-1' });
    vi.stubGlobal('fetch', fetchMock);

    await createHomeView(
      { viewKey: 'focus', name: 'Focus', makeDefault: false, layout },
      '11111111-1111-4111-8111-111111111111'
    );

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).not.toHaveProperty('modeKey');
  });

  it('stores a device overlay without changing semantic content order', async () => {
    const fetchMock = mutationFetch({ deviceClass: 'MOBILE_COMPACT', viewVersion: 5 });
    vi.stubGlobal('fetch', fetchMock);

    const result = await updateHomeDeviceLayout(
      'view/1',
      'MOBILE_COMPACT',
      { widgetOrder: ['schedule'], widgetSizes: {}, density: 'compact' },
      4,
      2,
      '55555555-5555-4555-8555-555555555555'
    );

    expect(result.viewVersion).toBe(5);

    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/platform/v1/home-views/view%2F1/device-layouts/MOBILE_COMPACT'
    );
    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toEqual({
      overlay: { widgetOrder: ['schedule'], widgetSizes: {}, density: 'compact' },
      viewVersion: 4,
      version: 2,
    });
    expect(
      new Headers((fetchMock.mock.calls[1]?.[1] as RequestInit).headers).get('Idempotency-Key')
    ).toBe('55555555-5555-4555-8555-555555555555');
  });

  it('uses legacy device names until the four-layout capability is advertised', async () => {
    const fetchMock = mutationFetch({ deviceClass: 'MOBILE', viewVersion: 5 });
    vi.stubGlobal('fetch', fetchMock);

    const result = await updateHomeDeviceLayout(
      'view-1',
      homeDeviceClassRequestValue('MOBILE_STANDARD', false),
      { widgetOrder: [], widgetSizes: {}, density: 'compact' },
      4,
      null,
      '55555555-5555-4555-8555-555555555555'
    );

    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/platform/v1/home-views/view-1/device-layouts/MOBILE'
    );
    expect(result.deviceClass).toBe('MOBILE_STANDARD');
    expect(homeDeviceClassRequestValue('DESKTOP_WIDE', false)).toBe('DESKTOP');
    expect(homeDeviceClassRequestValue('DESKTOP_WIDE', true)).toBe('DESKTOP_WIDE');
  });

  it('normalizes legacy device overlays and lets canonical rows win deterministically', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse([
        {
          deviceLayoutId: 'wide-desktop',
          viewId: 'view-1',
          deviceClass: 'DESKTOP_WIDE',
          overlay: { widgetOrder: [], widgetSizes: {}, density: 'comfortable' },
          version: 1,
          viewVersion: 1,
          updatedAt: '2026-09-15T00:00:00Z',
        },
        {
          deviceLayoutId: 'legacy-desktop',
          viewId: 'view-1',
          deviceClass: 'DESKTOP',
          overlay: { widgetOrder: [], widgetSizes: {}, density: 'comfortable' },
          version: 1,
          viewVersion: 1,
          updatedAt: '2026-09-15T00:00:00Z',
        },
        {
          deviceLayoutId: 'canonical-desktop',
          viewId: 'view-1',
          deviceClass: 'DESKTOP_STANDARD',
          overlay: { widgetOrder: ['schedule'], widgetSizes: {}, density: 'compact' },
          version: 2,
          viewVersion: 2,
          updatedAt: '2026-09-15T00:01:00Z',
        },
        {
          deviceLayoutId: 'legacy-mobile',
          viewId: 'view-1',
          deviceClass: 'MOBILE',
          overlay: { widgetOrder: [], widgetSizes: {}, density: 'comfortable' },
          version: 1,
          viewVersion: 1,
          updatedAt: '2026-09-15T00:00:00Z',
        },
        {
          deviceLayoutId: 'compact-mobile',
          viewId: 'view-1',
          deviceClass: 'MOBILE_COMPACT',
          overlay: { widgetOrder: [], widgetSizes: {}, density: 'compact' },
          version: 1,
          viewVersion: 1,
          updatedAt: '2026-09-15T00:00:00Z',
        },
      ])
    );
    vi.stubGlobal('fetch', fetchMock);

    const layouts = await getHomeDeviceLayouts('view-1');

    expect(layouts.map((entry) => entry.deviceClass)).toEqual(HOME_DEVICE_CLASSES);
    expect(layouts[1]?.deviceLayoutId).toBe('canonical-desktop');
    expect(layouts[2]?.deviceLayoutId).toBe('legacy-mobile');
  });

  it('resets a view through the dedicated retry-safe command', async () => {
    const fetchMock = mutationFetch({ viewId: 'view-1', customized: false, version: 5 });
    vi.stubGlobal('fetch', fetchMock);

    const result = await resetHomeView('view/1', 4, '66666666-6666-4666-8666-666666666666');

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/platform/v1/home-views/view%2F1/reset');
    expect(JSON.parse(String(request.body))).toEqual({ version: 4 });
    expect(new Headers(request.headers).get('Idempotency-Key')).toBe(
      '66666666-6666-4666-8666-666666666666'
    );
    expect(result.customized).toBe(false);
  });

  it('restores a revision as a new retry-safe command', async () => {
    const fetchMock = mutationFetch({ viewId: 'view-1', version: 7 });
    vi.stubGlobal('fetch', fetchMock);

    await restoreHomeViewRevision(
      'view-1',
      'revision/3',
      6,
      '22222222-2222-4222-8222-222222222222'
    );

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/platform/v1/home-views/view-1/revisions/revision%2F3/restore'
    );
    expect(new Headers(request.headers).get('Idempotency-Key')).toBe(
      '22222222-2222-4222-8222-222222222222'
    );
  });

  it('keeps AI proposal preview and explicit apply as separate commands', async () => {
    const previewFetch = mutationFetch({ proposalId: 'proposal-1', state: 'PREVIEWED' });
    vi.stubGlobal('fetch', previewFetch);

    await createHomeComposerProposal(
      {
        viewId: 'view-1',
        baseViewVersion: 8,
        reasonCodes: ['FOCUS_TIME'],
        changes: [{ operation: 'MOVE_WIDGET', widgetKey: 'schedule', afterIndex: 1 }],
      },
      '33333333-3333-4333-8333-333333333333'
    );

    expect(previewFetch.mock.calls[1]?.[0]).toBe('/api/platform/v1/home-composer/proposals');

    resetCsrfToken();
    const applyFetch = mutationFetch({ proposalId: 'proposal-1', state: 'APPLIED' });
    vi.stubGlobal('fetch', applyFetch);
    await applyHomeComposerProposal('proposal-1', 8, '44444444-4444-4444-8444-444444444444');

    const applyRequest = applyFetch.mock.calls[1]?.[1] as RequestInit;
    expect(applyFetch.mock.calls[1]?.[0]).toBe(
      '/api/platform/v1/home-composer/proposals/proposal-1/apply'
    );
    expect(new Headers(applyRequest.headers).get('Idempotency-Key')).toBe(
      '44444444-4444-4444-8444-444444444444'
    );
  });
});
