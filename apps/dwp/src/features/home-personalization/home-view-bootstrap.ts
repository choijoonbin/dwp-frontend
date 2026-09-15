import type {
  HomeExperienceVariant,
  HomePreferenceLayout,
  HomeView,
} from '@dwp-frontend/shared-utils';

export const DEFAULT_HOME_VIEW_KEY = 'default';

export type PendingHomeSaveCommand = {
  fingerprint: string;
  idempotencyKey: string;
};

export function resolveHomeViewCustomized(
  view: HomeView | null,
  legacyCustomized: boolean | undefined
): boolean {
  if (!view) return Boolean(legacyCustomized);
  if (typeof view.customized === 'boolean') return view.customized;
  return true;
}

export function resolvePendingHomeSaveCommand(
  current: PendingHomeSaveCommand | null,
  layout: HomePreferenceLayout,
  modeKey: HomeExperienceVariant,
  createKey: () => string,
  reset = false
): PendingHomeSaveCommand {
  const fingerprint = JSON.stringify({ modeKey, layout, reset });
  if (current?.fingerprint === fingerprint) return current;
  return { fingerprint, idempotencyKey: createKey() };
}
