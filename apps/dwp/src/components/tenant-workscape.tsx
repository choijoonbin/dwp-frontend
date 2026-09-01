import type { ReactNode } from 'react';

import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';

import { HOME_FORCED_COLOR_TOKENS, HOME_WORKSCAPE_TOKENS } from './home-surface-tokens';

import type {
  HomeBackgroundPosition,
  HomeContentAlignment,
  HomePresentation,
} from '@dwp-frontend/shared-utils';

export type TenantWorkscapeProps = {
  children: ReactNode;
  backgroundUrl?: string;
  backgroundPosition: HomeBackgroundPosition;
  /** Independent image focal point. Percentages are clamped to the rendered scene. */
  focalX?: number;
  focalY?: number;
  /** Optional compact/mobile override. The desktop focal point remains the fallback. */
  mobileFocalX?: number;
  mobileFocalY?: number;
  /** Content placement is deliberately independent from the image crop. */
  contentAlignment?: HomeContentAlignment;
  overlayOpacity: number;
  presentation?: HomePresentation;
  compact?: boolean;
  previewViewport?: 'wide' | 'desktop' | 'tablet' | 'mobile';
  darkPreview?: boolean;
  ariaLabel?: string;
};

function clampOverlay(value: number): number {
  return Math.min(0.78, Math.max(0, value / 100));
}

function clampFocalPoint(value: number | undefined, fallback: number): number {
  return Math.min(100, Math.max(0, Number.isFinite(value) ? Number(value) : fallback));
}

export function defaultHomeContentAlignment(
  backgroundPosition: HomeBackgroundPosition
): HomeContentAlignment {
  if (backgroundPosition === 'LEFT') return 'RIGHT';
  if (backgroundPosition === 'CENTER') return 'CENTER';
  return 'LEFT';
}

export type HomeWorkscapeContract = Readonly<{
  focalX: number;
  focalY: number;
  mobileFocalX: number;
  mobileFocalY: number;
  contentAlignment: HomeContentAlignment;
}>;

