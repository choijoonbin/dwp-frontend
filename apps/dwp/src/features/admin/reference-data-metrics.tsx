import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ReactNode } from 'react';

type OperationalMetricProps = {
  icon: ReactNode;
  label: string;
  value: string | number;
  detail: string;
};

export function OperationalMetric({ icon, label, value, detail }: OperationalMetricProps) {
  return (
    <Box
      sx={{
        minWidth: 0,
        px: 2,
        py: 1.75,
        borderTop: { xs: 1, lg: 0 },
        borderLeft: { xs: 0, lg: 1 },
        borderColor: 'divider',
      }}
    >
      <Stack direction="row" alignItems="center" gap={0.75} color="text.secondary">
        {icon}
        <Typography variant="caption" fontWeight={700}>
          {label}
        </Typography>
      </Stack>
      <Typography component="p" variant="h6" fontWeight={700} sx={{ mt: 0.5 }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
        {detail}
      </Typography>
    </Box>
  );
}
