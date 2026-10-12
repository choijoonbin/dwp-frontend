import type { AskPageContext } from '@dwp-frontend/shared-utils';

export type DwaionSurfaceContext = {
  pageContext: AskPageContext;
  suggestionKeys: readonly string[];
};

const surfaces: readonly (DwaionSurfaceContext & { prefix: string })[] = [
  {
    prefix: '/calendar',
    pageContext: { route: '/calendar', appKey: 'APP.CALENDAR', surface: 'schedule' },
    suggestionKeys: ['calendarBrief', 'meetingConflict', 'meetingPrep'],
  },
  {
    prefix: '/mail',
    pageContext: { route: '/mail', appKey: 'APP.MAIL', surface: 'inbox' },
    suggestionKeys: ['mailPriority', 'mailFollowup', 'mailDraft'],
  },
  {
    prefix: '/approvals',
    pageContext: { route: '/approvals', appKey: 'APP.APPROVALS', surface: 'decision-hub' },
    suggestionKeys: ['approvalPriority', 'approvalRisk', 'approvalDraft'],
  },
  {
    prefix: '/services',
    pageContext: {
      route: '/services',
      appKey: 'APP.EMPLOYEE_SERVICES',
      surface: 'service-center',
    },
    suggestionKeys: ['serviceFind', 'serviceStatus', 'policy'],
  },
  {
    prefix: '/hr',
    pageContext: { route: '/hr', appKey: 'APP.HCM', surface: 'people' },
    suggestionKeys: ['peopleFind', 'organization', 'policy'],
  },
  {
    prefix: '/work',
    pageContext: { route: '/work', appKey: 'APP.WORK', surface: 'work-queue' },
    suggestionKeys: ['priority', 'blockers', 'access'],
  },
  {
    prefix: '/',
    pageContext: { route: '/', appKey: 'APP.WORK', surface: 'home' },
    suggestionKeys: ['priority', 'calendarBrief', 'access'],
  },
];

export function resolveDwaionSurfaceContext(pathname: string): DwaionSurfaceContext {
  const surface = surfaces.find(({ prefix }) =>
    prefix === '/' ? pathname === '/' : pathname.startsWith(prefix)
  );
  const fallback = surface ?? surfaces[surfaces.length - 1];
  return {
    pageContext: { ...fallback.pageContext, route: pathname || '/' },
    suggestionKeys: fallback.suggestionKeys,
  };
}
