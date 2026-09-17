import type { NormalizedHomeContribution } from '../contributions';

export const HOME_WORK_FILTERS = ['all', 'urgentApproval', 'accessReview', 'personalTask'] as const;

export type HomeWorkFilter = (typeof HOME_WORK_FILTERS)[number];

export type HomeWorkActionCta = 'approvalReview' | 'accessReview' | 'start' | 'supplement' | 'open';

export type HomeWorkActionComposition = Readonly<{
  actionItems: readonly NormalizedHomeContribution[];
  responseItems: readonly NormalizedHomeContribution[];
}>;

export const HOME_WORK_CARD_VISIBLE_LIMIT = 4;

const URGENT_PRIORITIES = new Set(['CRITICAL', 'HIGH']);
const PRIORITY_RANK: Readonly<Record<NormalizedHomeContribution['priority'], number>> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  NONE: 4,
};
const REQUESTER_RESPONSE_STATES = new Set([
  'AWAITING_REQUESTER',
  'INFO_REQUESTED',
  'NEEDS_INFO',
  'NEEDS_INFORMATION',
]);

function identityTokens(item: NormalizedHomeContribution): readonly string[] {
  return [item.dedupeKey, item.sourceReference, ...item.sourceReferences]
    .map((value) => value.trim().toLocaleUpperCase('en-US'))
    .filter(Boolean);
}

function hasIdentity(item: NormalizedHomeContribution, namespace: string): boolean {
  const prefix = `${namespace}:`;
  return identityTokens(item).some((value) => value === namespace || value.startsWith(prefix));
}

export function isHomeApprovalAction(item: NormalizedHomeContribution): boolean {
  return (
    item.owner.appKey === 'APP.APPROVALS' ||
    item.providerKey === 'approval-home' ||
    hasIdentity(item, 'APPROVAL') ||
    hasIdentity(item, 'APPROVAL_TASK')
  );
}

export function isHomeAccessReviewAction(item: NormalizedHomeContribution): boolean {
  return hasIdentity(item, 'IDENTITY_GOVERNANCE');
}

export function isHomePersonalTaskAction(item: NormalizedHomeContribution): boolean {
  return item.providerKey === 'personal-work' || hasIdentity(item, 'PERSONAL_TASK');
}

export function isHomeRequesterSupplementAction(item: NormalizedHomeContribution): boolean {
  const status = item.status
    .trim()
    .toLocaleUpperCase('en-US')
    .replace(/[^A-Z0-9]+/gu, '_');
  return (
    REQUESTER_RESPONSE_STATES.has(status) &&
    (hasIdentity(item, 'SERVICE') || hasIdentity(item, 'SERVICE_REQUEST'))
  );
}

/**
 * Only a same-origin Work queue deep link can move a response obligation into
 * the Work action card. The contribution model has already applied provider
 * and item authority before this presentation-only composition is evaluated.
 */
export function isCanonicalHomeWorkRoute(route: string): boolean {
  if (!route.startsWith('/')) return false;
  try {
    const url = new URL(route, 'https://dwp.invalid');
    if (url.origin !== 'https://dwp.invalid' || url.pathname !== '/work/queue') return false;
    return Boolean(url.searchParams.get('work') || url.searchParams.get('item'));
  } catch {
    return false;
  }
}

export function homeWorkActionCta(item: NormalizedHomeContribution): HomeWorkActionCta {
  if (isHomeAccessReviewAction(item)) return 'accessReview';
  if (isHomePersonalTaskAction(item)) return 'start';
  if (isHomeRequesterSupplementAction(item)) return 'supplement';
  if (isHomeApprovalAction(item)) return 'approvalReview';
  return 'open';
}

export function homeWorkActionFilterCounts(
  items: readonly NormalizedHomeContribution[]
): Readonly<Record<HomeWorkFilter, number>> {
  return {
    all: items.length,
    urgentApproval: items.filter(
      (item) => isHomeApprovalAction(item) && URGENT_PRIORITIES.has(item.priority)
    ).length,
    accessReview: items.filter(isHomeAccessReviewAction).length,
    personalTask: items.filter(isHomePersonalTaskAction).length,
  };
}

export function filterHomeWorkActions(
  items: readonly NormalizedHomeContribution[],
  filter: HomeWorkFilter
): readonly NormalizedHomeContribution[] {
  if (filter === 'all') return items;
  if (filter === 'urgentApproval') {
    return items.filter(
      (item) => isHomeApprovalAction(item) && URGENT_PRIORITIES.has(item.priority)
    );
  }
  if (filter === 'accessReview') return items.filter(isHomeAccessReviewAction);
  return items.filter(isHomePersonalTaskAction);
}

/**
 * Work owns the execution route for requester supplements even though the
 * source provider owns the business record. Re-home only that governed route,
 * then remove it from the response card so one obligation is never shown twice.
 */
export function composeHomeWorkActions(
  actionItems: readonly NormalizedHomeContribution[],
  responseItems: readonly NormalizedHomeContribution[]
): HomeWorkActionComposition {
  const workResponses = responseItems.filter(
    (item) =>
      item.kind === 'RESPONSE' &&
      isHomeRequesterSupplementAction(item) &&
      isCanonicalHomeWorkRoute(item.route)
  );
  const moved = new Set(workResponses.map((item) => `${item.providerKey}:${item.id}`));
  const mergedActions = [...actionItems, ...workResponses];
  // The reference card exposes four rows. When an existing tenant has more,
  // keep a newly re-homed high-priority requester obligation from being hidden
  // behind lower-priority actions while preserving the exact four-row order.
  if (mergedActions.length > HOME_WORK_CARD_VISIBLE_LIMIT) {
    mergedActions.sort(
      (left, right) => PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority]
    );
  }
  return {
    actionItems: mergedActions,
    responseItems: responseItems.filter((item) => !moved.has(`${item.providerKey}:${item.id}`)),
  };
}
