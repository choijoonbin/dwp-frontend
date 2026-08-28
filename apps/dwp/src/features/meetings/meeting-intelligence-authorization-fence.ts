import { HttpError } from '@dwp-frontend/shared-utils';
import type {
  VideoMeetingIntelligenceReport,
  VideoMeetingIntelligenceReviewDecision,
  VideoMeetingIntelligenceRun,
} from '@dwp-frontend/shared-utils/api/video-meeting-intelligence-api';

export type MeetingIntelligenceAuthorizationGeneration = Readonly<{
  scope: string;
  generation: number;
}>;

export type MeetingIntelligenceAuthorizationValidation = Readonly<{
  scope: string;
  sequence: number;
}>;

export type AuthorizedRunCommand = {
  authorization: MeetingIntelligenceAuthorizationGeneration;
};

export type AuthorizedReviewCommand = AuthorizedRunCommand & {
  decision: VideoMeetingIntelligenceReviewDecision;
  reasonCode: string;
  report: VideoMeetingIntelligenceReport;
};

export type AuthorizedPublishCommand = AuthorizedRunCommand & {
  report: VideoMeetingIntelligenceReport;
};

export type AuthorizedActiveRun = AuthorizedRunCommand & {
  run: VideoMeetingIntelligenceRun;
};

export const isMeetingIntelligenceAuthorizationError = (error: unknown) =>
  error instanceof HttpError && (error.status === 401 || error.status === 403);

export function selectMeetingIntelligenceAuthorizedWriteback(
  cached: VideoMeetingIntelligenceReport | null | undefined,
  incoming: VideoMeetingIntelligenceReport,
  commandReport: VideoMeetingIntelligenceReport
): VideoMeetingIntelligenceReport | null {
  if (!cached) return null;
  if (
    incoming.reportId !== commandReport.reportId ||
    incoming.version < commandReport.version ||
    cached.reportId !== incoming.reportId ||
    cached.version > incoming.version
  ) {
    return cached;
  }
  return incoming;
}

export class MeetingIntelligenceAuthorizationSupersededError extends Error {
  constructor() {
    super('Meeting intelligence authorization validation was superseded.');
    this.name = 'MeetingIntelligenceAuthorizationSupersededError';
  }
}

export function createMeetingIntelligenceAuthorizationFence(scope: string) {
  let generation = 0;
  let validationSequence = 0;
  let denied = false;

  const revoke = () => {
    validationSequence += 1;
    if (!denied) generation += 1;
    denied = true;
    return generation;
  };
  const canCommit = (snapshot: MeetingIntelligenceAuthorizationGeneration) =>
    !denied && snapshot.scope === scope && snapshot.generation === generation;

  return {
    scope,
    beginValidation(): MeetingIntelligenceAuthorizationValidation {
      validationSequence += 1;
      return { scope, sequence: validationSequence };
    },
    authorize(validation: MeetingIntelligenceAuthorizationValidation): boolean {
      if (validation.scope !== scope || validation.sequence !== validationSequence) return false;
      denied = false;
      return true;
    },
    deny(validation: MeetingIntelligenceAuthorizationValidation): number | null {
      if (validation.scope !== scope || validation.sequence !== validationSequence) return null;
      return revoke();
    },
    revoke,
    capture(): MeetingIntelligenceAuthorizationGeneration {
      return { scope, generation };
    },
    canCommit,
    commit(snapshot: MeetingIntelligenceAuthorizationGeneration, write: () => void): boolean {
      if (!canCommit(snapshot)) return false;
      write();
      return true;
    },
    isDenied(): boolean {
      return denied;
    },
  };
}
