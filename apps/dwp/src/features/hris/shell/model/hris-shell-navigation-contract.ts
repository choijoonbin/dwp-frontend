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
  groupId: 'shell-home' | 'workbenches';
  candidates: readonly [string, ...string[]];
  icon: ProductNavigationItem['icon'];
}>;

/**
 * Compatibility paths are deliberately finite and unique. They preserve the existing exact PAGE
 * guards while the canonical workbench landing routes are implemented in later slices.
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
    groupId: 'workbenches',
    candidates: [
      '/hr/me',
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
    groupId: 'workbenches',
    candidates: ['/hr/team', '/hr/team/time', '/hr/team/absence'],
    icon: UsersRound,
  },
  {
    view: 'workbench-hr-operations',
    groupId: 'workbenches',
    candidates: [
      '/hr/operations',
      '/hr/operations/people',
      '/hr/operations/assignments',
      '/hr/design/organization',
    ],
    icon: BriefcaseBusiness,
  },
  {
    view: 'workbench-time',
    groupId: 'workbenches',
    candidates: ['/hr/operations/time', '/hr/operations/absence'],
    icon: Clock3,
  },
  {
    view: 'workbench-payroll',
    groupId: 'workbenches',
    candidates: ['/hr/operations/pay'],
    icon: ReceiptText,
  },
  {
    view: 'workbench-performance',
    groupId: 'workbenches',
    candidates: ['/hr/operations/talent'],
    icon: Sparkles,
  },
  {
    view: 'workbench-settings',
    groupId: 'workbenches',
    candidates: ['/hr/data/reference', '/hr/data/integrations', '/hr/data/exports'],
    icon: Settings2,
  },
] as const;

const HRIS_SHELL_EXCLUDED_PATHS = [
  '/hr/benefits',
  '/hr/operations/benefits',
  '/hr/explore',
] as const;

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

  return (['shell-home', 'workbenches'] as const).flatMap((groupId) => {
    const items = entries.filter((entry) => entry.groupId === groupId).map((entry) => entry.item);
    return items.length ? [{ id: groupId, items }] : [];
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
  return resolveProductNavigationSelection(normalizedPath, HRIS_SHELL_OWNERSHIP)?.view;
}

export const HRIS_SHELL_NAVIGATION_PROJECTION: ProductShellNavigationProjection = Object.freeze({
  hideSurfaceNavigation: true,
  project: projectHrisShellNavigation,
  resolveSelectedView: resolveHrisShellSelectedView,
});
