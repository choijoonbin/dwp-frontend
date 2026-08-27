import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationRuntimeHost } from './notification-runtime-host';

const runtime = vi.hoisted(() => ({
  authenticated: true,
  loading: false,
  permissionsLoaded: true,
  notificationAccess: false,
  identityPlane: 'TENANT' as 'PROVIDER' | 'TENANT',
  roles: [] as string[],
}));

vi.mock('@dwp-frontend/shared-utils/auth/auth-provider', () => ({
  useAuth: () => ({
    isAuthenticated: runtime.authenticated,
    isLoading: runtime.loading,
    user: { identityPlane: runtime.identityPlane, roles: runtime.roles, resourceRoles: [] },
  }),
}));

vi.mock('@dwp-frontend/shared-utils/auth/use-permissions', () => ({
  usePermissions: () => ({
    isLoaded: runtime.permissionsLoaded,
    hasPermission: (resourceKey: string, permissionCode: string) =>
      runtime.notificationAccess &&
      resourceKey === 'APP.NOTIFICATIONS' &&
      permissionCode === 'VIEW',
  }),
}));

vi.mock('./notification-arrival-host', () => ({
  NotificationArrivalHost: () => createElement('div', null, 'notification-arrival-host'),
}));

vi.mock('./notification-live-bridge', () => ({
  NotificationLiveBridge: () => createElement('div', null, 'notification-live-bridge'),
}));

vi.mock('./notification-cache-sync-host', () => ({
  NotificationCacheSyncHost: () => createElement('div', null, 'notification-cache-sync-host'),
}));

describe('NotificationRuntimeHost', () => {
  beforeEach(() => {
    runtime.authenticated = true;
    runtime.loading = false;
    runtime.permissionsLoaded = true;
    runtime.notificationAccess = false;
    runtime.identityPlane = 'TENANT';
    runtime.roles = [];
  });

  it('does not start notification requests without notification view authority', () => {
    expect(renderToStaticMarkup(createElement(NotificationRuntimeHost))).toBe('');
  });

  it('starts both notification runtimes after the exact permission is loaded', () => {
    runtime.notificationAccess = true;

    const markup = renderToStaticMarkup(createElement(NotificationRuntimeHost));

    expect(markup).toContain('notification-arrival-host');
    expect(markup).toContain('notification-cache-sync-host');
    expect(markup).toContain('notification-live-bridge');
  });

  it('never starts the tenant notification runtime for a roleless provider identity', () => {
    runtime.notificationAccess = true;
    runtime.identityPlane = 'PROVIDER';
    runtime.roles = [];

    expect(renderToStaticMarkup(createElement(NotificationRuntimeHost))).toBe('');
  });
});
