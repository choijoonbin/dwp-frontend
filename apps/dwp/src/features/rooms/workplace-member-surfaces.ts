import { foundationTokens } from '@dwp-frontend/design-system';
import { alpha } from '@mui/material/styles';

import type { Theme } from '@mui/material/styles';

export const workplaceMemberCard = (theme: Theme) => ({
  minWidth: 0,
  border: '1px solid',
  borderColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.3 : 0.12),
  borderRadius: foundationTokens.radius.surface + 'px',
  bgcolor: 'background.paper',
  overflow: 'hidden',
});

export const workplaceMemberSoftSurface = (theme: Theme) => ({
  bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.16 : 0.055),
  borderRadius: foundationTokens.radius.surface + 'px',
});
