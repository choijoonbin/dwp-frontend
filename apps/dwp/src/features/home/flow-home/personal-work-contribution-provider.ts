import { createHomeContributionProvider } from '../contributions';
import type {
  PersonalDayPlan,
  PersonalWorkPage,
  PersonalWorkTask,
} from '@dwp-frontend/shared-utils/api/personal-work-contracts';

const authority = {
  allOf: [{ resourceType: 'APP', resourceKey: 'APP.WORK', permissionCodes: ['VIEW'] }],
} as const;
const owner = { source: 'DWP_WORK', appKey: 'APP.WORK', appLabel: 'Work' };
export const personalWorkContributionProvider = createHomeContributionProvider<
  PersonalWorkPage<PersonalWorkTask>
>({
  key: 'personal-work',
  owner,
  authority,
  supportedKinds: ['ACTION'],
  freshnessMs: 120_000,
  normalize(data, context) {
    return data.items
      .filter((task) => !['COMPLETED', 'ARCHIVED', 'DELETED'].includes(task.status))
      .map((task) => ({
        id: `personal-work:${task.taskId}`,
        kind: 'ACTION' as const,
        scope: 'ME' as const,
        priority:
          task.dueAt && Date.parse(task.dueAt) < Date.parse(context.now)
            ? ('CRITICAL' as const)
            : task.priority === 'URGENT' || task.priority === 'HIGH'
              ? ('HIGH' as const)
              : task.priority === 'LOW'
                ? ('LOW' as const)
                : ('MEDIUM' as const),
        status: task.status === 'OPEN' ? 'NOT_STARTED' : task.status,
        title: task.title,
        description: task.description ?? undefined,
        dueAt: task.dueAt,
        deepLink: `/work/queue?work=${encodeURIComponent(`PERSONAL_TASK:${task.taskId}:`)}`,
        dedupeKey: `PERSONAL_TASK:${task.taskId}`,
        sourceReference: task.taskId,
        generatedAt: context.snapshotAt ?? task.updatedAt,
        privacy: { classification: 'INTERNAL' as const },
      }));
  },
});
export const personalDayPlanContributionProvider = createHomeContributionProvider<PersonalDayPlan>({
  key: 'personal-day-plan',
  owner,
  authority,
  supportedKinds: ['PULSE'],
  freshnessMs: 120_000,
  normalize(data, context) {
    if (!data.items.length) return [];
    return [
      {
        id: `personal-day-plan:${data.date}`,
        kind: 'PULSE',
        scope: 'ME',
        priority: 'LOW',
        status: 'PLANNED',
        title: context.translate?.('flow.contributions.personalPlan.title') ?? 'Today plan',
        description: context.translate?.('flow.contributions.personalPlan.description', {
          count: data.items.length,
        }),
        count: data.items.length,
        deepLink: '/work/day-plan',
        dedupeKey: `PERSONAL_DAY_PLAN:${data.date}`,
        sourceReference: data.date,
        generatedAt: context.snapshotAt ?? context.now,
        privacy: { classification: 'INTERNAL' },
      },
    ];
  },
});
