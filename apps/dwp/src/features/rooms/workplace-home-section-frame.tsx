import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function WorkplaceHomeSectionHeader({
  id,
  icon: Icon,
  title,
  description,
  action,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      justifyContent="space-between"
      gap={1.25}
      sx={{ px: { xs: 2, md: 2.5 }, py: 1.75 }}
    >
      <Stack direction="row" spacing={1.1} alignItems="flex-start" minWidth={0}>
        <Box
          aria-hidden="true"
          sx={(theme) => ({
            width: 34,
            height: 34,
            flex: '0 0 34px',
            display: 'grid',
            placeItems: 'center',
            borderRadius: 1,
            color: 'primary.main',
            bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.09),
          })}
        >
          <Icon size={17} strokeWidth={1.9} />
        </Box>
        <Box minWidth={0}>
          <Typography id={id} component="h2" variant="subtitle1" fontWeight={800}>
            {title}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.2 }}>
            {description}
          </Typography>
        </Box>
      </Stack>
      {action}
    </Stack>
  );
}

export function WorkplaceHomeSectionShell({
  labelledBy,
  children,
}: {
  labelledBy: string;
  children: ReactNode;
}) {
  return (
    <Box
      component="section"
      aria-labelledby={labelledBy}
      sx={{
        minWidth: 0,
        borderTop: 1,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'transparent',
        overflow: 'hidden',
      }}
    >
      {children}
    </Box>
  );
}
