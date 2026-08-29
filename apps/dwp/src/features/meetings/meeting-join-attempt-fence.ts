export type MeetingJoinResolutionIntent = Readonly<{
  generation: number;
  code: string;
}>;

export type MeetingJoinRequestIntent = Readonly<{
  generation: number;
  code: string;
  meetingId: string;
  displayName: string;
  requiresApproval: boolean;
}>;

export function createMeetingJoinAttemptFence(initialCode: string) {
  let generation = 0;
  let code = initialCode;
  let meetingId: string | null = null;

  const replaceCode = (nextCode: string) => {
    if (code === nextCode && meetingId === null) return;
    generation += 1;
    code = nextCode;
    meetingId = null;
  };

  return {
    replaceCode,
    beginResolution(nextCode: string): MeetingJoinResolutionIntent {
      generation += 1;
      code = nextCode;
      meetingId = null;
      return { generation, code };
    },
    canCommitResolution(intent: MeetingJoinResolutionIntent): boolean {
      return intent.generation === generation && intent.code === code && meetingId === null;
    },
    acceptResolution(intent: MeetingJoinResolutionIntent, resolvedMeetingId: string): boolean {
      if (!this.canCommitResolution(intent)) return false;
      meetingId = resolvedMeetingId;
      return true;
    },
    beginRequest(input: {
      meetingId: string;
      displayName: string;
      requiresApproval: boolean;
    }): MeetingJoinRequestIntent | null {
      if (!meetingId || meetingId !== input.meetingId) return null;
      generation += 1;
      return { generation, code, ...input };
    },
    canCommitRequest(intent: MeetingJoinRequestIntent): boolean {
      return (
        intent.generation === generation && intent.code === code && intent.meetingId === meetingId
      );
    },
    ownsMeeting(candidateMeetingId: string): boolean {
      return meetingId === candidateMeetingId;
    },
  };
}
