export type MeetingDepartureTransport = (keepalive: boolean) => Promise<unknown>;

type MeetingDepartureSyncOptions = {
  keepalive: boolean;
};

type MeetingDepartureSyncConfiguration = {
  foregroundAttempts?: number;
  wait?: (delayMs: number) => Promise<void>;
};

const defaultWait = (delayMs: number) =>
  new Promise<void>((resolve) => globalThis.setTimeout(resolve, delayMs));

export function createMeetingDepartureSynchronizer(
  transport: MeetingDepartureTransport,
  configuration: MeetingDepartureSyncConfiguration = {}
) {
  const requests = new Map<string, Promise<void>>();
  const foregroundAttempts = Math.max(1, configuration.foregroundAttempts ?? 3);
  const wait = configuration.wait ?? defaultWait;

  const send = async ({ keepalive }: MeetingDepartureSyncOptions) => {
    const maximumAttempts = keepalive ? 1 : foregroundAttempts;
    for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
      try {
        await transport(keepalive);
        return;
      } catch (error) {
        if (attempt === maximumAttempts) throw error;
        await wait(Math.min(750 * 2 ** (attempt - 1), 3_000));
      }
    }
  };

  return {
    synchronize(sessionId: string, options: MeetingDepartureSyncOptions): Promise<void> {
      const existing = requests.get(sessionId);
      if (existing) return existing;

      const request = Promise.resolve()
        .then(() => send(options))
        .catch((error: unknown) => {
          if (requests.get(sessionId) === request) requests.delete(sessionId);
          throw error;
        });
      requests.set(sessionId, request);
      return request;
    },
  };
}
