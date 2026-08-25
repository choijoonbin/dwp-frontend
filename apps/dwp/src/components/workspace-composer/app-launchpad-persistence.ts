import type {
  HomeAppDefinition,
  HomeAppGroup,
  LaunchpadFolder,
  LaunchpadLayout,
} from './app-launchpad-model';

const DEFAULT_GROUP_ID = 'work';

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isIdentifier(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

function fallbackLayout(
  apps: readonly HomeAppDefinition[],
  configuredGroups: readonly HomeAppGroup[]
): LaunchpadLayout {
  const configuredIds = unique(configuredGroups.map((group) => group.id).filter(Boolean));
  const appGroupIds = unique(apps.map((app) => app.groupId).filter(Boolean));
  const groupIds = configuredIds.length > 0 ? configuredIds : appGroupIds;
  if (groupIds.length === 0) groupIds.push(DEFAULT_GROUP_ID);
  const groups = Object.fromEntries(groupIds.map((groupId) => [groupId, [] as string[]]));
  apps.forEach((app) =>
    (Object.hasOwn(groups, app.groupId) ? groups[app.groupId]! : groups[groupIds[0]!]!).push(app.id)
  );
  return { version: 1, groups, folders: {}, hiddenAppIds: [] };
}

function copyLayout(layout: LaunchpadLayout): LaunchpadLayout {
  return {
    version: 1,
    groups: Object.fromEntries(
      Object.entries(layout.groups).map(([groupId, items]) => [groupId, [...items]])
    ),
    folders: Object.fromEntries(
      Object.entries(layout.folders).map(([folderId, folder]) => [
        folderId,
        { ...folder, appIds: [...folder.appIds] },
      ])
    ),
    hiddenAppIds: [...layout.hiddenAppIds],
  };
}

function parseGroups(value: unknown): Record<string, string[]> | null {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value);
  if (entries.length > 12) return null;
  const groups: Array<[string, string[]]> = [];
  for (const [groupId, rawItems] of entries) {
    if (!isIdentifier(groupId, 40) || !Array.isArray(rawItems) || rawItems.length > 100) {
      return null;
    }
    if (!rawItems.every((item) => isIdentifier(item, 100))) return null;
    const items = rawItems as string[];
    if (new Set(items).size !== items.length) return null;
    groups.push([groupId, [...items]]);
  }
  return Object.fromEntries(groups);
}

function parseFolders(
  value: unknown,
  groups: Readonly<Record<string, string[]>>
): Record<string, LaunchpadFolder> | null {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value);
  if (entries.length > 50) return null;
  const folders: Array<[string, LaunchpadFolder]> = [];
  for (const [folderId, rawFolder] of entries) {
    if (!isIdentifier(folderId, 100) || !isRecord(rawFolder)) return null;
    const { id, name, groupId, appIds } = rawFolder;
    if (
      id !== folderId ||
      !isIdentifier(name, 80) ||
      !isIdentifier(groupId, 40) ||
      !Object.hasOwn(groups, groupId) ||
      !Array.isArray(appIds) ||
      appIds.length < 2 ||
      appIds.length > 50 ||
      !appIds.every((appId) => isIdentifier(appId, 100))
    ) {
      return null;
    }
    const parsedAppIds = appIds as string[];
    if (new Set(parsedAppIds).size !== parsedAppIds.length) return null;
    folders.push([folderId, { id, name, groupId, appIds: [...parsedAppIds] }]);
  }
  return Object.fromEntries(folders);
}

function parseHiddenAppIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 100) return null;
  if (!value.every((appId) => isIdentifier(appId, 100))) return null;
  const appIds = value as string[];
  return new Set(appIds).size === appIds.length ? [...appIds] : null;
}

function hasExclusivePlacements(
  groups: Readonly<Record<string, string[]>>,
  folders: Readonly<Record<string, LaunchpadFolder>>,
  hiddenAppIds: readonly string[]
): boolean {
  const hidden = new Set(hiddenAppIds);
  const placedApps = new Set<string>();
  const placedFolders = new Set<string>();
  for (const [groupId, items] of Object.entries(groups)) {
    for (const itemId of items) {
      const folder = Object.hasOwn(folders, itemId) ? folders[itemId] : undefined;
      if (folder) {
        if (folder.groupId !== groupId || placedFolders.has(itemId)) return false;
        placedFolders.add(itemId);
      } else {
        if (hidden.has(itemId) || placedApps.has(itemId)) return false;
        placedApps.add(itemId);
      }
    }
  }
  if (placedFolders.size !== Object.keys(folders).length) return false;
  for (const folder of Object.values(folders)) {
    for (const appId of folder.appIds) {
      if (Object.hasOwn(folders, appId) || hidden.has(appId) || placedApps.has(appId)) return false;
      placedApps.add(appId);
    }
  }
  return true;
}

