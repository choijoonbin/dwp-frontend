import type { HrDomainOperationsSummary } from '@dwp-frontend/shared-utils';

export type HrOperationsDestination = Readonly<{
  path: string;
  view: string;
}>;

export const HR_OPERATIONS_DESTINATIONS: Readonly<
  Record<HrDomainOperationsSummary['domain'], HrOperationsDestination>
> = {
  WORKFORCE: { path: '/hr/operations/people', view: 'people' },
  TIME: { path: '/hr/operations/time', view: 'time-operations' },
  ABSENCE: { path: '/hr/operations/absence', view: 'absence-operations' },
  BENEFITS: { path: '/hr/operations/benefits', view: 'benefits-operations' },
  PAY: { path: '/hr/operations/pay', view: 'pay-operations' },
  TALENT: { path: '/hr/operations/talent', view: 'talent-operations' },
};

export function hrOperationsDestination(
  domain: HrDomainOperationsSummary['domain']
): HrOperationsDestination {
  return HR_OPERATIONS_DESTINATIONS[domain];
}
