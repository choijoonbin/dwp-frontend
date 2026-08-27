import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { resolveZonedDateKey } from '@dwp-frontend/shared-i18n';
import {
  getApprovalHome,
  getHrHome,
  getMyServiceRequests,
  getWorkplaceBookings,
} from '@dwp-frontend/shared-utils';
import {
  buildHomeContributionModel,
  hasHomeContributionAuthority,
  resolveHomeContributionProvider,
  type HomeContributionAuthority,
  type HomeContributionModel,
  type HomeContributionProviderResult,
  type HomeContributionProviderState,
} from '../contributions';
import {
  activityContributionProvider,
  approvalContributionProvider,
  calendarContributionProvider,
  hrContributionProvider,
  homeAppReadAuthority,
  homeHcmReadAuthority,
  notificationContributionProvider,
  serviceContributionProvider,
  workplaceContributionProvider,
  workspaceWorkContributionProvider,
} from './home-contribution-providers';
import {
  hrHomeUnavailableSources,
  homeQuerySnapshotTimestamp,
  homeProviderQueryState,
  homeQueryRetry,
  promoteHomeProviderPartialState,
  resolveHomeContributionPermissions,
  trustedHomeSourceTimestamp,
} from './home-contribution-runtime-policy';

import type {
  AppEntitlementPermission,
  AppNotificationSummary,
  HomeAudienceProfile,
  HomeOverview,
} from '@dwp-frontend/shared-utils';

const HOME_APP_INSIGHT_STALE_MS = 60_000;

type ExternalQuerySnapshot<T> = Readonly<{
  data?: T;
  loading: boolean;
  fetching: boolean;
  failed: boolean;
  refreshFailed?: boolean;
  error?: unknown;
}>;

export type UseHomeContributionModelInput = Readonly<{
  tenantId?: number | null;
  userId?: number | null;
  audience: HomeAudienceProfile;
  now: Date;
  locale: string;
  timeZone: string;
  permissions: readonly AppEntitlementPermission[];
  roles?: readonly string[];
  legacyRoleFallbackAllowed?: boolean;
  accessFingerprint: string;
  overview?: HomeOverview;
  overviewLoading: boolean;
  overviewFailed: boolean;
  overviewRefreshFailed?: boolean;
  notification: ExternalQuerySnapshot<AppNotificationSummary>;
}>;

export type HomeContributionRuntime = Readonly<{
  model: HomeContributionModel;
  loading: boolean;
  fetching: boolean;
  partial: boolean;
  retry: () => Promise<void>;
}>;

function appEnabled(
  identityReady: boolean,
  authority: HomeContributionAuthority,
  permissions: readonly AppEntitlementPermission[]
): boolean {
  return identityReady && hasHomeContributionAuthority(authority, permissions);
}

