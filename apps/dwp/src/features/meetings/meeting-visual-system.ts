import { alpha, type Theme } from '@mui/material/styles';

export type MeetingSurfaceTone = 'neutral' | 'primary' | 'success' | 'warning' | 'error' | 'violet';

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
    case 'violet':
      return '#7c3aed';
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
  const { tone = 'neutral', interactive = false, elevated = true } = options;
  const color = toneColor(theme, tone);
  const dark = theme.palette.mode === 'dark';
  const borderColor =
    tone === 'neutral'
      ? alpha(theme.palette.text.primary, dark ? 0.15 : 0.09)
      : alpha(color, dark ? 0.32 : 0.18);

  return {
    border: `1px solid ${borderColor}`,
    borderRadius: 3,
    backgroundColor: theme.palette.background.paper,
    backgroundImage: `linear-gradient(145deg, ${alpha(color, dark ? 0.07 : 0.035)}, transparent 58%)`,
    boxShadow: elevated
      ? dark
        ? '0 18px 46px rgba(0, 0, 0, 0.22)'
        : '0 18px 46px rgba(25, 39, 67, 0.08)'
      : 'none',
    transition: interactive
      ? 'transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease'
      : undefined,
    ...(interactive
      ? {
          '&:hover': {
            transform: 'translateY(-2px)',
            borderColor: alpha(color, dark ? 0.5 : 0.28),
            boxShadow: dark
              ? '0 22px 52px rgba(0, 0, 0, 0.28)'
              : '0 22px 52px rgba(25, 39, 67, 0.12)',
          },
        }
      : {}),
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
      transform: 'none',
    },
    '@media (forced-colors: active)': {
      border: '1px solid CanvasText',
      background: 'Canvas',
      boxShadow: 'none',
    },
  } as const;
}

export function meetingCommandSurface(theme: Theme, live = false) {
  const start = live ? '#0f766e' : '#173d91';
  const end = live ? '#0b5d57' : '#315fc8';
  return {
    position: 'relative',
    isolation: 'isolate',
    overflow: 'hidden',
    border: `1px solid ${alpha(theme.palette.common.white, 0.16)}`,
    borderRadius: 4,
    color: '#f8fbff',
    background: `linear-gradient(135deg, ${start} 0%, ${end} 66%, ${theme.palette.primary.dark} 100%)`,
    boxShadow:
      theme.palette.mode === 'dark'
        ? '0 24px 68px rgba(0, 0, 0, 0.38)'
        : '0 24px 68px rgba(29, 61, 124, 0.2)',
    '&::before': {
      content: '""',
      position: 'absolute',
      zIndex: -1,
      width: 280,
      height: 280,
      top: -150,
      right: -70,
      border: '1px solid rgba(255,255,255,.18)',
      borderRadius: '50%',
      boxShadow: '0 0 0 44px rgba(255,255,255,.045), 0 0 0 92px rgba(255,255,255,.025)',
    },
    '&::after': {
      content: '""',
      position: 'absolute',
      zIndex: -1,
      inset: 0,
      background: 'radial-gradient(circle at 78% 82%, rgba(133,180,255,.28), transparent 28%)',
      pointerEvents: 'none',
    },
    '@media (forced-colors: active)': {
      border: '2px solid CanvasText',
      color: 'CanvasText',
      background: 'Canvas',
      boxShadow: 'none',
      '&::before, &::after': { display: 'none' },
    },
  } as const;
}

export function meetingInsetSurface(theme: Theme, tone: MeetingSurfaceTone = 'neutral') {
  const color = toneColor(theme, tone);
  return {
    border: `1px solid ${alpha(color, theme.palette.mode === 'dark' ? 0.22 : 0.1)}`,
    borderRadius: 2.25,
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
