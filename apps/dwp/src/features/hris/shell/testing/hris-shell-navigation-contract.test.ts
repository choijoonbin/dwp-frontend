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
    const projected = projectHrisShellNavigation(new Set(allCandidates));
    expect(projected.map((group) => [group.id, group.items.map((item) => item.view)])).toEqual([
      ['shell-home', ['shell-home']],
      ['people-work', ['workbench-my-hr', 'workbench-team']],
      [
        'operations-work',
        ['workbench-hr-operations', 'workbench-time', 'workbench-payroll', 'workbench-performance'],
      ],
      ['administration', ['workbench-settings']],
    ]);
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
      new Set(['/hr/home', '/hr/team/leave', '/hr/operations/assignments', '/hr/data/exports'])
    ).flatMap((group) => group.items);

    expect(projected.map(({ view, path }) => ({ view, path }))).toEqual([
      { view: 'shell-home', path: '/hr/home' },
      { view: 'workbench-team', path: '/hr/team/leave' },
      { view: 'workbench-hr-operations', path: '/hr/operations/assignments' },
      { view: 'workbench-settings', path: '/hr/data/exports' },
    ]);
  });

  it('projects every R6-C canonical owner once and keeps historical aliases selection-only', () => {
    const projected = projectHrisShellNavigation(
      new Set([
        '/hr/team/leave',
        '/hr/operations/home',
        '/hr/operations/time/work-plans',
        '/hr/operations/time/leave-operations',
        '/hr/operations/performance/goal-cycles',
      ])
    ).flatMap((group) => group.items);

    expect(projected.map(({ view, path }) => ({ view, path }))).toEqual([
      { view: 'workbench-team', path: '/hr/team/leave' },
      { view: 'workbench-hr-operations', path: '/hr/operations/home' },
      { view: 'workbench-time', path: '/hr/operations/time/work-plans' },
      {
        view: 'workbench-performance',
        path: '/hr/operations/performance/goal-cycles',
      },
    ]);
    expect(
      projectHrisShellNavigation(
        new Set(['/hr/team/absence', '/hr/operations', '/hr/operations/absence'])
      )
    ).toEqual([]);
    expect(HRIS_SHELL_ENTRIES.flatMap((entry) => entry.candidates)).not.toEqual(
      expect.arrayContaining(['/hr/team/absence', '/hr/operations', '/hr/operations/absence'])
    );
    expect(resolveHrisShellSelectedView('/hr/team/absence')).toBe('workbench-team');
    expect(resolveHrisShellSelectedView('/hr/operations')).toBe('workbench-hr-operations');
    expect(resolveHrisShellSelectedView('/hr/operations/absence')).toBe('workbench-time');
  });

  it('uses the governed system page as the settings workbench landing when it is authorized', () => {
    const projected = projectHrisShellNavigation(
      new Set(['/hr/manage/system', '/hr/data/reference'])
    ).flatMap((group) => group.items);

    expect(projected).toEqual([
      expect.objectContaining({ view: 'workbench-settings', path: '/hr/manage/system' }),
    ]);
  });

  it('opens the performance workbench from compensation planning when it is the only authorized PAGE', () => {
    const projected = projectHrisShellNavigation(
      new Set(['/hr/operations/performance/compensation-planning'])
    ).flatMap((group) => group.items);

    expect(projected).toEqual([
      expect.objectContaining({
        view: 'workbench-performance',
        path: '/hr/operations/performance/compensation-planning',
        activePathPrefixes: ['/hr/operations/performance/compensation-planning'],
      }),
    ]);
  });

  it('keeps the four canonical PAGEs inside the existing workbench owners', () => {
    const projected = projectHrisShellNavigation(
      new Set([
        '/hr/me/employment-documents',
        '/hr/operations/people/employment-assignments',
        '/hr/operations/time/interpretation',
        '/hr/settings/payroll',
      ])
    ).flatMap((group) => group.items);

    expect(projected.map(({ view, path }) => ({ view, path }))).toEqual([
      { view: 'workbench-my-hr', path: '/hr/me/employment-documents' },
      {
        view: 'workbench-hr-operations',
        path: '/hr/operations/people/employment-assignments',
      },
      { view: 'workbench-time', path: '/hr/operations/time/interpretation' },
      { view: 'workbench-settings', path: '/hr/settings/payroll' },
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
    expect(resolveHrisShellSelectedView('/hr/operations/time/clock-ingestion')).toBe(
      'workbench-time'
    );
    expect(resolveHrisShellSelectedView('/hr/me/employment-documents')).toBe('workbench-my-hr');
    expect(resolveHrisShellSelectedView('/hr/operations/people/employment-assignments')).toBe(
      'workbench-hr-operations'
    );
    expect(resolveHrisShellSelectedView('/hr/operations/time/interpretation')).toBe(
      'workbench-time'
    );
    expect(resolveHrisShellSelectedView('/hr/operations/time/exceptions')).toBe('workbench-time');
    expect(resolveHrisShellSelectedView('/hr/operations/performance/review-operations')).toBe(
      'workbench-performance'
    );
    expect(resolveHrisShellSelectedView('/hr/operations/performance/compensation-planning')).toBe(
      'workbench-performance'
    );
    expect(resolveHrisShellSelectedView('/hr/operations/people/employee-change-requests')).toBe(
      'workbench-hr-operations'
    );
    expect(resolveHrisShellSelectedView('/hr/settings/reference-data')).toBe('workbench-settings');
    expect(resolveHrisShellSelectedView('/hr/settings/payroll')).toBe('workbench-settings');
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
    expect(
      selectedVisibleViews('/hr/operations/performance/compensation-planning', ['/hr/operations'])
    ).toEqual([]);
  });

  it('fully excludes BENSK routes from projection and active-state ownership', () => {
    expect(resolveHrisShellSelectedView('/hr/benefits')).toBeUndefined();
    expect(resolveHrisShellSelectedView('/hr/benefits/elections')).toBeUndefined();
    expect(resolveHrisShellSelectedView('/hr/operations/benefits')).toBeUndefined();
    expect(resolveHrisShellSelectedView('/hr/operations/benefits/configuration')).toBeUndefined();
  });
});
