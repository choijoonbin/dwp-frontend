import { getApprovalRequests, getApprovalTasks } from '@dwp-frontend/shared-utils/api/approval-api';
import { getServiceMyRequests } from '@dwp-frontend/shared-utils/api/service-center-api';
import { getPersonalWorkTasks } from '@dwp-frontend/shared-utils/api/personal-work-api';
import { getWorkspaceWorkQueue } from '@dwp-frontend/shared-utils/api/workspace-api';
import { getWorkAssignments } from '@dwp-frontend/shared-utils/api/work-assignment-api';
import type { WorkAssignmentScope } from '@dwp-frontend/shared-utils/api/work-assignment-contracts';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';
import {
  approvalRequestToHub,
  approvalTaskToHub,
  personalWorkToHub,
  serviceRequestToHub,
  workspaceWorkToHub,
} from './work-hub-source-adapters';
import {
  checkedWorkAssignmentPage,
  mergeWorkAssignmentTasks,
  workAssignmentToHub,
  WORK_ASSIGNMENT_PAGE_SIZE,
} from './work-hub-assignment-model';
import type {
  WorkHubItem,
  WorkHubSnapshot,
  WorkHubSourceId,
  WorkHubSourceSnapshot,
} from './work-hub-contracts';

export type WorkHubSourceReader = (authority: {
  canUpdatePersonal: boolean;
  actorId: number | null;
}) => Promise<{ items: WorkHubItem[]; generatedAt?: string | null; hasMore?: boolean }>;
export type WorkHubSourceReaders = Record<WorkHubSourceId, WorkHubSourceReader>;

/** Reads use the source apps' public clients and the current browser session/PEP. */
export const workHubSourceReaders: WorkHubSourceReaders = {
  workspace: async () => {
    const queue = await getWorkspaceWorkQueue();
    return { items: queue.items.map(workspaceWorkToHub), generatedAt: queue.generatedAt };
  },
  'work-assignments': async ({ actorId }) => {
    if (typeof actorId !== 'number' || !Number.isSafeInteger(actorId) || actorId < 1)
      throw new Error('A verified Work actor is required');
    const scopes: readonly WorkAssignmentScope[] = ['ASSIGNED_TO_ME', 'ASSIGNED_BY_ME'];
    const pages = await Promise.all(
      scopes.map(async (scope) => {
        const result = [];
        const seen = new Set<string>();
        let totalElements: number | null = null;
        for (let page = 0; page <= 10_000; page += 1) {
          const checked = checkedWorkAssignmentPage(
            await getWorkAssignments({ scope, page, size: WORK_ASSIGNMENT_PAGE_SIZE }),
            actorId,
            scope,
            page
          );
          if (totalElements !== null && checked.totalElements !== totalElements)
            throw new Error('Work assignment pagination total changed');
          totalElements = checked.totalElements;
          if (checked.items.some((item) => seen.has(item.assignmentId)))
            throw new Error('Work assignment pagination repeated an item');
          checked.items.forEach((item) => seen.add(item.assignmentId));
          result.push(checked);
          if (!checked.hasMore) {
            if (seen.size !== checked.totalElements)
              throw new Error('Work assignment pagination omitted an item');
            return result;
          }
        }
        throw new Error('Work assignment pagination exceeded its contract');
      })
    );
    return {
      items: mergeWorkAssignmentTasks(pages.flat()).map((item) =>
        workAssignmentToHub(item, actorId)
      ),
      hasMore: false,
    };
  },
  'approval-inbox': async () => {
    const items = await getApprovalTasks('INBOX');
    return {
      items: items.map((item) => approvalTaskToHub(item, 'approval-inbox')),
      hasMore: items.length >= 50,
    };
  },
  'approval-completed': async () => {
    const items = await getApprovalTasks('COMPLETED');
    return {
      items: items.map((item) => approvalTaskToHub(item, 'approval-completed')),
      hasMore: items.length >= 50,
    };
  },
  'approval-needs-info': async () => {
    const items = await getApprovalRequests('NEEDS_INFO');
    return { items: items.map(approvalRequestToHub), hasMore: items.length >= 50 };
  },
  services: async () => {
    const items = await getServiceMyRequests();
    return { items: items.map(serviceRequestToHub), hasMore: items.length >= 200 };
  },
  personal: async ({ canUpdatePersonal }) => {
    const items = new Map<string, WorkHubItem>();
    for (const status of [undefined, 'ARCHIVED'] as const) {
      const seen = new Set<string>();
      let pageNumber = 0;
      while (true) {
        const page = await getPersonalWorkTasks({ page: pageNumber, size: 100, status });
        if (
          page.page !== pageNumber ||
          (page.hasMore && !page.items.some((item) => !seen.has(item.taskId)))
        )
          throw new Error('Personal task pagination did not advance');
        for (const item of page.items) {
          const previous = items.get(item.taskId);
          if (!previous || item.version > previous.version)
            items.set(item.taskId, personalWorkToHub(item, canUpdatePersonal));
          seen.add(item.taskId);
        }
        if (!page.hasMore) break;
        pageNumber += 1;
      }
    }
    return { items: [...items.values()], hasMore: false };
  },
};