/**
 * Validates the persisted layout without applying today's catalog or entitlement set.
 * Unknown/future identifiers stay byte-for-byte equivalent at the layout-field level.
 */
export function canonicalizePersistedLaunchpadLayout(
  value: unknown,
  fallbackApps: readonly HomeAppDefinition[],
  configuredGroups: readonly HomeAppGroup[]
): LaunchpadLayout {
  if (!isRecord(value) || value.version !== 1) {
    return fallbackLayout(fallbackApps, configuredGroups);
  }
  const groups = parseGroups(value.groups);
  const folders = groups ? parseFolders(value.folders, groups) : null;
  const hiddenAppIds = parseHiddenAppIds(value.hiddenAppIds);
  if (
    !groups ||
    !folders ||
    !hiddenAppIds ||
    !hasExclusivePlacements(groups, folders, hiddenAppIds)
  ) {
    return fallbackLayout(fallbackApps, configuredGroups);
  }
  return copyLayout({ version: 1, groups, folders, hiddenAppIds });
}

function layoutSignature(layout: LaunchpadLayout): string {
  return JSON.stringify({
    groups: Object.fromEntries(
      Object.keys(layout.groups)
        .sort()
        .map((groupId) => [groupId, layout.groups[groupId] ?? []])
    ),
    folders: Object.fromEntries(
      Object.values(layout.folders)
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((folder) => [
          folder.id,
          { name: folder.name, groupId: folder.groupId, appIds: folder.appIds },
        ])
    ),
    hiddenAppIds: [...layout.hiddenAppIds].sort(),
  });
}

function appPlacement(layout: LaunchpadLayout, appId: string): string {
  if (layout.hiddenAppIds.includes(appId)) return 'hidden';
  const folder = Object.values(layout.folders).find((candidate) =>
    candidate.appIds.includes(appId)
  );
  if (folder) return `folder:${folder.id}`;
  const groupId = Object.keys(layout.groups).find((candidate) =>
    layout.groups[candidate]?.includes(appId)
  );
  return groupId ? `group:${groupId}` : 'absent';
}

function siblingTokens(layout: LaunchpadLayout, appId: string): readonly string[] {
  const folder = Object.values(layout.folders).find((candidate) =>
    candidate.appIds.includes(appId)
  );
  if (folder) return folder.appIds;
  const groupId = Object.keys(layout.groups).find((candidate) =>
    layout.groups[candidate]?.includes(appId)
  );
  return groupId ? layout.groups[groupId]! : [];
}

function appEditChanged(base: LaunchpadLayout, edited: LaunchpadLayout, appId: string): boolean {
  if (appPlacement(base, appId) !== appPlacement(edited, appId)) return true;
  const baseTokens = siblingTokens(base, appId);
  const editedTokens = siblingTokens(edited, appId);
  const baseIndex = baseTokens.indexOf(appId);
  const editedIndex = editedTokens.indexOf(appId);
  if (baseIndex < 0 || editedIndex < 0) return false;
  return baseTokens.some((peerId, peerIndex) => {
    if (peerId === appId) return false;
    const editedPeerIndex = editedTokens.indexOf(peerId);
    return (
      editedPeerIndex >= 0 &&
      Math.sign(baseIndex - peerIndex) !== Math.sign(editedIndex - editedPeerIndex)
    );
  });
}

/**
 * Merges the editable, entitlement-filtered Dock projection into its persisted source.
 * Catalog-stale and future placements remain dormant until that exact app is edited.
 */
