import { describe, expect, it } from 'vitest';
import { buildHomeContributionModel, resolveHomeContributionProvider } from '../contributions';
import {
  personalDayPlanContributionProvider,
  personalWorkContributionProvider,
} from './personal-work-contribution-provider';
import { workspaceWorkContributionProvider } from './home-contribution-providers';
import type {
  PersonalDayPlan,
  PersonalWorkTask,
} from '@dwp-frontend/shared-utils/api/personal-work-contracts';
import type { WorkspaceWorkQueue } from '@dwp-frontend/shared-utils/api/workspace-api';

const now = '2026-09-07T03:00:00.000Z';
const context = {
  now,
  snapshotAt: now,
  dateKey: '2026-09-07',
  locale: 'ko-KR',
  timeZone: 'Asia/Seoul',
  translate: (key: string) => key,
};
const task: PersonalWorkTask = {
  taskId: 'own-task',
  title: 'Prepare customer notes',
  description: null,
  status: 'OPEN',
  priority: 'NORMAL',
  dueAt: '2026-09-07T02:00:00.000Z',
  source: null,
  version: 2,
  createdAt: now,
  updatedAt: now,
  completedAt: null,
};

describe('personal work contribution to Flow', () => {
  it('offers only unfinished personal work, prioritizes overdue work, and links to its exact detail', () => {
    const items = personalWorkContributionProvider.normalize(
      {
        items: [
          task,
          { ...task, taskId: 'done', status: 'COMPLETED' },
          { ...task, taskId: 'archived', status: 'ARCHIVED' },
        ],
        page: 0,
        size: 100,
        totalElements: 3,
        hasMore: false,
      },
      context
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      scope: 'ME',
      priority: 'CRITICAL',
      deepLink: '/work/queue?work=PERSONAL_TASK%3Aown-task%3A',
    });
  });

  it('does not expose task titles through Flow without the exact Work entitlement', () => {
    const provider = resolveHomeContributionProvider(
      personalWorkContributionProvider,
      {
        state: 'AVAILABLE',
        generatedAt: now,
        data: { items: [task], page: 0, size: 100, totalElements: 1, hasMore: false },
      },
      context
    );
    for (const permissions of [
      [],
      [
        {
          resourceType: 'APP',
          resourceKey: 'APP.WORK',
          permissionCode: 'VIEW',
          effect: 'DENY' as const,
        },
      ],
    ]) {
      const model = buildHomeContributionModel([provider], { now, permissions });
      expect(model.providers[0].state).toBe('FORBIDDEN');
      expect(JSON.stringify(model)).not.toContain(task.title);
    }
  });

  it('counts the same personal task only once across the personal and workspace providers', () => {
    const personal = resolveHomeContributionProvider(
      personalWorkContributionProvider,
      {
        state: 'AVAILABLE',
        generatedAt: now,
        data: { items: [task], page: 0, size: 100, totalElements: 1, hasMore: false },
      },
      context
    );
    const workspaceData: WorkspaceWorkQueue = {
      summary: { total: 1, dueSoon: 0, inProgress: 0, waiting: 0, completed: 0 },
      generatedAt: now,
      items: [
        {
          workItemId: 'workspace-copy',
          id: 'workspace-copy',
          title: task.title,
          type: 'Task',
          priority: 'medium',
          status: 'open',
          owner: 'me',
          dueAt: task.dueAt,
          dataClassification: 'INTERNAL',
          sourceSystem: 'PERSONAL_TASK',
          sourceReference: task.taskId,
          sourceRoute: '/work/queue',
          version: task.version,
          updatedAt: task.updatedAt,
        },
      ],
    };
    const workspace = resolveHomeContributionProvider(
      workspaceWorkContributionProvider,
      { state: 'AVAILABLE', generatedAt: now, data: workspaceData },
      context
    );

    const model = buildHomeContributionModel([personal, workspace], {
      now,
      permissions: [
        {
          resourceType: 'APP',
          resourceKey: 'APP.WORK',
          permissionCode: 'VIEW',
          effect: 'ALLOW',
        },
      ],
    });

    expect(model.buckets.action).toHaveLength(1);
    expect(model.buckets.action[0]).toMatchObject({
      dedupeKey: `PERSONAL_TASK:${task.taskId}`,
      duplicateCount: 2,
    });
  });

  it('contributes only the day plan count and does not hydrate denied source metadata', () => {
    const plan: PersonalDayPlan = {
      date: context.dateKey,
      version: 1,
      updatedAt: now,
      items: [
        {
          position: 0,
          selectionReference: { sourceSystem: 'APPROVALS', sourceReference: 'sensitive-id' },
          source: {
            availability: 'UNAVAILABLE',
            reference: null,
            title: null,
            status: null,
            sourceRoute: null,
            dueAt: null,
          },
        },
      ],
    };
    const items = personalDayPlanContributionProvider.normalize(plan, context);
    expect(items[0]).toMatchObject({ scope: 'ME', count: 1, deepLink: '/work/day-plan' });
    expect(JSON.stringify(items)).not.toContain('sensitive-id');
    expect(personalDayPlanContributionProvider.normalize({ ...plan, items: [] }, context)).toEqual(
      []
    );
  });
});
