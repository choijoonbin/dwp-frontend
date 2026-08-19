import type { SxProps, Theme } from '@mui/material/styles';

import {
  WORKSPACE_APP_JIGGLE_DURATION_MS,
  workspaceAppJiggle,
} from '../../components/workspace-composer/workspace-edit-motion';

export const LAUNCHPAD_TILE_WIDTH = 72;
export const LAUNCHPAD_TILE_HEIGHT = 84;

export function launchpadLabelFontSize(label: string) {
  return label.length > 8 ? '0.625rem' : '0.6875rem';
}

export function launchpadInteractionFrameSx(editing: boolean): SxProps<Theme> {
  return {
    position: 'relative',
    isolation: 'isolate',
    width: editing ? 60 : 52,
    height: editing ? 60 : 52,
    boxSizing: 'border-box',
    display: 'grid',
    placeItems: 'center',
    border: editing ? 1 : 0,
    borderColor: 'transparent',
    borderRadius: 1,
    transition: (theme) =>
      theme.transitions.create(['background-color', 'border-color', 'box-shadow'], {
        duration: theme.transitions.duration.shorter,
      }),
    '&::after': editing
      ? undefined
      : {
          content: '""',
          position: 'absolute',
          inset: -4,
          zIndex: 0,
          boxSizing: 'border-box',
          border: '1px solid transparent',
          borderRadius: 1,
          bgcolor: 'transparent',
          pointerEvents: 'none',
          transition: (theme) =>
            theme.transitions.create(['background-color', 'border-color', 'box-shadow'], {
              duration: theme.transitions.duration.shorter,
            }),
        },
    '& > [data-launchpad-glyph]': {
      position: 'relative',
      zIndex: 1,
    },
  };
}

export function launchpadTileSx(editing: boolean, motionDelayMs: number): SxProps<Theme> {
  return {
    width: 1,
    height: LAUNCHPAD_TILE_HEIGHT,
    boxSizing: 'border-box',
    px: editing ? 0 : 0.25,
    py: editing ? 0 : 0.125,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: editing ? 0 : 0.25,
    position: 'relative',
    overflow: 'visible',
    border: editing ? 0 : '1px solid',
    borderColor: 'transparent',
    borderRadius: 1,
    bgcolor: 'transparent',
    textAlign: 'center',
    cursor: editing ? 'grab' : 'pointer',
    touchAction: 'manipulation',
    transition: (theme) =>
      theme.transitions.create(['background-color', 'border-color', 'box-shadow', 'transform'], {
        duration: theme.transitions.duration.shorter,
      }),
    '& [data-launchpad-glyph]': {
      transition: (theme) =>
        theme.transitions.create('transform', { duration: theme.transitions.duration.shorter }),
      transformOrigin: 'center',
      animation: editing
        ? `${workspaceAppJiggle} ${WORKSPACE_APP_JIGGLE_DURATION_MS}ms ease-in-out infinite`
        : 'none',
      animationDelay: editing ? `${motionDelayMs}ms` : '0ms',
      willChange: editing ? 'transform' : 'auto',
    },
    '& [data-launchpad-edit-frame]': {
      transition: (theme) =>
        theme.transitions.create(['background-color', 'border-color', 'box-shadow'], {
          duration: theme.transitions.duration.shorter,
        }),
    },
    '&:hover': {
      bgcolor: 'transparent',
      borderColor: 'transparent',
      boxShadow: 'none',
      transform: 'none',
    },
    '&:hover [data-launchpad-edit-frame]': editing
      ? {
          bgcolor: 'rgba(255,255,255,0.08)',
          borderColor: 'rgba(255,255,255,0.88)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), 0 8px 18px rgba(0,7,24,0.20)',
        }
      : undefined,
    '&:hover [data-launchpad-edit-frame]::after': editing
      ? undefined
      : {
          bgcolor: 'rgba(255,255,255,0.08)',
          borderColor: 'rgba(255,255,255,0.88)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), 0 8px 18px rgba(0,7,24,0.20)',
        },
    '&:focus-visible': {
      outline: 'none',
      borderColor: 'transparent',
      boxShadow: 'none',
    },
    '&:focus-visible [data-launchpad-edit-frame], &:active [data-launchpad-edit-frame]': editing
      ? {
          bgcolor: 'rgba(255,255,255,0.10)',
          borderColor: '#FFFFFF',
          boxShadow: '0 0 0 2px rgba(141,184,255,0.30), 0 8px 18px rgba(0,7,24,0.22)',
        }
      : undefined,
    '&:focus-visible [data-launchpad-edit-frame]::after': editing
      ? undefined
      : {
          bgcolor: 'rgba(255,255,255,0.10)',
          borderColor: '#8DB8FF',
          boxShadow: '0 0 0 2px rgba(141,184,255,0.30), 0 8px 18px rgba(0,7,24,0.22)',
        },
    '&:active [data-launchpad-edit-frame]::after': editing
      ? undefined
      : {
          bgcolor: 'rgba(255,255,255,0.12)',
          borderColor: '#FFFFFF',
        },
    'html[data-motion="reduced"] &': {
      transition: 'none',
      transform: 'none',
      '& [data-launchpad-glyph]': {
        animation: 'none',
        transition: 'none',
        transform: 'none',
        willChange: 'auto',
      },
      '& [data-launchpad-edit-frame], & [data-launchpad-edit-frame]::after': {
        transition: 'none',
      },
    },
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
      transform: 'none',
      '& [data-launchpad-glyph]': {
        animation: 'none',
        transition: 'none',
        transform: 'none',
        willChange: 'auto',
      },
      '& [data-launchpad-edit-frame], & [data-launchpad-edit-frame]::after': {
        transition: 'none',
      },
    },
  };
}
