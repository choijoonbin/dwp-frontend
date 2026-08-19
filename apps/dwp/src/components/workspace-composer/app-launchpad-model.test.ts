import { describe, expect, it } from 'vitest';

import {
  HOME_APPS,
  addAppToLaunchpadFolder,
  createDefaultLaunchpadLayout,
  createLaunchpadFolder,
  hideLaunchpadApp,
  isAppEntitled,
  moveLaunchpadItemToGroup,
  reconcileLaunchpadLayout,
  removeAppFromLaunchpadFolder,
  renameLaunchpadFolder,
  resolveHomeLaunchpadCatalog,
  restoreLaunchpadApp,
  ungroupLaunchpadFolder,
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

  it('launches employee services in its native product shell', () => {
    const serviceApp = HOME_APPS.find((app) => app.id === 'ref-app-service');

    expect(serviceApp).toMatchObject({
      route: '/services',
      resourceKey: 'APP.EMPLOYEE_SERVICES',
    });
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
    expect(dissolved.groups.work).toEqual(workApps.map((app) => app.id));
  });

  it('removes entitled apps from home without revoking them and restores them later', () => {
    const initial = createDefaultLaunchpadLayout(workApps);
    const hidden = hideLaunchpadApp(initial, 'dwp-ask');

    expect(hidden.groups.work).not.toContain('dwp-ask');
    expect(hidden.hiddenAppIds).toContain('dwp-ask');

    const restored = restoreLaunchpadApp(hidden, workApps[1]!);
    expect(restored.hiddenAppIds).not.toContain('dwp-ask');
    expect(restored.groups.work).toContain('dwp-ask');
  });

  it('ungroups a folder without removing its apps', () => {
    const initial = createDefaultLaunchpadLayout(workApps);
    const grouped = createLaunchpadFolder(
      initial,
      'work',
      'dwp-work',
      'dwp-ask',
      'folder-priority'
    );
    const ungrouped = ungroupLaunchpadFolder(grouped, 'folder-priority');

    expect(ungrouped.folders).toEqual({});
    expect(ungrouped.groups.work.slice(0, 2)).toEqual(['dwp-work', 'dwp-ask']);
  });

  it('moves apps between personalized groups and preserves the placement on reconciliation', () => {
    const initial = createDefaultLaunchpadLayout(HOME_APPS);
    const moved = moveLaunchpadItemToGroup(initial, 'connect', 'services', 'ref-app-mail');

    expect(moved.groups.connect).not.toContain('ref-app-mail');
    expect(moved.groups.services.at(-1)).toBe('ref-app-mail');

    const restored = reconcileLaunchpadLayout(moved, HOME_APPS);
    expect(restored.groups.connect).not.toContain('ref-app-mail');
    expect(restored.groups.services).toContain('ref-app-mail');
  });

  it('creates and moves cross-group folders without reverting apps to catalog groups', () => {
    const initial = createDefaultLaunchpadLayout(HOME_APPS);
    const grouped = createLaunchpadFolder(
      initial,
      'services',
      'ref-app-mail',
      'ref-app-service',
      'folder-people-tools',
      'People tools'
    );
    const expanded = addAppToLaunchpadFolder(grouped, 'dwp-messaging', 'folder-people-tools');
    const moved = moveLaunchpadItemToGroup(expanded, 'services', 'systems', 'folder-people-tools');
    const restored = reconcileLaunchpadLayout(moved, HOME_APPS);

    expect(restored.groups.connect).toEqual(
      HOME_APPS.filter(
        (app) =>
          app.groupId === 'connect' &&
          !restored.folders['folder-people-tools']?.appIds.includes(app.id)
      ).map((app) => app.id)
    );
    expect(restored.groups.systems).toContain('folder-people-tools');
    expect(restored.folders['folder-people-tools']).toMatchObject({
      groupId: 'systems',
      appIds: ['ref-app-mail', 'ref-app-service', 'dwp-messaging'],
    });
  });
});

describe('tenant launchpad policy', () => {
  it('applies localized tenant zones and default app placement before personal layout', () => {
    const catalog = resolveHomeLaunchpadCatalog(
      HOME_APPS,
      {
        schemaVersion: 1,
        groups: [
          {
            groupKey: 'focus',
            labels: { ko: '집중 업무', en: 'Focus' },
            descriptions: { ko: '핵심 업무', en: 'Core work' },
            sortOrder: 10,
            enabled: true,
          },
          {
            groupKey: 'people',
            labels: { ko: '사람과 서비스', en: 'People' },
            descriptions: { ko: '구성원 지원', en: 'People support' },
            sortOrder: 20,
            enabled: true,
          },
        ],
        placements: [
          { resourceKey: 'APP.WORK', groupKey: 'focus', sortOrder: 10 },
          { resourceKey: 'APP.HRIS', groupKey: 'people', sortOrder: 10 },
        ],
      },
      'ko-KR',
      (key) => key
    );

    expect(catalog.groups.map((group) => [group.id, group.name])).toEqual([
      ['focus', '집중 업무'],
      ['people', '사람과 서비스'],
    ]);
    expect(catalog.apps.find((app) => app.resourceKey === 'APP.WORK')?.groupId).toBe('focus');
    expect(catalog.apps.find((app) => app.resourceKey === 'APP.HCM')?.groupId).toBe('people');

    const layout = createDefaultLaunchpadLayout(catalog.apps, catalog.groups);
    expect(layout.groups.focus).toContain('dwp-work');
    expect(layout.groups.people).toContain('ref-app-people');
  });
});
