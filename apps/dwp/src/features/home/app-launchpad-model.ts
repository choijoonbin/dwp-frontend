import { TENANT_CONTROL_PLANE_ROLES } from '../auth/control-plane-access';

export type HomeAppGroupId = 'work' | 'connect' | 'services' | 'systems';

export type HomeAppIconKey =
  | 'activity'
  | 'admin'
  | 'ask'
  | 'collaboration'
  | 'communications'
  | 'erp'
  | 'knowledge'
  | 'legacy'
  | 'mail'
  | 'hris'
  | 'people'
  | 'services'
  | 'workforce'
  | 'work';

export type HomeAppDefinition = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  groupId: HomeAppGroupId;
  route: string;
  iconKey: HomeAppIconKey;
  tone: string;
  resourceKey: string;
  badge?: string;
  requiredRoles?: readonly string[];
};

export type HomeAppGroup = {
  id: HomeAppGroupId;
  name: string;
  description: string;
};

export type LaunchpadFolder = {
  id: string;
  name: string;
  groupId: HomeAppGroupId;
  appIds: string[];
};

export type LaunchpadLayout = {
  version: 1;
  groups: Record<HomeAppGroupId, string[]>;
  folders: Record<string, LaunchpadFolder>;
  hiddenAppIds: string[];
};

export type AppEntitlementPermission = {
  resourceType: string;
  resourceKey: string;
  permissionCode: string;
  effect: string;
};

export type HomeTranslate = (key: string, options?: Record<string, string | number>) => string;

export const HOME_APP_GROUPS: readonly HomeAppGroup[] = [
  {
    id: 'work',
    name: 'Start work',
    description: 'Priorities and governed workspace actions',
  },
  {
    id: 'connect',
    name: 'Connect',
    description: 'Communication and collaboration',
  },
  {
    id: 'services',
    name: 'People & services',
    description: 'Employee support and directory',
  },
  {
    id: 'systems',
    name: 'Systems & control',
    description: 'Knowledge, business tools, and governance',
  },
];

