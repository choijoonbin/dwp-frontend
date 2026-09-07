import { workspaceWorkItemRoute } from '@dwp-frontend/shared-utils/api/workspace-work-policy';
import type {
  CalendarDayLoad,
  HomeOverview,
  HomeRecommendation,
  WorkspaceWorkItem,
} from '@dwp-frontend/shared-utils';
import { resolveZonedDateKey } from '@dwp-frontend/shared-i18n';

export type FlowTone = 'neutral' | 'info' | 'success' | 'warning' | 'risk';

export type FlowlineItem = Readonly<{
  key: string;
  kind: 'calendar' | 'work';
  title: string;
  startsAt: string;
  endsAt?: string;
  allDay: boolean;
  source: string;
  route: string;
  state: 'completed' | 'current' | 'upcoming' | 'attention' | 'risk';
  detail?: string | null;
}>;

export type FlowlineDateState = Readonly<{
  expectedDate: string;
  payloadDate: string | null;
  mismatch: boolean;
}>;

export type FlowSignal = Readonly<{
  key: 'open-work' | 'focus-time' | 'schedule-load' | 'activity-attention';
  label: string;
  value: number;
  unit: 'items' | 'minutes' | 'percent';
  tone: FlowTone;
  comparison:
    { kind: 'threshold'; value: number } | { kind: 'target'; value: number } | { kind: 'none' };
  source: string;
  generatedAt: string;
  route: string;
  activityBreakdown?: Readonly<{
    needsInput: number;
    policyBlocked: number;
  }>;
  series?: readonly CalendarDayLoad[];
  seriesCurrentDate?: string;
}>;

export type FlowHomeViewModel = Readonly<{
  nowItems: readonly WorkspaceWorkItem[];
  flowline: readonly FlowlineItem[];
  flowlineOverflow: number;
  flowlineOverflowKinds: readonly FlowlineItem['kind'][];
  flowlineDateState: FlowlineDateState;
  signals: readonly FlowSignal[];
  nextItems: readonly HomeRecommendation[];
}>;

const statusOrder: Record<WorkspaceWorkItem['status'], number> = {
  open: 1,
  cancelled: 4,
  archived: 5,
  'due-soon': 0,
  'in-progress': 1,
  waiting: 2,
  completed: 3,
};
const priorityOrder: Record<WorkspaceWorkItem['priority'], number> = {
  high: 0,
  medium: 1,
  low: 2,
};
const flowlineSelectionOrder: Record<FlowlineItem['state'], number> = {
  risk: 0,
  attention: 1,
  current: 2,
  upcoming: 3,
  completed: 4,
};
const FLOWLINE_ACTION_BUDGET = 6;
const FLOWLINE_COMPLETED_BUDGET = 1;

function currentScheduleLoad(
  date: string,
  weekLoad: readonly CalendarDayLoad[]
): CalendarDayLoad | undefined {
  return weekLoad.find(
    (point) => point.date === date && Number.isFinite(point.loadPercent) && point.loadPercent >= 0
  );
}

function scheduleLoadTone(loadPercent: number, conflictCount: number): FlowTone {
  return conflictCount > 0 || loadPercent > 100 ? 'risk' : 'success';
}

export function rankFlowNowItems(items: readonly WorkspaceWorkItem[] = []): WorkspaceWorkItem[] {
  return [...items]
    .filter((item) => item.status !== 'completed')
    .sort(
      (left, right) =>
        statusOrder[left.status] - statusOrder[right.status] ||
        priorityOrder[left.priority] - priorityOrder[right.priority] ||
        new Date(left.dueAt ?? '9999-12-31').getTime() -
          new Date(right.dueAt ?? '9999-12-31').getTime() ||
        left.id.localeCompare(right.id)
    )
    .slice(0, 3);
}

function dateKeyInTimeZone(value: string, timeZone: string): string | null {
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return null;
  return resolveZonedDateKey(instant, timeZone);
}

function sameCalendarDay(value: string, date: string, timeZone: string): boolean {
  return dateKeyInTimeZone(value, timeZone) === date;
}

