import type {
  HomeAppDefinition,
  HomeAppGroup,
  LaunchpadLayout,
} from '../../../components/workspace-composer/app-launchpad-model';

export type FlowAppDockResolvedGroup = Readonly<
  HomeAppGroup & {
    itemIds: readonly string[];
  }
>;

export type FlowAppDockModel = Readonly<{
  groups: readonly FlowAppDockResolvedGroup[];
  visibleItemIds: readonly string[];
  hiddenItemIds: readonly string[];
  visibleAppIds: readonly string[];
  visibleItemCount: number;
  hiddenItemCount: number;
  visibleAppCount: number;
  hiddenAppCount: number;
  totalValidItemCount: number;
  totalValidAppCount: number;
}>;

export type ResolveFlowAppDockModelInput = Readonly<{
  apps: readonly HomeAppDefinition[];
  groups: readonly HomeAppGroup[];
  layout: LaunchpadLayout;
  itemLimit: number;
}>;

export type FlowAppDockNotificationSummary = Readonly<{
  total: number;
  actionable: number;
  urgent: number;
}>;

const EMPTY_NOTIFICATION_SUMMARY: FlowAppDockNotificationSummary = {
  total: 0,
  actionable: 0,
  urgent: 0,
};

/**
 * Summarizes hidden source-app counters without counting the synthetic
 * notification-center aggregate a second time.
 */
export function summarizeHiddenFlowAppNotifications(
  apps: readonly HomeAppDefinition[],
  visibleAppIds: ReadonlySet<string>
): FlowAppDockNotificationSummary {
  return apps
    .filter(
      (app) =>
        !visibleAppIds.has(app.id) && app.notificationSourceKey?.toLowerCase() !== 'notifications'
    )
    .reduce<FlowAppDockNotificationSummary>(
      (summary, app) => ({
        total: summary.total + (app.badgeMetadata?.totalUnread ?? 0),
        actionable: summary.actionable + (app.badgeMetadata?.actionableUnread ?? 0),
        urgent: summary.urgent + (app.badgeMetadata?.urgentUnread ?? 0),
      }),
      EMPTY_NOTIFICATION_SUMMARY
    );
}

function normalizedItemLimit(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function isValidFolderItem(
  itemId: string,
  groupId: string,
  layout: LaunchpadLayout,
  appIds: ReadonlySet<string>
): boolean {
  if (!Object.hasOwn(layout.folders, itemId)) return false;
  const folder = layout.folders[itemId];
  if (!folder || folder.id !== itemId || folder.groupId !== groupId) return false;

  return folder.appIds.some((appId) => appIds.has(appId));
}

function resolveAppIdsForItems(
  itemIds: readonly string[],
  layout: LaunchpadLayout,
  appIds: ReadonlySet<string>
): string[] {
  const resolved = new Set<string>();
  itemIds.forEach((itemId) => {
    if (appIds.has(itemId)) {
      resolved.add(itemId);
      return;
    }
    layout.folders[itemId]?.appIds.forEach((appId) => {
      if (appIds.has(appId)) resolved.add(appId);
    });
  });
  return [...resolved];
}

/**
 * Selects the compact Dock projection without changing the persisted layout.
 *
 * Every non-empty group receives its first valid item before the remaining
 * budget is distributed one item per group and round. The rendered result is
 * then restored to group order and each group's persisted item order.
 */
export function resolveFlowAppDockModel({
  apps,
  groups,
  layout,
  itemLimit,
}: ResolveFlowAppDockModelInput): FlowAppDockModel {
  const appIds = new Set(apps.map((app) => app.id));
  const claimedItemIds = new Set<string>();
  const validGroups = groups
    .map((group) => {
      const sourceItemIds = Object.hasOwn(layout.groups, group.id)
        ? (layout.groups[group.id] ?? [])
        : [];
      const validItemIds = sourceItemIds.filter((itemId) => {
        if (claimedItemIds.has(itemId)) return false;
        const valid = appIds.has(itemId) || isValidFolderItem(itemId, group.id, layout, appIds);
        if (valid) claimedItemIds.add(itemId);
        return valid;
      });

      return { group, validItemIds };
    })
    .filter(({ validItemIds }) => validItemIds.length > 0);
  const limit = normalizedItemLimit(itemLimit);
  const selectedByGroup = validGroups.map(() => [] as string[]);
  let remaining = limit;

  for (let itemIndex = 0; remaining > 0; itemIndex += 1) {
    let selectedInRound = false;

    for (let groupIndex = 0; groupIndex < validGroups.length && remaining > 0; groupIndex += 1) {
      const itemId = validGroups[groupIndex]?.validItemIds[itemIndex];
      if (!itemId) continue;
      selectedByGroup[groupIndex]?.push(itemId);
      remaining -= 1;
      selectedInRound = true;
    }

    if (!selectedInRound) break;
  }

  const resolvedGroups = validGroups.flatMap(({ group }, groupIndex) => {
    const itemIds = selectedByGroup[groupIndex] ?? [];
    return itemIds.length > 0 ? [{ ...group, itemIds }] : [];
  });
  const visibleItemIds = resolvedGroups.flatMap((group) => [...group.itemIds]);
  const visibleItemIdSet = new Set(visibleItemIds);
  const allValidItemIds = validGroups.flatMap(({ validItemIds }) => validItemIds);
  const hiddenItemIds = allValidItemIds.filter((itemId) => !visibleItemIdSet.has(itemId));
  const visibleAppIds = resolveAppIdsForItems(visibleItemIds, layout, appIds);
  const allValidAppIds = resolveAppIdsForItems(allValidItemIds, layout, appIds);

  return {
    groups: resolvedGroups,
    visibleItemIds,
    hiddenItemIds,
    visibleAppIds,
    visibleItemCount: visibleItemIds.length,
    hiddenItemCount: hiddenItemIds.length,
    visibleAppCount: visibleAppIds.length,
    hiddenAppCount: Math.max(0, apps.length - visibleAppIds.length),
    totalValidItemCount: allValidItemIds.length,
    totalValidAppCount: allValidAppIds.length,
  };
}
