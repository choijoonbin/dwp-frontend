import { HttpError } from '@dwp-frontend/shared-utils';

export type MeetingAttendanceSyncState = 'recovering' | 'failed' | null;

export const meetingAuthorizationDenied = (error: unknown) =>
  error instanceof HttpError && [401, 403, 404].includes(error.status);

type MeetingAttendanceSyncInput = {
  synchronize: () => Promise<void>;
  recover: () => Promise<void>;
  isCurrent: () => boolean;
  handleAccessRevoked: (error: unknown) => boolean;
  onStateChange: (state: MeetingAttendanceSyncState) => void;
};

export async function synchronizeMeetingAttendance({
  synchronize,
  recover,
  isCurrent,
  handleAccessRevoked,
  onStateChange,
}: MeetingAttendanceSyncInput): Promise<void> {
  try {
    await synchronize();
  } catch (error) {
    if (handleAccessRevoked(error) || !isCurrent()) return;
    onStateChange('recovering');
    try {
      await recover();
    } catch (recoveryError) {
      if (handleAccessRevoked(recoveryError) || !isCurrent()) return;
      onStateChange('failed');
      return;
    }
  }
  if (isCurrent()) onStateChange(null);
}
