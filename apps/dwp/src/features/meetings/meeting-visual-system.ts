import { alpha, type Theme } from '@mui/material/styles';

export type MeetingSurfaceTone = 'neutral' | 'primary' | 'success' | 'warning' | 'error';

// Product-level shape roles taken from the approved Stitch component hierarchy.
// Keep this separate from the platform's compact input radius.
export const meetingShape = {
  inset: '8px',
  control: '10px',
  card: '12px',
  group: '14px',
  stage: '16px',
  spotlight: '20px',
} as const;

export function meetingSoftShadow(theme: Theme) {
  return `0 4px 20px ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.12 : 0.055)}`;
}

export const meetingType = {
  micro: { fontSize: 'caption.fontSize', lineHeight: 'caption.lineHeight' },
  body: { fontSize: 'body2.fontSize', lineHeight: 'body2.lineHeight' },
  title: { fontSize: 'h6.fontSize', lineHeight: 'h6.lineHeight', fontWeight: 'fontWeightBold' },
} as const;

export function meetingLiveTheme(theme: Theme) {
  const mix = (color: string, percent: number, base: string) =>
    `color-mix(in srgb, ${color} ${percent}%, ${base})`;
  return {
    '--dwp-meeting-shape-inset': meetingShape.inset,
    '--dwp-meeting-shape-card': meetingShape.card,
    '--dwp-meeting-shape-stage': meetingShape.stage,
    '--dwp-meeting-shape-spotlight': meetingShape.spotlight,
    '--dwp-meeting-type-micro':
      theme.typography.caption.fontSize ?? theme.typography.pxToRem(theme.typography.fontSize),
    '--dwp-meeting-type-body':
      theme.typography.body2.fontSize ?? theme.typography.pxToRem(theme.typography.fontSize),
    '--dwp-meeting-type-title':
      theme.typography.h6.fontSize ?? theme.typography.pxToRem(theme.typography.fontSize),
    '--dwp-meeting-line-body': theme.typography.body2.lineHeight ?? 'normal',
    '--dwp-meeting-stage-frame': mix(theme.palette.primary.dark, 22, theme.palette.grey[900]),
    '--dwp-meeting-stage-canvas': mix(theme.palette.primary.dark, 12, theme.palette.common.black),
    '--dwp-meeting-stage-panel': mix(theme.palette.primary.dark, 18, theme.palette.grey[900]),
    '--dwp-meeting-stage-header': mix(theme.palette.primary.light, 16, theme.palette.grey[900]),
    '--dwp-meeting-stage-border': mix(theme.palette.primary.light, 25, theme.palette.grey[700]),
    '--dwp-meeting-stage-muted': mix(theme.palette.primary.light, 20, theme.palette.common.white),
    '--dwp-meeting-stage-accent': mix(theme.palette.primary.light, 45, theme.palette.common.white),
    '--dwp-meeting-stage-positive': mix(
      theme.palette.success.light,
      55,
      theme.palette.common.white
    ),
    '--dwp-meeting-stage-selection': mix(theme.palette.primary.main, 30, theme.palette.grey[900]),
    '--dwp-meeting-surface-shadow': meetingSoftShadow(theme),
  };
}

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
      ? alpha(theme.palette.primary.main, dark ? 0.22 : 0.12)
      : alpha(color, dark ? 0.32 : 0.18);
  const backgroundColor =
    tone !== 'neutral' ? alpha(color, dark ? 0.1 : 0.045) : theme.palette.background.paper;

  return {
    border: `1px solid ${borderColor}`,
    borderTopWidth: 1,
    borderTopColor: borderColor,
    // Approved Meetings surfaces are rounded cards, not the global compact input shape.
    borderRadius: meetingShape.card,
    backgroundColor,
    backgroundImage: 'none',
    boxShadow: elevated ? meetingSoftShadow(theme) : 'none',
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
  const color = toneColor(theme, tone === 'neutral' ? 'primary' : tone);
  return {
    border: `1px solid ${alpha(color, theme.palette.mode === 'dark' ? 0.22 : 0.1)}`,
    borderRadius: meetingShape.inset,
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
