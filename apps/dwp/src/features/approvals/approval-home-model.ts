import type { ApprovalRequest, HomeWidgetHeight } from '@dwp-frontend/shared-utils';

type RequestProgress = Pick<ApprovalRequest, 'status' | 'currentStepSequence' | 'totalSteps'>;

export function approvalHomeRowLimit(height: HomeWidgetHeight) {
  return { short: 1, standard: 2, tall: 4, expanded: 6 }[height];
}

export function approvalHomeRiskColor(score: number) {
  if (score >= 85) return 'error.main';
  if (score >= 70) return 'warning.main';
  return 'text.secondary';
}

export function approvalRequestProgress(request: RequestProgress): number | null {
  if (request.status === 'APPROVED') return 100;
  if (!['SUBMITTED', 'IN_REVIEW', 'NEEDS_INFO'].includes(request.status)) return null;

  const { currentStepSequence: current, totalSteps: total } = request;
  if (
    current == null ||
    !Number.isInteger(current) ||
    !Number.isInteger(total) ||
    total < 1 ||
    current < 1 ||
    current > total
  ) {
    return null;
  }

  // The current stage is still pending; its position is not a completed stage.
  return Math.floor(((current - 1) / total) * 100);
}
