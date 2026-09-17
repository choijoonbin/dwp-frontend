import type { HomeWidgetHeight } from '@dwp-frontend/shared-utils';

export type HomePurposeContentDensity = 'short' | 'standard' | 'tall';

export type HomePurposeContentPolicy = Readonly<{
  density: HomePurposeContentDensity;
  showSectionDescription: boolean;
  showItemDescription: boolean;
  showOwner: boolean;
  showScope: boolean;
}>;

export function homePurposeContentPolicy(
  footprintHeight?: HomeWidgetHeight,
  supportStack = false
): HomePurposeContentPolicy {
  const density: HomePurposeContentDensity =
    footprintHeight === 'short'
      ? 'short'
      : footprintHeight === 'tall' || footprintHeight === 'expanded'
        ? 'tall'
        : 'standard';
  return {
    density,
    showSectionDescription: density !== 'short' && !supportStack,
    showItemDescription: density === 'tall' && !supportStack,
    showOwner: density !== 'short',
    showScope: density === 'tall' && !supportStack,
  };
}

export function homeContributionDomAttributes(): Readonly<Record<string, string>> {
  // DOM markers identify layout only; business identifiers stay out of metadata.
  return { 'data-home-contribution': 'present' };
}

export function homePurposeVisibleLimit(
  maxItems: number,
  _footprintHeight?: HomeWidgetHeight,
  _supportStack = false
): number {
  const requestedLimit = Number.isFinite(maxItems) ? Math.floor(maxItems) : 1;
  return Math.min(4, Math.max(1, requestedLimit));
}
