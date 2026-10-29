import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { NotificationPreferences } from './notification-preferences';
import {
  canonicalizeNotificationSettingsSearch,
  readNotificationSettingsUrlState,
  writeNotificationSettingsUrlState,
  type NotificationSettingsNavigationChangeOptions,
  type NotificationSettingsUrlState,
} from './notification-settings-url-state';

export default function NotificationSettingsRoute() {
  const [searchParams, setSearchParams] = useSearchParams();
  const serializedSearch = searchParams.toString();
  const navigationState = useMemo(
    () => readNotificationSettingsUrlState(new URLSearchParams(serializedSearch)),
    [serializedSearch]
  );

  useEffect(() => {
    const canonical = canonicalizeNotificationSettingsSearch(new URLSearchParams(serializedSearch));
    if (canonical.toString() !== serializedSearch) {
      setSearchParams(canonical, { replace: true });
    }
  }, [serializedSearch, setSearchParams]);

  const handleNavigationStateChange = useCallback(
    (next: NotificationSettingsUrlState, options?: NotificationSettingsNavigationChangeOptions) => {
      setSearchParams(
        writeNotificationSettingsUrlState(new URLSearchParams(serializedSearch), next),
        { replace: options?.replace }
      );
    },
    [serializedSearch, setSearchParams]
  );

  return (
    <NotificationPreferences
      navigationState={navigationState}
      onNavigationStateChange={handleNavigationStateChange}
    />
  );
}
