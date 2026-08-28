export type MeetingEndRequest = {
  sessionId: string;
  expectedVersion: number;
};

export function createMeetingEndSynchronizer<Result>(
  settleConnection: (sessionId: string) => Promise<void>,
  endMeeting: (expectedVersion: number) => Promise<Result>
) {
  let request: Promise<Result> | null = null;

  return {
    synchronize(input: MeetingEndRequest): Promise<Result> {
      if (request) return request;

      const pending = Promise.resolve()
        .then(() => settleConnection(input.sessionId))
        .catch(() => undefined)
        .then(() => endMeeting(input.expectedVersion))
        .catch((error: unknown) => {
          if (request === pending) request = null;
          throw error;
        });
      request = pending;
      return pending;
    },
  };
}
