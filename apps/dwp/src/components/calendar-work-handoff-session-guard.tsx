import { useEffect } from 'react';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { usePermissions } from '@dwp-frontend/shared-utils/auth/use-permissions';

import { clearCalendarWorkHandoffRecovery } from '../features/calendar/calendar-work-handoff-recovery-storage';
import { useWorkHubOperationOwner } from './use-work-hub-operation-owner';

function clearWorkCalendarDocumentHandoffOnSessionLoss(): void {
  try {
    window.sessionStorage.removeItem('dwp.calendar.work-document-handoff.v1');
  } catch {
    // Session teardown remains best-effort if browser storage was revoked.
  }
}

/** Clears the opaque Calendar receipt even when route guards unmount Calendar during session loss. */
export function CalendarWorkHandoffSessionGuard() {
  const auth = useAuth();
  const { isLoaded: permissionsLoaded, permissions } = usePermissions();
  const owner = useWorkHubOperationOwner();

  useEffect(() => {
    if (auth.isLoading || (auth.isAuthenticated && !permissionsLoaded)) return;
    if (!auth.isAuthenticated || !owner) {
      clearCalendarWorkHandoffRecovery();
      clearWorkCalendarDocumentHandoffOnSessionLoss();
      return;
    }
    let active = true;
    void Promise.all([
      import('@dwp-frontend/shared-utils/api/work-hub-calendar-api'),
      import('../features/calendar/calendar-work-handoff'),
    ])
      .then(async ([{ workCalendarOwnerFingerprint }, { readCalendarWorkHandoffRecovery }]) => {
        const fingerprint = await workCalendarOwnerFingerprint(owner);
        if (active) readCalendarWorkHandoffRecovery(permissions, fingerprint, true);
      })
      .catch(() => {
        if (active) {
          clearCalendarWorkHandoffRecovery();
          clearWorkCalendarDocumentHandoffOnSessionLoss();
        }
      });
    return () => {
      active = false;
    };
  }, [auth.isAuthenticated, auth.isLoading, owner, permissions, permissionsLoaded]);

  return null;
}
