export type MeetingConnectionTransport = (sessionId: string) => Promise<unknown>;

type MeetingConnectionSyncConfiguration = {
  foregroundAttempts?: number;
  recoveryAttempts?: number;
  shouldRetry?: (error: unknown) => boolean;
  wait?: (delayMs: number) => Promise<void>;
};

const defaultWait = (delayMs: number) =>
  new Promise<void>((resolve) => globalThis.setTimeout(resolve, delayMs));

export function createMeetingConnectionSynchronizer(
  transport: MeetingConnectionTransport,
  configuration: MeetingConnectionSyncConfiguration = {}
) {
  const maximumAttempts = Math.max(1, configuration.foregroundAttempts ?? 3);
  const maximumRecoveryAttempts = Math.max(1, configuration.recoveryAttempts ?? 8);
  const shouldRetry = configuration.shouldRetry ?? (() => true);
  const wait = configuration.wait ?? defaultWait;
  let cycle = 0;
  let activeSessionId: string | null = null;
  let confirmed = false;
  let request: Promise<void> | null = null;
  let recoveryRequest: Promise<void> | null = null;

  const start = (sessionId: string) => {
    cycle += 1;
    activeSessionId = sessionId;
    confirmed = false;
    request = null;
    recoveryRequest = null;
  };

  return {
    start,
    synchronize(sessionId: string): Promise<void> {
      if (activeSessionId !== sessionId) start(sessionId);
      if (confirmed) return Promise.resolve();
      if (request) return request;
      if (recoveryRequest) return recoveryRequest;

      const requestCycle = cycle;
      const pending = Promise.resolve()
        .then(async () => {
          for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
            try {
              await transport(sessionId);
              if (cycle === requestCycle && activeSessionId === sessionId) confirmed = true;
              return;
            } catch (error) {
              if (attempt === maximumAttempts || !shouldRetry(error)) throw error;
              await wait(Math.min(1_000 * 2 ** (attempt - 1), 4_000));
            }
          }
        })
        .catch((error: unknown) => {
          if (cycle === requestCycle && request === pending) request = null;
          throw error;
        });
      request = pending;
      return request;
    },
    recover(sessionId: string): Promise<void> {
      if (activeSessionId !== sessionId || confirmed) return Promise.resolve();
      if (recoveryRequest) return recoveryRequest;

      const requestCycle = cycle;
      const pending = Promise.resolve()
        .then(async () => {
          let lastError: unknown;
          for (let attempt = 1; attempt <= maximumRecoveryAttempts; attempt += 1) {
            await wait(Math.min(2_000 * 2 ** (attempt - 1), 10_000));
            if (cycle !== requestCycle || activeSessionId !== sessionId) return;
            try {
              await transport(sessionId);
              if (cycle === requestCycle && activeSessionId === sessionId) confirmed = true;
              return;
            } catch (error) {
              if (!shouldRetry(error)) throw error;
              lastError = error;
            }
          }
          throw lastError;
        })
        .finally(() => {
          if (cycle === requestCycle && recoveryRequest === pending) recoveryRequest = null;
        });
      recoveryRequest = pending;
      return pending;
    },
    settle(sessionId: string): Promise<void> {
      return activeSessionId === sessionId && request ? request : Promise.resolve();
    },
    end(sessionId: string): void {
      if (activeSessionId !== sessionId) return;
      cycle += 1;
      activeSessionId = null;
      confirmed = false;
      request = null;
      recoveryRequest = null;
    },
  };
}