export function resolveHomeWorkscapeContract({
  backgroundPosition,
  focalX,
  focalY,
  mobileFocalX,
  mobileFocalY,
  contentAlignment,
}: Readonly<{
  backgroundPosition: HomeBackgroundPosition;
  focalX?: number;
  focalY?: number;
  mobileFocalX?: number;
  mobileFocalY?: number;
  contentAlignment?: HomeContentAlignment;
}>): HomeWorkscapeContract {
  const legacyFocalX =
    backgroundPosition === 'LEFT' ? 0 : backgroundPosition === 'CENTER' ? 50 : 100;
  const resolvedFocalX = clampFocalPoint(focalX, legacyFocalX);
  const resolvedFocalY = clampFocalPoint(focalY, 50);
  return {
    focalX: resolvedFocalX,
    focalY: resolvedFocalY,
    mobileFocalX: clampFocalPoint(mobileFocalX, resolvedFocalX),
    mobileFocalY: clampFocalPoint(mobileFocalY, resolvedFocalY),
    contentAlignment: contentAlignment ?? defaultHomeContentAlignment(backgroundPosition),
  };
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
  focalX,
  focalY,
  mobileFocalX,
  mobileFocalY,
  contentAlignment,
  overlayOpacity,
  presentation = 'balanced',
  compact = false,
  previewViewport,
  darkPreview = false,
  ariaLabel,
}: TenantWorkscapeProps) {
  const sceneUrl = backgroundUrl?.replaceAll('"', '%22');
  const workscapeContract = resolveHomeWorkscapeContract({
    backgroundPosition,
    focalX,
    focalY,
    mobileFocalX,
    mobileFocalY,
    contentAlignment,
  });
  const sceneFocalX = workscapeContract.focalX;
  const sceneFocalY = workscapeContract.focalY;
  const compactFocalX = workscapeContract.mobileFocalX;
  const compactFocalY = workscapeContract.mobileFocalY;
  const resolvedContentAlignment = workscapeContract.contentAlignment;
  const configuredOverlay = clampOverlay(overlayOpacity);
  const preview = Boolean(previewViewport);
  const mobilePreview = previewViewport === 'mobile';
  const tabletPreview = previewViewport === 'tablet';
  const shortPreview = previewViewport === 'wide' || previewViewport === 'desktop';
  const activeFocalX = mobilePreview ? compactFocalX : sceneFocalX;
  const activeFocalY = mobilePreview ? compactFocalY : sceneFocalY;

  return (
    <Box
      component={preview ? 'div' : 'section'}
      aria-label={ariaLabel}
      data-flow-workscape={preview ? undefined : 'true'}
      data-tenant-workscape-preview={preview ? previewViewport : undefined}
      data-tenant-workscape-presentation={presentation}
      data-tenant-background-position={backgroundPosition.toLowerCase()}
      data-tenant-background-focal-x={activeFocalX}
      data-tenant-background-focal-y={activeFocalY}
      data-tenant-content-alignment={resolvedContentAlignment.toLowerCase()}
      data-tenant-image-opacity={sceneUrl ? '1' : '0'}
      sx={(theme) => {
        const dark = darkPreview || theme.palette.mode === 'dark';
        const workscape = HOME_WORKSCAPE_TOKENS[dark ? 'dark' : 'light'];
        const opacity = (minimum: number) => Math.min(0.78, Math.max(minimum, configuredOverlay));
        const contentScrim =
          resolvedContentAlignment === 'CENTER'
            ? `linear-gradient(180deg, ${alpha(
                workscape.base,
                opacity(dark ? 0.64 : 0.58)
              )} 0%, ${alpha(workscape.base, opacity(dark ? 0.32 : 0.26))} 48%, ${alpha(
                workscape.base,
                opacity(dark ? 0.5 : 0.44)
              )} 100%)`
            : `linear-gradient(${resolvedContentAlignment === 'RIGHT' ? '270deg' : '90deg'}, ${alpha(
                workscape.base,
                opacity(dark ? 0.78 : 0.78)
              )} 0%, ${alpha(workscape.base, opacity(dark ? 0.6 : 0.54))} 42%, ${alpha(
                workscape.base,
                opacity(dark ? 0.24 : 0.2)
              )} 72%, ${alpha(workscape.base, opacity(dark ? 0.16 : 0.1))} 100%)`;
        const brandCalmScrim = `linear-gradient(180deg, ${alpha(
          workscape.base,
          dark ? 0.24 : 0.18
        )} 0%, ${alpha(workscape.base, 0)} 42%)`;
        const scrim = `${brandCalmScrim}, ${contentScrim}`;
        return {
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
                width: '100%',
                height: '100%',
                minHeight: 0,
                maxWidth: 'none',
                aspectRatio: 'auto',
                boxSizing: 'border-box',
                borderRadius: 2.5,
                px: mobilePreview ? 1.5 : tabletPreview ? 2 : shortPreview ? 3 : 2.5,
                py: mobilePreview ? 1.5 : tabletPreview ? 1.75 : shortPreview ? 2 : 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
              }
            : {
                width: 1,
                px: compact ? 0.75 : { xs: 0.75, sm: 2, md: 2.5, lg: 3, xl: 3.5 },
                pt: compact ? 0.75 : { xs: 1, md: 1.5, xl: 1 },
                pb: compact ? 0.75 : { xs: 1, md: 1.5, xl: 1 },
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                borderRadius: compact ? 3.5 : 'calc(var(--flow-surface-radius) + 4px)',
              }),
          '&::before': sceneUrl
            ? {
                content: '""',
                position: 'absolute',
                zIndex: -2,
                inset: 0,
                backgroundImage: `url("${sceneUrl}")`,
                backgroundPosition: `${activeFocalX}% ${activeFocalY}%`,
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
            background: mobilePreview
              ? alpha(workscape.base, Math.min(0.78, Math.max(0.62, configuredOverlay)))
              : scrim,
            pointerEvents: 'none',
          },
          ...(!preview
            ? {
                '@media (max-width: 599.95px)': {
                  '&::before': sceneUrl
                    ? { backgroundPosition: `${compactFocalX}% ${compactFocalY}%` }
                    : undefined,
                  '&::after': {
                    background: alpha(
                      workscape.base,
                      Math.min(0.78, Math.max(0.62, configuredOverlay))
                    ),
                  },
                },
              }
            : {}),
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
              bgcolor: dark ? '#071426' : '#10284D',
              backdropFilter: HOME_FORCED_COLOR_TOKENS.backdropFilter,
              WebkitBackdropFilter: HOME_FORCED_COLOR_TOKENS.backdropFilter,
            },
          },
          '@media (prefers-reduced-motion: reduce)': {
            '&, & *, & *::before, & *::after': {
              scrollBehavior: 'auto !important',
              transitionDuration: '0.01ms !important',
              animationDuration: '0.01ms !important',
              animationIterationCount: '1 !important',
            },
          },
        };
      }}
    >
      {children}
    </Box>
  );
}
