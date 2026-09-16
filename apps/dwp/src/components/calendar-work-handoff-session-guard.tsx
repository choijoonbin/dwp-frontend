import { useEffect } from 'react';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { usePermissions } from '@dwp-frontend/shared-utils/auth/use-permissions';
import { workCalendarOwnerFingerprint } from '@dwp-frontend/shared-utils/api/work-hub-calendar-api';

import {
  clearCalendarWorkHandoffRecovery,
  readCalendarWorkHandoffRecovery,
} from '../features/calendar/calendar-work-handoff';
import { useWorkHubOperationOwner } from './use-work-hub-operation-owner';

/** Clears the opaque Calendar receipt even when route guards unmount Calendar during session loss. */
export function CalendarWorkHandoffSessionGuard() {
  const auth = useAuth();
  const { isLoaded: permissionsLoaded, permissions } = usePermissions();
  const owner = useWorkHubOperationOwner();

  useEffect(() => {
    if (auth.isLoading || (auth.isAuthenticated && !permissionsLoaded)) return;
    if (!auth.isAuthenticated || !owner) {
      clearCalendarWorkHandoffRecovery();
      return;
    }
    let active = true;
    void workCalendarOwnerFingerprint(owner)
      .then((fingerprint) => {
        if (active) readCalendarWorkHandoffRecovery(permissions, fingerprint, true);
      })
      .catch(() => {
        if (active) clearCalendarWorkHandoffRecovery();
      });
    return () => {
      active = false;
    };
  }, [auth.isAuthenticated, auth.isLoading, owner, permissions, permissionsLoaded]);

  return null;
}
