import { describe, expect, it } from 'vitest';

import {
  HOME_APP_GROUPS,
  HOME_APPS,
  addAppToLaunchpadFolder,
  applyHomeAppNotificationBadges,
  canonicalizePersistedLaunchpadLayout,
  createDefaultLaunchpadLayout,
  createLaunchpadFolder,
  hideLaunchpadApp,
  isAppEntitled,
  moveLaunchpadItem,
  moveLaunchpadItemToGroup,
  mergeEntitledLaunchpadProjection,
  placeLaunchpadApp,
  reapplyEntitledLaunchpadProjection,
  reconcileLaunchpadLayout,
  removeAppFromLaunchpadFolder,
  renameLaunchpadFolder,
  resolveHomeLaunchpadCatalog,
  restoreLaunchpadApp,
  ungroupLaunchpadFolder,
} from './app-launchpad-model';

describe('personal home app entitlements', () => {
  it('launches Workplace at its home instead of the space discovery screen', () => {
    expect(HOME_APPS.find((app) => app.id === 'dwp-rooms')).toMatchObject({
      route: '/workplace/home',
      resourceKey: 'APP.WORKPLACE',
    });
  });

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

  it('requires the verified legacy-model signal before a role can expose HCM', () => {
    const hcm = HOME_APPS.find((app) => app.resourceKey === 'APP.HCM')!;

    expect(isAppEntitled(hcm, ['WORKSPACE_MEMBER'], [])).toBe(false);
    expect(isAppEntitled(hcm, ['WORKSPACE_MEMBER'], [], true)).toBe(true);
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

describe('home app notification badges', () => {
  it('uses explicit owner keys, caps the label, and clears unsupported static values', () => {
    const apps = HOME_APPS.map((app) => ({ ...app, badge: '9' }));
    const badged = applyHomeAppNotificationBadges(
      apps,
      new Map([
        ['approvals', 120],
        ['messaging', 2],
        ['communications', 4],
      ])
    );

    expect(badged.find((app) => app.id === 'dwp-approvals')?.badge).toBe('99+');
    expect(badged.find((app) => app.id === 'dwp-approvals')?.badgeMetadata).toEqual({
      totalUnread: 120,
      actionableUnread: 0,
      urgentUnread: 0,
      intent: 'unread',
      accessibleLabel: '120 unread notifications',
    });
    expect(badged.find((app) => app.id === 'dwp-messaging')?.badge).toBe('2');
    expect(badged.find((app) => app.id === 'dwp-communications')?.badge).toBe('4');
    expect(badged.find((app) => app.id === 'dwp-work')?.badge).toBeUndefined();
  });

  it('retains urgent and actionable semantics from structured counters', () => {
    const badged = applyHomeAppNotificationBadges(
      HOME_APPS,
      new Map([
        ['approvals', { totalUnread: 120, actionableUnread: 7, urgentUnread: 2 }],
        ['messaging', { totalUnread: 4, actionableUnread: 1, urgentUnread: 0 }],
        ['communications', { totalUnread: 3, actionableUnread: 0, urgentUnread: 0 }],
      ])
    );

    expect(badged.find((app) => app.id === 'dwp-approvals')).toMatchObject({
      badge: '99+',
      badgeMetadata: {
        totalUnread: 120,
        actionableUnread: 7,
        urgentUnread: 2,
        intent: 'urgent',
        accessibleLabel: '120 unread notifications, 7 actionable, 2 urgent',
      },
    });
    expect(badged.find((app) => app.id === 'dwp-messaging')?.badgeMetadata?.intent).toBe(
      'actionable'
    );
    expect(badged.find((app) => app.id === 'dwp-communications')?.badgeMetadata?.intent).toBe(
      'unread'
    );
  });

  it('keeps verified app counters from a partial summary and clears only missing apps', () => {
    const approval = HOME_APPS.find((app) => app.id === 'dwp-approvals')!;
    const messaging = HOME_APPS.find((app) => app.id === 'dwp-messaging')!;
    const badged = applyHomeAppNotificationBadges(
      [
        { ...approval, badge: '7' },
        {
          ...messaging,
          badge: '9',
          badgeMetadata: {
            totalUnread: 9,
            actionableUnread: 2,
            urgentUnread: 1,
            intent: 'urgent',
            accessibleLabel: 'stale value',
          },
        },
      ],
      new Map([['approvals', { totalUnread: 5, actionableUnread: 3, urgentUnread: 1 }]])
    );

    expect(badged[0]).toMatchObject({
      badge: '5',
      badgeMetadata: {
        totalUnread: 5,
        actionableUnread: 3,
        urgentUnread: 1,
        intent: 'urgent',
      },
    });
    expect(badged[1]?.badge).toBeUndefined();
    expect(badged[1]?.badgeMetadata).toBeUndefined();
  });

  it('fails closed when notification values are unavailable', () => {
    const approval = HOME_APPS.find((app) => app.id === 'dwp-approvals')!;
    const result = applyHomeAppNotificationBadges(
      [
        {
          ...approval,
          badge: '7',
          badgeMetadata: {
            totalUnread: 7,
            actionableUnread: 1,
            urgentUnread: 0,
            intent: 'actionable',
            accessibleLabel: 'stale value',
          },
        },
      ],
      null
    )[0];

    expect(result?.badge).toBeUndefined();
    expect(result?.badgeMetadata).toBeUndefined();
  });
});

describe('personal home launchpad layout', () => {
  const workApps = HOME_APPS.filter((app) => app.groupId === 'work');
  const mixedFolderApps = HOME_APPS.filter((app) =>
    ['dwp-work', 'dwp-ask', 'dwp-activity', 'dwp-communications'].includes(app.id)
  );
  const mixedFolderCanonical = () =>
    canonicalizePersistedLaunchpadLayout(
      {
        version: 1,
        groups: {
          work: ['future-before', 'folder-mixed', 'future-middle', 'dwp-activity', 'future-after'],
          connect: ['dwp-communications'],
        },
        folders: {
          'folder-mixed': {
            id: 'folder-mixed',
            name: 'Mixed tools',
            groupId: 'work',
            appIds: ['dwp-work', 'future-folder', 'dwp-ask'],
          },
        },
        hiddenAppIds: [],
      },
      mixedFolderApps,
      HOME_APP_GROUPS
    );

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

  it('preserves revoked apps and mixed folders through unrelated saves', () => {
    const apps = HOME_APPS.filter((app) => ['dwp-work', 'dwp-approvals'].includes(app.id));
    const canonical = createLaunchpadFolder(
      createDefaultLaunchpadLayout(apps),
      'work',
      'dwp-work',
      'dwp-approvals',
      'folder-critical',
      'Critical work'
    );
    const entitled = apps.filter((app) => app.id === 'dwp-work');
    const projection = reconcileLaunchpadLayout(canonical, entitled);

    const saved = mergeEntitledLaunchpadProjection(canonical, projection, projection, entitled);

    expect(saved).toEqual(canonical);
    expect(reconcileLaunchpadLayout(saved, apps)).toEqual(canonical);
  });

  it('merges Dock edits while retaining unauthorized canonical placement', () => {
    const apps = HOME_APPS.filter((app) =>
      ['dwp-work', 'dwp-approvals', 'dwp-activity'].includes(app.id)
    );
    const canonical = createLaunchpadFolder(
      createDefaultLaunchpadLayout(apps),
      'work',
      'dwp-work',
      'dwp-approvals',
      'folder-critical',
      'Critical work'
    );
    const entitled = apps.filter((app) => app.id !== 'dwp-approvals');
    const projection = reconcileLaunchpadLayout(canonical, entitled);
    const edited = hideLaunchpadApp(projection, 'dwp-activity');
    const saved = mergeEntitledLaunchpadProjection(canonical, projection, edited, entitled);

    expect(saved.folders['folder-critical']).toMatchObject({
      name: 'Critical work',
      appIds: ['dwp-work', 'dwp-approvals'],
    });
    expect(saved.hiddenAppIds).toContain('dwp-activity');
    expect(reconcileLaunchpadLayout(saved, apps).folders['folder-critical']?.appIds).toEqual([
      'dwp-work',
      'dwp-approvals',
    ]);
  });

  it('round-trips unknown apps, groups, folders, and hidden entries on unrelated saves', () => {
    const apps = HOME_APPS.filter((app) =>
      ['dwp-work', 'dwp-ask', 'dwp-activity', 'dwp-approvals'].includes(app.id)
    );
    const persisted = {
      version: 1 as const,
      groups: {
        work: ['dwp-activity', 'future-top', 'mixed-bundle'],
        future: ['future-standalone', 'future-bundle', 'dwp-approvals'],
      },
      folders: {
        'mixed-bundle': {
          id: 'mixed-bundle',
          name: 'Mixed tools',
          groupId: 'work',
          appIds: ['dwp-work', 'future-mixed'],
        },
        'future-bundle': {
          id: 'future-bundle',
          name: 'Future tools',
          groupId: 'future',
          appIds: ['dwp-ask', 'future-folder-app'],
        },
      },
      hiddenAppIds: ['future-hidden'],
    };
    const canonical = canonicalizePersistedLaunchpadLayout(persisted, apps, HOME_APP_GROUPS);
    const projection = reconcileLaunchpadLayout(canonical, apps);

    expect(canonical).toEqual(persisted);
    expect(mergeEntitledLaunchpadProjection(canonical, projection, projection, apps)).toEqual(
      persisted
    );
  });

  it('preserves backend-valid identifiers that collide with object prototype names', () => {
    const persisted = {
      version: 1 as const,
      groups: { future: ['__proto__'] },
      folders: Object.fromEntries([
        [
          '__proto__',
          {
            id: '__proto__',
            name: 'Future tools',
            groupId: 'future',
            appIds: ['future-a', 'future-b'],
          },
        ],
      ]),
      hiddenAppIds: ['constructor'],
    };
    const canonical = canonicalizePersistedLaunchpadLayout(persisted, [], HOME_APP_GROUPS);

    expect(Object.hasOwn(canonical.folders, '__proto__')).toBe(true);
    expect(canonical).toEqual(persisted);
  });

  it('keeps dormant future placements while applying a Dock edit elsewhere', () => {
    const apps = HOME_APPS.filter((app) =>
      ['dwp-work', 'dwp-ask', 'dwp-activity', 'dwp-approvals'].includes(app.id)
    );
    const canonical = canonicalizePersistedLaunchpadLayout(
      {
        version: 1,
        groups: {
          work: ['dwp-activity', 'future-top', 'mixed-bundle'],
          future: ['future-standalone', 'future-bundle', 'dwp-approvals'],
        },
        folders: {
          'mixed-bundle': {
            id: 'mixed-bundle',
            name: 'Mixed tools',
            groupId: 'work',
            appIds: ['dwp-work', 'future-mixed'],
          },
          'future-bundle': {
            id: 'future-bundle',
            name: 'Future tools',
            groupId: 'future',
            appIds: ['dwp-ask', 'future-folder-app'],
          },
        },
        hiddenAppIds: ['future-hidden'],
      },
      apps,
      HOME_APP_GROUPS
    );
    const projection = reconcileLaunchpadLayout(canonical, apps);
    const edited = hideLaunchpadApp(projection, 'dwp-activity');
    const saved = mergeEntitledLaunchpadProjection(canonical, projection, edited, apps);

    expect(saved.groups.work).toEqual(['future-top', 'mixed-bundle']);
    expect(saved.groups.future).toEqual(['future-standalone', 'future-bundle', 'dwp-approvals']);
    expect(saved.folders).toEqual(canonical.folders);
    expect(saved.hiddenAppIds).toEqual(['future-hidden', 'dwp-activity']);
    expect(canonicalizePersistedLaunchpadLayout(saved, apps, HOME_APP_GROUPS)).toEqual(saved);
  });

  it('keeps interleaved future tokens anchored when another group changes', () => {
    const apps = HOME_APPS.filter((app) =>
      ['dwp-work', 'dwp-activity', 'dwp-communications'].includes(app.id)
    );
    const canonical = canonicalizePersistedLaunchpadLayout(
      {
        version: 1,
        groups: {
          work: ['future-a', 'dwp-work', 'future-b', 'dwp-activity'],
          connect: ['dwp-communications'],
        },
        folders: {},
        hiddenAppIds: [],
      },
      apps,
      HOME_APP_GROUPS
    );
    const projection = reconcileLaunchpadLayout(canonical, apps);
    const edited = hideLaunchpadApp(projection, 'dwp-communications');
    const saved = mergeEntitledLaunchpadProjection(canonical, projection, edited, apps);

    expect(saved.groups.work).toEqual(['future-a', 'dwp-work', 'future-b', 'dwp-activity']);
    expect(saved.hiddenAppIds).toEqual(['dwp-communications']);
  });

  it('atomically restores a locally edited folder after a concurrent dissolution', () => {
    const apps = HOME_APPS.filter((app) =>
      ['dwp-work', 'dwp-ask', 'dwp-activity'].includes(app.id)
    );
    const base = {
      version: 1 as const,
      groups: { work: ['focus-folder', 'dwp-activity'] },
      folders: {
        'focus-folder': {
          id: 'focus-folder',
          name: 'Focus',
          groupId: 'work',
          appIds: ['dwp-work', 'dwp-ask'],
        },
      },
      hiddenAppIds: [],
    };
    const edited = {
      ...base,
      folders: {
        'focus-folder': {
          ...base.folders['focus-folder'],
          appIds: ['dwp-ask', 'dwp-work'],
        },
      },
    };
    const latest = {
      version: 1 as const,
      groups: { work: ['dwp-work', 'dwp-ask', 'dwp-activity'] },
      folders: {},
      hiddenAppIds: [],
    };

    const saved = reapplyEntitledLaunchpadProjection(latest, base, edited, apps);

    expect(saved.groups.work).toEqual(['focus-folder', 'dwp-activity']);
    expect(saved.folders['focus-folder']?.appIds).toEqual(['dwp-ask', 'dwp-work']);
    expect(canonicalizePersistedLaunchpadLayout(saved, apps, HOME_APP_GROUPS)).toEqual(saved);
  });

  it('atomically restores unchanged members when a local folder addition conflicts with dissolution', () => {
    const apps = HOME_APPS.filter((app) =>
      ['dwp-work', 'dwp-ask', 'dwp-activity'].includes(app.id)
    );
    const base = {
      version: 1 as const,
      groups: { work: ['focus-folder', 'dwp-activity'] },
      folders: {
        'focus-folder': {
          id: 'focus-folder',
          name: 'Focus',
          groupId: 'work',
          appIds: ['dwp-work', 'dwp-ask'],
        },
      },
      hiddenAppIds: [],
    };
    const edited = {
      ...base,
      groups: { work: ['focus-folder'] },
      folders: {
        'focus-folder': {
          ...base.folders['focus-folder'],
          appIds: ['dwp-work', 'dwp-ask', 'dwp-activity'],
        },
      },
    };
    const latest = {
      version: 1 as const,
      groups: { work: ['dwp-work', 'dwp-ask', 'dwp-activity'] },
      folders: {},
      hiddenAppIds: [],
    };

    const saved = reapplyEntitledLaunchpadProjection(latest, base, edited, apps);

    expect(saved.groups.work).toEqual(['focus-folder']);
    expect(saved.folders['focus-folder']?.appIds).toEqual(['dwp-work', 'dwp-ask', 'dwp-activity']);
    expect(canonicalizePersistedLaunchpadLayout(saved, apps, HOME_APP_GROUPS)).toEqual(saved);
  });

  it('atomically restores a local folder reorder after a concurrent dissolution', () => {
    const apps = HOME_APPS.filter((app) =>
      ['dwp-work', 'dwp-ask', 'dwp-activity'].includes(app.id)
    );
    const base = {
      version: 1 as const,
      groups: { work: ['focus-folder', 'dwp-activity'] },
      folders: {
        'focus-folder': {
          id: 'focus-folder',
          name: 'Focus',
          groupId: 'work',
          appIds: ['dwp-work', 'dwp-ask'],
        },
      },
      hiddenAppIds: [],
    };
    const edited = {
      ...base,
      groups: { work: ['dwp-activity', 'focus-folder'] },
    };
    const latest = {
      version: 1 as const,
      groups: { work: ['dwp-work', 'dwp-ask', 'dwp-activity'] },
      folders: {},
      hiddenAppIds: [],
    };

    const saved = reapplyEntitledLaunchpadProjection(latest, base, edited, apps);

    expect(saved.groups.work).toEqual(['dwp-activity', 'focus-folder']);
    expect(saved.folders['focus-folder']?.appIds).toEqual(['dwp-work', 'dwp-ask']);
    expect(canonicalizePersistedLaunchpadLayout(saved, apps, HOME_APP_GROUPS)).toEqual(saved);
  });

  it('keeps folder metadata bound to the locally chosen token placement', () => {
    const apps = HOME_APPS.filter((app) =>
      ['dwp-work', 'dwp-ask', 'dwp-activity'].includes(app.id)
    );
    const base = {
      version: 1 as const,
      groups: { work: ['focus-folder', 'dwp-activity'], connect: [] },
      folders: {
        'focus-folder': {
          id: 'focus-folder',
          name: 'Focus',
          groupId: 'work',
          appIds: ['dwp-work', 'dwp-ask'],
        },
      },
      hiddenAppIds: [],
    };
    const edited = {
      ...base,
      groups: { work: ['dwp-activity', 'focus-folder'], connect: [] },
    };
    const latest = {
      ...base,
      groups: { work: ['dwp-activity'], connect: ['focus-folder'] },
      folders: {
        'focus-folder': {
          ...base.folders['focus-folder'],
          groupId: 'connect',
        },
      },
    };

    const saved = reapplyEntitledLaunchpadProjection(latest, base, edited, apps);

    expect(saved.groups).toEqual({ work: ['dwp-activity', 'focus-folder'], connect: [] });
    expect(saved.folders['focus-folder']?.groupId).toBe('work');
    expect(canonicalizePersistedLaunchpadLayout(saved, apps, HOME_APP_GROUPS)).toEqual(saved);
  });

  it('keeps the latest placement when entitlement loss makes local folder replay invalid', () => {
    const apps = HOME_APPS.filter((app) => app.id === 'dwp-ask');
    const base = {
      version: 1 as const,
      groups: { work: ['focus-folder'] },
      folders: {
        'focus-folder': {
          id: 'focus-folder',
          name: 'Focus',
          groupId: 'work',
          appIds: ['dwp-work', 'dwp-ask'],
        },
      },
      hiddenAppIds: [],
    };
    const edited = {
      ...base,
      folders: {
        'focus-folder': {
          ...base.folders['focus-folder'],
          name: 'My focus',
        },
      },
    };
    const latest = {
      version: 1 as const,
      groups: { work: ['dwp-ask'] },
      folders: {},
      hiddenAppIds: [],
    };

    const saved = reapplyEntitledLaunchpadProjection(latest, base, edited, apps);

    expect(saved).toEqual(latest);
    expect(canonicalizePersistedLaunchpadLayout(saved, apps, HOME_APP_GROUPS)).toEqual(saved);
  });

  it('keeps an independent local hide when entitlement loss prevents folder replay', () => {
    const apps = HOME_APPS.filter((app) => ['dwp-ask', 'dwp-activity'].includes(app.id));
    const base = {
      version: 1 as const,
      groups: { work: ['focus-folder'] },
      folders: {
        'focus-folder': {
          id: 'focus-folder',
          name: 'Focus',
          groupId: 'work',
          appIds: ['dwp-work', 'dwp-ask', 'dwp-activity'],
        },
      },
      hiddenAppIds: [],
    };
    const edited = {
      ...base,
      folders: {
        'focus-folder': {
          ...base.folders['focus-folder'],
          appIds: ['dwp-work', 'dwp-ask'],
        },
      },
      hiddenAppIds: ['dwp-activity'],
    };
    const latest = {
      version: 1 as const,
      groups: { work: ['dwp-ask', 'dwp-activity'] },
      folders: {},
      hiddenAppIds: [],
    };

    const saved = reapplyEntitledLaunchpadProjection(latest, base, edited, apps);

    expect(saved).toEqual({
      version: 1,
      groups: { work: ['dwp-ask'] },
      folders: {},
      hiddenAppIds: ['dwp-activity'],
    });
    expect(canonicalizePersistedLaunchpadLayout(saved, apps, HOME_APP_GROUPS)).toEqual(saved);
  });

  it('keeps the latest placement when entitlement loss invalidates a new local folder', () => {
    const apps = HOME_APPS.filter((app) => app.id === 'dwp-ask');
    const base = {
      version: 1 as const,
      groups: { work: ['dwp-work', 'dwp-ask'] },
      folders: {},
      hiddenAppIds: [],
    };
    const edited = {
      version: 1 as const,
      groups: { work: ['focus-folder'] },
      folders: {
        'focus-folder': {
          id: 'focus-folder',
          name: 'Focus',
          groupId: 'work',
          appIds: ['dwp-work', 'dwp-ask'],
        },
      },
      hiddenAppIds: [],
    };
    const latest = {
      version: 1 as const,
      groups: { work: ['dwp-ask'] },
      folders: {},
      hiddenAppIds: [],
    };

    const saved = reapplyEntitledLaunchpadProjection(latest, base, edited, apps);

    expect(saved).toEqual(latest);
    expect(canonicalizePersistedLaunchpadLayout(saved, apps, HOME_APP_GROUPS)).toEqual(saved);
  });

  it('persists a same-group reorder for an app projected from a future group', () => {
    const apps = HOME_APPS.filter((app) => ['dwp-work', 'dwp-activity'].includes(app.id));
    const canonical = canonicalizePersistedLaunchpadLayout(
      {
        version: 1,
        groups: {
          work: ['dwp-activity'],
          future: ['future-a', 'dwp-work', 'future-b'],
        },
        folders: {},
        hiddenAppIds: [],
      },
      apps,
      HOME_APP_GROUPS
    );
    const projection = reconcileLaunchpadLayout(canonical, apps);
    const edited = {
      ...projection,
      groups: { ...projection.groups, work: ['dwp-work', 'dwp-activity'] },
    };
    const saved = mergeEntitledLaunchpadProjection(canonical, projection, edited, apps);

    expect(saved.groups.future).toEqual(['future-a', 'future-b']);
    expect(saved.groups.work).toEqual(['dwp-work', 'dwp-activity']);
    expect(reconcileLaunchpadLayout(saved, apps).groups.work).toEqual(['dwp-work', 'dwp-activity']);
  });

  it('merges mixed-folder rename, member reorder, and add around dormant anchors', () => {
    const canonical = mixedFolderCanonical();
    const projection = reconcileLaunchpadLayout(canonical, mixedFolderApps);
    const renamed = renameLaunchpadFolder(projection, 'folder-mixed', 'My daily tools');
    const expanded = addAppToLaunchpadFolder(renamed, 'dwp-activity', 'folder-mixed');
    const edited = {
      ...expanded,
      folders: {
        ...expanded.folders,
        'folder-mixed': {
          ...expanded.folders['folder-mixed']!,
          appIds: ['dwp-ask', 'dwp-work', 'dwp-activity'],
        },
      },
    };
    const saved = mergeEntitledLaunchpadProjection(canonical, projection, edited, mixedFolderApps);

    expect(saved.folders['folder-mixed']).toMatchObject({
      name: 'My daily tools',
      groupId: 'work',
      appIds: ['dwp-ask', 'future-folder', 'dwp-work', 'dwp-activity'],
    });
    expect(saved.groups.work.filter((itemId) => itemId === 'folder-mixed')).toHaveLength(1);
    expect(canonicalizePersistedLaunchpadLayout(saved, mixedFolderApps, HOME_APP_GROUPS)).toEqual(
      saved
    );
  });

  it('moves a visible mixed folder within its group without moving dormant anchors', () => {
    const canonical = mixedFolderCanonical();
    const projection = reconcileLaunchpadLayout(canonical, mixedFolderApps);
    const edited = moveLaunchpadItem(projection, 'work', 'dwp-activity', 'folder-mixed');
    const saved = mergeEntitledLaunchpadProjection(canonical, projection, edited, mixedFolderApps);

    expect(saved.groups.work).toEqual([
      'future-before',
      'dwp-activity',
      'future-middle',
      'folder-mixed',
      'future-after',
    ]);
    expect(saved.folders['folder-mixed']?.appIds).toEqual(['dwp-work', 'future-folder', 'dwp-ask']);
  });

  it('moves a visible mixed folder across groups and keeps one valid placement', () => {
    const canonical = mixedFolderCanonical();
    const projection = reconcileLaunchpadLayout(canonical, mixedFolderApps);
    const edited = moveLaunchpadItemToGroup(projection, 'work', 'connect', 'folder-mixed');
    const saved = mergeEntitledLaunchpadProjection(canonical, projection, edited, mixedFolderApps);
    const folderPlacements = Object.values(saved.groups)
      .flat()
      .filter((itemId) => itemId === 'folder-mixed');

    expect(saved.folders['folder-mixed']?.groupId).toBe('connect');
    expect(saved.groups.work).not.toContain('folder-mixed');
    expect(saved.groups.connect).toContain('folder-mixed');
    expect(folderPlacements).toHaveLength(1);
    expect(canonicalizePersistedLaunchpadLayout(saved, mixedFolderApps, HOME_APP_GROUPS)).toEqual(
      saved
    );
  });

  it('dissolves a visible mixed folder without dropping its dormant member', () => {
    const canonical = mixedFolderCanonical();
    const projection = reconcileLaunchpadLayout(canonical, mixedFolderApps);
    const edits = [
      removeAppFromLaunchpadFolder(projection, 'folder-mixed', 'dwp-ask'),
      ungroupLaunchpadFolder(projection, 'folder-mixed'),
    ];

    edits.forEach((edited) => {
      const saved = mergeEntitledLaunchpadProjection(
        canonical,
        projection,
        edited,
        mixedFolderApps
      );
      expect(saved.folders['folder-mixed']).toBeUndefined();
      expect(saved.groups.work).toEqual(
        expect.arrayContaining(['future-folder', 'dwp-work', 'dwp-ask'])
      );
      expect(saved.groups.work.filter((itemId) => itemId === 'future-folder')).toHaveLength(1);
      expect(canonicalizePersistedLaunchpadLayout(saved, mixedFolderApps, HOME_APP_GROUPS)).toEqual(
        saved
      );
    });
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

  it('places a newly entitled app that is not yet represented in the current layout', () => {
    const [work, ask] = workApps;
    const initial = createDefaultLaunchpadLayout(work ? [work] : []);

    const placed = placeLaunchpadApp(initial, ask!);

    expect(placed.groups.work).toContain('dwp-ask');
    expect(initial.groups.work).not.toContain('dwp-ask');
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
