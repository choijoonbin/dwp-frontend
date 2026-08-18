import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { GlyphSurface } from '../glyph-surface';

import type { ReactNode } from 'react';
import type { BoxProps } from '@mui/material/Box';

export type ProductMarkProps = Omit<BoxProps<'a'>, 'component' | 'prefix'> & {
  compact?: boolean;
  label?: string;
  description?: ReactNode;
  prefix?: ReactNode;
  suffix?: ReactNode;
};

export function ProductMark({
  compact = false,
  label = 'Digital Workplace',
  description,
  prefix,
  suffix,
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
      <GlyphSurface size={36} tone="#2457D6">
        <Box
          component="span"
          sx={{
            color: '#FFFFFF',
            fontSize: 11,
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: 0,
            transform: 'translateY(-0.5px)',
          }}
        >
          DWP
        </Box>
        <Box
          component="span"
          sx={{
            position: 'absolute',
            right: 4,
            bottom: 4,
            width: 6,
            height: 6,
            bgcolor: 'secondary.main',
            border: '1px solid rgba(255,255,255,0.92)',
            borderRadius: '2px',
            boxShadow: '0 1px 3px rgba(7,20,41,0.22)',
          }}
        />
      </GlyphSurface>
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
      {suffix}
    </Box>
  );
}
