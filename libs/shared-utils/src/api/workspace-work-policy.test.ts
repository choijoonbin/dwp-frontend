import { describe, expect, it } from 'vitest';
import {
  canChangeWorkspaceWorkStatus,
  rankWorkspaceWorkItems,
  workspaceWorkFreshness,
  workspaceWorkActivityRoute,
  workspaceWorkItemReference,
  workspaceWorkItemRoute,
  workspaceWorkSourceRoute,
} from './workspace-work-policy';
import type { WorkspaceWorkItem } from './workspace-api';

function item(overrides: Partial<WorkspaceWorkItem> = {}): WorkspaceWorkItem {
  return {
    workItemId: 'task-1',
    id: 'WK-1',
    title: 'Task',
    type: 'Task',
    priority: 'high',
    status: 'open',
    owner: 'Me',
    sourceSystem: 'WORKSPACE',
    version: 0,
    updatedAt: '2026-09-04T00:00:00Z',
    ...overrides,
  };
}

describe('Workspace work policy', () => {
  it('never grants a generic transition from missing capabilities or an external projection', () => {
    expect(canChangeWorkspaceWorkStatus(item(), 'COMPLETED')).toBe(false);
    for (const sourceSystem of ['HR', 'APPROVAL_TASK', 'SERVICE_REQUEST', 'IDENTITY_GOVERNANCE']) {
      expect(
        canChangeWorkspaceWorkStatus(
          item({ sourceSystem, capabilities: { canStart: true, canComplete: true } }),
          'COMPLETED'
        )
      ).toBe(false);
    }
    expect(
      canChangeWorkspaceWorkStatus(
        item({ type: 'Approval', capabilities: { canStart: true, canComplete: true } }),
        'COMPLETED'
      )
    ).toBe(false);
  });
  it('uses explicit native capabilities and denies terminal/redundant transitions', () => {
    const native = item({
      sourceSystem: 'DWP_WORKSPACE',
      capabilities: { canStart: true, canComplete: true },
    });
    expect(canChangeWorkspaceWorkStatus(native, 'IN_PROGRESS')).toBe(true);
    expect(canChangeWorkspaceWorkStatus({ ...native, status: 'in-progress' }, 'IN_PROGRESS')).toBe(
      false
    );
    for (const status of ['completed', 'cancelled', 'archived'] as const)
      expect(canChangeWorkspaceWorkStatus({ ...native, status }, 'COMPLETED')).toBe(false);
  });
  it('preserves reviewer opaque identity on every queue entry', () => {
    const reference = 'd2e63316-8564-4d8c-bd02-eaede882f982';
    const review = item({
      type: 'Review',
      sourceSystem: 'IDENTITY_GOVERNANCE',
      sourceReference: reference,
    });
    expect(workspaceWorkItemReference(review)).toBe(reference);
    expect(workspaceWorkItemRoute(review)).toBe(`/work/queue?item=${reference}`);
    expect(workspaceWorkItemRoute({ ...review, sourceReference: 'invalid' })).toBe('/work/queue');
    expect(workspaceWorkItemRoute(item({ id: 'id&scope=all' }))).toBe(
      '/work/queue?item=id%26scope%3Dall'
    );
  });
  it('links only native tasks to the common Activity object contract', () => {
    const workItemId = 'd2e63316-8564-4d8c-bd02-eaede882f982';
    expect(workspaceWorkActivityRoute(item({ workItemId }))).toBe(
      `/activity/timeline?objectType=WORK_ITEM&objectId=${workItemId}`
    );
    expect(workspaceWorkActivityRoute(item({ workItemId, sourceSystem: 'DWP_WORKSPACE' }))).toBe(
      `/activity/timeline?objectType=WORK_ITEM&objectId=${workItemId}`
    );
    expect(workspaceWorkActivityRoute(item({ workItemId: 'WK-1' }))).toBeNull();
    expect(workspaceWorkActivityRoute(item({ workItemId, type: 'Approval' }))).toBeNull();
    expect(
      workspaceWorkActivityRoute(item({ workItemId, sourceSystem: 'APPROVAL_TASK' }))
    ).toBeNull();
  });
  it('places invalid or absent deadlines after finite deadlines without mutating the list', () => {
    const items = [
      item({ id: 'none', workItemId: 'none' }),
      item({ id: 'bad', workItemId: 'bad', dueAt: 'invalid' }),
      item({ id: 'due', workItemId: 'due', dueAt: '2026-09-05' }),
      item({ status: 'completed' }),
    ];
    expect(rankWorkspaceWorkItems(items).map((entry) => entry.id)).toEqual(['due', 'bad', 'none']);
    expect(items[0].id).toBe('none');
  });
  it('does not present missing, old, future or failed snapshots as live', () => {
    const now = Date.parse('2026-09-04T01:00:00Z');
    const base = { isFetching: false, isError: false, now };
    expect(workspaceWorkFreshness({ ...base, generatedAt: '2026-09-04T00:59:00Z' })).toBe('live');
    expect(workspaceWorkFreshness(base)).toBe('stale');
    expect(workspaceWorkFreshness({ ...base, generatedAt: '2026-09-04T00:00:00Z' })).toBe('stale');
    expect(workspaceWorkFreshness({ ...base, generatedAt: '2026-09-05T00:00:00Z' })).toBe('stale');
    expect(workspaceWorkFreshness({ ...base, isError: true })).toBe('degraded');
  });
  it('only permits an internal source handoff target', () => {
    for (const sourceRoute of [
      'https://example.test',
      '//example.test',
      '/\\example.test',
      '/work\n',
    ])
      expect(workspaceWorkSourceRoute({ sourceRoute })).toBeNull();
    expect(workspaceWorkSourceRoute({ sourceRoute: '/services/requests/1' })).toBe(
      '/services/requests/1'
    );
  });
});
