import type { PreferenceSectionKey, PreferenceView } from './notification-preference-navigation';

export type NotificationSettingsUrlState = {
  view: PreferenceView;
  section: PreferenceSectionKey;
  appKey: string | null;
};

export type NotificationSettingsNavigationChangeOptions = {
  replace?: boolean;
};

const DEFAULT_STATE: NotificationSettingsUrlState = {
  view: 'settings',
  section: 'global',
  appKey: null,
};

const VIEWS = new Set<PreferenceView>(['settings', 'diagnostics']);
const SECTIONS = new Set<PreferenceSectionKey>([
  'presentation',
  'global',
  'attention',
  'quiet',
  'digest',
  'apps',
]);
const APP_KEY = /^[a-z0-9][a-z0-9._-]{0,63}$/i;

export function readNotificationSettingsUrlState(
  search: URLSearchParams
): NotificationSettingsUrlState {
  const view = search.get('view');
  const section = search.get('section');
  const appKey = search.get('app');

  return {
    view: VIEWS.has(view as PreferenceView) ? (view as PreferenceView) : DEFAULT_STATE.view,
    section: SECTIONS.has(section as PreferenceSectionKey)
      ? (section as PreferenceSectionKey)
      : DEFAULT_STATE.section,
    appKey: appKey && APP_KEY.test(appKey) ? appKey : null,
  };
}

export function writeNotificationSettingsUrlState(
  current: URLSearchParams,
  state: NotificationSettingsUrlState
): URLSearchParams {
  const next = new URLSearchParams(current);

  if (state.view === DEFAULT_STATE.view) next.delete('view');
  else next.set('view', state.view);

  if (state.section === DEFAULT_STATE.section) next.delete('section');
  else next.set('section', state.section);

  if (state.appKey) next.set('app', state.appKey);
  else next.delete('app');

  return next;
}

export function canonicalizeNotificationSettingsSearch(current: URLSearchParams): URLSearchParams {
  return writeNotificationSettingsUrlState(current, readNotificationSettingsUrlState(current));
}
