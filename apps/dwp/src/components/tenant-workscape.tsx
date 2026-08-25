import type { ReactNode } from 'react';

import Box from '@mui/material/Box';

import { HOME_FORCED_COLOR_TOKENS, HOME_WORKSCAPE_TOKENS } from './home-surface-tokens';

import type { HomeBackgroundPosition, HomePresentation } from '@dwp-frontend/shared-utils';

type TenantWorkscapeProps = {
  children: ReactNode;
  backgroundUrl?: string;
  backgroundPosition: HomeBackgroundPosition;
  overlayOpacity: number;
  presentation?: HomePresentation;
  compact?: boolean;
  previewViewport?: 'desktop' | 'mobile';
  darkPreview?: boolean;
  ariaLabel?: string;
};

function clampOverlay(value: number): number {
  return Math.min(0.72, Math.max(0, value / 100));
}

/**
 * The shared tenant-image contract used by the Flow Home and the administrator preview.
 * The photograph is always rendered at full opacity. Readability comes from a separate,
 * directional scrim so tenant colour and subject matter are not turned into a watermark.
 */
export function TenantWorkscape({
  children,
  backgroundUrl,
  backgroundPosition,
  overlayOpacity,
  presentation = 'balanced',
  compact = false,
  previewViewport,
  darkPreview = false,
  ariaLabel,
}: TenantWorkscapeProps) {
  const sceneUrl = backgroundUrl?.replaceAll('"', '%22');
  const scenePosition =
    backgroundPosition === 'LEFT'
      ? 'left center'
      : backgroundPosition === 'CENTER'
        ? 'center'
        : 'right center';
  const configuredOverlay = clampOverlay(overlayOpacity);
  const safeEdgeOpacity = Math.max(HOME_WORKSCAPE_TOKENS.scrim.safe, configuredOverlay);
  const middleOpacity = Math.max(HOME_WORKSCAPE_TOKENS.scrim.middle, configuredOverlay);
  const farEdgeOpacity = Math.max(HOME_WORKSCAPE_TOKENS.scrim.far, configuredOverlay);
  const scrimDirection = backgroundPosition === 'LEFT' ? '270deg' : '90deg';
  const preview = Boolean(previewViewport);
  const mobilePreview = previewViewport === 'mobile';
  // The brand scene is a launch context, not a second dashboard viewport.
  // Together with the one-row Dock this targets a 208–224px desktop Workscape.
  const contextHeight = presentation === 'focused' ? 78 : 84;

  return (
    <Box
      component={preview ? 'div' : 'section'}
      aria-label={ariaLabel}
      data-flow-workscape={preview ? undefined : 'true'}
      data-tenant-workscape-preview={preview ? previewViewport : undefined}
      data-tenant-background-position={backgroundPosition.toLowerCase()}
      data-tenant-image-opacity={sceneUrl ? '1' : '0'}
      sx={(theme) => {
        const workscape =
          HOME_WORKSCAPE_TOKENS[darkPreview || theme.palette.mode === 'dark' ? 'dark' : 'light'];
        return {
          '--flow-workscape-context-min-height': `${contextHeight}px`,
          position: 'relative',
          isolation: 'isolate',
          minWidth: 0,
          overflow: 'hidden',
          color: workscape.on,
          bgcolor: workscape.base,
          border: 1,
          borderColor: workscape.border,
          boxShadow: workscape.shadow,
          ...(preview
            ? {
                width: mobilePreview ? 320 : 'calc(100% - 32px)',
                maxWidth: mobilePreview ? 320 : 1120,
                aspectRatio: mobilePreview ? '9 / 16' : '16 / 6',
                minHeight: mobilePreview ? 568 : 340,
                borderRadius: 2.5,
              }
            : {
                width: 1,
                px: compact ? 0.75 : { xs: 0.75, sm: 1, md: 1 },
                pt: compact ? 0.75 : { xs: 0.75, sm: 1, md: 1 },
                pb: compact ? 0.75 : { xs: 0.75, sm: 1, md: 1 },
                display: 'flex',
                flexDirection: 'column',
                gap: 0.75,
                borderRadius: compact ? 3.5 : 'calc(var(--flow-surface-radius) + 4px)',
              }),
          '&::before': sceneUrl
            ? {
                content: '""',
                position: 'absolute',
                zIndex: -2,
                inset: 0,
                backgroundImage: `url("${sceneUrl}")`,
                backgroundPosition: scenePosition,
                backgroundRepeat: 'no-repeat',
                backgroundSize: 'cover',
                opacity: 1,
                pointerEvents: 'none',
              }
            : undefined,
          '&::after': {
            content: '""',
            position: 'absolute',
            zIndex: -1,
            inset: 0,
            background: `linear-gradient(${scrimDirection}, rgba(${HOME_WORKSCAPE_TOKENS.scrim.rgb}, ${safeEdgeOpacity}) 0%, rgba(${HOME_WORKSCAPE_TOKENS.scrim.rgb}, ${middleOpacity}) 48%, rgba(${HOME_WORKSCAPE_TOKENS.scrim.rgb}, ${farEdgeOpacity}) 100%)`,
            pointerEvents: 'none',
          },
          '& > *': { position: 'relative', zIndex: 1 },
          '@media (max-width: 599.95px)': {
            '--flow-workscape-context-min-height': '88px',
            '&::after': {
              background: `rgba(${HOME_WORKSCAPE_TOKENS.scrim.rgb}, ${Math.max(HOME_WORKSCAPE_TOKENS.scrim.mobile, configuredOverlay)})`,
            },
          },
          '@media (forced-colors: active)': {
            color: HOME_FORCED_COLOR_TOKENS.text,
            bgcolor: HOME_FORCED_COLOR_TOKENS.canvas,
            borderColor: HOME_FORCED_COLOR_TOKENS.border,
            boxShadow: HOME_FORCED_COLOR_TOKENS.shadow,
            '&::before, &::after': {
              display: 'none',
              backgroundImage: HOME_FORCED_COLOR_TOKENS.image,
            },
          },
          '@media (prefers-reduced-transparency: reduce)': {
            '& [data-flow-dock-shell]': {
              bgcolor: theme.palette.background.paper,
              backdropFilter: HOME_FORCED_COLOR_TOKENS.backdropFilter,
              WebkitBackdropFilter: HOME_FORCED_COLOR_TOKENS.backdropFilter,
            },
          },
        };
      }}
    >
      {children}
    </Box>
  );
}
