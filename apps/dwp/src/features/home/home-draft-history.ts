import type { HomePresentation, HomeWidgetPreference } from '@dwp-frontend/shared-utils';
import type { LaunchpadLayout } from '../../components/workspace-composer/app-launchpad-model';

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
