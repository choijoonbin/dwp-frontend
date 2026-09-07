import type { MenuVisualBaselineEntry, MenuVisualProject } from './menu-visual-baseline-inventory';

export type MenuVisualBaselineException = {
  routeId: string;
  projects: readonly MenuVisualProject[];
  owner: string;
  reason: string;
  reviewBy: string;
};

export type MenuVisualBaselinePolicyInput = {
  manifestRouteIds: readonly string[];
  baselines: readonly MenuVisualBaselineEntry[];
  exceptions: readonly MenuVisualBaselineException[];
  today: string;
};

export const MENU_VISUAL_PROJECTS = ['chromium', 'mobile'] as const;

const ALL_PROJECTS: readonly MenuVisualProject[] = MENU_VISUAL_PROJECTS;
const POLICY_REVIEW_BY = '2026-11-30';

function defineExceptions(
  metadata: Pick<MenuVisualBaselineException, 'owner' | 'reason' | 'reviewBy'>,
  routeIds: readonly string[],
  projects: readonly MenuVisualProject[] = ALL_PROJECTS
): MenuVisualBaselineException[] {
  return routeIds.map((routeId) => ({ routeId, projects, ...metadata }));
}

export const MENU_VISUAL_BASELINE_EXCEPTIONS: readonly MenuVisualBaselineException[] = [
  ...defineExceptions(
    {
      owner: '@dwp/work-experience',
      reason:
        'The domain team owns dedicated experience coverage and must approve deterministic menu snapshots before this temporary structural-only coverage can be retired.',
      reviewBy: POLICY_REVIEW_BY,
    },
    ['home.personal', 'catalog.apps', 'work.queue', 'activity.home', 'activity.timeline']
  ),
  ...defineExceptions(
    {
      owner: '@dwp/ai-experience',
      reason:
        'DWAI routes currently rely on the complete structural runtime contract while stable seeded visual states are prepared for explicit pixel approval.',
      reviewBy: POLICY_REVIEW_BY,
    },
    [
      'dwaion.home',
      'dwaion.new',
      'dwaion.conversations',
      'dwaion.activity',
      'dwaion.proposals',
      'dwaion.agents',
      'dwaion.actions',
      'dwaion.admin-overview',
      'dwaion.admin-agents',
      'dwaion.admin-sources',
      'dwaion.admin-actions',
      'dwaion.admin-safety',
      'dwaion.admin-evaluation',
      'dwaion.admin-gates',
      'dwaion.admin-audit',
    ]
  ),
  ...defineExceptions(
    {
      owner: '@dwp/communications',
      reason:
        'Communications routes retain structural runtime coverage until deterministic content fixtures and their visual review are owned by the domain team.',
      reviewBy: POLICY_REVIEW_BY,
    },
    [
      'communications.home',
      'communications.for-you',
      'communications.all',
      'communications.required',
      'communications.saved',
      'communications.admin-content',
    ]
  ),
  ...defineExceptions(
    {
      owner: '@dwp/services',
      reason:
        'Service catalog states remain structurally governed while stable catalog fixtures are prepared for domain-owned pixel baseline approval.',
      reviewBy: POLICY_REVIEW_BY,
    },
    [
      'services.home',
      'services.discover',
      'services.my',
      'services.drafts',
      'services.admin-catalog',
      'services.admin-operations',
    ]
  ),
  ...defineExceptions(
    {
      owner: '@dwp/notifications',
      reason:
        'Notification streaming states retain structural runtime coverage pending stable event fixtures and explicit visual approval by the owning team.',
      reviewBy: POLICY_REVIEW_BY,
    },
    [
      'notifications.home',
      'notifications.center',
      'notifications.settings',
      'notifications.admin-overview',
      'notifications.admin-contracts',
      'notifications.admin-policies',
      'notifications.admin-templates',
      'notifications.admin-operations',
      'notifications.admin-suppressions',
    ]
  ),
  ...defineExceptions(
    {
      owner: '@dwp/calendar',
      reason:
        'Calendar time-dependent states remain under structural runtime coverage until deterministic clock fixtures receive explicit visual approval.',
      reviewBy: POLICY_REVIEW_BY,
    },
    ['calendar.focus', 'calendar.invitations', 'calendar.trash']
  ),
  ...defineExceptions(
    {
      owner: '@dwp/calendar',
      reason:
        'The desktop baseline remains active; the responsive company-calendar fixture requires explicit mobile visual approval before coverage is enabled.',
      reviewBy: POLICY_REVIEW_BY,
    },
    ['calendar.admin-company-calendars'],
    ['mobile']
  ),
  ...defineExceptions(
    {
      owner: '@dwp/workplace',
      reason:
        'Workplace availability routes retain structural runtime coverage while stable inventory fixtures are prepared for pixel baseline approval.',
      reviewBy: POLICY_REVIEW_BY,
    },
    [
      'rooms.home',
      'rooms.explore',
      'rooms.find-rooms',
      'rooms.my-bookings',
      'rooms.my-meetings',
      'rooms.admin-overview',
      'rooms.admin-operations',
      'rooms.admin-governance',
      'rooms.admin-locations',
      'rooms.admin-policy',
      'rooms.admin-room-operations',
      'rooms.admin-room-policy',
    ]
  ),
  ...defineExceptions(
    {
      owner: '@dwp/mail',
      reason:
        'Mail data states retain the complete structural runtime contract until deterministic mailbox fixtures receive explicit visual approval.',
      reviewBy: POLICY_REVIEW_BY,
    },
    [
      'mail.home',
      'mail.inbox',
      'mail.sent',
      'mail.drafts',
      'mail.archive',
      'mail.spam',
      'mail.trash',
      'mail.folders',
      'mail.shared',
      'mail.organization',
      'mail.accounts',
      'mail.admin-overview',
      'mail.admin-connections',
      'mail.admin-shared-inboxes',
      'mail.admin-policies',
    ]
  ),
  ...defineExceptions(
    {
      owner: '@dwp/meetings',
      reason:
        'Meeting lifecycle routes remain structurally governed while stable media and session fixtures are prepared for domain visual approval.',
      reviewBy: POLICY_REVIEW_BY,
    },
    [
      'meetings.home',
      'meetings.join',
      'meetings.mine',
      'meetings.history',
      'meetings.admin-operations',
      'meetings.admin-policies',
      'meetings.admin-intelligence',
    ]
  ),
  ...defineExceptions(
    {
      owner: '@dwp/messaging',
      reason:
        'Messaging live states retain structural runtime coverage pending deterministic conversation fixtures and explicit visual review.',
      reviewBy: POLICY_REVIEW_BY,
    },
    [
      'messaging.home',
      'messaging.inbox',
      'messaging.spaces',
      'messaging.direct',
      'messaging.people',
      'messaging.later',
      'messaging.admin-overview',
      'messaging.admin-policy',
    ]
  ),
  ...defineExceptions(
    {
      owner: '@dwp/approvals',
      reason:
        'The completed approvals state retains structural runtime coverage until its deterministic visual fixture is reviewed and approved.',
      reviewBy: POLICY_REVIEW_BY,
    },
    ['approvals.completed']
  ),
  ...defineExceptions(
    {
      owner: '@dwp/spaces',
      reason:
        'Space membership and administration states retain structural coverage while deterministic tenant fixtures await visual approval.',
      reviewBy: POLICY_REVIEW_BY,
    },
    [
      'spaces.home',
      'spaces.my-spaces',
      'spaces.discover',
      'spaces.requests',
      'spaces.admin-overview',
      'spaces.admin-directory',
      'spaces.admin-requests',
      'spaces.admin-templates',
      'spaces.admin-content-reviews',
      'spaces.admin-lifecycle',
      'spaces.admin-operations',
    ]
  ),
  ...defineExceptions(
    {
      owner: '@dwp/tenant-admin',
      reason:
        'Home composition remains structurally governed while its interactive composition fixture awaits explicit admin visual approval.',
      reviewBy: POLICY_REVIEW_BY,
    },
    ['admin.home-composition']
  ),
  ...defineExceptions(
    {
      owner: '@dwp/account',
      reason:
        'Account notification preferences remain structurally governed until deterministic preference fixtures receive explicit visual approval.',
      reviewBy: POLICY_REVIEW_BY,
    },
    ['account.notifications']
  ),
];

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const OWNER_PATTERN = /^@dwp\/[a-z0-9-]+$/;

function isCalendarDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export function validateMenuVisualBaselinePolicy({
  manifestRouteIds,
  baselines,
  exceptions,
  today,
}: MenuVisualBaselinePolicyInput): string[] {
  const issues: string[] = [];
  const manifestRouteIdSet = new Set(manifestRouteIds);
  if (manifestRouteIdSet.size !== manifestRouteIds.length) {
    issues.push('manifest contains duplicate route ids');
  }
  if (!isCalendarDate(today)) {
    issues.push(`policy evaluation date is invalid: ${today}`);
  }

  const baselineCoverage = new Set<string>();
  const baselineFileNames = new Set<string>();
  for (const baseline of baselines) {
    const key = `${baseline.routeId}:${baseline.project}`;
    if (!manifestRouteIdSet.has(baseline.routeId)) {
      issues.push(`stale visual baseline route: ${baseline.routeId}`);
    }
    if (!MENU_VISUAL_PROJECTS.includes(baseline.project)) {
      issues.push(`invalid visual baseline project: ${key}`);
    }
    if (baselineCoverage.has(key)) issues.push(`duplicate visual baseline coverage: ${key}`);
    baselineCoverage.add(key);
    if (!baseline.fileName.trim()) issues.push(`visual baseline file name is missing: ${key}`);
    if (baselineFileNames.has(baseline.fileName)) {
      issues.push(`duplicate visual baseline file name: ${baseline.fileName}`);
    }
    baselineFileNames.add(baseline.fileName);
  }

  const exceptionCoverage = new Set<string>();
  for (const exception of exceptions) {
    if (!manifestRouteIdSet.has(exception.routeId)) {
      issues.push(`stale non-visual exception route: ${exception.routeId}`);
    }
    if (!OWNER_PATTERN.test(exception.owner)) {
      issues.push(`non-visual exception owner is missing or invalid: ${exception.routeId}`);
    }
    if (exception.reason.trim().length < 40) {
      issues.push(`non-visual exception reason is missing or too short: ${exception.routeId}`);
    }
    if (!isCalendarDate(exception.reviewBy)) {
      issues.push(`non-visual exception review date is invalid: ${exception.routeId}`);
    } else if (isCalendarDate(today) && exception.reviewBy < today) {
      issues.push(
        `non-visual exception review is overdue: ${exception.routeId} (${exception.reviewBy})`
      );
    }
    if (exception.projects.length === 0) {
      issues.push(`non-visual exception has no projects: ${exception.routeId}`);
    }
    const projects = new Set<MenuVisualProject>();
    for (const project of exception.projects) {
      const key = `${exception.routeId}:${project}`;
      if (!MENU_VISUAL_PROJECTS.includes(project)) {
        issues.push(`invalid non-visual exception project: ${key}`);
      }
      if (projects.has(project) || exceptionCoverage.has(key)) {
        issues.push(`duplicate non-visual exception coverage: ${key}`);
      }
      projects.add(project);
      exceptionCoverage.add(key);
      if (baselineCoverage.has(key)) {
        issues.push(`visual baseline and non-visual exception overlap: ${key}`);
      }
    }
  }

  for (const routeId of manifestRouteIds) {
    for (const project of MENU_VISUAL_PROJECTS) {
      const key = `${routeId}:${project}`;
      if (!baselineCoverage.has(key) && !exceptionCoverage.has(key)) {
        issues.push(`menu visual coverage is unclassified: ${key}`);
      }
    }
  }

  return issues;
}