export function mergeEntitledLaunchpadProjection(
  canonical: LaunchpadLayout,
  baseProjection: LaunchpadLayout,
  editedProjection: LaunchpadLayout,
  entitledApps: readonly HomeAppDefinition[]
): LaunchpadLayout {
  if (layoutSignature(baseProjection) === layoutSignature(editedProjection)) {
    return copyLayout(canonical);
  }

  const entitledIds = new Set(entitledApps.map((app) => app.id));
  const explicitlyChanged = new Set(
    [...entitledIds].filter((appId) => appEditChanged(baseProjection, editedProjection, appId))
  );
  const projectionShifted = new Set(
    [...entitledIds].filter(
      (appId) => appPlacement(canonical, appId) !== appPlacement(baseProjection, appId)
    )
  );
  const opaqueFolderIds = new Set(
    Object.values(canonical.folders)
      .filter((folder) =>
        Boolean(
          !Object.hasOwn(baseProjection.folders, folder.id) &&
          folder.appIds.some(
            (appId) =>
              !entitledIds.has(appId) ||
              (projectionShifted.has(appId) && !explicitlyChanged.has(appId))
          )
        )
      )
      .map((folder) => folder.id)
  );
  const protectedEntitledIds = new Set<string>(
    [...projectionShifted].filter((appId) => !explicitlyChanged.has(appId))
  );
  Object.values(canonical.folders)
    .filter((folder) => opaqueFolderIds.has(folder.id))
    .flatMap((folder) => folder.appIds)
    .filter((appId) => entitledIds.has(appId) && !explicitlyChanged.has(appId))
    .forEach((appId) => protectedEntitledIds.add(appId));

  const folders = Object.create(null) as Record<string, LaunchpadFolder>;
  const protectedReplacement = new Map<string, string[]>();
  Object.values(canonical.folders).forEach((folder) => {
    const baseFolder = Object.hasOwn(baseProjection.folders, folder.id)
      ? baseProjection.folders[folder.id]
      : undefined;
    const editedFolder = Object.hasOwn(editedProjection.folders, folder.id)
      ? editedProjection.folders[folder.id]
      : undefined;
    if (!baseFolder) {
      const retainedAppIds = folder.appIds.filter(
        (appId) => !entitledIds.has(appId) || protectedEntitledIds.has(appId)
      );
      if (retainedAppIds.length >= 2) folders[folder.id] = { ...folder, appIds: retainedAppIds };
      else protectedReplacement.set(folder.id, retainedAppIds);
      return;
    }
    const dormantIds = new Set(
      folder.appIds.filter((appId) => !entitledIds.has(appId) || protectedEntitledIds.has(appId))
    );
    if (!editedFolder) {
      protectedReplacement.set(folder.id, [...dormantIds]);
      return;
    }
    const editableAppIds = unique(
      editedFolder.appIds.filter(
        (appId) => entitledIds.has(appId) && !protectedEntitledIds.has(appId)
      )
    );
    const mergedAppIds: string[] = [];
    let editableIndex = 0;
    folder.appIds.forEach((appId) => {
      if (dormantIds.has(appId)) mergedAppIds.push(appId);
      else if (editableIndex < editableAppIds.length) {
        mergedAppIds.push(editableAppIds[editableIndex++]!);
      }
    });
    mergedAppIds.push(...editableAppIds.slice(editableIndex));
    const appIds = unique(mergedAppIds);
    if (appIds.length >= 2) folders[folder.id] = { ...editedFolder, appIds };
    else protectedReplacement.set(folder.id, appIds);
  });

  Object.values(editedProjection.folders).forEach((folder) => {
    if (Object.hasOwn(canonical.folders, folder.id)) return;
    const appIds = unique(
      folder.appIds.filter((appId) => entitledIds.has(appId) && !protectedEntitledIds.has(appId))
    );
    if (appIds.length >= 2) folders[folder.id] = { ...folder, appIds };
  });

  const groupIds = unique([
    ...Object.keys(canonical.groups),
    ...Object.keys(editedProjection.groups),
  ]);
  const groups = Object.fromEntries(
    groupIds.map((groupId) => {
      const editableTokens = (editedProjection.groups[groupId] ?? []).filter((itemId) => {
        if (folders[itemId]) return !opaqueFolderIds.has(itemId);
        return entitledIds.has(itemId) && !protectedEntitledIds.has(itemId);
      });
      const canonicalItems = canonical.groups[groupId] ?? [];
      const mergedTokens: string[] = [];
      let editableIndex = 0;
      canonicalItems.forEach((itemId) => {
        if (protectedReplacement.has(itemId)) {
          mergedTokens.push(...protectedReplacement.get(itemId)!);
        } else if (opaqueFolderIds.has(itemId) && folders[itemId]) {
          mergedTokens.push(itemId);
        } else if (
          !Object.hasOwn(canonical.folders, itemId) &&
          (!entitledIds.has(itemId) || protectedEntitledIds.has(itemId))
        ) {
          mergedTokens.push(itemId);
        } else if (editableIndex < editableTokens.length) {
          mergedTokens.push(editableTokens[editableIndex++]!);
        }
      });
      mergedTokens.push(...editableTokens.slice(editableIndex));
      return [groupId, unique(mergedTokens)];
    })
  );
  const editableHidden = editedProjection.hiddenAppIds.filter(
    (appId) => entitledIds.has(appId) && !protectedEntitledIds.has(appId)
  );
  const hiddenAppIds: string[] = [];
  let hiddenIndex = 0;
  canonical.hiddenAppIds.forEach((appId) => {
    if (!entitledIds.has(appId) || protectedEntitledIds.has(appId)) hiddenAppIds.push(appId);
    else if (hiddenIndex < editableHidden.length) hiddenAppIds.push(editableHidden[hiddenIndex++]!);
  });
  hiddenAppIds.push(...editableHidden.slice(hiddenIndex));

  return { version: 1, groups, folders, hiddenAppIds: unique(hiddenAppIds) };
}
