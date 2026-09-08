import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchSameOriginStaticAsset } from './browser-static-asset';

afterEach(() => vi.unstubAllGlobals());

describe('fetchSameOriginStaticAsset', () => {
  it('uses a credential-free, redirect-rejecting fetch for a canonical asset URL', async () => {
    vi.stubGlobal('location', { origin: 'https://dwp.example' });
    const response = new Response('verified');
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetchMock);
    const signal = new AbortController().signal;

    await expect(
      fetchSameOriginStaticAsset('https://dwp.example/assets/dwp/meetings/background.wasm', signal)
    ).resolves.toBe(response);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://dwp.example/assets/dwp/meetings/background.wasm',
      {
        signal,
        credentials: 'omit',
        redirect: 'error',
        mode: 'same-origin',
        cache: 'force-cache',
      }
    );
  });

  it.each([
    'https://cdn.example/background.wasm',
    '/api/meetings/v1/background.wasm',
    '/assets/background.wasm?revision=untrusted',
    '/assets/background.wasm#untrusted',
  ])('rejects non-canonical asset URL %s before network access', async (href) => {
    vi.stubGlobal('location', { origin: 'https://dwp.example' });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchSameOriginStaticAsset(href, new AbortController().signal)).rejects.toThrow(
      'Static assets must use a canonical same-origin /assets/ URL.'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