export const HOME_APPS: readonly HomeAppDefinition[] = [
  {
    id: 'dwp-work',
    name: 'Work',
    shortName: 'Work',
    description: 'Priorities, approvals, and tasks',
    groupId: 'work',
    route: '/work',
    iconKey: 'work',
    tone: '#315FD5',
    resourceKey: 'APP.WORK',
    badge: '4',
  },
  {
    id: 'dwp-ask',
    name: 'Ask DWP',
    shortName: 'Ask DWP',
    description: 'Read-only request plans with an audit trace',
    groupId: 'work',
    route: '/ask',
    iconKey: 'ask',
    tone: '#7A4FC4',
    resourceKey: 'APP.ASK',
  },
  {
    id: 'dwp-activity',
    name: 'Activity',
    shortName: 'Activity',
    description: 'Human, system, and agent events',
    groupId: 'work',
    route: '/activity',
    iconKey: 'activity',
    tone: '#087E8B',
    resourceKey: 'APP.ACTIVITY',
    badge: '2',
  },
  {
    id: 'dwp-communications',
    name: 'Newsroom',
    shortName: 'News',
    description: 'Targeted company news, events, and required updates',
    groupId: 'connect',
    route: '/communications',
    iconKey: 'communications',
    tone: '#E14F5A',
    resourceKey: 'APP.COMMUNICATIONS',
  },
  {
    id: 'ref-app-mail',
    name: 'Mail & calendar',
    shortName: 'Mail',
    description: 'Messages, meetings, and follow-ups',
    groupId: 'connect',
    route: '/apps?app=ref-app-mail',
    iconKey: 'mail',
    tone: '#1769AA',
    resourceKey: 'APP.MAIL_CALENDAR',
    badge: '6',
  },
  {
    id: 'ref-app-collaboration',
    name: 'Collaboration',
    shortName: 'Collab',
    description: 'Chat, channels, and meetings',
    groupId: 'connect',
    route: '/apps?app=ref-app-collaboration',
    iconKey: 'collaboration',
    tone: '#C04B5C',
    resourceKey: 'APP.COLLABORATION',
    badge: '3',
  },
  {
    id: 'ref-app-service',
    name: 'Services',
    shortName: 'Services',
    description: 'IT, people, workplace, finance, and procurement requests',
    groupId: 'services',
    route: '/services',
    iconKey: 'services',
    tone: '#15805A',
    resourceKey: 'APP.EMPLOYEE_SERVICES',
    badge: '1',
  },
  {
    id: 'ref-app-people',
    name: 'HRIS',
    shortName: 'HRIS',
    description: 'Personal HR, people, organization, and workforce operations',
    groupId: 'services',
    route: '/hr',
    iconKey: 'hris',
    tone: '#176B68',
    resourceKey: 'APP.HRIS',
  },
  {
    id: 'ref-app-knowledge',
    name: 'Knowledge',
    shortName: 'Knowledge',
    description: 'Connect policies and workplace guides',
    groupId: 'systems',
    route: '/apps?app=ref-app-knowledge',
    iconKey: 'knowledge',
    tone: '#A66300',
    resourceKey: 'APP.KNOWLEDGE',
  },
  {
    id: 'ref-app-erp',
    name: 'Business ERP',
    shortName: 'ERP',
    description: 'Finance and purchasing workspace',
    groupId: 'systems',
    route: '/apps?app=ref-app-erp',
    iconKey: 'erp',
    tone: '#8B5A2B',
    resourceKey: 'APP.BUSINESS_ERP',
  },
  {
    id: 'ref-app-legacy',
    name: 'Legacy operations',
    shortName: 'Legacy',
    description: 'Existing operational systems',
    groupId: 'systems',
    route: '/apps?app=ref-app-legacy',
    iconKey: 'legacy',
    tone: '#4B5663',
    resourceKey: 'APP.LEGACY_OPERATIONS',
  },
  {
    id: 'dwp-admin',
    name: 'Administration',
    shortName: 'Admin',
    description: 'Access, registry, policies, and codes',
    groupId: 'systems',
    route: '/admin',
    iconKey: 'admin',
    tone: '#9A3B23',
    resourceKey: 'APP.ADMINISTRATION',
    requiredRoles: TENANT_CONTROL_PLANE_ROLES,
  },
];

export function localizeHomeAppGroups(translate: HomeTranslate): HomeAppGroup[] {
  return HOME_APP_GROUPS.map((group) => ({
    ...group,
    name: translate(`apps.groups.${group.id}.name`, { defaultValue: group.name }),
    description: translate(`apps.groups.${group.id}.description`, {
      defaultValue: group.description,
    }),
  }));
}

export function localizeHomeApps(translate: HomeTranslate): HomeAppDefinition[] {
  return HOME_APPS.map((app) => ({
    ...app,
    name: translate(`apps.items.${app.id}.name`, { defaultValue: app.name }),
    shortName: translate(`apps.items.${app.id}.shortName`, { defaultValue: app.shortName }),
    description: translate(`apps.items.${app.id}.description`, {
      defaultValue: app.description,
    }),
  }));
}

const GROUP_IDS = HOME_APP_GROUPS.map((group) => group.id);

function emptyGroups(): Record<HomeAppGroupId, string[]> {
  return {
    work: [],
    connect: [],
    services: [],
    systems: [],
  };
}

