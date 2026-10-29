// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isAppReadEntitled: vi.fn(),
  useMessagingPresenceHeartbeat: vi.fn(),
  usePermissions: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({ useQuery: mocks.useQuery }));

vi.mock('@dwp-frontend/shared-utils', () => ({
  getMessagingPrivacyPreference: vi.fn(),
  isAppReadEntitled: mocks.isAppReadEntitled,
  useAuth: () => ({ user: { tenantId: 7, userId: 42 } }),
  usePermissions: mocks.usePermissions,
}));

vi.mock('react-router-dom', () => ({ Outlet: () => <div>messaging route</div> }));

vi.mock('./use-messaging-presence-heartbeat', () => ({
  useMessagingPresenceHeartbeat: mocks.useMessagingPresenceHeartbeat,
}));

import { MessagingPresenceRouteRuntime } from './messaging-presence-route-runtime';

describe('MessagingPresenceRouteRuntime', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    mocks.isAppReadEntitled.mockReset();
    mocks.useMessagingPresenceHeartbeat.mockReset();
    mocks.usePermissions.mockReset();
    mocks.useQuery.mockReset().mockReturnValue({
      data: { readReceiptsEnabled: true, presenceSharingEnabled: true, version: 1 },
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('starts presence only after an explicit Messaging VIEW entitlement is loaded', async () => {
    const permissions = [
      {
        resourceType: 'APP',
        resourceKey: 'APP.MESSAGING',
        permissionCode: 'VIEW',
        effect: 'ALLOW',
      },
    ];
    mocks.usePermissions.mockReturnValue({ permissions, isLoaded: true });
    mocks.isAppReadEntitled.mockReturnValue(true);

    await act(async () => root.render(<MessagingPresenceRouteRuntime />));

    expect(mocks.isAppReadEntitled).toHaveBeenCalledWith('APP.MESSAGING', permissions);
    expect(mocks.useMessagingPresenceHeartbeat).toHaveBeenCalledWith(true, {
      tenantId: 7,
      userId: 42,
    });
    expect(host.textContent).toContain('messaging route');
  });

  it.each([
    { isLoaded: false, entitled: true },
    { isLoaded: true, entitled: false },
  ])('keeps presence disabled for an unauthorized or unresolved route', async (state) => {
    mocks.usePermissions.mockReturnValue({ permissions: [], isLoaded: state.isLoaded });
    mocks.isAppReadEntitled.mockReturnValue(state.entitled);

    await act(async () => root.render(<MessagingPresenceRouteRuntime />));

    expect(mocks.useMessagingPresenceHeartbeat).toHaveBeenCalledWith(false, {
      tenantId: 7,
      userId: 42,
    });
  });

  it('does not start client heartbeats when the durable presence privacy choice is off', async () => {
    mocks.usePermissions.mockReturnValue({ permissions: [], isLoaded: true });
    mocks.isAppReadEntitled.mockReturnValue(true);
    mocks.useQuery.mockReturnValue({
      data: { readReceiptsEnabled: true, presenceSharingEnabled: false, version: 2 },
    });

    await act(async () => root.render(<MessagingPresenceRouteRuntime />));

    expect(mocks.useMessagingPresenceHeartbeat).toHaveBeenCalledWith(false, {
      tenantId: 7,
      userId: 42,
    });
  });
});
