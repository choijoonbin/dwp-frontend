import {
  isExactCalendarEventReceipt,
  isExactWorkScheduleCommandIdentity,
  type WorkScheduleResult,
} from './work-hub-scheduling';
import type { CalendarEvent } from '@dwp-frontend/shared-utils/api/calendar-api';
import type { WorkScheduleCommand } from './work-hub-scheduling';

export type WorkScheduleCoordinatorOperation = {
  signal: AbortSignal;
  canContinue: () => boolean;
  cancel: () => void;
  publish: (result: WorkScheduleResult) => boolean;
};

export type WorkScheduleCoordinator = {
  owner: string | null;
  begin: (
    owner: string,
    itemKey: string,
    command: WorkScheduleCommand,
    confirmedEvent?: CalendarEvent
  ) => WorkScheduleCoordinatorOperation | null;
  clear: (owner: string, itemKey: string) => void;
  dispose: () => void;
  isActive: (owner: string, itemKey: string) => boolean;
  recover: (owner: string, itemKey: string) => WorkScheduleResult | null;
  subscribe: (listener: () => void) => () => void;
};

function shouldRetain(result: WorkScheduleResult) {
  return (
    result.state === 'LINK_PENDING' ||
    result.state === 'CALENDAR_UNCONFIRMED' ||
    ('reason' in result && result.reason === 'INVALID_RECEIPT')
  );
}

/**
 * Keeps only retry identity and the confirmed Calendar receipt in WorkLayout memory.
 * Nothing is serialized, so reviewed titles and event details never enter web storage.
 */
export function createWorkScheduleCoordinator(owner: string | null): WorkScheduleCoordinator {
  let disposed = false;
  let sequence = 0;
  const recoveries = new Map<string, WorkScheduleResult>();
  const latest = new Map<string, { token: number; commandIdentity: string }>();
  const active = new Map<string, { token: number; controller: AbortController }>();
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  return {
    owner,
    begin(requestOwner, itemKey, command, confirmedEvent) {
      if (
        disposed ||
        !owner ||
        requestOwner !== owner ||
        !itemKey ||
        !isExactWorkScheduleCommandIdentity(command, itemKey) ||
        (confirmedEvent !== undefined && !isExactCalendarEventReceipt(confirmedEvent, command))
      )
        return null;
      active.get(itemKey)?.controller.abort();
      const token = ++sequence;
      const controller = new AbortController();
      const commandIdentity = JSON.stringify(command);
      latest.set(itemKey, { token, commandIdentity });
      active.set(itemKey, { token, controller });
      recoveries.set(
        itemKey,
        confirmedEvent
          ? {
              state: 'LINK_PENDING',
              command,
              event: confirmedEvent,
              sourceChanged: false,
              reason: 'CANCELLED',
              retryable: true,
            }
          : {
              state: 'CALENDAR_UNCONFIRMED',
              command,
              sourceChanged: false,
              reason: 'CANCELLED',
              retryable: true,
            }
      );
      notify();
      return {
        signal: controller.signal,
        canContinue: () =>
          !disposed &&
          owner === requestOwner &&
          latest.get(itemKey)?.token === token &&
          !controller.signal.aborted,
        cancel: () => {
          if (latest.get(itemKey)?.token === token) controller.abort();
        },
        publish: (result) => {
          const current = latest.get(itemKey);
          if (
            disposed ||
            owner !== requestOwner ||
            current?.token !== token ||
            current?.commandIdentity !== commandIdentity ||
            JSON.stringify(result.command) !== commandIdentity
          )
            return false;
          if (shouldRetain(result)) recoveries.set(itemKey, result);
          else recoveries.delete(itemKey);
          if (!shouldRetain(result) && active.get(itemKey)?.token !== token)
            active.get(itemKey)?.controller.abort();
          if (active.get(itemKey)?.token === token || !shouldRetain(result)) active.delete(itemKey);
          notify();
          return true;
        },
      };
    },
    clear(requestOwner, itemKey) {
      if (disposed || owner !== requestOwner) return;
      active.get(itemKey)?.controller.abort();
      active.delete(itemKey);
      latest.delete(itemKey);
      if (recoveries.delete(itemKey)) notify();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      active.forEach(({ controller }) => controller.abort());
      active.clear();
      latest.clear();
      recoveries.clear();
      listeners.clear();
    },
    isActive(requestOwner, itemKey) {
      return !disposed && owner === requestOwner && active.has(itemKey);
    },
    recover(requestOwner, itemKey) {
      if (disposed || !owner || requestOwner !== owner) return null;
      return recoveries.get(itemKey) ?? null;
    },
    subscribe(listener) {
      if (disposed) return () => undefined;
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
