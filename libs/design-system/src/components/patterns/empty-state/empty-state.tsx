import type { ReactNode } from 'react';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { Iconify } from '../../iconify';

// ----------------------------------------------------------------------

export type EmptyStateProps = {
  title?: string;
  description?: string;
  /** Iconify icon name (e.g. 'solar:document-text-outline') or ReactNode. String is rendered via Iconify. */
  icon?: ReactNode | string;
  action?: ReactNode;
  minHeight?: number | string;
};

export function EmptyState({
  title = '데이터가 없습니다',
  description,
  icon,
  action,
  minHeight = 240,
}: EmptyStateProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight,
        p: 3,
        textAlign: 'center',
      }}
    >
      {icon && (
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            bgcolor: 'action.hover',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 2,
          }}
        >
          <Box sx={{ color: 'text.disabled', fontSize: 28 }}>
            {typeof icon === 'string' ? <Iconify icon={icon} width={32} /> : icon}
          </Box>
        </Box>
      )}

      <Typography variant="h6" sx={{ mb: 1 }}>
        {title}
      </Typography>

      {description && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
          {description}
        </Typography>
      )}

      {action && <Box>{action}</Box>}
    </Box>
  );
}