export async function loadWorkHub(options: {
  /** Explicitly selected after app entitlement evaluation; no implicit extra source reads. */
  enabledSources: readonly WorkHubSourceId[];
  readers?: WorkHubSourceReaders;
  now?: () => number;
  canUpdatePersonal?: boolean;
  actorId?: number | null;
}): Promise<WorkHubSnapshot> {
  const readers = options.readers ?? workHubSourceReaders;
  const now = options.now ?? Date.now;
  const sourceIds = Object.keys(readers) as WorkHubSourceId[];
  const enabled = new Set(options.enabledSources);
  const sources = await Promise.all(
    sourceIds.map(async (sourceId): Promise<WorkHubSourceSnapshot> => {
      if (!enabled.has(sourceId))
        return {
          sourceId,
          state: 'NOT_REQUESTED',
          items: [],
          receivedAt: null,
          generatedAt: null,
          hasMore: false,
        };
      try {
        const result = await readers[sourceId]({
          canUpdatePersonal: options.canUpdatePersonal === true,
          actorId: options.actorId ?? null,
        });
        return {
          sourceId,
          state: 'READY',
          items: result.items,
          receivedAt: new Date(now()).toISOString(),
          generatedAt: result.generatedAt ?? null,
          hasMore: result.hasMore ?? false,
        };
      } catch (error) {
        return {
          sourceId,
          ...(error instanceof HttpError ? { failureStatus: error.status } : {}),
          state:
            error instanceof HttpError && (error.status === 401 || error.status === 403)
              ? 'FORBIDDEN'
              : 'UNAVAILABLE',
          items: [],
          receivedAt: null,
          generatedAt: null,
          hasMore: false,
        };
      }
    })
  );
  return assembleWorkHubSnapshot(sources, new Date(now()).toISOString());
}

export function assembleWorkHubSnapshot(
  sources: WorkHubSourceSnapshot[],
  receivedAt: string
): WorkHubSnapshot {
  const requested = sources.filter((source) => source.state !== 'NOT_REQUESTED');
  const ready = requested.filter((source) => source.state === 'READY');
  // Exact source obligation identity only. Request and approval-step obligations remain distinct.
  const unique = new Map<string, WorkHubItem>();
  for (const source of ready) {
    for (const item of source.items) {
      const previous = unique.get(item.key);
      const previousIsProjection = previous?.sourceId === 'workspace';
      const itemIsProjection = item.sourceId === 'workspace';
      if (
        !previous ||
        (previousIsProjection && !itemIsProjection) ||
        (previousIsProjection === itemIsProjection && item.version > previous.version)
      )
        unique.set(item.key, item);
    }
  }
  return {
    items: [...unique.values()],
    sources,
    receivedAt,
    completeness:
      ready.length === 0
        ? 'UNAVAILABLE'
        : ready.length === requested.length && !ready.some((source) => source.hasMore)
          ? 'COMPLETE'
          : 'PARTIAL',
  };
}