function isGroupId(value: unknown): value is HomeAppGroupId {
  return typeof value === 'string' && GROUP_IDS.includes(value as HomeAppGroupId);
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function safeFolderName(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().replace(/\s+/g, ' ').slice(0, 42);
  return normalized || fallback;
}

function copyLayout(layout: LaunchpadLayout): LaunchpadLayout {
  return {
    version: 1,
    groups: Object.fromEntries(
      GROUP_IDS.map((groupId) => [groupId, [...layout.groups[groupId]]])
    ) as Record<HomeAppGroupId, string[]>,
    folders: Object.fromEntries(
      Object.values(layout.folders).map((folder) => [
        folder.id,
        { ...folder, appIds: [...folder.appIds] },
      ])
    ),
    hiddenAppIds: [...layout.hiddenAppIds],
  };
}

export function isAppEntitled(
  app: HomeAppDefinition,
  roles: readonly string[],
  permissions: readonly AppEntitlementPermission[]
): boolean {
  if (app.requiredRoles && !app.requiredRoles.some((role) => roles.includes(role))) return false;

  return isAppResourceEntitled(app.resourceKey, permissions);
}

export function isAppResourceEntitled(
  resourceKey: string,
  permissions: readonly AppEntitlementPermission[]
): boolean {
  const appPermissions = permissions.filter(
    (permission) => permission.resourceType.toUpperCase() === 'APP'
  );
  if (appPermissions.length === 0) return true;

  const matchingPermissions = appPermissions.filter(
    (permission) =>
      permission.resourceKey === resourceKey &&
      ['VIEW', 'USE', 'LAUNCH'].includes(permission.permissionCode)
  );
  if (matchingPermissions.some((permission) => permission.effect === 'DENY')) return false;
  return matchingPermissions.some((permission) => permission.effect === 'ALLOW');
}

export function createDefaultLaunchpadLayout(apps: readonly HomeAppDefinition[]): LaunchpadLayout {
  const groups = emptyGroups();
  apps.forEach((app) => groups[app.groupId].push(app.id));
  return { version: 1, groups, folders: {}, hiddenAppIds: [] };
}

export function reconcileLaunchpadLayout(
  value: unknown,
  apps: readonly HomeAppDefinition[]
): LaunchpadLayout {
  if (!value || typeof value !== 'object') return createDefaultLaunchpadLayout(apps);

  const candidate = value as {
    version?: unknown;
    groups?: Record<string, unknown>;
    folders?: Record<string, unknown>;
    hiddenAppIds?: unknown;
  };
  if (candidate.version !== 1 || !candidate.groups || !candidate.folders) {
    return createDefaultLaunchpadLayout(apps);
  }

  const appById = new Map(apps.map((app) => [app.id, app]));
  const hiddenAppIds = Array.isArray(candidate.hiddenAppIds)
    ? unique(candidate.hiddenAppIds.filter((id): id is string => typeof id === 'string')).filter(
        (appId) => appById.has(appId)
      )
    : [];
  const hiddenApps = new Set(hiddenAppIds);
  const folders: Record<string, LaunchpadFolder> = {};
  const claimedApps = new Set<string>();

  Object.entries(candidate.folders).forEach(([folderId, rawFolder]) => {
    if (!folderId.startsWith('folder-') || !rawFolder || typeof rawFolder !== 'object') return;
    const folder = rawFolder as Partial<LaunchpadFolder>;
    if (!isGroupId(folder.groupId) || !Array.isArray(folder.appIds)) return;

    const appIds = unique(
      folder.appIds.filter((id): id is string => typeof id === 'string')
    ).filter((appId) => {
      const app = appById.get(appId);
      return Boolean(app && !hiddenApps.has(appId) && !claimedApps.has(appId));
    });
    if (appIds.length < 2) return;

    appIds.forEach((appId) => claimedApps.add(appId));
    folders[folderId] = {
      id: folderId,
      name: safeFolderName(folder.name, 'App folder'),
      groupId: folder.groupId,
      appIds,
    };
  });

  const groups = emptyGroups();
  const usedTopLevelApps = new Set<string>();
  const usedFolders = new Set<string>();

  GROUP_IDS.forEach((groupId) => {
    const rawItems = candidate.groups?.[groupId];
    if (!Array.isArray(rawItems)) return;

    rawItems.forEach((rawItemId) => {
      if (typeof rawItemId !== 'string') return;
      const folder = folders[rawItemId];
      if (folder?.groupId === groupId && !usedFolders.has(rawItemId)) {
        groups[groupId].push(rawItemId);
        usedFolders.add(rawItemId);
        return;
      }

      const app = appById.get(rawItemId);
      if (
        app &&
        !hiddenApps.has(rawItemId) &&
        !claimedApps.has(rawItemId) &&
        !usedTopLevelApps.has(rawItemId)
      ) {
        groups[groupId].push(rawItemId);
        usedTopLevelApps.add(rawItemId);
      }
    });
  });

  Object.values(folders).forEach((folder) => {
    if (!usedFolders.has(folder.id)) groups[folder.groupId].push(folder.id);
  });
  apps.forEach((app) => {
    if (!hiddenApps.has(app.id) && !claimedApps.has(app.id) && !usedTopLevelApps.has(app.id)) {
      groups[app.groupId].push(app.id);
    }
  });

  return { version: 1, groups, folders, hiddenAppIds };
}

export function moveLaunchpadItem(
  layout: LaunchpadLayout,
  groupId: HomeAppGroupId,
  activeId: string,
  overId: string
): LaunchpadLayout {
  const items = layout.groups[groupId];
  const activeIndex = items.indexOf(activeId);
  const overIndex = items.indexOf(overId);
  if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) return layout;

  const next = copyLayout(layout);
  const [activeItem] = next.groups[groupId].splice(activeIndex, 1);
  if (!activeItem) return layout;
  next.groups[groupId].splice(overIndex, 0, activeItem);
  return next;
}

