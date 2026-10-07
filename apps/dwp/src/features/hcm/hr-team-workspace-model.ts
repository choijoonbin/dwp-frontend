import type { HrTeamWorkspace } from '@dwp-frontend/shared-utils';

export type HrTeamDecisionDestination = Readonly<{
  domain: 'time' | 'absence';
  count: number;
  route: '/hr/team/time' | '/hr/team/absence';
}>;

export function buildHrTeamDecisionDestinations(
  workspace: Pick<HrTeamWorkspace, 'timePendingCount' | 'absencePendingCount'>
): readonly HrTeamDecisionDestination[] {
  return Object.freeze([
    Object.freeze({
      domain: 'time' as const,
      count: Math.max(0, workspace.timePendingCount),
      route: '/hr/team/time' as const,
    }),
    Object.freeze({
      domain: 'absence' as const,
      count: Math.max(0, workspace.absencePendingCount),
      route: '/hr/team/absence' as const,
    }),
  ]);
}

export function hrTeamMemberDirectoryPath(personId: string): string {
  return `/hr/directory?person=${encodeURIComponent(personId)}`;
}
