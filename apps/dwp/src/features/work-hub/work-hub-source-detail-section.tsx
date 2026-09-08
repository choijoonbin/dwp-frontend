import { useId, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export function WorkSourceDetailSection({
  title,
  description,
  icon: Icon,
  children,
  tone = 'neutral',
}: {
  title: string;
  description?: string;
  icon: LucideIcon;
  children: ReactNode;
  tone?: 'neutral' | 'warning' | 'primary';
}) {
  const headingId = useId();
  return (
    <Box
      component="section"
      aria-labelledby={headingId}
      sx={{
        minWidth: 0,
        border: 1,
        borderColor: tone === 'warning' ? 'warning.light' : 'divider',
        borderRadius: (theme) => `${theme.shape.borderRadius}px`,
        overflow: 'hidden',
      }}
    >
      <Stack
        direction="row"
        gap={1}
        alignItems="flex-start"
        sx={{
          px: { xs: 1.5, sm: 2 },
          py: 1.25,
          bgcolor: tone === 'neutral' ? 'action.hover' : `${tone}.lighter`,
          color: tone === 'neutral' ? 'text.primary' : `${tone}.dark`,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Icon size={18} aria-hidden="true" />
        <Box sx={{ minWidth: 0 }}>
          <Typography id={headingId} component="h3" variant="subtitle2">
            {title}
          </Typography>
          {description && (
            <Typography variant="caption" color="text.secondary">
              {description}
            </Typography>
          )}
        </Box>
      </Stack>
      <Box sx={{ p: { xs: 1.5, sm: 2 }, minWidth: 0 }}>{children}</Box>
    </Box>
  );
}
