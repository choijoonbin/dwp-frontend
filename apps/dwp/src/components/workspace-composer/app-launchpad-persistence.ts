import type {
  HomeAppDefinition,
  HomeAppGroup,
  LaunchpadFolder,
  LaunchpadLayout,
} from './home-launchpad-layout-contract';

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

function groupTokenEditChanged(
  base: LaunchpadLayout,
  edited: LaunchpadLayout,
  tokenId: string
): boolean {
  const baseGroupId = Object.keys(base.groups).find((groupId) =>
    base.groups[groupId]?.includes(tokenId)
  );
  const editedGroupId = Object.keys(edited.groups).find((groupId) =>
    edited.groups[groupId]?.includes(tokenId)
  );
  if (baseGroupId !== editedGroupId) return true;
  if (!baseGroupId || !editedGroupId) return false;

  const baseTokens = base.groups[baseGroupId] ?? [];
  const editedTokens = edited.groups[editedGroupId] ?? [];
  const baseIndex = baseTokens.indexOf(tokenId);
  const editedIndex = editedTokens.indexOf(tokenId);
  return baseTokens.some((peerId, peerIndex) => {
    if (peerId === tokenId) return false;
    const editedPeerIndex = editedTokens.indexOf(peerId);
    return (
      editedPeerIndex >= 0 &&
      Math.sign(baseIndex - peerIndex) !== Math.sign(editedIndex - editedPeerIndex)
    );
  });
}

function folderContentEditChanged(
  base: LaunchpadLayout,
  edited: LaunchpadLayout,
  folderId: string
): boolean {
  const baseFolder = Object.hasOwn(base.folders, folderId) ? base.folders[folderId] : undefined;
  const editedFolder = Object.hasOwn(edited.folders, folderId)
    ? edited.folders[folderId]
    : undefined;
  if (!baseFolder || !editedFolder) return baseFolder !== editedFolder;
  return (
    baseFolder.id !== editedFolder.id ||
    baseFolder.name !== editedFolder.name ||
    baseFolder.groupId !== editedFolder.groupId ||
    baseFolder.appIds.length !== editedFolder.appIds.length ||
    baseFolder.appIds.some((appId, index) => editedFolder.appIds[index] !== appId)
  );
}

export function mergeConcurrentTokenOrder(
  mergedItems: readonly string[],
  baseItems: readonly string[],
  editedItems: readonly string[],
  latestItems: readonly string[]
): string[] {
  const nodes = unique(mergedItems);
  const nodeSet = new Set(nodes);
  const editedNodes = editedItems.filter((itemId) => nodeSet.has(itemId));
  const edges = new Map(nodes.map((itemId) => [itemId, new Set<string>()]));

  const reaches = (startId: string, targetId: string): boolean => {
    const pending = [startId];
    const visited = new Set<string>();
    while (pending.length > 0) {
      const itemId = pending.pop()!;
      if (itemId === targetId) return true;
      if (visited.has(itemId)) continue;
      visited.add(itemId);
      pending.push(...(edges.get(itemId) ?? []));
    }
    return false;
  };
  const addEdge = (beforeId: string, afterId: string, allowConflict: boolean) => {
    if (beforeId === afterId || edges.get(beforeId)?.has(afterId)) return;
    if (!allowConflict && reaches(afterId, beforeId)) return;
    edges.get(beforeId)?.add(afterId);
  };

  const pairChanged = (
    sourceItems: readonly string[],
    targetItems: readonly string[],
    leftId: string,
    rightId: string
  ): boolean => {
    const targetLeftIndex = targetItems.indexOf(leftId);
    const targetRightIndex = targetItems.indexOf(rightId);
    if (targetLeftIndex < 0 || targetRightIndex < 0) return false;
    const sourceLeftIndex = sourceItems.indexOf(leftId);
    const sourceRightIndex = sourceItems.indexOf(rightId);
    return (
      sourceLeftIndex < 0 ||
      sourceRightIndex < 0 ||
      Math.sign(sourceLeftIndex - sourceRightIndex) !==
        Math.sign(targetLeftIndex - targetRightIndex)
    );
  };
  const localPairChanged = (leftId: string, rightId: string) =>
    pairChanged(baseItems, editedItems, leftId, rightId);

  editedNodes.forEach((beforeId, beforeIndex) => {
    editedNodes.slice(beforeIndex + 1).forEach((afterId) => {
      if (localPairChanged(beforeId, afterId)) {
        addEdge(beforeId, afterId, true);
      }
    });
  });
  const latestChangedEdges: Array<readonly [string, string]> = [];
  const latestStableEdges: Array<readonly [string, string]> = [];
  const mergedFallbackEdges: Array<readonly [string, string]> = [];
  nodes.forEach((leftId, leftIndex) => {
    nodes.slice(leftIndex + 1).forEach((rightId) => {
      if (localPairChanged(leftId, rightId)) return;
      const latestLeftIndex = latestItems.indexOf(leftId);
      const latestRightIndex = latestItems.indexOf(rightId);
      if (latestLeftIndex >= 0 && latestRightIndex >= 0) {
        const edge: readonly [string, string] =
          latestLeftIndex < latestRightIndex ? [leftId, rightId] : [rightId, leftId];
        (pairChanged(baseItems, latestItems, leftId, rightId)
          ? latestChangedEdges
          : latestStableEdges
        ).push(edge);
        return;
      }
      mergedFallbackEdges.push([leftId, rightId]);
    });
  });
  [...latestChangedEdges, ...latestStableEdges, ...mergedFallbackEdges].forEach(
    ([beforeId, afterId]) => addEdge(beforeId, afterId, false)
  );

  const indegree = new Map(nodes.map((itemId) => [itemId, 0]));
  edges.forEach((targets) => {
    targets.forEach((targetId) => indegree.set(targetId, (indegree.get(targetId) ?? 0) + 1));
  });
  const mergedIndex = new Map(nodes.map((itemId, index) => [itemId, index]));
  const ready = nodes.filter((itemId) => indegree.get(itemId) === 0);
  const ordered: string[] = [];
  while (ready.length > 0) {
    ready.sort((left, right) => mergedIndex.get(left)! - mergedIndex.get(right)!);
    const itemId = ready.shift()!;
    ordered.push(itemId);
    edges.get(itemId)?.forEach((targetId) => {
      const nextIndegree = indegree.get(targetId)! - 1;
      indegree.set(targetId, nextIndegree);
      if (nextIndegree === 0) ready.push(targetId);
    });
  }
  return ordered.length === nodes.length ? ordered : nodes;
}

