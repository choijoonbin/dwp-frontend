import { describe, expect, it } from 'vitest';

import {
  HOME_APPS,
  addAppToLaunchpadFolder,
  createDefaultLaunchpadLayout,
  createLaunchpadFolder,
  isAppEntitled,
  reconcileLaunchpadLayout,
  removeAppFromLaunchpadFolder,
  renameLaunchpadFolder,
} from './app-launchpad-model';

describe('personal home app entitlements', () => {
  it('uses role guards when the app permission registry is not seeded', () => {
    const employeeApps = HOME_APPS.filter((app) => isAppEntitled(app, ['EMPLOYEE'], []));
    const adminApps = HOME_APPS.filter((app) => isAppEntitled(app, ['ADMIN'], []));

    expect(employeeApps.some((app) => app.id === 'dwp-admin')).toBe(false);
    expect(adminApps.some((app) => app.id === 'dwp-admin')).toBe(true);
  });

  it('only exposes explicit app grants once app permissions exist', () => {
    const permissions = [
      {
        resourceType: 'APP',
        resourceKey: 'APP.WORK',
        permissionCode: 'VIEW',
        effect: 'ALLOW',
      },
    ];
    const entitled = HOME_APPS.filter((app) => isAppEntitled(app, ['EMPLOYEE'], permissions));

    expect(entitled.map((app) => app.id)).toEqual(['dwp-work']);
  });

  it('gives an explicit deny precedence over an allow', () => {
    const workApp = HOME_APPS.find((app) => app.id === 'dwp-work')!;
    const permissions = [
      {
        resourceType: 'APP',
        resourceKey: 'APP.WORK',
        permissionCode: 'VIEW',
        effect: 'ALLOW',
      },
      {
        resourceType: 'APP',
        resourceKey: 'APP.WORK',
        permissionCode: 'VIEW',
        effect: 'DENY',
      },
    ];

    expect(isAppEntitled(workApp, ['EMPLOYEE'], permissions)).toBe(false);
  });
});

describe('personal home launchpad layout', () => {
  const workApps = HOME_APPS.filter((app) => app.groupId === 'work');

  it('reconciles saved data against the current entitlement set', () => {
    const fullLayout = createDefaultLaunchpadLayout(workApps);
    const folderLayout = createLaunchpadFolder(
      fullLayout,
      'work',
      'dwp-work',
      'dwp-ask',
      'folder-priority',
      'Priority tools'
    );

    const workOnly = reconcileLaunchpadLayout(folderLayout, [workApps[0]!]);
    expect(workOnly.folders).toEqual({});
    expect(workOnly.groups.work).toEqual(['dwp-work']);
  });

  it('supports folder creation, naming, adding, and safe dissolution', () => {
    const initial = createDefaultLaunchpadLayout(workApps);
    const created = createLaunchpadFolder(
      initial,
      'work',
      'dwp-work',
      'dwp-ask',
      'folder-priority'
    );
    const named = renameLaunchpadFolder(created, 'folder-priority', 'Priority tools');
    const expanded = addAppToLaunchpadFolder(named, 'dwp-activity', 'folder-priority');

    expect(expanded.folders['folder-priority']?.appIds).toEqual([
      'dwp-work',
      'dwp-ask',
      'dwp-activity',
    ]);
    expect(expanded.folders['folder-priority']?.name).toBe('Priority tools');

    const reduced = removeAppFromLaunchpadFolder(expanded, 'folder-priority', 'dwp-activity');
    const dissolved = removeAppFromLaunchpadFolder(reduced, 'folder-priority', 'dwp-ask');
    expect(dissolved.folders).toEqual({});
    expect(dissolved.groups.work).toEqual(['dwp-work', 'dwp-ask', 'dwp-activity']);
  });
});
