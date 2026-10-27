// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useMessagingHomePresence } from './use-messaging-home-presence';

import type { MessagingHome } from '@dwp-frontend/shared-utils';

const NOW = Date.parse('2026-10-27T07:00:00Z');

function home(): MessagingHome {
  return {
    generatedAt: new Date(NOW).toISOString(),
    presence: {
      authority: 'LIVE',
      evaluatedAt: new Date(NOW).toISOString(),
      leaseTtlSeconds: 75,
      refreshAfterSeconds: 20,
    },
    metrics: {
      unreadConversations: 0,
      mentions: 0,
      spaceChannels: 0,
      directMessages: 0,
      savedItems: 0,
    },
    priority: [],
    spaces: [],
    people: [],
  };
}

function Harness({
  value = home(),
  queryFailed = false,
  dataUpdatedAt,
}: {
  value?: MessagingHome;
  queryFailed?: boolean;
  dataUpdatedAt: number;
}) {
  const presence = useMessagingHomePresence(value, queryFailed, dataUpdatedAt);
  return <output>{presence?.authority}</output>;
}

describe('useMessagingHomePresence', () => {
  let host: HTMLDivElement;
  let root: Root;
  let online: boolean;
  let visible: boolean;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    online = true;
    visible = true;
    vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() =>
      visible ? 'visible' : 'hidden'
    );
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function render(dataUpdatedAt = Date.now()) {
    await act(async () => root.render(<Harness dataUpdatedAt={dataUpdatedAt} />));
  }

  it('masks cached live presence immediately while offline and restores it while the lease is fresh', async () => {
    await render();
    expect(host.textContent).toBe('LIVE');

    online = false;
    await act(async () => window.dispatchEvent(new Event('offline')));
    expect(host.textContent).toBe('UNAVAILABLE');

    online = true;
    await act(async () => window.dispatchEvent(new Event('online')));
    expect(host.textContent).toBe('LIVE');
  });

  it('masks cached live presence when its lease expires without another query transition', async () => {
    await render();

    await act(async () => vi.advanceTimersByTimeAsync(75_001));

    expect(host.textContent).toBe('UNAVAILABLE');
  });

  it('rechecks expiry when a throttled page becomes visible again', async () => {
    await render();
    visible = false;
    vi.setSystemTime(NOW + 80_000);
    visible = true;

    await act(async () => document.dispatchEvent(new Event('visibilitychange')));

    expect(host.textContent).toBe('UNAVAILABLE');
  });

  it.each([
    { label: 'two minutes ahead', skewMs: 120_000 },
    { label: 'two minutes behind', skewMs: -120_000 },
  ])('keeps a fresh lease valid with a client clock $label', async ({ skewMs }) => {
    vi.setSystemTime(NOW + skewMs);
    const dataUpdatedAt = Date.now();
    await render(dataUpdatedAt);
    expect(host.textContent).toBe('LIVE');

    await act(async () => vi.advanceTimersByTimeAsync(74_999));
    expect(host.textContent).toBe('LIVE');

    await act(async () => vi.advanceTimersByTimeAsync(2));
    expect(host.textContent).toBe('UNAVAILABLE');
  });
});
