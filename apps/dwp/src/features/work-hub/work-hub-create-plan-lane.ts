import type { WorkHubActionGuard } from './work-hub-actions';
import type { WorkTaskSaveCoordinator } from './work-hub-task-save-coordinator';

type PlanLaneTicket<T> = {
  cleanup: () => void;
  execute: () => Promise<T>;
  guard: WorkHubActionGuard;
  reject: (reason: unknown) => void;
  resolve: (value: T | PromiseLike<T>) => void;
  started: boolean;
};

type PlanLane = {
  active: boolean;
  queued: PlanLaneTicket<unknown>[];
};

const planLanes = new WeakMap<WorkTaskSaveCoordinator, PlanLane>();

function abortError() {
  return new DOMException('Work owner changed', 'AbortError');
}

function canContinue(guard: WorkHubActionGuard) {
  return guard.signal?.aborted !== true && (guard.canContinue?.() ?? true);
}

function drain(lane: PlanLane) {
  if (lane.active) return;
  const ticket = lane.queued.shift();
  if (!ticket) return;
  if (!canContinue(ticket.guard)) {
    ticket.cleanup();
    ticket.reject(abortError());
    drain(lane);
    return;
  }
  ticket.cleanup();
  ticket.started = true;
  lane.active = true;
  void Promise.resolve()
    .then(() => {
      if (!canContinue(ticket.guard)) throw abortError();
      return ticket.execute();
    })
    .then(ticket.resolve, ticket.reject)
    .finally(() => {
      lane.active = false;
      drain(lane);
    });
}

/** Serializes create-to-plan follow-ups that share one Work controller. */
export function runWorkHubCreatePlanLane<T>(
  coordinator: WorkTaskSaveCoordinator | undefined,
  guard: WorkHubActionGuard,
  execute: () => Promise<T>
): Promise<T> {
  if (!coordinator) {
    if (!canContinue(guard)) return Promise.reject(abortError());
    return execute();
  }
  let lane = planLanes.get(coordinator);
  if (!lane) {
    lane = { active: false, queued: [] };
    planLanes.set(coordinator, lane);
  }
  return new Promise<T>((resolve, reject) => {
    const ticket: PlanLaneTicket<T> = {
      cleanup: () => undefined,
      execute,
      guard,
      reject,
      resolve,
      started: false,
    };
    const queued = ticket as PlanLaneTicket<unknown>;
    const removeAborted = () => {
      if (ticket.started) return;
      const index = lane!.queued.indexOf(queued);
      if (index < 0) return;
      lane!.queued.splice(index, 1);
      ticket.cleanup();
      reject(abortError());
    };
    if (guard.signal) {
      guard.signal.addEventListener('abort', removeAborted, { once: true });
      ticket.cleanup = () => guard.signal?.removeEventListener('abort', removeAborted);
    }
    lane.queued.push(queued);
    drain(lane);
  });
}
