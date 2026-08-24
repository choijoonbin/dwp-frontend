import { describe, expect, it } from 'vitest';

import { dispatchWorkspaceWorkItem, selectWorkspaceWorkItem } from './work-queue-dispatcher';

import type { WorkspaceWorkItem } from '@dwp-frontend/shared-utils/api/workspace-api';

const REF = 'd2e63316-8564-4d8c-bd02-eaede882f982';

function item(overrides: Partial<WorkspaceWorkItem> = {}): WorkspaceWorkItem {
  return {
    workItemId: 'projection-1',
    id: 'W-1',
    title: 'Review access',
    type: 'Review',
    priority: 'high',
    status: 'due-soon',
    owner: 'Identity governance',
    sourceSystem: 'IDENTITY_GOVERNANCE',
    sourceReference: REF,
    version: 1,
    updatedAt: '2026-08-24T01:00:00Z',
    ...overrides,
  };
}

describe('Work Queue owner dispatcher', () => {
  it('resolves the URL item against the Workspace sourceReference and dispatches the opaque owner ref', () => {
    const selected = selectWorkspaceWorkItem([item()], REF);
    expect(dispatchWorkspaceWorkItem(selected)).toEqual({
      kind: 'access-review',
      item: item(),
      workItemRef: REF,
    });
  });

  it('does not treat the query string or malformed projections as access evidence', () => {
    expect(selectWorkspaceWorkItem([item()], 'foreign-ref')).toBeUndefined();
    expect(
      dispatchWorkspaceWorkItem(item({ sourceSystem: 'WORKSPACE', sourceReference: REF }))
    ).toEqual({ kind: 'unavailable' });
    expect(dispatchWorkspaceWorkItem(item({ sourceReference: 'campaign-1:item-7' }))).toEqual({
      kind: 'unavailable',
    });
  });

  it('preserves existing Workspace item dispatch without consulting an owner API', () => {
    const workspace = item({
      type: 'Task',
      sourceSystem: 'HR',
      sourceReference: null,
    });
    expect(dispatchWorkspaceWorkItem(workspace)).toEqual({ kind: 'workspace', item: workspace });
  });
});
