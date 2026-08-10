import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import type { ReactNode } from 'react';
import type { BoxProps } from '@mui/material/Box';

export type ProductMarkProps = Omit<BoxProps<'a'>, 'component' | 'prefix'> & {
  compact?: boolean;
  label?: string;
  description?: ReactNode;
  prefix?: ReactNode;
};

export function ProductMark({
  compact = false,
  label = 'Digital Workplace',
  description,
  prefix,
  href = '/',
  sx,
  ...props
}: ProductMarkProps) {
  return (
    <Box
      component="a"
      href={href}
      aria-label={`${label} home`}
      sx={[
        {
          display: 'inline-flex',
          minWidth: 0,
          alignItems: 'center',
          gap: 1.25,
          color: 'text.primary',
          textDecoration: 'none',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...props}
    >
      {prefix}
      <Box
        aria-hidden="true"
        sx={{
          width: 34,
          height: 34,
          flex: '0 0 34px',
          display: 'grid',
          placeItems: 'center',
          borderRadius: 1,
          color: 'primary.contrastText',
          bgcolor: 'primary.main',
          fontSize: 12,
          fontWeight: 800,
          lineHeight: 1,
          position: 'relative',
          overflow: 'hidden',
          '&::after': {
            content: '""',
            position: 'absolute',
            right: 5,
            bottom: 5,
            width: 6,
            height: 6,
            bgcolor: 'secondary.main',
            border: '1px solid currentColor',
            borderRadius: 0.5,
          },
        }}
      >
        DWP
      </Box>
      {!compact && (
        <Box sx={{ minWidth: 0 }}>
          <Typography
            component="span"
            variant={description ? 'subtitle2' : 'subtitle1'}
            sx={{
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontWeight: 750,
            }}
          >
            {label}
          </Typography>
          {description && (
            <Typography
              component="span"
              variant="caption"
              color="text.secondary"
              noWrap
              sx={{ display: 'block' }}
            >
              {description}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
