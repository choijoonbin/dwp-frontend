import type { HomeContributionBucketKey } from '../contributions';

type PurposeRouteItem = Readonly<{
  owner: Readonly<{ appKey: string }>;
  deepLink: string;
}>;

function pathOf(value: string): string {
  return value.trim().split(/[?#]/u, 1)[0] ?? '';
}

function everyPath(items: readonly PurposeRouteItem[], prefix: string): boolean {
  return items.length > 0 && items.every((item) => pathOf(item.deepLink).startsWith(prefix));
}

/** Returns a destination that truthfully contains every visible item, or no route. */
export function homePurposeAllRoute(
  purpose: HomeContributionBucketKey,
  items: readonly PurposeRouteItem[]
): string | undefined {
  const appKeys = [...new Set(items.map((item) => item.owner.appKey))];
  if (appKeys.length !== 1) return undefined;

  const appKey = appKeys[0];
  if (appKey === 'APP.APPROVALS') {
    if (purpose === 'action') return '/approvals/inbox';
    if (purpose === 'response')
      return everyPath(items, '/approvals/requests/needs-info')
        ? '/approvals/requests/needs-info'
        : '/approvals/home';
    if (purpose === 'request') {
      if (everyPath(items, '/approvals/requests/submitted')) {
        return '/approvals/requests/submitted';
      }
      if (everyPath(items, '/approvals/requests/needs-info')) {
        return '/approvals/requests/needs-info';
      }
      return '/approvals/home';
    }
    if (purpose === 'pulse') {
      if (everyPath(items, '/approvals/inbox')) return '/approvals/inbox';
      if (everyPath(items, '/approvals/admin/operations')) return '/approvals/admin/operations';
      return '/approvals/home';
    }
  }

  if (appKey === 'APP.CALENDAR') {
    if (purpose === 'timeline') return '/calendar/schedule';
    if (purpose === 'response' || purpose === 'pulse') return '/calendar/home';
  }
  if (appKey === 'APP.HCM') {
    const routes = [...new Set(items.map((item) => pathOf(item.deepLink)))];
    return routes.length === 1 && routes[0]?.startsWith('/hr/') ? routes[0] : '/hr/home';
  }

  const routes: Partial<Record<HomeContributionBucketKey, Record<string, string>>> = {
    action: {
      'APP.WORK': '/work/queue',
      'APP.WORKPLACE': '/workplace/my-bookings',
    },
    timeline: {
      'APP.WORKPLACE': '/workplace/my-bookings',
      'APP.WORK': '/work/queue',
    },
    response: {
      'APP.EMPLOYEE_SERVICES': '/services/my',
      'APP.NOTIFICATIONS': '/notifications/home',
    },
    request: { 'APP.EMPLOYEE_SERVICES': '/services/my' },
    pulse: {
      'APP.WORK': '/work/queue',
      'APP.ACTIVITY': '/activity',
      'APP.NOTIFICATIONS': '/notifications/home',
    },
  };
  return routes[purpose]?.[appKey];
}
