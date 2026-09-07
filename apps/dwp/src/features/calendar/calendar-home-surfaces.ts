import { foundationTokens } from '@dwp-frontend/design-system';
import { alpha } from '@mui/material/styles';

import type { Theme } from '@mui/material/styles';

export const CALENDAR_HOME_RADIUS = `${foundationTokens.radius.surface * 2}px`;
export const CALENDAR_HOME_ROW_RADIUS = `${foundationTokens.radius.surface}px`;

export const calendarHomeSurface = (theme: Theme) => ({
  minWidth: 0,
  border: '1px solid',
  borderColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.1),
  borderRadius: CALENDAR_HOME_RADIUS,
  bgcolor: 'background.paper',
  overflow: 'hidden',
  '@media (forced-colors: active)': { borderColor: 'CanvasText' },
});
