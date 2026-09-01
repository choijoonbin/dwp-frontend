import type { HomePresentation, HomeWidgetPreference } from '@dwp-frontend/shared-utils';
import {
  mergeConcurrentTokenOrder,
  reapplyEntitledLaunchpadProjection,
} from '../../components/workspace-composer/app-launchpad-model';

import type {
  HomeAppDefinition,
  LaunchpadLayout,
} from '../../components/workspace-composer/app-launchpad-model';

export type HomeDraft = Readonly<{
  appLayout: LaunchpadLayout;
  presentation: HomePresentation;
  resetIntent: boolean;
  widgets: HomeWidgetPreference[];
}>;

export type HomeDraftHistory = Readonly<{
  past: HomeDraft[];
  present: HomeDraft;
  future: HomeDraft[];
}>;

function sameDraft(left: HomeDraft, right: HomeDraft): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function reapplyValue<T>(base: T, draft: T, latest: T): T {
  return sameValue(base, draft) ? latest : draft;
}

function reapplyWidgets(
  base: readonly HomeWidgetPreference[],
  draft: readonly HomeWidgetPreference[],
  latest: readonly HomeWidgetPreference[]
): HomeWidgetPreference[] {
  const baseByKey = new Map(base.map((widget) => [widget.widgetKey, widget]));
  const draftByKey = new Map(draft.map((widget) => [widget.widgetKey, widget]));
  const latestByKey = new Map(latest.map((widget) => [widget.widgetKey, widget]));
  const baseOrder = base.map((widget) => widget.widgetKey);
  const draftOrder = draft.map((widget) => widget.widgetKey);
  const latestOrder = latest.map((widget) => widget.widgetKey);
  const candidateKeys = [...new Set([...latestOrder, ...draftOrder])];
  const mergedByKey = new Map<string, HomeWidgetPreference>();
  candidateKeys.forEach((key) => {
    const baseWidget = baseByKey.get(key);
    const draftWidget = draftByKey.get(key);
    const latestWidget = latestByKey.get(key);
    const localMembershipChanged = Boolean(baseWidget) !== Boolean(draftWidget);
    if (localMembershipChanged) {
      if (draftWidget) mergedByKey.set(key, draftWidget);
      return;
    }
    if (!draftWidget || !baseWidget) {
      if (latestWidget) mergedByKey.set(key, latestWidget);
      return;
    }
    if (!latestWidget) return;

    const size = reapplyValue(baseWidget.size, draftWidget.size, latestWidget.size);
    const height = reapplyValue(baseWidget.height, draftWidget.height, latestWidget.height);
    const merged: HomeWidgetPreference = {
      widgetKey: key,
      visible: reapplyValue(baseWidget.visible, draftWidget.visible, latestWidget.visible),
    };
    if (size !== undefined) merged.size = size;
    if (height !== undefined) merged.height = height;
    mergedByKey.set(key, merged);
  });
  const mergedOrder = candidateKeys.filter((key) => mergedByKey.has(key));
  return mergeConcurrentTokenOrder(mergedOrder, baseOrder, draftOrder, latestOrder).map((key) =>
    mergedByKey.get(key)!
  );
}

/**
 * Reapplies only the user's local changes after an optimistic-lock conflict.
 * Untouched fields come from the latest server revision so a retry cannot silently
 * overwrite changes made in another session.
 */
export function reapplyHomeDraft(
  base: HomeDraft,
  draft: HomeDraft,
  latest: HomeDraft,
  entitledApps: readonly HomeAppDefinition[]
): HomeDraft {
  return {
    appLayout: reapplyEntitledLaunchpadProjection(
      latest.appLayout,
      base.appLayout,
      draft.appLayout,
      entitledApps
    ),
    presentation: reapplyValue(base.presentation, draft.presentation, latest.presentation),
    // A conflicted reset must not be retried as a destructive reset against a newer revision.
    // Its visible local deltas are reapplied below and the user can explicitly reset again.
    resetIntent: false,
    widgets: reapplyWidgets(base.widgets, draft.widgets, latest.widgets),
  };
}

export function createHomeDraftHistory(draft: HomeDraft): HomeDraftHistory {
  return { past: [], present: draft, future: [] };
}

export function replaceHomeDraftHistory(draft: HomeDraft): HomeDraftHistory {
  return createHomeDraftHistory(draft);
}

export function commitHomeDraft(history: HomeDraftHistory, nextDraft: HomeDraft): HomeDraftHistory {
  if (sameDraft(history.present, nextDraft)) return history;
  return {
    past: [...history.past, history.present],
    present: nextDraft,
    future: [],
  };
}

export function commitHomeDraftEdit(
  history: HomeDraftHistory,
  nextDraft: HomeDraft
): HomeDraftHistory {
  return commitHomeDraft(history, { ...nextDraft, resetIntent: false });
}

export function commitHomeDraftReset(
  history: HomeDraftHistory,
  nextDraft: HomeDraft
): HomeDraftHistory {
  return commitHomeDraft(history, { ...nextDraft, resetIntent: true });
}

export function undoHomeDraft(history: HomeDraftHistory): HomeDraftHistory {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redoHomeDraft(history: HomeDraftHistory): HomeDraftHistory {
  const next = history.future[0];
  if (!next) return history;
  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
  };
}

function changedWidgetCount(base: HomeDraft, draft: HomeDraft): number {
  const baseByKey = new Map(base.widgets.map((widget) => [widget.widgetKey, widget]));
  const draftByKey = new Map(draft.widgets.map((widget) => [widget.widgetKey, widget]));
  const keys = new Set([...baseByKey.keys(), ...draftByKey.keys()]);
  let changes = 0;
  keys.forEach((key) => {
    if (JSON.stringify(baseByKey.get(key)) !== JSON.stringify(draftByKey.get(key))) changes += 1;
  });
  if (
    base.widgets.map((widget) => widget.widgetKey).join('|') !==
    draft.widgets.map((widget) => widget.widgetKey).join('|')
  ) {
    changes += 1;
  }
  return changes;
}

export function homeDraftChangeCount(base: HomeDraft, draft: HomeDraft): number {
  let changes = changedWidgetCount(base, draft);
  if (base.resetIntent !== draft.resetIntent) changes += 1;
  if (base.presentation !== draft.presentation) changes += 1;
  if (JSON.stringify(base.appLayout.groups) !== JSON.stringify(draft.appLayout.groups))
    changes += 1;
  if (JSON.stringify(base.appLayout.folders) !== JSON.stringify(draft.appLayout.folders))
    changes += 1;
  if (
    JSON.stringify(base.appLayout.hiddenAppIds) !== JSON.stringify(draft.appLayout.hiddenAppIds)
  ) {
    changes += 1;
  }
  return changes;
}

export function isHomeDraftDirty(base: HomeDraft, draft: HomeDraft): boolean {
  return !sameDraft(base, draft);
}
