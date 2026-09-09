import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { VideoMeetingSummary } from '@dwp-frontend/shared-utils/api/video-meeting-api';

import {
  createMeetingHomeManualOutcomesLoader,
  type MeetingHomeManualOutcome,
} from './meeting-home-manual-outcomes-model';

export type MeetingHomeManualOutcomesState = {
  entries: MeetingHomeManualOutcome[];
  loading: boolean;
};

export function useMeetingHomeManualOutcomes({
  recent,
  scope,
  actorId,
  enabled,
}: {
  recent: readonly VideoMeetingSummary[];
  scope: string;
  actorId: number;
  enabled: boolean;
}): MeetingHomeManualOutcomesState {
  const client = useQueryClient();
  const meetingIds = recent.slice(0, 4).map((meeting) => meeting.meetingId);
  const binding = JSON.stringify([scope, actorId, meetingIds]);
  const loader = useMemo(() => createMeetingHomeManualOutcomesLoader(binding), [binding]);
  const queryKey = useMemo(
    () => ['meetings', 'home', 'manual-outcomes', binding] as const,
    [binding]
  );
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => loader.load(recent, actorId, signal),
    enabled: enabled && actorId > 0 && meetingIds.length > 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
    gcTime: 0,
    meta: { accessSensitive: true, actorId },
  });
  useEffect(
    () => () => {
      loader.revoke();
      client.removeQueries({ queryKey });
    },
    [client, loader, queryKey]
  );
  return {
    entries:
      enabled && !query.isError && !query.isRefetchError && !query.isFetching
        ? (query.data?.entries ?? [])
        : [],
    loading: enabled && meetingIds.length > 0 && (query.isLoading || query.isFetching),
  };
}
