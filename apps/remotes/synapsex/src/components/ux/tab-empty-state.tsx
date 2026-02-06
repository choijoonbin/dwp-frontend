/**
 * Tab Empty State — 탭 내부용 compact empty
 * @see docs/job/PROMPT_B_Frontend_Cases_TabsBind_P1_v2.txt
 */

import { Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

type TabEmptyStateProps = {
  icon?: string;
  title?: string;
  description?: string;
};

export const TabEmptyState = ({
  icon = 'solar:database-outline',
  title,
  description,
}: TabEmptyStateProps) => (
  <Box
    sx={{
      py: 6,
      px: 2,
      textAlign: 'center',
      borderRadius: 1,
      border: 1,
      borderColor: 'divider',
      bgcolor: 'action.hover',
    }}
  >
    <Iconify icon={icon} width={40} sx={{ color: 'text.disabled', mb: 1 }} />
    {title && (
      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
        {title}
      </Typography>
    )}
    {description && (
      <Typography variant="caption" color="text.disabled">
        {description}
      </Typography>
    )}
  </Box>
);
