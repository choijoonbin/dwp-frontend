import { alpha } from '@mui/material/styles';

import type { SxProps, Theme } from '@mui/material/styles';

export const notificationPreferenceRadius = (theme: Theme) => `${theme.shape.borderRadius}px`;

export const notificationPreferenceSoftBackground = (theme: Theme) =>
  alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.12 : 0.025);

export const notificationPreferenceSelectedBackground = (theme: Theme) =>
  alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.1);

export const notificationPreferenceControlSx = {
  minWidth: 0,
  width: { xs: '100%', sm: 180 },
  maxWidth: '100%',
} satisfies SxProps<Theme>;

export const notificationPreferenceChipSx = {
  minWidth: 0,
  maxWidth: '100%',
  minHeight: 20,
  height: 'auto',
  borderRadius: notificationPreferenceRadius,
  typography: 'caption',
  '& .MuiChip-label': {
    px: 0.75,
    py: 0.25,
    whiteSpace: 'normal',
    overflowWrap: 'anywhere',
  },
  '& .MuiChip-icon': { ml: 0.5, mr: -0.25, flexShrink: 0 },
} satisfies SxProps<Theme>;
