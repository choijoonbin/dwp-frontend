import type { PersonalWorkTask } from '@dwp-frontend/shared-utils/api/personal-work-contracts';
import type { WorkspaceWorkItem } from '@dwp-frontend/shared-utils/api/workspace-api';
import type { WorkHubItem, WorkHubSnapshot, WorkHubSourceId } from './work-hub-contracts';
import { personalWorkToHub } from './work-hub-source-adapters';

export const NOW = Date.parse('2026-09-04T09:00:00Z');
export const KEY = '1d48ca30-9f34-4f6d-8e73-9f75d4483eba';
export function personal(overrides: Partial<PersonalWorkTask> = {}): PersonalWorkTask {
  return {
    taskId: KEY,
    title: 'Prepare brief',
    description: null,
    status: 'OPEN',
    priority: 'NORMAL',
    dueAt: null,
    source: null,
    version: 2,
    createdAt: new Date(NOW).toISOString(),
    updatedAt: new Date(NOW).toISOString(),
    completedAt: null,
    ...overrides,
  };
}
export function workspace(overrides: Partial<WorkspaceWorkItem> = {}): WorkspaceWorkItem {
  return {
    workItemId: KEY,
    id: 'WK-1',
    title: 'Source work',
    type: 'Task',
    priority: 'high',
    status: 'in-progress',
    sourceSystem: 'HR',
    owner: 'Me',
    version: 2,
    updatedAt: new Date(NOW).toISOString(),
    ...overrides,
  };
}
export function hubItem(overrides: Partial<WorkHubItem> = {}): WorkHubItem {
  return { ...personalWorkToHub(personal(), true), ...overrides };
}
export function snapshot(
  items: WorkHubItem[] = [hubItem()],
  sourceId: WorkHubSourceId = 'personal'
): WorkHubSnapshot {
  return {
    items,
    sources: [
      {
        sourceId,
        state: 'READY',
        items,
        hasMore: false,
        receivedAt: new Date(NOW).toISOString(),
        generatedAt: null,
      },
    ],
    completeness: 'COMPLETE',
    receivedAt: new Date(NOW).toISOString(),
  };
}
