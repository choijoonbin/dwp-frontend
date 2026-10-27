// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildMessagingContext } from './messaging-context-model';
import { maskMessagingPresence, useBrowserOnlineState } from './messaging-presence-freshness';

import type { MessagingMember, MessagingPerson } from '@dwp-frontend/shared-utils';

function OnlineProbe() {
  const online = useBrowserOnlineState();
  return <span>{online ? 'online' : 'offline'}</span>;
}

function PresenceProbe({ people }: { people: MessagingPerson[] }) {
  const online = useBrowserOnlineState();
  return <span>{maskMessagingPresence(people, online)[0]?.presenceState}</span>;
}

describe('messaging presence freshness', () => {
  let host: HTMLDivElement;
  let root: Root;
  let online: boolean;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    online = true;
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => online,
    });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('reacts immediately to browser offline and online events', async () => {
    await act(async () => root.render(<OnlineProbe />));
    expect(host.textContent).toBe('online');

    online = false;
    await act(async () => window.dispatchEvent(new Event('offline')));
    expect(host.textContent).toBe('offline');

    online = true;
    await act(async () => window.dispatchEvent(new Event('online')));
    expect(host.textContent).toBe('online');
  });

  it('rechecks browser connectivity when a suspended page becomes visible', async () => {
    await act(async () => root.render(<OnlineProbe />));
    expect(host.textContent).toBe('online');

    online = false;
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));

    expect(host.textContent).toBe('offline');
  });

  it('masks cached availability without mutating the query result', () => {
    const cached: MessagingPerson[] = [
      {
        userId: 7,
        emailAddress: 'person@example.com',
        displayName: 'Cached Person',
        presenceState: 'AVAILABLE',
      },
    ];

    const masked = maskMessagingPresence(cached, false);

    expect(masked).toEqual([{ ...cached[0], presenceState: 'UNKNOWN' }]);
    expect(masked).not.toBe(cached);
    expect(cached[0]?.presenceState).toBe('AVAILABLE');
    expect(maskMessagingPresence(cached, true)).toBe(cached);
  });

  it('stops rendering cached AVAILABLE immediately when the browser goes offline', async () => {
    const cached: MessagingPerson[] = [
      {
        userId: 7,
        emailAddress: 'person@example.com',
        displayName: 'Cached Person',
        presenceState: 'AVAILABLE',
      },
    ];
    await act(async () => root.render(<PresenceProbe people={cached} />));
    expect(host.textContent).toBe('AVAILABLE');

    online = false;
    await act(async () => window.dispatchEvent(new Event('offline')));

    expect(host.textContent).toBe('UNKNOWN');
    expect(host.textContent).not.toContain('AVAILABLE');
  });

  it('never counts cached available members as active while offline', () => {
    const members = [
      {
        userId: 7,
        emailAddress: 'person@example.com',
        displayName: 'Cached Person',
        presenceState: 'AVAILABLE',
      },
    ] as MessagingMember[];

    const context = buildMessagingContext([], maskMessagingPresence(members, false));

    expect(context.activeCount).toBe(0);
    expect(context.members[0]?.presenceState).toBe('UNKNOWN');
  });
});
