import { describe, expect, it } from 'vitest';

import type {
  HomeAppDefinition,
  HomeAppGroup,
  LaunchpadFolder,
  LaunchpadLayout,
} from '../../../components/workspace-composer/app-launchpad-model';
import {
  preserveFlowAppDockGroupSurfaces,
  resolveFlowAppDockModel,
  summarizeHiddenFlowAppNotifications,
} from './flow-app-dock-model';

function app(id: string, groupId: string): HomeAppDefinition {
  return {
    id,
    name: id,
    shortName: id,
    description: id,
    groupId,
    route: `/${id}`,
    iconKey: 'work',
    tone: '#315FD5',
    resourceKey: `APP.${id.toUpperCase()}`,
  };
}

function group(id: string): HomeAppGroup {
  return { id, name: id, description: id };
}

function folder(id: string, groupId: string, appIds: string[]): LaunchpadFolder {
  return { id, name: id, groupId, appIds };
}

function layout(
  groups: Record<string, string[]>,
  folders: Record<string, LaunchpadFolder> = {}
): LaunchpadLayout {
  return { version: 1, groups, folders, hiddenAppIds: [] };
}

describe('Flow App Dock model', () => {
  it('does not double count the synthetic notification-center aggregate', () => {
    const approvals = {
      ...app('approvals', 'work'),
      notificationSourceKey: 'approvals',
      badgeMetadata: {
        totalUnread: 4,
        actionableUnread: 2,
        urgentUnread: 1,
        intent: 'urgent' as const,
        accessibleLabel: '4 unread notifications',
      },
    };
    const notifications = {
      ...app('dwp-notifications', 'work'),
      notificationSourceKey: 'notifications',
      badgeMetadata: {
        totalUnread: 4,
        actionableUnread: 2,
        urgentUnread: 1,
        intent: 'urgent' as const,
        accessibleLabel: '4 unread notifications',
      },
    };

    expect(summarizeHiddenFlowAppNotifications([approvals, notifications], new Set())).toEqual({
      total: 4,
      actionable: 2,
      urgent: 1,
    });
  });

  it('does not surface the aggregate when all source apps are already visible', () => {
    const approvals = {
      ...app('approvals', 'work'),
      notificationSourceKey: 'approvals',
      badgeMetadata: {
        totalUnread: 4,
        actionableUnread: 2,
        urgentUnread: 0,
        intent: 'actionable' as const,
        accessibleLabel: '4 unread notifications',
      },
    };
    const notifications = {
      ...app('dwp-notifications', 'work'),
      notificationSourceKey: 'notifications',
      badgeMetadata: {
        totalUnread: 4,
        actionableUnread: 2,
        urgentUnread: 0,
        intent: 'actionable' as const,
        accessibleLabel: '4 unread notifications',
      },
    };

    expect(
      summarizeHiddenFlowAppNotifications([approvals, notifications], new Set([approvals.id]))
    ).toEqual({ total: 0, actionable: 0, urgent: 0 });
  });

  it('gives every non-empty group one item before distributing the remaining budget', () => {
    const groups = ['work', 'connect', 'services', 'systems'].map(group);
    const itemIdsByGroup = {
      work: ['w1', 'w2', 'w3', 'w4', 'w5'],
      connect: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'],
      services: ['s1', 's2', 's3'],
      systems: ['y1', 'y2'],
    };
    const apps = groups.flatMap(({ id }) =>
      itemIdsByGroup[id as keyof typeof itemIdsByGroup].map((itemId) => app(itemId, id))
    );

    const result = resolveFlowAppDockModel({
      apps,
      groups,
      layout: layout(itemIdsByGroup),
      itemLimit: 12,
    });

    expect(result.groups.map(({ id, itemIds }) => [id, itemIds])).toEqual([
      ['work', ['w1', 'w2', 'w3', 'w4']],
      ['connect', ['c1', 'c2', 'c3']],
      ['services', ['s1', 's2', 's3']],
      ['systems', ['y1', 'y2']],
    ]);
    expect(result.visibleItemIds).toEqual([
      'w1',
      'w2',
      'w3',
      'w4',
      'c1',
      'c2',
      'c3',
      's1',
      's2',
      's3',
      'y1',
      'y2',
    ]);
    expect(result).toMatchObject({
      visibleItemCount: 12,
      hiddenItemCount: 5,
      visibleAppCount: 12,
      hiddenAppCount: 5,
      totalValidItemCount: 17,
      totalValidAppCount: 17,
    });
  });

  it('preserves every configured group surface when compact selection leaves groups empty', () => {
    const groups = ['work', 'connect', 'services', 'systems'].map(group);
    const selectedGroups = resolveFlowAppDockModel({
      apps: groups.map(({ id }) => app(`${id}-1`, id)),
      groups,
      layout: layout(Object.fromEntries(groups.map(({ id }) => [id, [`${id}-1`]]))),
      itemLimit: 2,
    }).groups;

    expect(
      preserveFlowAppDockGroupSurfaces(groups, selectedGroups).map(({ id, itemIds }) => [
        id,
        itemIds,
      ])
    ).toEqual([
      ['work', ['work-1']],
      ['connect', ['connect-1']],
      ['services', []],
      ['systems', []],
    ]);
  });

  it('keeps the view projection to two five-item rows per governed group', () => {
    const groups = [group('work'), group('connect')];
    const workItems = Array.from({ length: 12 }, (_, index) => `work-${index + 1}`);
    const connectItems = ['connect-1', 'connect-2'];
    const apps = [
      ...workItems.map((itemId) => app(itemId, 'work')),
      ...connectItems.map((itemId) => app(itemId, 'connect')),
    ];

    const result = resolveFlowAppDockModel({
      apps,
      groups,
      layout: layout({ work: workItems, connect: connectItems }),
      itemLimit: 20,
      itemLimitPerGroup: 10,
    });

    expect(result.groups.map(({ id, itemIds }) => [id, itemIds])).toEqual([
      ['work', workItems.slice(0, 10)],
      ['connect', connectItems],
    ]);
    expect(result.hiddenItemIds).toEqual(['work-11', 'work-12']);
    expect(result.visibleItemCount).toBe(12);
    expect(result.hiddenItemCount).toBe(2);
  });

  it('limits by leading group order when the budget is smaller than the non-empty group count', () => {
    const groups = ['work', 'connect', 'services', 'systems'].map(group);
    const result = resolveFlowAppDockModel({
      apps: groups.map(({ id }) => app(`${id}-1`, id)),
      groups,
      layout: layout(Object.fromEntries(groups.map(({ id }) => [id, [`${id}-1`]]))),
      itemLimit: 2,
    });

    expect(result.groups.map(({ id, itemIds }) => [id, itemIds])).toEqual([
      ['work', ['work-1']],
      ['connect', ['connect-1']],
    ]);
    expect(result.hiddenItemIds).toEqual(['services-1', 'systems-1']);
    expect(result.hiddenItemCount).toBe(2);
    expect(result.visibleAppIds).toEqual(['work-1', 'connect-1']);
    expect(result.hiddenAppCount).toBe(2);
  });

  it('keeps valid folders while excluding stale, empty, misplaced, and duplicate items', () => {
    const groups = [group('work'), group('connect')];
    const apps = [app('work-1', 'work'), app('work-2', 'work'), app('connect-1', 'connect')];
    const folders = {
      'folder-valid': folder('folder-valid', 'work', ['work-1', 'work-2']),
      'folder-empty': folder('folder-empty', 'work', ['revoked-app']),
      'folder-misplaced': folder('folder-misplaced', 'connect', ['connect-1']),
    };
    const sourceLayout = layout(
      {
        work: ['unknown-app', 'folder-valid', 'folder-empty', 'folder-misplaced', 'work-2'],
        connect: ['connect-1', 'work-2', 'folder-missing'],
      },
      folders
    );
    const before = structuredClone(sourceLayout);

    const result = resolveFlowAppDockModel({
      apps,
      groups,
      layout: sourceLayout,
      itemLimit: 3,
    });

    expect(result.groups.map(({ id, itemIds }) => [id, itemIds])).toEqual([
      ['work', ['folder-valid', 'work-2']],
      ['connect', ['connect-1']],
    ]);
    expect(result.hiddenItemIds).toEqual([]);
    expect(result.totalValidItemCount).toBe(3);
    expect(result.visibleAppIds).toEqual(['work-1', 'work-2', 'connect-1']);
    expect(result.totalValidAppCount).toBe(3);
    expect(sourceLayout).toEqual(before);
  });

  it('normalizes invalid budgets and reports every valid item as hidden at zero', () => {
    const groups = [group('work')];
    const sourceLayout = layout({ work: ['work-1', 'work-2'] });
    const apps = [app('work-1', 'work'), app('work-2', 'work')];

    const result = resolveFlowAppDockModel({
      apps,
      groups,
      layout: sourceLayout,
      itemLimit: Number.NaN,
    });

    expect(result).toEqual({
      groups: [],
      visibleItemIds: [],
      hiddenItemIds: ['work-1', 'work-2'],
      visibleAppIds: [],
      visibleItemCount: 0,
      hiddenItemCount: 2,
      visibleAppCount: 0,
      hiddenAppCount: 2,
      totalValidItemCount: 2,
      totalValidAppCount: 2,
    });
  });
});
