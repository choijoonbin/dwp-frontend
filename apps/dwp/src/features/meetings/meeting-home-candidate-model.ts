import type { VideoMeetingSummary } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import { getLatestPublishedVideoMeetingIntelligenceReport } from '@dwp-frontend/shared-utils/api/video-meeting-intelligence-api';
import { boundMeetingHomeResults, meetingHomeResultUnexpired } from './meeting-home-results-model';
import { projectMeetingFollowUpCandidates } from './meeting-follow-up-candidates-model';
import {
  createMeetingIntelligenceAuthorizationFence,
  MeetingIntelligenceAuthorizationSupersededError,
} from './meeting-intelligence-authorization-fence';

export function createMeetingHomeCandidateLoader(
  scope: string,
  read = getLatestPublishedVideoMeetingIntelligenceReport,
  now: () => number = Date.now
) {
  const fence = createMeetingIntelligenceAuthorizationFence(scope);
  return {
    revoke: fence.revoke,
    async load(recent: readonly VideoMeetingSummary[], signal?: AbortSignal) {
      const validation = fence.beginValidation();
      const results = await Promise.allSettled(
        boundMeetingHomeResults(recent).map(async (meeting) => {
          const report = await read(meeting.meetingId, signal);
          if (!report || !meetingHomeResultUnexpired(report, now())) return [];
          return projectMeetingFollowUpCandidates(meeting, report, now()).map((candidate) => ({
            ...candidate,
            retentionUntil: report.retentionUntil,
            legalHold: report.legalHold,
          }));
        })
      );
      if (signal?.aborted || !fence.authorize(validation))
        throw new MeetingIntelligenceAuthorizationSupersededError();
      return {
        entries: results.flatMap((result) => (result.status === 'fulfilled' ? result.value : [])),
        unavailable: results.some((result) => result.status === 'rejected'),
      };
    },
  };
}
