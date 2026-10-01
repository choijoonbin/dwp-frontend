import type { PersonalSettingsWorkspace } from '@dwp-frontend/shared-utils';

export type PersonalSettingsWorkspaceRuntimeState =
  | 'CURRENT'
  | 'REVIEW_REQUIRED'
  | 'OFFLINE_CACHED'
  | 'OFFLINE_UNAVAILABLE'
  | 'REFRESH_FAILED_CACHED'
  | 'UNAVAILABLE';

const REVIEW_FRESHNESS_STATES = new Set([
  'UNCONFIRMED',
  'CHANGED_SINCE_CONFIRMATION',
  'REVIEW_DUE',
]);

export type PersonalSettingsFreshnessState =
  PersonalSettingsWorkspace['observation']['freshnessState'] | 'UNAVAILABLE';

export function personalSettingsFreshnessState(value: unknown): PersonalSettingsFreshnessState {
  return value === 'CURRENT' || REVIEW_FRESHNESS_STATES.has(String(value))
    ? (value as PersonalSettingsWorkspace['observation']['freshnessState'])
    : 'UNAVAILABLE';
}

export function resolvePersonalSettingsWorkspaceRuntime({
  online,
  hasSnapshot,
  queryError,
  freshnessState,
}: {
  online: boolean;
  hasSnapshot: boolean;
  queryError: boolean;
  freshnessState?: unknown;
}): { state: PersonalSettingsWorkspaceRuntimeState; readOnly: boolean } {
  if (!online) {
    return {
      state: hasSnapshot ? 'OFFLINE_CACHED' : 'OFFLINE_UNAVAILABLE',
      readOnly: true,
    };
  }
  if (queryError) {
    return {
      state: hasSnapshot ? 'REFRESH_FAILED_CACHED' : 'UNAVAILABLE',
      readOnly: true,
    };
  }
  const presentedFreshness = personalSettingsFreshnessState(freshnessState);
  if (REVIEW_FRESHNESS_STATES.has(presentedFreshness)) {
    return { state: 'REVIEW_REQUIRED', readOnly: false };
  }
  if (presentedFreshness === 'CURRENT') return { state: 'CURRENT', readOnly: false };
  return { state: 'UNAVAILABLE', readOnly: true };
}
