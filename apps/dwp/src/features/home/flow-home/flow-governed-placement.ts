import type { HomeWidgetSize } from '@dwp-frontend/shared-utils';

export type FlowGovernedPlacement = Readonly<{
  preferredSize: HomeWidgetSize;
  renderSize: HomeWidgetSize;
  orphanProtected: boolean;
}>;

/**
 * Flow Home renders its governed news zone as an editorial row between the
 * required notice and the personal work canvas. The row has no paired widget,
 * so a partial-width footprint would create an accidental empty region.
 * Preserve the tenant preference as metadata, but normalize the unpaired
 * presentation footprint to a full row.
 */
export function resolveFlowGovernedPlacement(preferredSize: HomeWidgetSize): FlowGovernedPlacement {
  return {
    preferredSize,
    renderSize: 'full',
    orphanProtected: preferredSize !== 'full',
  };
}
