import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ReactNode } from 'react';

export function DwaionAdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <Stack
      component="header"
      direction={{ xs: 'column', sm: 'row' }}
      alignItems={{ xs: 'stretch', sm: 'flex-start' }}
      justifyContent="space-between"
      gap={2}
    >
      <Box>
        {eyebrow && (
          <Typography variant="overline" color="primary.main">
            {eyebrow}
          </Typography>
        )}
        <Typography component="h1" variant="h4" sx={{ mt: eyebrow ? 0.25 : 0 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.6, maxWidth: 820 }}>
          {description}
        </Typography>
      </Box>
      {actions}
    </Stack>
  );
}
