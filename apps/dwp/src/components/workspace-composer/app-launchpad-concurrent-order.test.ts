import { describe, expect, it } from 'vitest';

import {
  HOME_APP_GROUPS,
  HOME_APPS,
  canonicalizePersistedLaunchpadLayout,
  mergeConcurrentTokenOrder,
  reapplyEntitledLaunchpadProjection,
} from './app-launchpad-model';

const appIds = ['dwp-work', 'dwp-ask', 'dwp-activity', 'dwp-approvals'];
const apps = HOME_APPS.filter((app) => appIds.includes(app.id));

function permutations(items: readonly string[]): string[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((itemId, index) =>
    permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((suffix) => [
      itemId,
      ...suffix,
    ])
  );
}

function changedPairEdges(
  base: readonly string[],
  edited: readonly string[]
): Array<readonly [string, string]> {
  const edges: Array<readonly [string, string]> = [];
  base.forEach((leftId, leftIndex) => {
    base.slice(leftIndex + 1).forEach((rightId) => {
      if (edited.indexOf(leftId) > edited.indexOf(rightId)) edges.push([rightId, leftId]);
    });
  });
  return edges;
}

function isAcyclic(nodes: readonly string[], edges: readonly (readonly [string, string])[]) {
  const targets = new Map(nodes.map((nodeId) => [nodeId, [] as string[]]));
  edges.forEach(([beforeId, afterId]) => targets.get(beforeId)?.push(afterId));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (nodeId: string): boolean => {
    if (visiting.has(nodeId)) return false;
    if (visited.has(nodeId)) return true;
    visiting.add(nodeId);
    if (!(targets.get(nodeId) ?? []).every(visit)) return false;
    visiting.delete(nodeId);
    visited.add(nodeId);
    return true;
  };
  return nodes.every(visit);
}

describe('launchpad concurrent order merge', () => {
  it('preserves every compatible pair delta across four-token permutations', () => {
    const tokens = ['a', 'b', 'c', 'd'];
    const orders = permutations(tokens);

    orders.forEach((localOrder) => {
      orders.forEach((latestOrder) => {
        const requiredEdges = [
          ...changedPairEdges(tokens, localOrder),
          ...changedPairEdges(tokens, latestOrder),
        ];
        if (!isAcyclic(tokens, requiredEdges)) return;

        const merged = mergeConcurrentTokenOrder(localOrder, tokens, localOrder, latestOrder);
        requiredEdges.forEach(([beforeId, afterId]) => {
          expect(merged.indexOf(beforeId)).toBeLessThan(merged.indexOf(afterId));
        });
      });
    });
  });

  it('replays a local front restore over the latest untouched-sibling order', () => {
    const base = {
      version: 1 as const,
      groups: { work: appIds.slice(0, 3) },
      folders: {},
      hiddenAppIds: ['dwp-approvals'],
    };
    const edited = {
      ...base,
      groups: { work: ['dwp-approvals', ...appIds.slice(0, 3)] },
      hiddenAppIds: [],
    };
    const latest = {
      ...base,
      groups: { work: ['dwp-ask', 'dwp-work', 'dwp-activity'] },
    };

    const saved = reapplyEntitledLaunchpadProjection(latest, base, edited, apps);

    expect(saved.groups.work).toEqual(['dwp-approvals', 'dwp-ask', 'dwp-work', 'dwp-activity']);
    expect(saved.hiddenAppIds).toEqual([]);
    expect(canonicalizePersistedLaunchpadLayout(saved, apps, HOME_APP_GROUPS)).toEqual(saved);
  });

  it('keeps a latest independent front move around a local sibling swap', () => {
    const base = {
      version: 1 as const,
      groups: { work: appIds.slice(0, 3) },
      folders: {},
      hiddenAppIds: [],
    };
    const edited = {
      ...base,
      groups: { work: ['dwp-ask', 'dwp-work', 'dwp-activity'] },
    };
    const latest = {
      ...base,
      groups: { work: ['dwp-activity', 'dwp-work', 'dwp-ask'] },
    };

    const saved = reapplyEntitledLaunchpadProjection(latest, base, edited, apps);

    expect(saved.groups.work).toEqual(['dwp-activity', 'dwp-ask', 'dwp-work']);
    expect(canonicalizePersistedLaunchpadLayout(saved, apps, HOME_APP_GROUPS)).toEqual(saved);
  });

  it('uses the latest relation for a pair untouched by a local tail move', () => {
    const base = {
      version: 1 as const,
      groups: { work: ['dwp-work', 'dwp-ask', 'dwp-activity'] },
      folders: {},
      hiddenAppIds: [],
    };
    const edited = {
      ...base,
      groups: { work: ['dwp-ask', 'dwp-activity', 'dwp-work'] },
    };
    const latest = {
      ...base,
      groups: { work: ['dwp-work', 'dwp-activity', 'dwp-ask'] },
    };

    const saved = reapplyEntitledLaunchpadProjection(latest, base, edited, apps);

    expect(saved.groups.work).toEqual(['dwp-activity', 'dwp-ask', 'dwp-work']);
    expect(canonicalizePersistedLaunchpadLayout(saved, apps, HOME_APP_GROUPS)).toEqual(saved);
  });

  it('prioritizes an actual latest move over unchanged-pair stabilization', () => {
    const base = {
      version: 1 as const,
      groups: { work: ['dwp-work', 'dwp-approvals', 'dwp-ask'] },
      folders: {},
      hiddenAppIds: [],
    };
    const edited = {
      ...base,
      groups: { work: ['dwp-work', 'dwp-ask', 'dwp-approvals'] },
    };
    const latest = {
      ...base,
      groups: { work: ['dwp-approvals', 'dwp-work', 'dwp-ask'] },
    };

    const saved = reapplyEntitledLaunchpadProjection(latest, base, edited, apps);

    expect(saved.groups.work).toEqual(['dwp-ask', 'dwp-approvals', 'dwp-work']);
    expect(canonicalizePersistedLaunchpadLayout(saved, apps, HOME_APP_GROUPS)).toEqual(saved);
  });

  it('replays a local folder-member restore over the latest sibling order', () => {
    const base = {
      version: 1 as const,
      groups: { work: ['focus-folder'] },
      folders: {
        'focus-folder': {
          id: 'focus-folder',
          name: 'Focus',
          groupId: 'work',
          appIds: appIds.slice(0, 3),
        },
      },
      hiddenAppIds: ['dwp-approvals'],
    };
    const edited = {
      ...base,
      folders: {
        'focus-folder': {
          ...base.folders['focus-folder'],
          appIds: ['dwp-approvals', ...appIds.slice(0, 3)],
        },
      },
      hiddenAppIds: [],
    };
    const latest = {
      ...base,
      folders: {
        'focus-folder': {
          ...base.folders['focus-folder'],
          appIds: ['dwp-ask', 'dwp-work', 'dwp-activity'],
        },
      },
    };

    const saved = reapplyEntitledLaunchpadProjection(latest, base, edited, apps);

    expect(saved.folders['focus-folder']?.appIds).toEqual([
      'dwp-approvals',
      'dwp-ask',
      'dwp-work',
      'dwp-activity',
    ]);
    expect(saved.hiddenAppIds).toEqual([]);
    expect(canonicalizePersistedLaunchpadLayout(saved, apps, HOME_APP_GROUPS)).toEqual(saved);
  });
});