function calendarFlowState(
  startsAt: string,
  endsAt: string,
  conflict: boolean,
  needsResponse: boolean,
  now: Date
): FlowlineItem['state'] {
  const starts = new Date(startsAt).getTime();
  const ends = new Date(endsAt).getTime();
  if (ends < now.getTime()) return 'completed';
  if (conflict) return 'risk';
  if (needsResponse) return 'attention';
  if (starts <= now.getTime() && ends >= now.getTime()) return 'current';
  return 'upcoming';
}

export function buildTodayFlowline(
  overview: HomeOverview | undefined,
  now = new Date(),
  timeZone = 'UTC',
  excludedWorkItemIds: ReadonlySet<string> = new Set()
): {
  items: FlowlineItem[];
  overflow: number;
  overflowKinds: FlowlineItem['kind'][];
  dateState: FlowlineDateState;
} {
  const calendar = overview?.calendar.status === 'AVAILABLE' ? overview.calendar.data : undefined;
  const expectedDate = resolveZonedDateKey(now, timeZone) ?? now.toISOString().slice(0, 10);
  const payloadDate = calendar?.date ?? null;
  const dateState: FlowlineDateState = {
    expectedDate,
    payloadDate,
    mismatch: payloadDate !== null && payloadDate !== expectedDate,
  };
  const calendarItems: FlowlineItem[] = (dateState.mismatch ? [] : (calendar?.today ?? []))
    .filter((event) => event.status !== 'CANCELLED')
    .map((event) => ({
      key: `calendar:${event.eventId}`,
      kind: 'calendar',
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      allDay: event.allDay,
      source: overview?.calendar.source ?? 'DWP_CALENDAR',
      route: `/calendar/schedule?event=${encodeURIComponent(event.eventId)}`,
      state: calendarFlowState(
        event.startsAt,
        event.endsAt,
        event.conflict,
        event.responseRequired && event.myResponse === 'NEEDS_ACTION',
        now
      ),
      detail: event.location,
    }));
  const workItems: FlowlineItem[] = (
    overview?.work.status === 'AVAILABLE' ? (overview.work.data?.items ?? []) : []
  )
    .filter(
      (item) =>
        !excludedWorkItemIds.has(item.id) &&
        item.status !== 'completed' &&
        Boolean(item.dueAt && sameCalendarDay(item.dueAt, expectedDate, timeZone))
    )
    .map((item) => ({
      key: `work:${item.id}`,
      kind: 'work',
      title: item.title,
      startsAt: item.dueAt!,
      allDay: false,
      source: item.sourceSystem,
      route: workspaceWorkItemRoute(item),
      state: item.status === 'due-soon' && item.priority === 'high' ? 'risk' : 'attention',
      detail: item.reason ?? item.summary,
    }));
  const chronological = (left: FlowlineItem, right: FlowlineItem) =>
    Number(right.allDay) - Number(left.allDay) ||
    new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime() ||
    left.key.localeCompare(right.key);
  const all = [...calendarItems, ...workItems].sort(chronological);
  const active = all.filter((item) => item.state !== 'completed');
  const selectedActive = [...active]
    .sort(
      (left, right) =>
        flowlineSelectionOrder[left.state] - flowlineSelectionOrder[right.state] ||
        chronological(left, right)
    )
    .slice(0, FLOWLINE_ACTION_BUDGET)
    .sort(chronological);
  const completed = all
    .filter((item) => item.state === 'completed')
    .sort(
      (left, right) =>
        new Date(right.startsAt).getTime() - new Date(left.startsAt).getTime() ||
        left.key.localeCompare(right.key)
    )
    .slice(0, FLOWLINE_COMPLETED_BUDGET);
  // Selection prioritizes actionable states, but the rendered Flowline is a
  // time axis. Re-sort the bounded result so an earlier completed item never
  // appears after later meetings while the UI promises chronological order.
  const items = [...selectedActive, ...completed]
    .sort(chronological)
    .slice(0, FLOWLINE_ACTION_BUDGET);
  const visibleKeys = new Set(items.map((item) => item.key));
  return {
    items,
    overflow: Math.max(0, all.length - items.length),
    overflowKinds: [
      ...new Set(all.filter((item) => !visibleKeys.has(item.key)).map((item) => item.kind)),
    ],
    dateState,
  };
}

