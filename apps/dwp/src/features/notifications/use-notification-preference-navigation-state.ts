import { useCallback, useEffect, useMemo, useState } from 'react';

import type { NotificationAppSetting } from '@dwp-frontend/shared-utils/api/notification-api';
import type { PreferenceSectionKey, PreferenceView } from './notification-preference-navigation';
import type {
  NotificationSettingsNavigationChangeOptions,
  NotificationSettingsUrlState,
} from './notification-settings-url-state';

export function useNotificationPreferenceNavigationState({
  apps,
  navigationState,
  onNavigationStateChange,
}: {
  apps?: NotificationAppSetting[];
  navigationState?: NotificationSettingsUrlState;
  onNavigationStateChange?: (
    state: NotificationSettingsUrlState,
    options?: NotificationSettingsNavigationChangeOptions
  ) => void;
}) {
  const [localAppKey, setLocalAppKey] = useState<string | null>(null);
  const [localSection, setLocalSection] = useState<PreferenceSectionKey>('global');
  const [localView, setLocalView] = useState<PreferenceView>('settings');
  const requestedAppKey = navigationState ? navigationState.appKey : localAppKey;
  const section = navigationState?.section ?? localSection;
  const view = navigationState?.view ?? localView;

  const update = useCallback(
    (
      patch: Partial<NotificationSettingsUrlState>,
      options?: NotificationSettingsNavigationChangeOptions
    ) => {
      const next = { view, section, appKey: requestedAppKey, ...patch };
      if (!navigationState) {
        setLocalView(next.view);
        setLocalSection(next.section);
        setLocalAppKey(next.appKey);
      }
      onNavigationStateChange?.(next, options);
    },
    [navigationState, onNavigationStateChange, requestedAppKey, section, view]
  );

  useEffect(() => {
    if (!apps?.length) return;
    if (navigationState) {
      if (navigationState.appKey && !apps.some((app) => app.appKey === navigationState.appKey)) {
        onNavigationStateChange?.({ ...navigationState, appKey: null }, { replace: true });
      }
      return;
    }
    if (!localAppKey || !apps.some((app) => app.appKey === localAppKey)) {
      setLocalAppKey(apps[0].appKey);
    }
  }, [apps, localAppKey, navigationState, onNavigationStateChange]);

  const selectedApp = useMemo(
    () => apps?.find((app) => app.appKey === requestedAppKey) ?? apps?.[0] ?? null,
    [apps, requestedAppKey]
  );

  return {
    view,
    section,
    selectedApp,
    selectedAppKey: selectedApp?.appKey ?? null,
    update,
  };
}
