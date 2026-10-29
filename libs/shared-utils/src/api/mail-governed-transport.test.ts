import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken, setAuthorizationAccessFailureHandler } from '../axios-instance';
import { createMailFolder, getMailHome } from './mail-api';
import {
  getMailGovernedEventStream,
  registerMailGovernedRequestAuthority,
} from './mail-governed-transport';

import type { AuthorizationAccessFailure } from '../axios-instance';
import type { MailGovernedRequestAuthority } from './mail-governed-transport';

const disposers: Array<() => void> = [];

function register(authority: MailGovernedRequestAuthority) {
  const dispose = registerMailGovernedRequestAuthority(authority);
  disposers.push(dispose);
  return dispose;
}

function response(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify({ status: 'SUCCESS', data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function secure(
  overrides: Partial<Extract<MailGovernedRequestAuthority, { mode: 'SECURE' }>> = {}
): Extract<MailGovernedRequestAuthority, { mode: 'SECURE' }> {
  return {
    mode: 'SECURE',
    rolloutState: '110',
    contextScopeKey: 'scope:mail:personal',
    expectedDecisionRevision: 'mail-revision-1',
    revalidateAt: '2099-01-01T00:00:00.000Z',
    ...overrides,
  };
}

afterEach(() => {
  while (disposers.length) disposers.pop()?.();
  setAuthorizationAccessFailureHandler(null);
  resetCsrfToken();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe.each(['000', '100'] as const)('Mail governed transport rollout %s', (rolloutState) => {
  it('keeps legacy callers byte-compatible without governed query or revision headers', async () => {
    register({ mode: 'LEGACY_COMPATIBILITY', rolloutState });
    const fetchMock = vi.fn().mockResolvedValue(response({ accounts: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await getMailHome({ accountId: 'account-1' });

    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/platform/v1/mail/home?accountId=account-1');
    expect(new Headers(request.headers)).not.toHaveProperty('X-DWP-Expected-Decision-Revision');
  });
});

describe.each(['110', '111'] as const)('Mail governed transport rollout %s', (rolloutState) => {
  it('binds reads and mutations to the selected scope and authority revision', async () => {
    register(secure({ rolloutState }));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ accounts: [] }))
      .mockResolvedValueOnce(response({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(response({ folderId: 'folder-1' }));
    vi.stubGlobal('fetch', fetchMock);

    await getMailHome();
    await createMailFolder({
      accountId: 'account-1',
      displayName: 'Reviewed',
      color: 'BLUE',
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/platform/v1/mail/home?contextScopeKey=scope%3Amail%3Apersonal'
    );
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      '/api/platform/v1/mail/organization/folders?contextScopeKey=scope%3Amail%3Apersonal'
    );
    for (const call of [fetchMock.mock.calls[0], fetchMock.mock.calls[2]]) {
      const headers = new Headers((call?.[1] as RequestInit).headers);
      expect(headers.get('X-DWP-Expected-Decision-Revision')).toBe('mail-revision-1');
    }
  });

  it('binds Mail event streams to the selected scope and authority revision', async () => {
    register(secure({ rolloutState }));
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode('event: mail.changed\ndata: {"cursor":"event-2"}\n\n')
        );
        controller.close();
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    const onMessage = vi.fn();

    await getMailGovernedEventStream('/api/platform/v1/mail/events?after=event-1', { onMessage });

    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      '/api/platform/v1/mail/events?after=event-1&contextScopeKey=scope%3Amail%3Apersonal'
    );
    expect(new Headers(request.headers).get('X-DWP-Expected-Decision-Revision')).toBe(
      'mail-revision-1'
    );
    expect(onMessage).toHaveBeenCalledWith({ event: 'mail.changed', data: { cursor: 'event-2' } });
  });
});

describe('Mail secure authority failures', () => {
  it('does not open a Mail event stream without a mounted authority', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      getMailGovernedEventStream('/api/platform/v1/mail/events', { onMessage: vi.fn() })
    ).rejects.toMatchObject({ code: 'AUTHORITY_MISSING' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed before dispatch when the secure revision is missing', async () => {
    register(secure({ expectedDecisionRevision: undefined }));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(getMailHome()).rejects.toMatchObject({
      code: 'DECISION_REVISION_MISSING',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses exactly the selected member of a multi-scope authority', async () => {
    register(
      secure({
        rolloutState: '111',
        contextScopeKey: 'scope:mail:shared:people',
        eligibleContextScopeKeys: ['scope:mail:personal', 'scope:mail:shared:people'],
      })
    );
    const fetchMock = vi.fn().mockResolvedValue(response({ accounts: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await getMailHome();

    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      'contextScopeKey=scope%3Amail%3Ashared%3Apeople'
    );
    expect(fetchMock.mock.calls[0]?.[0]).not.toContain('scope%3Amail%3Apersonal');
  });

  it('treats a 500-character opaque scope key as data instead of interpreting its format', async () => {
    const contextScopeKey = `scope-a/b${'x'.repeat(491)}`;
    expect(contextScopeKey).toHaveLength(500);
    register(
      secure({
        contextScopeKey,
        eligibleContextScopeKeys: [contextScopeKey],
      })
    );
    const fetchMock = vi.fn().mockResolvedValue(response({ accounts: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await getMailHome();

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `/api/platform/v1/mail/home?contextScopeKey=${encodeURIComponent(contextScopeKey)}`
    );
  });

  it.each([`scope-${'x'.repeat(495)}`, 'scope-a\nb'])(
    'rejects an oversized or control-character scope without dispatching (%j)',
    async (contextScopeKey) => {
      register(secure({ contextScopeKey }));
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      await expect(getMailHome()).rejects.toMatchObject({ code: 'CONTEXT_SCOPE_INVALID' });
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  it('fails closed when the authority lease or selected scope has expired', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-28T05:00:00.000Z'));
    register(
      secure({
        revalidateAt: '2026-10-28T05:01:00.000Z',
        scopeValidUntil: '2026-10-28T04:59:59.000Z',
      })
    );

    await expect(getMailHome()).rejects.toMatchObject({
      code: 'AUTHORITY_EXPIRED',
    });
  });

  it('blocks a mutation whose authority changes while CSRF is loading', async () => {
    const disposeFirst = register(secure());
    let resolveCsrf: ((value: Response) => void) | undefined;
    const csrfPending = new Promise<Response>((resolve) => {
      resolveCsrf = resolve;
    });
    const fetchMock = vi.fn().mockReturnValueOnce(csrfPending);
    vi.stubGlobal('fetch', fetchMock);

    const request = createMailFolder({
      accountId: 'account-1',
      displayName: 'Reviewed',
      color: 'BLUE',
    });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    disposeFirst();
    register(secure({ contextScopeKey: 'scope:mail:shared:people' }));
    resolveCsrf?.(response({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }));

    await expect(request).rejects.toMatchObject({
      code: 'AUTHORITY_CHANGED',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports a stale server revision with the rejected scope for hard revalidation', async () => {
    register(secure());
    const failures: AuthorizationAccessFailure[] = [];
    setAuthorizationAccessFailureHandler((failure) => {
      failures.push(failure);
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ errorCode: 'DECISION_REVISION_CONFLICT' }), {
          status: 409,
          headers: {
            'Content-Type': 'application/json',
            'X-DWP-Decision-Revision': 'mail-revision-2',
          },
        })
      )
    );

    await expect(getMailHome()).rejects.toMatchObject({ status: 409 });
    expect(failures).toEqual([
      {
        status: 409,
        reasonCode: 'DECISION_REVISION_CONFLICT',
        contextScopeKey: 'scope:mail:personal',
        rejectedDecisionRevision: 'mail-revision-1',
        serverDecisionRevision: 'mail-revision-2',
      },
    ]);
  });
});
