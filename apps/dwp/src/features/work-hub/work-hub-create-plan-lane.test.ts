import { describe, expect, it, vi } from 'vitest';
import { runWorkHubCreatePlanLane } from './work-hub-create-plan-lane';
import { createWorkTaskSaveCoordinator } from './work-hub-task-save-coordinator';

describe('Work create plan lane', () => {
  it('serializes one coordinator and removes an aborted queued follow-up', async () => {
    const coordinator = createWorkTaskSaveCoordinator('tenant:user:access');
    let finishFirst!: () => void;
    const firstPending = new Promise<void>((resolve) => {
      finishFirst = resolve;
    });
    const order: string[] = [];
    const first = runWorkHubCreatePlanLane(coordinator, {}, async () => {
      order.push('first:start');
      await firstPending;
      order.push('first:end');
    });
    const cancelled = new AbortController();
    const skipped = vi.fn(async () => {
      order.push('skipped');
    });
    const second = runWorkHubCreatePlanLane(coordinator, { signal: cancelled.signal }, skipped);
    const third = runWorkHubCreatePlanLane(coordinator, {}, async () => {
      order.push('third');
    });

    await vi.waitFor(() => expect(order).toEqual(['first:start']));
    cancelled.abort();
    await expect(second).rejects.toMatchObject({ name: 'AbortError' });
    expect(skipped).not.toHaveBeenCalled();
    expect(order).toEqual(['first:start']);

    finishFirst();
    await expect(first).resolves.toBeUndefined();
    await expect(third).resolves.toBeUndefined();
    expect(order).toEqual(['first:start', 'first:end', 'third']);
  });
});