export function moveLaunchpadItemToGroup(
  layout: LaunchpadLayout,
  sourceGroupId: HomeAppGroupId,
  targetGroupId: HomeAppGroupId,
  activeId: string,
  overId?: string
): LaunchpadLayout {
  const sourceItems = layout.groups[sourceGroupId];
  const activeIndex = sourceItems.indexOf(activeId);
  if (activeIndex < 0) return layout;

  if (sourceGroupId === targetGroupId && overId) {
    return moveLaunchpadItem(layout, sourceGroupId, activeId, overId);
  }
  if (sourceGroupId === targetGroupId && sourceItems.at(-1) === activeId) return layout;

  const targetItems = layout.groups[targetGroupId];
  const targetIndex = overId ? targetItems.indexOf(overId) : targetItems.length;
  if (overId && targetIndex < 0) return layout;

  const next = copyLayout(layout);
  next.groups[sourceGroupId].splice(activeIndex, 1);
  next.groups[targetGroupId].splice(targetIndex, 0, activeId);
  const movedFolder = next.folders[activeId];
  if (movedFolder) movedFolder.groupId = targetGroupId;
  return next;
}

export function createLaunchpadFolder(
  layout: LaunchpadLayout,
  groupId: HomeAppGroupId,
  firstAppId: string,
  secondAppId: string,
  folderId: string,
  folderName = 'App folder'
): LaunchpadLayout {
  if (
    firstAppId === secondAppId ||
    layout.folders[folderId] ||
    layout.folders[firstAppId] ||
    layout.folders[secondAppId]
  ) {
    return layout;
  }
  const firstGroupId = GROUP_IDS.find((candidate) => layout.groups[candidate].includes(firstAppId));
  const secondIndex = layout.groups[groupId].indexOf(secondAppId);
  if (!firstGroupId || secondIndex < 0) return layout;

  const next = copyLayout(layout);
  const insertAt = layout.groups[groupId]
    .slice(0, secondIndex)
    .filter((itemId) => itemId !== firstAppId).length;
  GROUP_IDS.forEach((candidate) => {
    next.groups[candidate] = next.groups[candidate].filter(
      (itemId) => itemId !== firstAppId && itemId !== secondAppId
    );
  });
  next.groups[groupId].splice(insertAt, 0, folderId);
  next.folders[folderId] = {
    id: folderId,
    name: safeFolderName(folderName, 'App folder'),
    groupId,
    appIds: [firstAppId, secondAppId],
  };
  return next;
}

