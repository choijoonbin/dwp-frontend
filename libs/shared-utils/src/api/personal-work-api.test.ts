import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPersonalWorkTask,
  deletePersonalWorkTask,
  getPersonalDayPlan,
  getPersonalWorkTask,
  getPersonalWorkTasks,
  getPersonalWorkTimeline,
  replacePersonalDayPlan,
  transitionPersonalWorkTask,
  updatePersonalWorkTask,
} from './personal-work-api';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock('../axios-instance', () => ({ axiosInstance: http }));
const key = '1d48ca30-9f34-4f6d-8e73-9f75d4483eba';
beforeEach(() => {
  vi.resetAllMocks();
  for (const method of Object.values(http)) method.mockResolvedValue({ data: { data: {} } });
});

describe('personal Work API contracts', () => {
  it('passes an optional cancellation signal without changing the source command identity', async () => {
    const controller = new AbortController();
    await transitionPersonalWorkTask('task-1', 'complete', { version: 4 }, key, controller.signal);
    expect(http.post.mock.calls[0][2]).toEqual({
      headers: { 'Idempotency-Key': key },
      signal: controller.signal,
    });
  });
  it('passes cancellation through detail reads and checklist/delete writes', async () => {
    const controller = new AbortController();
    const input = { title: 'Work', priority: 'NORMAL' as const, version: 4, checklist: [] };
    await getPersonalWorkTask('task-1', controller.signal);
    await getPersonalWorkTimeline('task-1', 0, 100, controller.signal);
    await updatePersonalWorkTask('task-1', input, key, controller.signal);
    await deletePersonalWorkTask('task-1', { version: 4 }, key, controller.signal);
    expect(http.get).toHaveBeenNthCalledWith(
      1,
      '/api/platform/v1/workspace/work-hub/personal-tasks/task-1',
      { signal: controller.signal }
    );
    expect(http.get).toHaveBeenNthCalledWith(
      2,
      '/api/platform/v1/workspace/work-hub/personal-tasks/task-1/timeline?page=0&size=100',
      { signal: controller.signal }
    );
    expect(http.put).toHaveBeenCalledWith(
      '/api/platform/v1/workspace/work-hub/personal-tasks/task-1',
      input,
      { headers: { 'Idempotency-Key': key }, signal: controller.signal }
    );
    expect(http.post).toHaveBeenCalledWith(
      '/api/platform/v1/workspace/work-hub/personal-tasks/task-1/delete',
      { version: 4 },
      { headers: { 'Idempotency-Key': key }, signal: controller.signal }
    );
  });
  it('passes cancellation through create and whole-plan replacement writes', async () => {
    const controller = new AbortController();
    const task = { title: 'Work', priority: 'NORMAL' as const };
    const plan = {
      version: 3,
      items: [{ sourceSystem: 'DAY_PLAN_SELECTION', sourceReference: 'opaque-1' }],
    };
    await createPersonalWorkTask(task, key, controller.signal);
    await replacePersonalDayPlan('2026-09-04', plan, key, controller.signal);
    expect(http.post).toHaveBeenCalledWith(
      '/api/platform/v1/workspace/work-hub/personal-tasks',
      task,
      { headers: { 'Idempotency-Key': key }, signal: controller.signal }
    );
    expect(http.put).toHaveBeenCalledWith(
      '/api/platform/v1/workspace/work-hub/day-plans/2026-09-04',
      plan,
      { headers: { 'Idempotency-Key': key }, signal: controller.signal }
    );
  });
  it('binds a Mail owner command to the personal task create request', async () => {
    const task = { title: 'Work', priority: 'NORMAL' as const };
    await createPersonalWorkTask(task, key, undefined, {
      proposalId: '50000000-0000-4000-8000-000000000002',
      commandId: '60000000-0000-4000-8000-000000000002',
      version: 7,
    });
    expect(http.post).toHaveBeenCalledWith(
      '/api/platform/v1/workspace/work-hub/personal-tasks',
      task,
      {
        headers: {
          'Idempotency-Key': key,
          'X-DWP-Mail-Proposal-ID': '50000000-0000-4000-8000-000000000002',
          'X-DWP-Mail-Command-ID': '60000000-0000-4000-8000-000000000002',
          'X-DWP-Mail-Proposal-Version': '7',
        },
      }
    );
  });
  it('keeps a stable idempotency key and original version for command replay', async () => {
    await transitionPersonalWorkTask('id/1', 'complete', { version: 4 }, key);
    await transitionPersonalWorkTask('id/1', 'complete', { version: 4 }, key);
    expect(http.post).toHaveBeenNthCalledWith(
      1,
      '/api/platform/v1/workspace/work-hub/personal-tasks/id%2F1/complete',
      { version: 4 },
      { headers: { 'Idempotency-Key': key } }
    );
    expect(http.post.mock.calls[1]).toEqual(http.post.mock.calls[0]);
  });
  it('rejects a missing command identity before sending a mutation', async () => {
    await expect(createPersonalWorkTask({ title: 'Work', priority: 'NORMAL' }, '')).rejects.toThrow(
      'UUID'
    );
    expect(http.post).not.toHaveBeenCalled();
  });
  it('uses explicit lifecycle commands rather than setting completed on the status endpoint', async () => {
    await expect(
      transitionPersonalWorkTask('1', 'status', { version: 1, status: 'COMPLETED' }, key)
    ).rejects.toThrow('lifecycle');
    expect(http.post).not.toHaveBeenCalled();
  });
  it('retains source link on null and explicitly sends requested unlink', async () => {
    const input = {
      title: 'Work',
      priority: 'NORMAL' as const,
      version: 4,
      sourceReference: null,
      clearSourceReference: true,
    };
    await updatePersonalWorkTask('1', input, key);
    expect(http.put.mock.calls[0][1]).toEqual(input);
  });
  it('sends the whole ordered plan with its version and validates the calendar date', async () => {
    const input = {
      version: 3,
      items: [{ sourceSystem: 'DAY_PLAN_SELECTION', sourceReference: 'opaque-1' }],
    };
    await replacePersonalDayPlan('2026-09-04', input, key);
    expect(http.put).toHaveBeenCalledWith(
      '/api/platform/v1/workspace/work-hub/day-plans/2026-09-04',
      input,
      { headers: { 'Idempotency-Key': key } }
    );
    await expect(getPersonalDayPlan('2026-02-30')).rejects.toThrow();
  });
  it('sends checklist and ordered source identities with the current version', async () => {
    const input = {
      title: 'Prepare review',
      priority: 'HIGH' as const,
      version: 7,
      checklist: [{ itemId: key, title: 'Review evidence', completed: true }],
      sourceReferences: [
        { sourceSystem: 'SERVICE', sourceReference: 'request-1' },
        { sourceSystem: 'PERSONAL_TASK', sourceReference: 'task-2' },
      ],
    };
    await updatePersonalWorkTask('task-1', input, key);
    expect(http.put).toHaveBeenCalledWith(
      '/api/platform/v1/workspace/work-hub/personal-tasks/task-1',
      input,
      { headers: { 'Idempotency-Key': key } }
    );
  });
  it('soft deletion uses its version and stable command identity and returns server evidence', async () => {
    const result = { taskId: 'task-1', version: 8, deletedAt: '2026-09-07T01:00:00Z' };
    http.post.mockResolvedValue({ data: { data: result } });
    expect(await deletePersonalWorkTask('task-1', { version: 7 }, key)).toEqual(result);
    expect(http.post).toHaveBeenCalledWith(
      '/api/platform/v1/workspace/work-hub/personal-tasks/task-1/delete',
      { version: 7 },
      { headers: { 'Idempotency-Key': key } }
    );
  });
  it('exposes explicit personal pagination', async () => {
    const controller = new AbortController();
    await getPersonalWorkTasks({
      page: 1,
      size: 100,
      status: 'ARCHIVED',
      signal: controller.signal,
    });
    expect(http.get.mock.calls[0][0]).toBe(
      '/api/platform/v1/workspace/work-hub/personal-tasks?page=1&size=100&status=ARCHIVED'
    );
    expect(http.get.mock.calls[0][1]).toEqual({
      timeoutMs: 8_000,
      signal: controller.signal,
    });
  });
  it('passes cancellation to the day-plan read', async () => {
    const controller = new AbortController();
    await getPersonalDayPlan('2026-09-07', controller.signal);
    expect(http.get).toHaveBeenCalledWith(
      '/api/platform/v1/workspace/work-hub/day-plans/2026-09-07',
      { signal: controller.signal }
    );
  });
});
