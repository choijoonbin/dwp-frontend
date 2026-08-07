import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import type { BoxProps } from '@mui/material/Box';

export type ProductMarkProps = Omit<BoxProps<'a'>, 'component'> & {
  compact?: boolean;
  label?: string;
};

export function ProductMark({
  compact = false,
  label = 'Digital Workplace',
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
      <Box
        aria-hidden="true"
        sx={{
          width: 32,
          height: 32,
          flex: '0 0 32px',
          display: 'grid',
          placeItems: 'center',
          borderRadius: 1,
          color: 'primary.contrastText',
          bgcolor: 'primary.main',
          fontSize: 14,
          fontWeight: 800,
          lineHeight: 1,
        }}
      >
        D
      </Box>
      {!compact && (
        <Typography
          component="span"
          variant="subtitle1"
          sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {label}
        </Typography>
      )}
    </Box>
  );
}
