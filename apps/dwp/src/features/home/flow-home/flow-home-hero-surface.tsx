import type { ReactNode } from 'react';

import Box from '@mui/material/Box';

import { TenantWorkscape, defaultHomeContentAlignment } from '../../../components/tenant-workscape';

import type {
  HomeBackgroundPosition,
  HomeContentAlignment,
  HomePresentation,
} from '@dwp-frontend/shared-utils';

export type FlowHomeHeroSurfaceProps = Readonly<{
  context: ReactNode;
  dock: ReactNode;
  backgroundUrl?: string;
  backgroundPosition?: HomeBackgroundPosition;
  focalX?: number;
  focalY?: number;
  mobileFocalX?: number;
  mobileFocalY?: number;
  contentAlignment?: HomeContentAlignment;
  overlayOpacity?: number;
  presentation?: HomePresentation;
  compact?: boolean;
  editing?: boolean;
  wide?: boolean;
  ariaLabel?: string;
  previewViewport?: 'desktop' | 'mobile';
  darkPreview?: boolean;
}>;

/**
 * Runtime-owned hero boundary shared with administration previews.
 *
 * Consumers provide semantic context and Dock slots, while this component owns the exact
 * crop, scrim, width and placement contract used on Home. This prevents preview-only CSS
 * from drifting from the published surface.
 */
export function FlowHomeHeroSurface({
  context,
  dock,
  backgroundUrl,
  backgroundPosition = 'RIGHT',
  focalX,
  focalY,
  mobileFocalX,
  mobileFocalY,
  contentAlignment,
  overlayOpacity = 18,
  presentation = 'balanced',
  compact = false,
  editing = false,
  ariaLabel,
  previewViewport,
  darkPreview = false,
}: FlowHomeHeroSurfaceProps) {
  const resolvedContentAlignment =
    contentAlignment ?? defaultHomeContentAlignment(backgroundPosition);
  const alignItems =
    resolvedContentAlignment === 'RIGHT'
      ? { xs: 'stretch', md: 'flex-end' }
      : resolvedContentAlignment === 'CENTER'
        ? { xs: 'stretch', md: 'center' }
        : { xs: 'stretch', md: 'flex-start' };

  return (
    <Box data-flow-launch-deck-frame sx={{ width: 1, minWidth: 0, display: 'grid', gap: 2 }}>
      <TenantWorkscape
        backgroundUrl={backgroundUrl}
        backgroundPosition={backgroundPosition}
        focalX={focalX}
        focalY={focalY}
        mobileFocalX={mobileFocalX}
        mobileFocalY={mobileFocalY}
        contentAlignment={resolvedContentAlignment}
        overlayOpacity={overlayOpacity}
        presentation={presentation}
        compact={compact}
        previewViewport={previewViewport}
        darkPreview={darkPreview}
        ariaLabel={ariaLabel}
      >
        <Box
          data-flow-hero-surface
          data-flow-hero-content-alignment={resolvedContentAlignment.toLowerCase()}
          sx={{
            position: 'relative',
            zIndex: 1,
            width: 1,
            mx: 'auto',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            alignItems: editing ? 'stretch' : alignItems,
          }}
        >
          {context}
        </Box>
      </TenantWorkscape>
      {dock}
    </Box>
  );
}
