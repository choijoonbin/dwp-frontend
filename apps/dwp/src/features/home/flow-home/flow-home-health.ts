import type { HomeOverview } from '@dwp-frontend/shared-utils';
import type { HomeContributionModel, HomeContributionProviderState } from '../contributions';

export type FlowHomeHealthDomain =
  | 'overview'
  | 'work'
  | 'calendar'
  | 'activity'
  | 'communications'
  | 'approvals'
  | 'people'
  | 'services'
  | 'workplace'
  | 'notifications';

export type FlowHomeHealthIssueState = 'DELAYED' | 'PARTIAL' | 'UNAVAILABLE';

export type FlowHomeHealthIssue = Readonly<{
  domain: FlowHomeHealthDomain;
  state: FlowHomeHealthIssueState;
  generatedAt?: string;
  lagMinutes?: number;
}>;

export type FlowHomeHealth = Readonly<{
  state: 'HEALTHY' | 'REFRESHING' | 'DELAYED' | 'PARTIAL' | 'UNAVAILABLE';
  issues: readonly FlowHomeHealthIssue[];
  refreshing: boolean;
  lastUpdatedAt?: string;
}>;

type ResolveFlowHomeHealthOptions = Readonly<{
  now: Date;
  overview?: HomeOverview;
  overviewFailed: boolean;
  overviewFetching: boolean;
  supplementalPartial: boolean;
  notificationPartial?: boolean;
  contributionFetching: boolean;
  providers: HomeContributionModel['providers'];
}>;

const providerDomainByAppKey: Readonly<Record<string, FlowHomeHealthDomain>> = {
  'APP.WORK': 'work',
  'APP.CALENDAR': 'calendar',
  'APP.ACTIVITY': 'activity',
  'APP.APPROVALS': 'approvals',
  'APP.HCM': 'people',
  'APP.EMPLOYEE_SERVICES': 'services',
  'APP.WORKPLACE': 'workplace',
  'APP.NOTIFICATIONS': 'notifications',
};

const severity: Readonly<Record<FlowHomeHealthIssueState, number>> = {
  DELAYED: 1,
  PARTIAL: 2,
  UNAVAILABLE: 3,
};

// Thirty seconds is the widget refresh cadence, not a user-facing outage threshold.
// Home only asks the user to intervene after the shared source freshness window expires.
const FLOW_HOME_HEALTH_DELAY_MS = 5 * 60 * 1000;

function issueStateForProvider(
  state: HomeContributionProviderState
): FlowHomeHealthIssueState | undefined {
  if (state === 'STALE') return 'DELAYED';
  if (state === 'PARTIAL') return 'PARTIAL';
  if (state === 'UNAVAILABLE') return 'UNAVAILABLE';
  // A source that is not configured is not a runtime failure. The app itself exposes
  // its setup affordance, while Home continues to present the sources that are usable.
  return undefined;
}

function validTimestamp(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function lagMinutes(now: Date, generatedAt: string | undefined): number | undefined {
  const parsed = validTimestamp(generatedAt);
  if (parsed === undefined) return undefined;
  return Math.max(1, Math.ceil((now.getTime() - parsed) / 60_000));
}

function newestTimestamp(values: readonly (string | undefined)[]): string | undefined {
  return values.reduce<string | undefined>((newest, value) => {
    const valueTime = validTimestamp(value);
    if (valueTime === undefined) return newest;
    const newestTime = validTimestamp(newest);
    return newestTime === undefined || valueTime > newestTime ? value : newest;
  }, undefined);
}

export function resolveFlowHomeHealth({
  now,
  overview,
  overviewFailed,
  overviewFetching,
  supplementalPartial,
  notificationPartial = false,
  contributionFetching,
  providers,
}: ResolveFlowHomeHealthOptions): FlowHomeHealth {
  const issuesByDomain = new Map<FlowHomeHealthDomain, FlowHomeHealthIssue>();
  const putIssue = (issue: FlowHomeHealthIssue) => {
    const current = issuesByDomain.get(issue.domain);
    if (!current || severity[issue.state] > severity[current.state]) {
      issuesByDomain.set(issue.domain, issue);
      return;
    }
    if (severity[issue.state] === severity[current.state]) {
      const currentTime = validTimestamp(current.generatedAt) ?? Number.POSITIVE_INFINITY;
      const issueTime = validTimestamp(issue.generatedAt) ?? Number.POSITIVE_INFINITY;
      if (issueTime < currentTime) issuesByDomain.set(issue.domain, issue);
    }
  };

  if (overviewFailed || (!overview && !overviewFetching)) {
    putIssue({ domain: 'overview', state: 'UNAVAILABLE' });
  }

  const overviewSections = overview
    ? ([
        ['work', overview.work],
        ['calendar', overview.calendar],
        ['activity', overview.activity],
        ['communications', overview.communications],
      ] as const)
    : [];
  const freshnessMs = FLOW_HOME_HEALTH_DELAY_MS;
  overviewSections.forEach(([domain, section]) => {
    if (section.status === 'UNAVAILABLE') {
      putIssue({ domain, state: 'UNAVAILABLE', generatedAt: section.generatedAt });
      return;
    }
    if (section.status !== 'AVAILABLE') return;
    const generatedAt = validTimestamp(section.generatedAt);
    if (generatedAt !== undefined && now.getTime() - generatedAt > freshnessMs) {
      putIssue({
        domain,
        state: 'DELAYED',
        generatedAt: section.generatedAt,
        lagMinutes: lagMinutes(now, section.generatedAt),
      });
    }
  });

  providers.forEach((provider) => {
    const domain = providerDomainByAppKey[provider.owner.appKey];
    const state = issueStateForProvider(provider.state);
    if (!domain || !state || provider.state === 'FORBIDDEN') return;
    putIssue({
      domain,
      state,
      generatedAt: provider.generatedAt,
      lagMinutes: state === 'DELAYED' ? lagMinutes(now, provider.generatedAt) : undefined,
    });
  });

  if (notificationPartial) {
    putIssue({ domain: 'notifications', state: 'PARTIAL' });
  }

  if (supplementalPartial && issuesByDomain.size === 0) {
    putIssue({ domain: 'overview', state: 'PARTIAL', generatedAt: overview?.generatedAt });
  }

  const issues = [...issuesByDomain.values()].sort((left, right) => {
    const severityDifference = severity[right.state] - severity[left.state];
    return severityDifference || left.domain.localeCompare(right.domain);
  });
  const refreshing = overviewFetching || contributionFetching;
  const lastUpdatedAt = newestTimestamp([
    overview?.generatedAt,
    ...overviewSections.map(([, section]) => section.generatedAt),
    ...providers
      .filter((provider) => provider.state === 'AVAILABLE' || provider.state === 'EMPTY')
      .map((provider) => provider.generatedAt),
  ]);

  if (issues.some((issue) => issue.domain === 'overview' && issue.state === 'UNAVAILABLE')) {
    return { state: 'UNAVAILABLE', issues, refreshing, lastUpdatedAt };
  }
  if (issues.some((issue) => issue.state === 'UNAVAILABLE' || issue.state === 'PARTIAL')) {
    return { state: 'PARTIAL', issues, refreshing, lastUpdatedAt };
  }
  if (issues.length > 0) return { state: 'DELAYED', issues, refreshing, lastUpdatedAt };
  return {
    state: refreshing ? 'REFRESHING' : 'HEALTHY',
    issues,
    refreshing,
    lastUpdatedAt,
  };
}
