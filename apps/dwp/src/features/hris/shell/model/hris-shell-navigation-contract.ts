import {
  BriefcaseBusiness,
  Clock3,
  ContactRound,
  House,
  ReceiptText,
  Settings2,
  Sparkles,
  UsersRound,
} from 'lucide-react';

import {
  normalizeProductPath,
  resolveProductNavigationSelection,
} from '../../../../components/product-manifest';

import type {
  ProductNavigationGroup,
  ProductNavigationItem,
  ProductShellNavigationProjection,
} from '../../../../components/product-manifest';

type HrisShellEntry = Readonly<{
  view: string;
  groupId: HrisShellGroupId;
  candidates: readonly [string, ...string[]];
  icon: ProductNavigationItem['icon'];
}>;

export const HRIS_SHELL_GROUP_IDS = [
  'shell-home',
  'people-work',
  'operations-work',
  'administration',
] as const;

export type HrisShellGroupId = (typeof HRIS_SHELL_GROUP_IDS)[number];

/**
 * Static candidates are deliberately finite and unique. Canonical R6-C PAGEs own presentation;
 * historical aliases are selection-only so bookmarks never create a second sidebar entry.
 * BENSK benefits routes and /hr/explore are intentionally absent.
 */
export const HRIS_SHELL_ENTRIES: readonly HrisShellEntry[] = [
  {
    view: 'shell-home',
    groupId: 'shell-home',
    candidates: ['/hr/home'],
    icon: House,
  },
  {
    view: 'workbench-my-hr',
    groupId: 'people-work',
    candidates: [
      '/hr/me',
      '/hr/me/employment-documents',
      '/hr/me/requests',
      '/hr/time',
      '/hr/absence',
      '/hr/pay',
      '/hr/talent',
      '/hr/services',
      '/hr/directory',
      '/hr/organization',
    ],
    icon: ContactRound,
  },
  {
    view: 'workbench-team',
    groupId: 'people-work',
    candidates: [
      '/hr/team',
      '/hr/team/time',
      '/hr/team/leave',
      '/hr/team/people-changes',
      '/hr/team/delegation',
    ],
    icon: UsersRound,
  },
  {
    view: 'workbench-hr-operations',
    groupId: 'operations-work',
    candidates: [
      '/hr/operations/home',
      '/hr/operations/people',
      '/hr/operations/people/employee-change-requests',
      '/hr/operations/people/employment-assignments',
      '/hr/operations/people/appointments',
      '/hr/operations/people/certificates-documents',
      '/hr/operations/people/organization-positions',
      '/hr/operations/assignments',
      '/hr/design/organization',
    ],
    icon: BriefcaseBusiness,
  },
  {
    view: 'workbench-time',
    groupId: 'operations-work',
    candidates: [
      '/hr/operations/time',
      '/hr/operations/time/work-plans',
      '/hr/operations/time/clock-ingestion',
      '/hr/operations/time/interpretation',
      '/hr/operations/time/exceptions',
      '/hr/operations/time/leave-operations',
    ],
    icon: Clock3,
  },
  {
    view: 'workbench-payroll',
    groupId: 'operations-work',
    candidates: ['/hr/operations/pay', '/hr/operations/payroll/population'],
    icon: ReceiptText,
  },
  {
    view: 'workbench-performance',
    groupId: 'operations-work',
    candidates: [
      '/hr/operations/talent',
      '/hr/operations/performance/goal-cycles',
      '/hr/operations/performance/review-operations',
      '/hr/operations/performance/compensation-planning',
    ],
    icon: Sparkles,
  },
  {
    view: 'workbench-settings',
    groupId: 'administration',
    candidates: [
      '/hr/manage/system',
      '/hr/settings/reference-data',
      '/hr/settings/payroll',
      '/hr/settings/navigation-policy',
      '/hr/settings/people-employment',
      '/hr/settings/operations',
      '/hr/settings/workflow',
      '/hr/data/reference',
      '/hr/data/integrations',
      '/hr/data/exports',
    ],
    icon: Settings2,
  },
] as const;

const HRIS_SHELL_EXCLUDED_PATHS = [
  '/hr/benefits',
  '/hr/operations/benefits',
  '/hr/explore',
] as const;

const HRIS_SHELL_DEEP_LINK_SELECTION: Readonly<Record<string, HrisShellEntry['view']>> =
  Object.freeze({
    '/hr/team/absence': 'workbench-team',
    '/hr/operations': 'workbench-hr-operations',
    '/hr/operations/absence': 'workbench-time',
  });

function authorizedCandidates(
  entry: HrisShellEntry,
  authorizedPaths: ReadonlySet<string>
): string[] {
  return entry.candidates.filter((path) => authorizedPaths.has(normalizeProductPath(path)));
}

export function projectHrisShellNavigation(
  authorizedPaths: ReadonlySet<string>
): readonly ProductNavigationGroup[] {
  const normalizedAuthorizedPaths = new Set(
    [...authorizedPaths].map((path) => normalizeProductPath(path))
  );
  const entries = HRIS_SHELL_ENTRIES.flatMap((entry) => {
    const candidates = authorizedCandidates(entry, normalizedAuthorizedPaths);
    const first = candidates[0];
    return first
      ? [
          {
            groupId: entry.groupId,
            item: {
              path: first,
              view: entry.view,
              icon: entry.icon,
              activePathPrefixes: candidates,
            } satisfies ProductNavigationItem,
          },
        ]
      : [];
  });

  return HRIS_SHELL_GROUP_IDS.flatMap((groupId) => {
    const items = entries.filter((entry) => entry.groupId === groupId).map((entry) => entry.item);
    return items.length ? [{ id: groupId, items }] : [];
  });
}

/**
 * Reapplies the same persona-oriented grouping to a server-projected workbench list. The server
 * still decides which workbenches and descendants are visible; this function controls only stable
 * presentation order and never adds a route that was absent from the projection.
 */
export function groupHrisShellNavigationItems(
  items: readonly ProductNavigationItem[]
): readonly ProductNavigationGroup[] {
  const itemByView = new Map(items.map((item) => [item.view, item]));
  return HRIS_SHELL_GROUP_IDS.flatMap((groupId) => {
    const groupItems = HRIS_SHELL_ENTRIES.filter((entry) => entry.groupId === groupId).flatMap(
      (entry) => {
        const item = itemByView.get(entry.view);
        return item ? [item] : [];
      }
    );
    return groupItems.length ? [{ id: groupId, items: Object.freeze(groupItems) }] : [];
  });
}

const HRIS_SHELL_OWNERSHIP = projectHrisShellNavigation(
  new Set(HRIS_SHELL_ENTRIES.flatMap((entry) => entry.candidates))
);

export function resolveHrisShellSelectedView(pathname: string): string | undefined {
  const normalizedPath = normalizeProductPath(pathname);
  if (
    HRIS_SHELL_EXCLUDED_PATHS.some(
      (excluded) => normalizedPath === excluded || normalizedPath.startsWith(`${excluded}/`)
    )
  ) {
    return undefined;
  }
  const compatibilityOwner = HRIS_SHELL_DEEP_LINK_SELECTION[normalizedPath];
  if (compatibilityOwner) return compatibilityOwner;
  return resolveProductNavigationSelection(normalizedPath, HRIS_SHELL_OWNERSHIP)?.view;
}

export const HRIS_SHELL_NAVIGATION_PROJECTION: ProductShellNavigationProjection = Object.freeze({
  hideSurfaceNavigation: true,
  project: projectHrisShellNavigation,
  resolveSelectedView: resolveHrisShellSelectedView,
});
