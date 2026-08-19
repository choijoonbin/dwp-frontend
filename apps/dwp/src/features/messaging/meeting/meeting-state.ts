import type {
  MessagingMeetingCapability,
  MessagingMeetingSession,
} from '@dwp-frontend/shared-utils/api/messaging-meeting-api';

export type MeetingLobbyState = 'LOADING' | 'UNAVAILABLE' | 'START' | 'JOIN';

export function resolveMeetingLobbyState(input: {
  loading: boolean;
  capability?: MessagingMeetingCapability;
  session?: MessagingMeetingSession | null;
}): MeetingLobbyState {
  if (input.loading) return 'LOADING';
  if (!input.capability?.available) return 'UNAVAILABLE';
  return input.session?.lifecycleState === 'ACTIVE' ? 'JOIN' : 'START';
}
