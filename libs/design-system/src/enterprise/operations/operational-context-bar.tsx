import type { ReactNode } from 'react';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export type OperationalContextItem = {
  label: string;
  value: string;
  icon?: ReactNode;
};

export type OperationalContextBarProps = {
  label: string;
  items: OperationalContextItem[];
  status?: ReactNode;
  actions?: ReactNode;
};

export function OperationalContextBar({
  label,
  items,
  status,
  actions,
}: OperationalContextBarProps) {
  return (
    <Paper
      component="section"
      variant="outlined"
      aria-label={label}
      sx={{
        px: { xs: 1.5, md: 2 },
        py: 1.25,
        bgcolor: 'background.paper',
      }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'stretch', md: 'center' }}
        justifyContent="space-between"
        gap={1.5}
      >
        <Stack
          direction="row"
          alignItems="center"
          flexWrap="wrap"
          divider={<Divider orientation="vertical" flexItem />}
          gap={1.5}
        >
          {items.map((item) => (
            <Stack
              key={`${item.label}:${item.value}`}
              direction="row"
              alignItems="center"
              gap={0.75}
            >
              {item.icon && (
                <Box aria-hidden="true" sx={{ display: 'grid', color: 'text.secondary' }}>
                  {item.icon}
                </Box>
              )}
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {item.label}
                </Typography>
                <Typography variant="body2" fontWeight={700} sx={{ whiteSpace: 'nowrap' }}>
                  {item.value}
                </Typography>
              </Box>
            </Stack>
          ))}
        </Stack>
        {(status || actions) && (
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1.5}>
            {status}
            {actions}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