function workplaceRange(now: Date): Readonly<{ from: string; to: string }> {
  // Query a stable UTC superset, then apply the user's exact zoned date in the
  // provider. This avoids browser-local midnight and DST assumptions.
  const from = new Date(now);
  from.setUTCHours(0, 0, 0, 0);
  from.setUTCDate(from.getUTCDate() - 1);
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + 4);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function useHomeContributionModel({
  tenantId,
  userId,
  audience,
  now,
  locale,
  timeZone,
  permissions,
  roles = [],
  legacyRoleFallbackAllowed = false,
  accessFingerprint,
  overview,
  overviewLoading,
  overviewFailed,
  overviewRefreshFailed = false,
  notification,
}: UseHomeContributionModelInput): HomeContributionRuntime {
  const { t } = useTranslation('home');
  const identityReady = Boolean(tenantId && userId);
  const contributionPermissions = useMemo(
    () => resolveHomeContributionPermissions(permissions, roles, legacyRoleFallbackAllowed),
    [legacyRoleFallbackAllowed, permissions, roles]
  );
  const approvalsEnabled = appEnabled(
    identityReady,
    homeAppReadAuthority('APP.APPROVALS'),
    contributionPermissions
  );
  const hrEnabled = appEnabled(identityReady, homeHcmReadAuthority, contributionPermissions);
  const servicesEnabled = appEnabled(
    identityReady,
    homeAppReadAuthority('APP.EMPLOYEE_SERVICES'),
    contributionPermissions
  );
  const workplaceEnabled = appEnabled(
    identityReady,
    homeAppReadAuthority('APP.WORKPLACE'),
    contributionPermissions
  );
  const notificationEnabled = appEnabled(
    identityReady,
    homeAppReadAuthority('APP.NOTIFICATIONS'),
    contributionPermissions
  );
  const range = useMemo(() => workplaceRange(now), [now]);
  const dateKey = resolveZonedDateKey(now, timeZone);

  const approvals = useQuery({
    queryKey: ['home-contributions', 'approvals', tenantId, userId, accessFingerprint],
    // TanStack Query passes a QueryFunctionContext argument. Do not forward it
    // as the optional governed scope key expected by getApprovalHome().
    queryFn: () => getApprovalHome(),
    enabled: approvalsEnabled,
    staleTime: HOME_APP_INSIGHT_STALE_MS,
    refetchInterval: HOME_APP_INSIGHT_STALE_MS,
    refetchIntervalInBackground: false,
    retry: homeQueryRetry,
  });
  const hr = useQuery({
    queryKey: ['home-contributions', 'hr', tenantId, userId, accessFingerprint],
    queryFn: getHrHome,
    enabled: hrEnabled,
    staleTime: HOME_APP_INSIGHT_STALE_MS,
    refetchInterval: HOME_APP_INSIGHT_STALE_MS,
    refetchIntervalInBackground: false,
    retry: homeQueryRetry,
  });
  const services = useQuery({
    queryKey: ['home-contributions', 'services', tenantId, userId, accessFingerprint],
    queryFn: () => getMyServiceRequests(),
    enabled: servicesEnabled,
    staleTime: HOME_APP_INSIGHT_STALE_MS,
    refetchInterval: HOME_APP_INSIGHT_STALE_MS,
    refetchIntervalInBackground: false,
    retry: homeQueryRetry,
  });
  const workplace = useQuery({
    queryKey: [
      'home-contributions',
      'workplace',
      tenantId,
      userId,
      range.from,
      range.to,
      accessFingerprint,
    ],
    queryFn: () => getWorkplaceBookings(range.from, range.to),
    enabled: workplaceEnabled,
    staleTime: HOME_APP_INSIGHT_STALE_MS,
    refetchInterval: HOME_APP_INSIGHT_STALE_MS,
    refetchIntervalInBackground: false,
    retry: homeQueryRetry,
  });

  const queryResults = useMemo<HomeContributionProviderResult[]>(() => {
    const context = {
      now: now.toISOString(),
      locale,
      timeZone,
      dateKey: dateKey ?? undefined,
    };
    const sectionState = (
      section:
        HomeOverview['work'] | HomeOverview['calendar'] | HomeOverview['activity'] | undefined
    ): HomeContributionProviderState => {
      if (section) return section.status;
      return overviewLoading && !overviewFailed ? 'EMPTY' : 'UNAVAILABLE';
    };
    const results: HomeContributionProviderResult[] = [
      resolveHomeContributionProvider(
        workspaceWorkContributionProvider,
        {
          state:
            overview?.work && overviewRefreshFailed && overview.work.status === 'AVAILABLE'
              ? 'PARTIAL'
              : sectionState(overview?.work),
          generatedAt: trustedHomeSourceTimestamp(overview?.work.generatedAt),
          data: overview?.work.data ?? undefined,
          reason: overview?.work.reason ?? (overviewLoading ? 'LOADING' : undefined),
        },
        context
      ),
      resolveHomeContributionProvider(
        calendarContributionProvider,
        {
          state: promoteHomeProviderPartialState(
            overview?.calendar && overviewRefreshFailed && overview.calendar.status === 'AVAILABLE'
              ? 'PARTIAL'
              : sectionState(overview?.calendar),
            Boolean(overview?.calendar.data && overview.calendar.data.date !== dateKey)
          ),
          generatedAt: trustedHomeSourceTimestamp(overview?.calendar.generatedAt),
          data: overview?.calendar.data ?? undefined,
          reason: overview?.calendar.reason ?? (overviewLoading ? 'LOADING' : undefined),
          unavailableSources:
            overview?.calendar.data && overview.calendar.data.date !== dateKey
              ? ['DWP_CALENDAR:DATE_MISMATCH']
              : [],
        },
        context
      ),
      resolveHomeContributionProvider(
        activityContributionProvider,
        {
          state:
            overview?.activity && overviewRefreshFailed && overview.activity.status === 'AVAILABLE'
              ? 'PARTIAL'
              : sectionState(overview?.activity),
          generatedAt: trustedHomeSourceTimestamp(overview?.activity.generatedAt),
          data: overview?.activity.data ?? undefined,
          reason: overview?.activity.reason ?? (overviewLoading ? 'LOADING' : undefined),
        },
        context
      ),
      resolveHomeContributionProvider(
        approvalContributionProvider,
        {
          state: homeProviderQueryState(approvalsEnabled, {
            data: approvals.data,
            loading: approvals.isLoading,
            fetching: approvals.isFetching,
            failed: approvals.isError,
            refreshFailed: approvals.isRefetchError,
            error: approvals.error,
          }),
          generatedAt: trustedHomeSourceTimestamp(approvals.data?.generatedAt),
          data: approvals.data ? { home: approvals.data, audience } : undefined,
          reason: approvals.isLoading
            ? 'LOADING'
            : approvals.isError
              ? 'REQUEST_FAILED'
              : undefined,
        },
        context
      ),
      resolveHomeContributionProvider(
        hrContributionProvider,
        {
          state: promoteHomeProviderPartialState(
            homeProviderQueryState(hrEnabled, {
              data: hr.data,
              loading: hr.isLoading,
              fetching: hr.isFetching,
              failed: hr.isError,
              refreshFailed: hr.isRefetchError,
              error: hr.error,
            }),
            hrHomeUnavailableSources(hr.data).length > 0
          ),
          generatedAt: trustedHomeSourceTimestamp(hr.data?.generatedAt ?? hr.data?.asOf),
          data: hr.data ? { home: hr.data, audience } : undefined,
          reason: hr.isLoading ? 'LOADING' : hr.isError ? 'REQUEST_FAILED' : undefined,
          unavailableSources: hrHomeUnavailableSources(hr.data),
        },
        context
      ),
      resolveHomeContributionProvider(
        serviceContributionProvider,
        {
          state: homeProviderQueryState(servicesEnabled, {
            data: services.data,
            loading: services.isLoading,
            fetching: services.isFetching,
            failed: services.isError,
            refreshFailed: services.isRefetchError,
            error: services.error,
          }),
          generatedAt: homeQuerySnapshotTimestamp(services.dataUpdatedAt),
          data: services.data,
          reason: services.isLoading ? 'LOADING' : services.isError ? 'REQUEST_FAILED' : undefined,
        },
        { ...context, snapshotAt: homeQuerySnapshotTimestamp(services.dataUpdatedAt) }
      ),
      resolveHomeContributionProvider(
        workplaceContributionProvider,
        {
          state: promoteHomeProviderPartialState(
            homeProviderQueryState(workplaceEnabled, {
              data: workplace.data,
              loading: workplace.isLoading,
              fetching: workplace.isFetching,
              failed: workplace.isError,
              refreshFailed: workplace.isRefetchError,
              error: workplace.error,
            }),
            Boolean(workplace.data && !dateKey)
          ),
          generatedAt: homeQuerySnapshotTimestamp(workplace.dataUpdatedAt),
          data: workplace.data,
          reason: workplace.isLoading
            ? 'LOADING'
            : workplace.isError
              ? 'REQUEST_FAILED'
              : undefined,
          unavailableSources: workplace.data && !dateKey ? ['DWP_WORKPLACE:DATE_UNAVAILABLE'] : [],
        },
        { ...context, snapshotAt: homeQuerySnapshotTimestamp(workplace.dataUpdatedAt) }
      ),
      resolveHomeContributionProvider(
        notificationContributionProvider,
        {
          state: promoteHomeProviderPartialState(
            homeProviderQueryState(notificationEnabled, notification),
            notification.data?.partial === true
          ),
          generatedAt: trustedHomeSourceTimestamp(notification.data?.generatedAt),
          data: notification.data,
          reason: notification.loading
            ? 'LOADING'
            : notification.failed
              ? 'REQUEST_FAILED'
              : undefined,
          unavailableSources: notification.data?.unavailableSources,
        },
        context
      ),
    ];
    return results;
  }, [
    approvals.data,
    approvals.isError,
    approvals.error,
    approvals.isFetching,
    approvals.isLoading,
    approvals.isRefetchError,
    approvalsEnabled,
    audience,
    dateKey,
    hr.data,
    hr.isError,
    hr.error,
    hr.isFetching,
    hr.isLoading,
    hr.isRefetchError,
    hrEnabled,
    locale,
    notification,
    notificationEnabled,
    now,
    overview,
    overviewFailed,
    overviewLoading,
    overviewRefreshFailed,
    services.data,
    services.dataUpdatedAt,
    services.isError,
    services.error,
    services.isFetching,
    services.isLoading,
    services.isRefetchError,
    servicesEnabled,
    timeZone,
    workplace.data,
    workplace.dataUpdatedAt,
    workplace.isError,
    workplace.error,
    workplace.isFetching,
    workplace.isLoading,
    workplace.isRefetchError,
    workplaceEnabled,
  ]);

  const model = useMemo(
    () =>
      buildHomeContributionModel(queryResults, {
        now,
        permissions: contributionPermissions,
        redactionPolicy: {
          fallbackTitle: t('flow.purpose.protectedItem'),
        },
      }),
    [contributionPermissions, now, queryResults, t]
  );

  const enabledQueries = [
    ...(approvalsEnabled ? [approvals] : []),
    ...(hrEnabled ? [hr] : []),
    ...(servicesEnabled ? [services] : []),
    ...(workplaceEnabled ? [workplace] : []),
  ];
  const loading =
    overviewLoading || notification.loading || enabledQueries.some((query) => query.isLoading);
  const fetching =
    notification.fetching || enabledQueries.some((query) => query.isFetching) || false;
  const partial = model.providers.some(
    (provider) =>
      provider.state === 'PARTIAL' || provider.state === 'UNAVAILABLE' || provider.state === 'STALE'
  );

  return {
    model,
    loading,
    fetching,
    partial,
    retry: async () => {
      await Promise.all([
        ...(approvalsEnabled ? [approvals.refetch()] : []),
        ...(hrEnabled ? [hr.refetch()] : []),
        ...(servicesEnabled ? [services.refetch()] : []),
        ...(workplaceEnabled ? [workplace.refetch()] : []),
      ]);
    },
  };
}
