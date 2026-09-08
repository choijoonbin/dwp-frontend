/** Lightweight route metadata shared by the eager router and the lazy Work experience. */
export const WORK_HUB_VIEWS = [
  { view: 'queue', path: '/work/queue', scope: 'ALL' },
  { view: 'action-required', path: '/work/action-required', scope: 'ACTIONABLE' },
  { view: 'day-plan', path: '/work/day-plan', scope: 'TODAY' },
  { view: 'in-progress', path: '/work/in-progress', scope: 'IN_PROGRESS' },
  { view: 'awaiting-response', path: '/work/awaiting-response', scope: 'WAITING' },
  { view: 'completed', path: '/work/completed', scope: 'COMPLETED' },
] as const;

export type WorkHubView = (typeof WORK_HUB_VIEWS)[number]['view'];