export function addAppToLaunchpadFolder(
  layout: LaunchpadLayout,
  appId: string,
  folderId: string
): LaunchpadLayout {
  const folder = layout.folders[folderId];
  if (!folder || layout.folders[appId] || folder.appIds.includes(appId)) return layout;
  if (!GROUP_IDS.some((groupId) => layout.groups[groupId].includes(appId))) return layout;

  const next = copyLayout(layout);
  GROUP_IDS.forEach((groupId) => {
    next.groups[groupId] = next.groups[groupId].filter((itemId) => itemId !== appId);
  });
  next.folders[folderId]?.appIds.push(appId);
  return next;
}

export function removeAppFromLaunchpadFolder(
  layout: LaunchpadLayout,
  folderId: string,
  appId: string
): LaunchpadLayout {
  const folder = layout.folders[folderId];
  if (!folder?.appIds.includes(appId)) return layout;

  const next = copyLayout(layout);
  const nextFolder = next.folders[folderId];
  if (!nextFolder) return layout;
  nextFolder.appIds = nextFolder.appIds.filter((id) => id !== appId);
  const folderIndex = next.groups[folder.groupId].indexOf(folderId);

  if (nextFolder.appIds.length < 2) {
    const remaining = nextFolder.appIds;
    next.groups[folder.groupId].splice(folderIndex, 1, ...remaining, appId);
    delete next.folders[folderId];
  } else {
    next.groups[folder.groupId].splice(folderIndex + 1, 0, appId);
  }
  return next;
}

export function hideLaunchpadApp(layout: LaunchpadLayout, appId: string): LaunchpadLayout {
  if (layout.hiddenAppIds.includes(appId)) return layout;
  const next = copyLayout(layout);
  let removed = false;

  HOME_APP_GROUPS.forEach(({ id: groupId }) => {
    if (!next.groups[groupId].includes(appId)) return;
    next.groups[groupId] = next.groups[groupId].filter((itemId) => itemId !== appId);
    removed = true;
  });

  Object.values(next.folders).forEach((folder) => {
    if (!folder.appIds.includes(appId)) return;
    folder.appIds = folder.appIds.filter((itemId) => itemId !== appId);
    const folderIndex = next.groups[folder.groupId].indexOf(folder.id);
    if (folder.appIds.length < 2) {
      if (folderIndex >= 0) {
        next.groups[folder.groupId].splice(folderIndex, 1, ...folder.appIds);
      }
      delete next.folders[folder.id];
    }
    removed = true;
  });

  if (!removed) return layout;
  next.hiddenAppIds.push(appId);
  return next;
}

export function restoreLaunchpadApp(
  layout: LaunchpadLayout,
  app: Pick<HomeAppDefinition, 'id' | 'groupId'>
): LaunchpadLayout {
  if (!layout.hiddenAppIds.includes(app.id)) return layout;
  const next = copyLayout(layout);
  next.hiddenAppIds = next.hiddenAppIds.filter((appId) => appId !== app.id);
  next.groups[app.groupId].push(app.id);
  return next;
}

export function ungroupLaunchpadFolder(layout: LaunchpadLayout, folderId: string): LaunchpadLayout {
  const folder = layout.folders[folderId];
  if (!folder) return layout;
  const next = copyLayout(layout);
  const folderIndex = next.groups[folder.groupId].indexOf(folderId);
  if (folderIndex >= 0) {
    next.groups[folder.groupId].splice(folderIndex, 1, ...folder.appIds);
  }
  delete next.folders[folderId];
  return next;
}

export function renameLaunchpadFolder(
  layout: LaunchpadLayout,
  folderId: string,
  name: string
): LaunchpadLayout {
  const folder = layout.folders[folderId];
  if (!folder) return layout;
  const nextName = safeFolderName(name, folder.name);
  if (nextName === folder.name) return layout;
  const next = copyLayout(layout);
  if (next.folders[folderId]) next.folders[folderId].name = nextName;
  return next;
}
