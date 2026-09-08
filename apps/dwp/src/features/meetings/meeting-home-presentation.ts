import { alpha, type Theme } from '@mui/material/styles';
import { meetingShape, meetingSoftShadow } from './meeting-visual-system';

/** U01 uses a white command surface and lightly tinted nested work, not a tinted hero. */
export function meetingHomeCard(theme: Theme) {
  return {
    border: `1px solid ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.28 : 0.13)}`,
    borderRadius: meetingShape.stage,
    backgroundColor: theme.palette.background.paper,
    boxShadow: meetingSoftShadow(theme),
    '@media (forced-colors: active)': { borderColor: 'CanvasText', boxShadow: 'none' },
  };
}

export function meetingHomeInset(theme: Theme) {
  return {
    border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
    borderRadius: meetingShape.card,
    backgroundColor: alpha(
      theme.palette.primary.main,
      theme.palette.mode === 'dark' ? 0.08 : 0.025
    ),
    '@media (forced-colors: active)': { borderColor: 'CanvasText', backgroundColor: 'Canvas' },
  };
}
