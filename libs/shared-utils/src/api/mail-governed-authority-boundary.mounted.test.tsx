import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import { getMailHome } from './mail-api';
import { MailGovernedAuthorityBoundary } from './mail-governed-authority-boundary';

import type { MailGovernedRequestAuthority } from './mail-governed-transport';

let container: HTMLDivElement;
let root: Root;

function response(data: unknown) {
  return new Response(JSON.stringify({ status: 'SUCCESS', data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function RequestOnMount({ onSettled }: { onSettled: (error?: unknown) => void }) {
  useEffect(() => {
    void getMailHome().then(() => onSettled(), onSettled);
  }, [onSettled]);
  return null;
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  resetCsrfToken();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
});

describe('mounted Mail governed authority boundary', () => {
  it('installs secure authority before a descendant effect dispatches', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ accounts: [] }));
    vi.stubGlobal('fetch', fetchMock);
    let settle!: (value: unknown) => void;
    const settled = new Promise((resolve) => {
      settle = resolve;
    });
    const authority: MailGovernedRequestAuthority = {
      mode: 'SECURE',
      rolloutState: '111',
      contextScopeKey: 'scope-a/b',
      expectedDecisionRevision: 'revision-1',
      revalidateAt: '2099-01-01T00:00:00.000Z',
    };

    act(() => {
      root.render(
        <MailGovernedAuthorityBoundary authority={authority}>
          <RequestOnMount onSettled={settle} />
        </MailGovernedAuthorityBoundary>
      );
    });
    await settled;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/platform/v1/mail/home?contextScopeKey=scope-a%2Fb'
    );
    expect(
      new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).get(
        'X-DWP-Expected-Decision-Revision'
      )
    ).toBe('revision-1');
  });

  it('sends nothing when a secure consumer mounts without the boundary integration', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    let settledError: unknown;
    let settle!: () => void;
    const settled = new Promise<void>((resolve) => {
      settle = resolve;
    });

    act(() => {
      root.render(
        <RequestOnMount
          onSettled={(error) => {
            settledError = error;
            settle();
          }}
        />
      );
    });
    await settled;

    expect(settledError).toMatchObject({ code: 'AUTHORITY_MISSING' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
