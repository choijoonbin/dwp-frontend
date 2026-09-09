import type {
  AgentActionHandoffOrigin,
  WorkplaceAction,
  WorkplaceActionPreview,
} from '@dwp-frontend/shared-utils';

import { actionDestination } from './dwaion-catalog-copy';

export type DwaionActionReviewRouteState = {
  dwaionActionReview: {
    preview: WorkplaceActionPreview;
    expectedOrigin: AgentActionHandoffOrigin;
    returnTo: string;
  };
};

export function createDwaionActionReviewRouteState(
  preview: WorkplaceActionPreview,
  expectedOrigin: AgentActionHandoffOrigin,
  returnTo: string
): DwaionActionReviewRouteState {
  return { dwaionActionReview: { preview, expectedOrigin, returnTo } };
}

export function readDwaionActionReviewRouteState(
  value: unknown
): DwaionActionReviewRouteState['dwaionActionReview'] | null {
  if (!isRecord(value) || !isRecord(value.dwaionActionReview)) return null;
  const candidate = value.dwaionActionReview;
  if (
    !isRecord(candidate.preview) ||
    !isRecord(candidate.expectedOrigin) ||
    typeof candidate.returnTo !== 'string' ||
    !candidate.returnTo.startsWith('/')
  ) {
    return null;
  }
  return candidate as DwaionActionReviewRouteState['dwaionActionReview'];
}

export function previewMatchesAction(
  preview: WorkplaceActionPreview,
  selected: WorkplaceAction,
  expectedOrigin: AgentActionHandoffOrigin,
  language: 'ko' | 'en'
): boolean {
  const actualOrigin = preview.plan.handoffOrigin;
  return (
    preview.action.actionKey === selected.actionKey &&
    preview.action.targetRoute === selected.targetRoute &&
    preview.action.targetRoute === actionDestination(selected.actionKey, language).route &&
    actualOrigin.appKey === expectedOrigin.appKey &&
    actualOrigin.route === expectedOrigin.route &&
    actualOrigin.surface === expectedOrigin.surface &&
    actualOrigin.sourceRunId === expectedOrigin.sourceRunId &&
    actualOrigin.sourceRequestId === expectedOrigin.sourceRequestId &&
    actualOrigin.sourceCorrelationId === expectedOrigin.sourceCorrelationId &&
    actualOrigin.conversationId === expectedOrigin.conversationId
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
