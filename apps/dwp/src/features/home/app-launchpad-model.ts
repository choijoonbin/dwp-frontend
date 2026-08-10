export type HomeAppGroupId = 'work' | 'connect' | 'services' | 'systems';

export type HomeAppIconKey =
  | 'activity'
  | 'admin'
  | 'ask'
  | 'collaboration'
  | 'erp'
  | 'knowledge'
  | 'legacy'
  | 'mail'
  | 'people'
  | 'services'
  | 'work';

export type HomeAppDefinition = {
  id: string;
  name: string;
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
};

export type AppEntitlementPermission = {
  resourceType: string;
  resourceKey: string;
  permissionCode: string;
  effect: string;
};

export const HOME_APP_GROUPS: readonly HomeAppGroup[] = [
  {
    id: 'work',
    name: 'Start work',
    description: 'Priorities and AI-assisted action',
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
    description: 'Grounded answers and governed actions',
    groupId: 'work',
    route: '/ask',
    iconKey: 'ask',
    tone: '#7A4FC4',
    resourceKey: 'APP.ASK',
    badge: 'AI',
  },
  {
    id: 'dwp-activity',
    name: 'Activity',
    description: 'Human, system, and agent events',
    groupId: 'work',
    route: '/activity',
    iconKey: 'activity',
    tone: '#087E8B',
    resourceKey: 'APP.ACTIVITY',
    badge: '2',
  },
  {
    id: 'ref-app-mail',
    name: 'Mail & calendar',
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
    name: 'Employee services',
    description: 'HR, IT, and workplace requests',
    groupId: 'services',
    route: '/apps?app=ref-app-service',
    iconKey: 'services',
    tone: '#15805A',
    resourceKey: 'APP.EMPLOYEE_SERVICES',
    badge: '1',
  },
  {
    id: 'ref-app-people',
    name: 'People directory',
    description: 'People, teams, and contact details',
    groupId: 'services',
    route: '/apps?app=ref-app-people',
    iconKey: 'people',
    tone: '#007F73',
    resourceKey: 'APP.PEOPLE_DIRECTORY',
  },
  {
    id: 'ref-app-knowledge',
    name: 'Knowledge',
    description: 'Policies, guides, and verified answers',
    groupId: 'systems',
    route: '/apps?app=ref-app-knowledge',
    iconKey: 'knowledge',
    tone: '#A66300',
    resourceKey: 'APP.KNOWLEDGE',
  },
  {
    id: 'ref-app-erp',
    name: 'Business ERP',
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
    description: 'Access, registry, policies, and codes',
    groupId: 'systems',
    route: '/admin',
    iconKey: 'admin',
    tone: '#9A3B23',
    resourceKey: 'APP.ADMINISTRATION',
    requiredRoles: ['ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN'],
  },
];

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
  return { version: 1, groups, folders: {} };
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
  };
  if (candidate.version !== 1 || !candidate.groups || !candidate.folders) {
    return createDefaultLaunchpadLayout(apps);
  }

  const appById = new Map(apps.map((app) => [app.id, app]));
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
      return Boolean(app && app.groupId === folder.groupId && !claimedApps.has(appId));
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
        app?.groupId === groupId &&
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
    if (!claimedApps.has(app.id) && !usedTopLevelApps.has(app.id)) {
      groups[app.groupId].push(app.id);
    }
  });

  return { version: 1, groups, folders };
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

export function moveLaunchpadItemByOffset(
  layout: LaunchpadLayout,
  groupId: HomeAppGroupId,
  itemId: string,
  offset: -1 | 1
): LaunchpadLayout {
  const items = layout.groups[groupId];
  const index = items.indexOf(itemId);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= items.length) return layout;
  return moveLaunchpadItem(layout, groupId, itemId, items[target] ?? itemId);
}

export function createLaunchpadFolder(
  layout: LaunchpadLayout,
  groupId: HomeAppGroupId,
  firstAppId: string,
  secondAppId: string,
  folderId: string,
  folderName = 'App folder'
): LaunchpadLayout {
  if (firstAppId === secondAppId || layout.folders[folderId]) return layout;
  const items = layout.groups[groupId];
  const firstIndex = items.indexOf(firstAppId);
  const secondIndex = items.indexOf(secondAppId);
  if (firstIndex < 0 || secondIndex < 0) return layout;

  const next = copyLayout(layout);
  const insertAt = Math.min(firstIndex, secondIndex);
  next.groups[groupId] = next.groups[groupId].filter(
    (itemId) => itemId !== firstAppId && itemId !== secondAppId
  );
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
  if (!folder || folder.appIds.includes(appId)) return layout;
  if (!layout.groups[folder.groupId].includes(appId)) return layout;

  const next = copyLayout(layout);
  next.groups[folder.groupId] = next.groups[folder.groupId].filter((itemId) => itemId !== appId);
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

export function ungroupLaunchpadFolder(layout: LaunchpadLayout, folderId: string): LaunchpadLayout {
  const folder = layout.folders[folderId];
  if (!folder) return layout;
  const next = copyLayout(layout);
  const folderIndex = next.groups[folder.groupId].indexOf(folderId);
  next.groups[folder.groupId].splice(folderIndex, 1, ...folder.appIds);
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

export function launchpadStorageKey(tenantId: number, userId: number): string {
  return `dwp.home.launchpad.v1:${tenantId}:${userId}`;
}
