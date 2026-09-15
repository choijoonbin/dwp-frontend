import type { WidgetDefinitionRetirementImpact } from '@dwp-frontend/shared-utils';

export function canRunWidgetRegistryTransition({
  shadow,
  allowedTransitions,
  transition,
  impact,
}: {
  shadow: boolean;
  allowedTransitions: readonly string[];
  transition: string;
  impact?: WidgetDefinitionRetirementImpact;
}): boolean {
  if (shadow || !allowedTransitions.includes(transition) || !impact?.operationAllowed) return false;
  return impact.operation === transition;
}
