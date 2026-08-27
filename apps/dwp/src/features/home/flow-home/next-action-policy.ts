import type { HomeOverview, HomeRecommendation } from '@dwp-frontend/shared-utils';

/**
 * Flow Home annotates the ranked action queue only with an action recommendation.
 * Schedule and communication recommendations already have dedicated purpose
 * surfaces and must not be repeated beside required notices or the timeline.
 */
export function selectFlowActionRecommendation(
  overview?: HomeOverview
): HomeRecommendation | undefined {
  const section = overview?.recommendations;
  if (section?.status !== 'AVAILABLE') return undefined;
  return section.data?.find((recommendation) => recommendation.kind === 'ACTION');
}