/**
 * Merges the editable, entitlement-filtered Dock projection into its persisted source.
 * Catalog-stale and future placements remain dormant until that exact app is edited.
 */
function mergeEntitledLaunchpadProjectionInternal(
  canonical: LaunchpadLayout,
  baseProjection: LaunchpadLayout,
  editedProjection: LaunchpadLayout,
  entitledApps: readonly HomeAppDefinition[],
  preserveConcurrentChanges: boolean
): LaunchpadLayout {
  if (layoutSignature(baseProjection) === layoutSignature(editedProjection)) {
    return copyLayout(canonical);
  }

  const entitledIds = new Set(entitledApps.map((app) => app.id));
  const explicitlyChanged = new Set(
    [...entitledIds].filter((appId) => appEditChanged(baseProjection, editedProjection, appId))
  );
  const projectionShifted = new Set(
    [...entitledIds].filter((appId) =>
      preserveConcurrentChanges
        ? appEditChanged(baseProjection, canonical, appId)
        : appPlacement(canonical, appId) !== appPlacement(baseProjection, appId)
    )
  );
  const folderIds = unique([
    ...Object.keys(canonical.folders),
    ...Object.keys(baseProjection.folders),
    ...Object.keys(editedProjection.folders),
  ]);
  const canonicalAbsentLocallyEditedFolderIds = preserveConcurrentChanges
    ? new Set(
        folderIds.filter(
          (folderId) =>
            !Object.hasOwn(canonical.folders, folderId) &&
            Object.hasOwn(editedProjection.folders, folderId) &&
            (folderContentEditChanged(baseProjection, editedProjection, folderId) ||
              groupTokenEditChanged(baseProjection, editedProjection, folderId))
        )
      )
    : new Set<string>();
  const locallyReplayedFolderIds = new Set(
    [...canonicalAbsentLocallyEditedFolderIds].filter((folderId) => {
      const editedFolder = editedProjection.folders[folderId];
      return editedFolder
        ? editedFolder.appIds.filter((appId) => entitledIds.has(appId)).length >= 2
        : false;
    })
  );
  const unreplayableFolderIds = new Set(
    [...canonicalAbsentLocallyEditedFolderIds].filter(
      (folderId) => !locallyReplayedFolderIds.has(folderId)
    )
  );
  const protectedFolderIds = preserveConcurrentChanges
    ? new Set(
        folderIds.filter(
          (folderId) =>
            groupTokenEditChanged(baseProjection, canonical, folderId) &&
            !groupTokenEditChanged(baseProjection, editedProjection, folderId) &&
            !locallyReplayedFolderIds.has(folderId)
        )
      )
    : new Set<string>();
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
  Object.values(editedProjection.folders)
    .filter((folder) => locallyReplayedFolderIds.has(folder.id))
    .flatMap((folder) => folder.appIds)
    .forEach((appId) => protectedEntitledIds.delete(appId));
  [...unreplayableFolderIds]
    .flatMap((folderId) => editedProjection.folders[folderId]?.appIds ?? [])
    .filter((appId) => entitledIds.has(appId))
    .forEach((appId) => protectedEntitledIds.add(appId));
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
    if (appIds.length >= 2) {
      folders[folder.id] = {
        ...editedFolder,
        name:
          preserveConcurrentChanges && editedFolder.name === baseFolder.name
            ? folder.name
            : editedFolder.name,
        groupId:
          preserveConcurrentChanges &&
          !groupTokenEditChanged(baseProjection, editedProjection, folder.id) &&
          editedFolder.groupId === baseFolder.groupId
            ? folder.groupId
            : editedFolder.groupId,
        appIds,
      };
    } else protectedReplacement.set(folder.id, appIds);
  });

  Object.values(editedProjection.folders).forEach((folder) => {
    if (Object.hasOwn(canonical.folders, folder.id)) return;
    const baseFolder = Object.hasOwn(baseProjection.folders, folder.id)
      ? baseProjection.folders[folder.id]
      : undefined;
    if (
      preserveConcurrentChanges &&
      baseFolder &&
      !groupTokenEditChanged(baseProjection, editedProjection, folder.id) &&
      JSON.stringify(baseFolder) === JSON.stringify(folder)
    ) {
      return;
    }
    const appIds = unique(
      folder.appIds.filter((appId) => entitledIds.has(appId) && !protectedEntitledIds.has(appId))
    );
    if (appIds.length >= 2) folders[folder.id] = { ...folder, appIds };
  });
  if (preserveConcurrentChanges) {
    Object.values(folders).forEach((folder) => {
      folders[folder.id] = {
        ...folder,
        appIds: mergeConcurrentTokenOrder(
          folder.appIds,
          baseProjection.folders[folder.id]?.appIds ?? [],
          editedProjection.folders[folder.id]?.appIds ?? [],
          canonical.folders[folder.id]?.appIds ?? []
        ),
      };
    });
  }

  const groupIds = unique([
    ...Object.keys(canonical.groups),
    ...Object.keys(editedProjection.groups),
  ]);
  const mergedGroups = Object.fromEntries(
    groupIds.map((groupId) => {
      const editableTokens = (editedProjection.groups[groupId] ?? []).filter((itemId) => {
        if (folders[itemId]) {
          return !opaqueFolderIds.has(itemId) && !protectedFolderIds.has(itemId);
        }
        return entitledIds.has(itemId) && !protectedEntitledIds.has(itemId);
      });
      const canonicalItems = canonical.groups[groupId] ?? [];
      const mergedTokens: string[] = [];
      let editableIndex = 0;
      canonicalItems.forEach((itemId) => {
        if (protectedReplacement.has(itemId)) {
          mergedTokens.push(...protectedReplacement.get(itemId)!);
        } else if (protectedFolderIds.has(itemId) && folders[itemId]) {
          mergedTokens.push(itemId);
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
  const groups = preserveConcurrentChanges
    ? Object.fromEntries(
        groupIds.map((groupId) => [
          groupId,
          mergeConcurrentTokenOrder(
            mergedGroups[groupId] ?? [],
            baseProjection.groups[groupId] ?? [],
            editedProjection.groups[groupId] ?? [],
            canonical.groups[groupId] ?? []
          ),
        ])
      )
    : mergedGroups;
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

export function mergeEntitledLaunchpadProjection(
  canonical: LaunchpadLayout,
  baseProjection: LaunchpadLayout,
  editedProjection: LaunchpadLayout,
  entitledApps: readonly HomeAppDefinition[]
): LaunchpadLayout {
  return mergeEntitledLaunchpadProjectionInternal(
    canonical,
    baseProjection,
    editedProjection,
    entitledApps,
    false
  );
}

export function reapplyEntitledLaunchpadProjection(
  latest: LaunchpadLayout,
  baseProjection: LaunchpadLayout,
  editedProjection: LaunchpadLayout,
  entitledApps: readonly HomeAppDefinition[]
): LaunchpadLayout {
  return mergeEntitledLaunchpadProjectionInternal(
    latest,
    baseProjection,
    editedProjection,
    entitledApps,
    true
  );
}
