// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mailCursorStorageKey, MailLiveInvalidationBridge } from './mail-live-invalidation';
import { MailGovernedAuthorityLeaseProvider } from './mail-governed-authority-lease';

import type { Root } from 'react-dom/client';
import type { EventStreamConfig } from '@dwp-frontend/shared-utils';
import type * as SharedUtilsModule from '@dwp-frontend/shared-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedUtilsModule>()),
  getTenantId: () => 'tenant-1',
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: { userId: 99, tenantId: 1 },
  }),
}));

const mailEvent = {
  sequence: 8,
  type: 'THREAD_UPDATED',
  threadId: '40000000-0000-4000-8000-000000000008',
  occurredAt: '2026-10-28T10:00:00.000Z',
};

const secureAuthority = (revision: string, expiresAt: string) =>
  ({
    mode: 'SECURE',
    rolloutState: '111',
    contextScopeKey: 'mail-scope',
    expectedDecisionRevision: revision,
    revalidateAt: expiresAt,
    scopeValidUntil: null,
    eligibleContextScopeKeys: ['mail-scope'],
  }) as const;

describe('MailLiveInvalidationBridge', () => {
  let host: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-28T10:00:00.000Z'));
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
    window.sessionStorage.clear();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient.clear();
    host.remove();
    vi.useRealTimers();
  });

  it('restores its cursor, coalesces events, polls when not live, and pauses while hidden', async () => {
    const requests: Array<{ url: string; config: EventStreamConfig }> = [];
    const subscribe = vi.fn((url: string, config: EventStreamConfig) => {
      requests.push({ url, config });
      return new Promise<void>((resolve) => {
        config.signal?.addEventListener('abort', () => resolve(), { once: true });
      });
    });
    const invalidate = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockResolvedValue(undefined as never);
    window.sessionStorage.setItem(mailCursorStorageKey('tenant-1', 99), '7');

    await act(async () =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <MailLiveInvalidationBridge subscribe={subscribe} pollIntervalMs={30_000} />
        </QueryClientProvider>
      )
    );

    expect(requests[0]?.url).toBe('/api/platform/v1/mail/events?after=7');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_250);
    });
    expect(invalidate).toHaveBeenCalledTimes(1);

    await act(async () => {
      requests[0]?.config.onOpen?.();
      requests[0]?.config.onMessage({ event: 'mail', data: mailEvent });
      requests[0]?.config.onMessage({ event: 'mail', data: { ...mailEvent, sequence: 9 } });
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(window.sessionStorage.getItem(mailCursorStorageKey('tenant-1', 99))).toBe('9');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
      requests[0]?.config.onMessage({ event: 'message', data: null });
      await vi.advanceTimersByTimeAsync(14_000);
    });
    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(requests[0]?.config.signal?.aborted).toBe(false);

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    expect(requests[0]?.config.signal?.aborted).toBe(true);
  });

  it('aborts a quiet stream and an expired secure lease, then reconnects only after renewal', async () => {
    const requests: Array<{ url: string; config: EventStreamConfig }> = [];
    const subscribe = vi.fn((url: string, config: EventStreamConfig) => {
      requests.push({ url, config });
      return new Promise<void>((resolve) => {
        config.signal?.addEventListener('abort', () => resolve(), { once: true });
      });
    });
    const renderBridge = async (revision: string, expiresAt: string) =>
      act(async () =>
        root.render(
          <QueryClientProvider client={queryClient}>
            <MailGovernedAuthorityLeaseProvider authority={secureAuthority(revision, expiresAt)}>
              <MailLiveInvalidationBridge subscribe={subscribe} heartbeatTimeoutMs={1_000} />
            </MailGovernedAuthorityLeaseProvider>
          </QueryClientProvider>
        )
      );

    await renderBridge('revision-1', '2026-10-28T10:00:05.000Z');
    await act(async () => requests[0]?.config.onOpen?.());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
      requests[0]?.config.onMessage({ event: 'message', data: null });
      await vi.advanceTimersByTimeAsync(900);
    });
    expect(requests[0]?.config.signal?.aborted).toBe(false);

    await act(async () => vi.advanceTimersByTimeAsync(100));
    expect(requests[0]?.config.signal?.aborted).toBe(true);

    await act(async () => vi.advanceTimersByTimeAsync(3_100));
    expect(requests).toHaveLength(2);
    await act(async () => requests[1]?.config.onOpen?.());
    await act(async () => vi.advanceTimersByTimeAsync(100));
    expect(requests[1]?.config.signal?.aborted).toBe(true);

    await renderBridge('revision-2', '2026-10-28T10:01:00.000Z');
    expect(requests).toHaveLength(3);
    expect(requests[2]?.config.signal?.aborted).toBe(false);
  });

  it('drops an event that races the exact secure-authority expiry instant', async () => {
    const requests: Array<{ url: string; config: EventStreamConfig }> = [];
    const subscribe = vi.fn((url: string, config: EventStreamConfig) => {
      requests.push({ url, config });
      return new Promise<void>((resolve) => {
        config.signal?.addEventListener('abort', () => resolve(), { once: true });
      });
    });
    const invalidate = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockResolvedValue(undefined as never);

    await act(async () =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <MailGovernedAuthorityLeaseProvider
            authority={secureAuthority('revision-1', '2026-10-28T10:00:05.000Z')}
          >
            <MailLiveInvalidationBridge subscribe={subscribe} />
          </MailGovernedAuthorityLeaseProvider>
        </QueryClientProvider>
      )
    );
    await act(async () => requests[0]?.config.onOpen?.());

    vi.setSystemTime(new Date('2026-10-28T10:00:05.000Z'));
    await act(async () => {
      requests[0]?.config.onMessage({ event: 'mail', data: mailEvent });
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(requests[0]?.config.signal?.aborted).toBe(true);
    expect(invalidate).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(mailCursorStorageKey('tenant-1', 99))).toBeNull();
  });
});
