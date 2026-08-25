import type { HomeWidgetSize } from '@dwp-frontend/shared-utils';

export type FlowTrailingGovernedPlacement = Readonly<{
  preferredSize: HomeWidgetSize;
  renderSize: HomeWidgetSize;
  orphanProtected: boolean;
}>;

/**
 * Flow Home renders its governed news zone after the personal canvas and has
 * no paired command rail. A partial-width trailing item would therefore
 * create a permanent orphan gap. Preserve the tenant preference as metadata,
 * but normalize the unpaired presentation footprint to a full row.
 */
export function resolveFlowTrailingGovernedPlacement(
  preferredSize: HomeWidgetSize
): FlowTrailingGovernedPlacement {
  return {
    preferredSize,
    renderSize: 'full',
    orphanProtected: preferredSize !== 'full',
  };
}
