import type { ReactNode } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';

// ----------------------------------------------------------------------

export type SelectableCardProps = {
  selected: boolean;
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  onClick?: () => void;
};

export function SelectableCard({ selected, title, subtitle, meta, onClick }: SelectableCardProps) {
  return (
    <Card
      onClick={onClick}
      sx={{
        p: 2,
        cursor: onClick ? 'pointer' : 'default',
        bgcolor: selected ? 'action.selected' : 'background.paper',
        borderColor: 'divider',
        transition: (theme) =>
          theme.transitions.create(['background-color', 'border-color'], {
            duration: theme.transitions.duration.shorter,
          }),
        '&:hover': onClick && {
          bgcolor: selected ? 'action.selected' : 'action.hover',
        },
      }}
    >
      <Typography variant="subtitle2" sx={{ color: selected ? 'primary.main' : 'text.primary' }}>
        {title}
      </Typography>

      {subtitle && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          {subtitle}
        </Typography>
      )}

      {meta && <Box sx={{ mt: 1 }}>{meta}</Box>}
    </Card>
  );
}
