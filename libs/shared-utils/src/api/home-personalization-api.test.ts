import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  applyHomeComposerProposal,
  createHomeComposerProposal,
  createHomeView,
  getHomeViews,
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

  it('lists only the requested home surface', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    await getHomeViews('workspace-home');

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/platform/v1/home-views?surfaceKey=workspace-home'
    );
  });

  it('creates a view through a retry-safe command', async () => {
    const fetchMock = mutationFetch({ viewId: 'view-1' });
    vi.stubGlobal('fetch', fetchMock);

    await createHomeView(
      { viewKey: 'focus', name: 'Focus', makeDefault: false, layout },
      '11111111-1111-4111-8111-111111111111'
    );

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/platform/v1/home-views');
    expect(new Headers(request.headers).get('Idempotency-Key')).toBe(
      '11111111-1111-4111-8111-111111111111'
    );
    expect(JSON.parse(String(request.body))).toMatchObject({
      viewKey: 'focus',
      makeDefault: false,
    });
  });

  it('stores a device overlay without changing semantic content order', async () => {
    const fetchMock = mutationFetch({ deviceClass: 'MOBILE', viewVersion: 5 });
    vi.stubGlobal('fetch', fetchMock);

    const result = await updateHomeDeviceLayout(
      'view/1',
      'MOBILE',
      { widgetOrder: ['schedule'], widgetSizes: {}, density: 'compact' },
      4,
      2,
      '55555555-5555-4555-8555-555555555555'
    );

    expect(result.viewVersion).toBe(5);

    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/platform/v1/home-views/view%2F1/device-layouts/MOBILE'
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
