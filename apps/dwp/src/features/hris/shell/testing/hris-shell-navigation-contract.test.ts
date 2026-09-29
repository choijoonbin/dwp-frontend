import { describe, expect, it } from 'vitest';

import {
  HRIS_SHELL_ENTRIES,
  projectHrisShellNavigation,
  resolveHrisShellSelectedView,
} from '../model/hris-shell-navigation-contract';

function views(paths: readonly string[]) {
  return projectHrisShellNavigation(new Set(paths))
    .flatMap((group) => group.items)
    .map((item) => item.view);
}

function selectedVisibleViews(pathname: string, authorizedPaths: readonly string[]) {
  const owner = resolveHrisShellSelectedView(pathname);
  return views(authorizedPaths).filter((view) => view === owner);
}

describe('canonical HRIS shell navigation projection', () => {
  it('renders fixed home and seven workbenches in canonical order from authorized descendants', () => {
    const allCandidates = HRIS_SHELL_ENTRIES.flatMap((entry) => entry.candidates);
    expect(views(allCandidates)).toEqual([
      'shell-home',
      'workbench-my-hr',
      'workbench-team',
      'workbench-hr-operations',
      'workbench-time',
      'workbench-payroll',
      'workbench-performance',
      'workbench-settings',
    ]);
  });

  it('omits a workbench without an authorized descendant and links to the first allowed PAGE', () => {
    const projected = projectHrisShellNavigation(
      new Set(['/hr/home', '/hr/team/absence', '/hr/operations/assignments', '/hr/data/exports'])
    ).flatMap((group) => group.items);

    expect(projected.map(({ view, path }) => ({ view, path }))).toEqual([
      { view: 'shell-home', path: '/hr/home' },
      { view: 'workbench-team', path: '/hr/team/absence' },
      { view: 'workbench-hr-operations', path: '/hr/operations/assignments' },
      { view: 'workbench-settings', path: '/hr/data/exports' },
    ]);
  });

  it('assigns every compatibility PAGE to at most one shell entry', () => {
    const candidates = HRIS_SHELL_ENTRIES.flatMap((entry) => entry.candidates);
    expect(new Set(candidates).size).toBe(candidates.length);
  });

  it('never promotes BENSK, the explorer utility, or arbitrary leaf paths into the sidebar', () => {
    const projected = projectHrisShellNavigation(
      new Set(['/hr/benefits', '/hr/operations/benefits', '/hr/explore', '/hr/unregistered'])
    );
    expect(projected).toEqual([]);
    expect(HRIS_SHELL_ENTRIES.flatMap((entry) => entry.candidates)).not.toEqual(
      expect.arrayContaining(['/hr/benefits', '/hr/operations/benefits', '/hr/explore'])
    );
  });

  it('selects exactly the longest canonical owner for overlapping operations routes', () => {
    const allCandidates = HRIS_SHELL_ENTRIES.flatMap((entry) => entry.candidates);
    expect(resolveHrisShellSelectedView('/hr/operations')).toBe('workbench-hr-operations');
    expect(resolveHrisShellSelectedView('/hr/operations/people')).toBe('workbench-hr-operations');
    expect(resolveHrisShellSelectedView('/hr/operations/time')).toBe('workbench-time');
    expect(resolveHrisShellSelectedView('/hr/operations/time/review')).toBe('workbench-time');
    expect(resolveHrisShellSelectedView('/hr/operations/pay')).toBe('workbench-payroll');
    expect(resolveHrisShellSelectedView('/hr/operations/talent')).toBe('workbench-performance');
    expect(selectedVisibleViews('/hr/operations/time', allCandidates)).toEqual(['workbench-time']);
    expect(selectedVisibleViews('/hr/operations/pay', allCandidates)).toEqual([
      'workbench-payroll',
    ]);
    expect(selectedVisibleViews('/hr/operations/talent', allCandidates)).toEqual([
      'workbench-performance',
    ]);
  });

  it('does not fall back to a broader visible owner when the exact owner is unauthorized', () => {
    const visibleViews = views(['/hr/operations']);
    const canonicalOwner = resolveHrisShellSelectedView('/hr/operations/time');

    expect(canonicalOwner).toBe('workbench-time');
    expect(visibleViews).not.toContain(canonicalOwner);
    expect(selectedVisibleViews('/hr/operations/time', ['/hr/operations'])).toEqual([]);
  });

  it('fully excludes BENSK routes from projection and active-state ownership', () => {
    expect(resolveHrisShellSelectedView('/hr/benefits')).toBeUndefined();
    expect(resolveHrisShellSelectedView('/hr/benefits/elections')).toBeUndefined();
    expect(resolveHrisShellSelectedView('/hr/operations/benefits')).toBeUndefined();
    expect(resolveHrisShellSelectedView('/hr/operations/benefits/configuration')).toBeUndefined();
  });
});
