import type { NotificationDeliveryProfile } from '@dwp-frontend/shared-utils/api/notification-api';

export type NotificationProfileSaveOutcome = {
  saved: NotificationDeliveryProfile;
  recovered: boolean;
};

type NotificationProfileSaveContext = {
  sequence: number;
  latest: boolean;
};

export type NotificationProfileSaveQueueOptions = {
  persist: (next: NotificationDeliveryProfile) => Promise<NotificationProfileSaveOutcome>;
  onBusyChange: (busy: boolean) => void;
  onSuccess: (
    outcome: NotificationProfileSaveOutcome,
    context: NotificationProfileSaveContext
  ) => void | Promise<void>;
  onError: (error: unknown, context: NotificationProfileSaveContext) => void | Promise<void>;
};

/** Keeps one in-flight write and coalesces all waiting edits into the latest user intent. */
export function createLatestNotificationProfileSaveQueue(
  options: NotificationProfileSaveQueueOptions
) {
  let running = false;
  let disposed = false;
  let latestSequence = 0;
  let pending: { sequence: number; next: NotificationDeliveryProfile } | null = null;

  const drain = async () => {
    if (running || disposed) return;
    running = true;
    options.onBusyChange(true);
    try {
      while (pending && !disposed) {
        const intent = pending;
        pending = null;
        try {
          const outcome = await options.persist(intent.next);
          if (disposed) return;
          await options.onSuccess(outcome, {
            sequence: intent.sequence,
            latest: intent.sequence === latestSequence,
          });
        } catch (error) {
          if (disposed) return;
          await options.onError(error, {
            sequence: intent.sequence,
            latest: intent.sequence === latestSequence,
          });
        }
      }
    } finally {
      running = false;
      if (!disposed) options.onBusyChange(false);
    }
  };

  return {
    enqueue(next: NotificationDeliveryProfile) {
      latestSequence += 1;
      pending = { sequence: latestSequence, next };
      void drain();
      return latestSequence;
    },
    dispose() {
      disposed = true;
      pending = null;
    },
    isBusy() {
      return running || pending !== null;
    },
  };
}