export function buildFlowSignals(overview: HomeOverview | undefined): FlowSignal[] {
  const signals: FlowSignal[] = [];
  if (overview?.work.status === 'AVAILABLE' && overview.work.data) {
    const summary = overview.work.data.summary;
    signals.push({
      key: 'open-work',
      label: 'openWork',
      value: Math.max(0, summary.total - summary.completed),
      unit: 'items',
      tone: summary.dueSoon > 0 ? 'warning' : 'neutral',
      comparison: { kind: 'threshold', value: summary.dueSoon },
      source: overview.work.source,
      generatedAt: overview.work.generatedAt,
      route: '/work',
    });
  }
  if (overview?.calendar.status === 'AVAILABLE' && overview.calendar.data) {
    const calendar = overview.calendar.data;
    const scheduleLoad = currentScheduleLoad(calendar.date, calendar.weekLoad);
    signals.push({
      key: 'focus-time',
      label: 'focusTime',
      value: calendar.metrics.focusMinutes,
      unit: 'minutes',
      tone:
        calendar.metrics.focusTargetMinutes > 0 &&
        calendar.metrics.focusMinutes < calendar.metrics.focusTargetMinutes
          ? 'warning'
          : 'success',
      comparison:
        calendar.metrics.focusTargetMinutes > 0
          ? { kind: 'target', value: calendar.metrics.focusTargetMinutes }
          : { kind: 'none' },
      source: overview.calendar.source,
      generatedAt: overview.calendar.generatedAt,
      route: '/calendar/insights',
    });
    if (scheduleLoad) {
      signals.push({
        key: 'schedule-load',
        label: 'scheduleLoad',
        value: Math.round(scheduleLoad.loadPercent),
        unit: 'percent',
        tone: scheduleLoadTone(scheduleLoad.loadPercent, calendar.metrics.conflictCount),
        comparison: { kind: 'threshold', value: calendar.metrics.conflictCount },
        source: overview.calendar.source,
        generatedAt: overview.calendar.generatedAt,
        route: '/calendar/insights',
        series: calendar.weekLoad,
        seriesCurrentDate: calendar.date,
      });
    }
  }
  if (
    overview?.activity.status === 'AVAILABLE' &&
    overview.activity.data?.executionSummary &&
    overview.activity.data.executionSummaryStatus !== 'UNAVAILABLE'
  ) {
    const executionSummary = overview.activity.data.executionSummary;
    const needsAttention = executionSummary.needsInput + executionSummary.policyBlocked;
    signals.push({
      key: 'activity-attention',
      label: 'activityAttention',
      value: needsAttention,
      unit: 'items',
      tone: needsAttention > 0 ? 'warning' : 'neutral',
      comparison: { kind: 'none' },
      source: overview.activity.source,
      generatedAt: executionSummary.generatedAt,
      route: '/activity/timeline',
      activityBreakdown: {
        needsInput: executionSummary.needsInput,
        policyBlocked: executionSummary.policyBlocked,
      },
    });
  }
  return signals;
}

export function buildFlowHomeViewModel(
  overview: HomeOverview | undefined,
  now = new Date(),
  timeZone = 'UTC'
): FlowHomeViewModel {
  const nowItems = rankFlowNowItems(
    overview?.work.status === 'AVAILABLE' ? overview.work.data?.items : []
  );
  const visibleNowIds = new Set(nowItems.map((item) => item.id));
  const flowline = buildTodayFlowline(overview, now, timeZone, visibleNowIds);
  return {
    nowItems,
    flowline: flowline.items,
    flowlineOverflow: flowline.overflow,
    flowlineOverflowKinds: flowline.overflowKinds,
    flowlineDateState: flowline.dateState,
    signals: buildFlowSignals(overview),
    nextItems:
      overview?.recommendations.status === 'AVAILABLE'
        ? (overview.recommendations.data ?? []).slice(0, 3)
        : [],
  };
}
