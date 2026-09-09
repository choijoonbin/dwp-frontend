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
      direction={{ xs: 'column', lg: 'row' }}
      alignItems={{ xs: 'stretch', lg: 'flex-end' }}
      justifyContent="space-between"
      gap={{ xs: 1.5, sm: 2 }}
    >
      <Box sx={{ minWidth: 0, flex: 1 }}>
        {eyebrow && (
          <Typography
            variant="overline"
            color="primary.main"
            sx={{
              display: 'block',
              fontSize: 'overline.fontSize',
              lineHeight: 'button.lineHeight',
              fontWeight: 'fontWeightBold',
              letterSpacing: 'h3.letterSpacing',
            }}
          >
            {eyebrow}
          </Typography>
        )}
        <Typography
          component="h1"
          sx={{
            mt: eyebrow ? 0.5 : 0,
            fontSize: { xs: 'h3.fontSize', md: 'h2.fontSize' },
            lineHeight: 'button.lineHeight',
            fontWeight: 'fontWeightBold',
            letterSpacing: 'h3.letterSpacing',
            overflowWrap: 'anywhere',
          }}
        >
          {title}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.75, maxWidth: 880, lineHeight: 'h5.lineHeight', overflowWrap: 'anywhere' }}
        >
          {description}
        </Typography>
      </Box>
      {actions && (
        <Box
          sx={{
            flexShrink: 0,
            maxWidth: { lg: '62%' },
            '& > .MuiStack-root': { flexWrap: 'wrap', justifyContent: { sm: 'flex-end' } },
            '& button': { minHeight: 40 },
          }}
        >
          {actions}
        </Box>
      )}
    </Stack>
  );
}
