import { describe, expect, it } from 'vitest';

import { isHomeNotificationSummaryFresh, resolveHomeAppsWithBadges } from './home-app-badge-policy';

import type { AppNotificationSummary } from '@dwp-frontend/shared-utils';
import type {
  AppEntitlementPermission,
  HomeAppDefinition,
} from '../../components/workspace-composer/app-launchpad-model';

const app: HomeAppDefinition = {
  id: 'approvals',
  name: 'Approvals',
  shortName: 'Approvals',
  description: 'Review approvals',
  groupId: 'start',
  route: '/approvals',
  iconKey: 'approvals',
  tone: '#315FD5',
  resourceKey: 'APP.APPROVALS',
  notificationSourceKey: 'approvals',
};

const hcmApp: HomeAppDefinition = {
  ...app,
  id: 'hcm',
  name: 'HR',
  shortName: 'HR',
  route: '/hr/home',
  iconKey: 'hcm',
  resourceKey: 'APP.HCM',
  notificationSourceKey: 'hcm',
};

const communicationsApp: HomeAppDefinition = {
  ...app,
  id: 'communications',
  name: 'News',
  shortName: 'News',
  route: '/communications',
  iconKey: 'communications',
  resourceKey: 'APP.COMMUNICATIONS',
  notificationSourceKey: 'communications',
};

const permission: AppEntitlementPermission = {
  resourceType: 'APP',
  resourceKey: 'APP.APPROVALS',
  permissionCode: 'VIEW',
  effect: 'ALLOW',
};

const summary = {
  partial: false,
  unavailableSources: [],
  apps: [
    {
      appKey: 'approvals',
      totalUnread: 7,
      actionableUnread: 3,
      urgentUnread: 1,
      lastActivityAt: '2026-08-24T05:00:00Z',
    },
  ],
  changeVersion: '1',
  counterVersion: '1',
  generatedAt: '2026-08-24T05:00:00Z',
} as unknown as AppNotificationSummary;

function resolve(options: { authorized: boolean; healthy: boolean }) {
  return resolveHomeAppsWithBadges({
    apps: [app],
    roles: ['WORKSPACE_MEMBER'],
    permissions: [permission],
    notificationSummary: summary,
    notificationSummaryAuthorized: options.authorized,
    notificationSummaryHealthy: options.healthy,
    notificationSummaryNow: new Date(summary.generatedAt),
  });
}

describe('resolveHomeAppsWithBadges', () => {
  it('accepts only recent, parseable summaries within bounded clock skew', () => {
    const now = new Date('2026-08-24T05:00:30Z');
    expect(isHomeNotificationSummaryFresh(summary, now)).toBe(true);
    expect(
      isHomeNotificationSummaryFresh(
        { ...summary, generatedAt: '2026-08-24T04:59:59Z' } as AppNotificationSummary,
        now
      )
    ).toBe(false);
    expect(
      isHomeNotificationSummaryFresh(
        { ...summary, generatedAt: 'not-a-date' } as AppNotificationSummary,
        now
      )
    ).toBe(false);
  });

  it('keeps structured counters only while the source is authorized and healthy', () => {
    expect(resolve({ authorized: true, healthy: true })[0]).toMatchObject({
      badge: '7',
      badgeMetadata: { totalUnread: 7, actionableUnread: 3, urgentUnread: 1, intent: 'urgent' },
    });
  });

  it.each([
    { authorized: false, healthy: true },
    { authorized: true, healthy: false },
  ])('fails closed for stale cached counters: %o', (options) => {
    expect(resolve(options)[0]).not.toHaveProperty('badge');
    expect(resolve(options)[0]).not.toHaveProperty('badgeMetadata');
  });

  it('does not resurrect a Communications badge without an authorized healthy summary', () => {
    const result = resolveHomeAppsWithBadges({
      apps: [communicationsApp],
      roles: ['WORKSPACE_MEMBER'],
      permissions: [{ ...permission, resourceKey: 'APP.COMMUNICATIONS' }],
      notificationSummary: undefined,
      notificationSummaryAuthorized: false,
      notificationSummaryHealthy: false,
      notificationSummaryNow: new Date(summary.generatedAt),
    });

    expect(result[0]).not.toHaveProperty('badge');
    expect(result[0]).not.toHaveProperty('badgeMetadata');
  });

  it('shows only apps whose read route is actually authorized', () => {
    const base = {
      roles: ['WORKSPACE_MEMBER'],
      notificationSummary: undefined,
      notificationSummaryAuthorized: false,
      notificationSummaryHealthy: false,
      notificationSummaryNow: new Date(summary.generatedAt),
    } as const;

    expect(resolveHomeAppsWithBadges({ ...base, apps: [app], permissions: [] })).toEqual([]);
    expect(
      resolveHomeAppsWithBadges({
        ...base,
        apps: [hcmApp],
        permissions: [],
        legacyRoleFallbackAllowed: true,
      }).map((item) => item.id)
    ).toEqual(['hcm']);
    expect(
      resolveHomeAppsWithBadges({
        ...base,
        apps: [hcmApp],
        roles: [],
        permissions: [{ ...permission, resourceKey: 'APP.HRIS', permissionCode: 'MANAGE' }],
      }).map((item) => item.id)
    ).toEqual(['hcm']);
    expect(
      resolveHomeAppsWithBadges({
        ...base,
        apps: [hcmApp],
        roles: ['HR_ADMIN'],
        permissions: [
          {
            resourceType: 'DATA',
            resourceKey: 'DATA.OTHER',
            permissionCode: 'VIEW',
            effect: 'ALLOW',
          },
        ],
      })
    ).toEqual([]);
  });
});
