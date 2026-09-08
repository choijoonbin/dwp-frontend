import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPersonalWorkTask,
  deletePersonalWorkTask,
  getPersonalDayPlan,
  getPersonalWorkTasks,
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
