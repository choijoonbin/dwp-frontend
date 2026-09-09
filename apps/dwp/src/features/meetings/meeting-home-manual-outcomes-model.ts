import type { VideoMeetingSummary } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import { getVideoMeeting } from '@dwp-frontend/shared-utils/api/video-meeting-api';

import {
  createMeetingIntelligenceAuthorizationFence,
  MeetingIntelligenceAuthorizationSupersededError,
} from './meeting-intelligence-authorization-fence';
import { boundMeetingHomeResults } from './meeting-home-results-model';

export type MeetingHomeManualOutcome = {
  meetingId: string;
  meetingTitle: string;
  endedAt: string;
  decision: string | null;
  followUp: {
    action: string;
    dueInDays: number | null;
    status: string | null;
  } | null;
};

export type MeetingHomeManualOutcomesSnapshot = {
  entries: MeetingHomeManualOutcome[];
  unavailableMeetingIds: string[];
};

function nonEmpty(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function presentationText(value: string | null | undefined) {
  return nonEmpty(value)?.replace(
    /^\[화면점검 · (?:수동 기록 · AI 결과 아님|수동 후속 초안 · 실제 업무 아님)\]\s*/u,
    ''
  );
}

export function projectMeetingHomeManualOutcome(
  meeting: VideoMeetingSummary,
  actorId: number
): MeetingHomeManualOutcome | null {
  if (meeting.lifecycleState !== 'ENDED' || !meeting.endedAt) return null;
  const decision =
    meeting.decisions.map((item) => presentationText(item.decision)).find(Boolean) ?? null;
  const ownedFollowUp = meeting.followUpActions.find(
    (item) => item.ownerUserId === actorId && Boolean(presentationText(item.action))
  );
  return {
    meetingId: meeting.meetingId,
    meetingTitle: meeting.title,
    endedAt: meeting.endedAt,
    decision,
    followUp: ownedFollowUp
      ? {
          action: presentationText(ownedFollowUp.action)!,
          dueInDays:
            Number.isInteger(ownedFollowUp.dueInDays) && Number(ownedFollowUp.dueInDays) >= 0
              ? Number(ownedFollowUp.dueInDays)
              : null,
          status: nonEmpty(ownedFollowUp.status),
        }
      : null,
  };
}

export function createMeetingHomeManualOutcomesLoader(
  scope: string,
  readMeeting = getVideoMeeting
) {
  const fence = createMeetingIntelligenceAuthorizationFence(scope);
  return {
    revoke: fence.revoke,
    async load(
      recent: readonly VideoMeetingSummary[],
      actorId: number,
      signal?: AbortSignal
    ): Promise<MeetingHomeManualOutcomesSnapshot> {
      const validation = fence.beginValidation();
      const candidates = boundMeetingHomeResults(recent);
      const results = await Promise.allSettled(
        candidates.map(async (meeting) => {
          const detail = await readMeeting(meeting.meetingId);
          if (detail.meetingId !== meeting.meetingId)
            throw new Error('Meeting detail binding mismatch');
          return projectMeetingHomeManualOutcome(detail, actorId);
        })
      );
      if (signal?.aborted || !fence.authorize(validation)) {
        throw new MeetingIntelligenceAuthorizationSupersededError();
      }
      const entries: MeetingHomeManualOutcome[] = [];
      const unavailableMeetingIds: string[] = [];
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          unavailableMeetingIds.push(candidates[index].meetingId);
        } else if (result.value) {
          entries.push(result.value);
        }
      });
      return { entries, unavailableMeetingIds };
    },
  };
}
