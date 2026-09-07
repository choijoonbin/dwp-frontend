import { alpha, type Theme } from '@mui/material/styles';

export type MeetingSurfaceTone = 'neutral' | 'primary' | 'success' | 'warning' | 'error';

function toneColor(theme: Theme, tone: MeetingSurfaceTone): string {
  switch (tone) {
    case 'primary':
      return theme.palette.primary.main;
    case 'success':
      return theme.palette.success.main;
    case 'warning':
      return theme.palette.warning.main;
    case 'error':
      return theme.palette.error.main;
    default:
      return theme.palette.text.primary;
  }
}

export function meetingSurface(
  theme: Theme,
  options: {
    tone?: MeetingSurfaceTone;
    interactive?: boolean;
    elevated?: boolean;
  } = {}
) {
  const { tone = 'neutral', interactive = false, elevated = false } = options;
  const color = toneColor(theme, tone);
  const dark = theme.palette.mode === 'dark';
  const prominent = elevated || tone !== 'neutral';
  const borderColor =
    tone === 'neutral'
      ? alpha(theme.palette.text.primary, dark ? 0.15 : 0.09)
      : alpha(color, dark ? 0.32 : 0.18);
  const backgroundColor = prominent
    ? alpha(color, dark ? 0.1 : 0.04)
    : theme.palette.background.paper;

  return {
    border: `1px solid ${borderColor}`,
    borderTopWidth: tone === 'neutral' ? 1 : 2,
    borderTopColor: tone === 'neutral' ? borderColor : alpha(color, dark ? 0.72 : 0.58),
    borderRadius: 'var(--dwp-shape-borderRadius)',
    backgroundColor,
    backgroundImage: 'none',
    boxShadow: prominent ? theme.shadows[2] : 'none',
    transition: interactive
      ? theme.transitions.create(['background-color', 'border-color', 'box-shadow'], {
          duration: theme.transitions.duration.shorter,
        })
      : undefined,
    ...(interactive
      ? {
          '&:hover': {
            borderColor: alpha(color, dark ? 0.5 : 0.28),
            backgroundColor: prominent
              ? alpha(color, dark ? 0.16 : 0.075)
              : theme.palette.action.hover,
          },
        }
      : {}),
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
    '@media (forced-colors: active)': {
      border: '1px solid CanvasText',
      background: 'Canvas',
      boxShadow: 'none',
    },
  } as const;
}

export function meetingInsetSurface(theme: Theme, tone: MeetingSurfaceTone = 'neutral') {
  const color = toneColor(theme, tone);
  return {
    border: `1px solid ${alpha(color, theme.palette.mode === 'dark' ? 0.22 : 0.1)}`,
    borderRadius: 'var(--dwp-shape-borderRadius)',
    backgroundColor: alpha(color, theme.palette.mode === 'dark' ? 0.1 : 0.045),
    '@media (forced-colors: active)': {
      border: '1px solid CanvasText',
      background: 'Canvas',
    },
  } as const;
}

export function meetingListSurface(theme: Theme) {
  return {
    ...meetingSurface(theme),
    overflow: 'hidden',
    '& > *:not(:last-child)': {
      borderBottom: `1px solid ${alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.13 : 0.07)}`,
    },
  } as const;
}
