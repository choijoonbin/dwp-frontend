import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';

import type { ReactNode } from 'react';
import type { BoxProps } from '@mui/material/Box';

export type GlyphSurfaceProps = Omit<BoxProps, 'children'> & {
  children: ReactNode;
  size?: number;
  tone?: string;
  variant?: 'glass' | 'soft';
};

export function GlyphSurface({
  children,
  size = 40,
  tone,
  variant = 'glass',
  sx,
  ...props
}: GlyphSurfaceProps) {
  const radius = `${Math.min(8, Math.max(4, Math.round(size * 0.18)))}px`;

  return (
    <Box
      aria-hidden="true"
      {...props}
      sx={[
        (theme) => {
          const resolvedTone = tone ?? theme.palette.primary.main;
          const soft = variant === 'soft';
          const dark = theme.palette.mode === 'dark';

          return {
            width: size,
            height: size,
            flex: `0 0 ${size}px`,
            position: 'relative',
            isolation: 'isolate',
            overflow: 'hidden',
            display: 'grid',
            placeItems: 'center',
            borderRadius: radius,
            color: soft ? resolvedTone : '#FFFFFF',
            bgcolor: soft
              ? alpha(resolvedTone, dark ? 0.2 : 0.1)
              : alpha(resolvedTone, dark ? 0.86 : 0.92),
            backgroundImage: soft
              ? `linear-gradient(145deg, ${alpha('#FFFFFF', dark ? 0.11 : 0.44)}, transparent 52%)`
              : `linear-gradient(145deg, ${alpha('#FFFFFF', 0.3)} 0%, ${alpha('#FFFFFF', 0.06)} 46%, ${alpha('#071429', 0.2)} 100%)`,
            border: '1px solid',
            borderColor: soft ? alpha(resolvedTone, dark ? 0.34 : 0.2) : alpha('#FFFFFF', 0.3),
            boxShadow: soft
              ? `inset 0 1px 0 ${alpha('#FFFFFF', dark ? 0.12 : 0.7)}`
              : `inset 0 1px 0 ${alpha('#FFFFFF', 0.48)}, inset 0 -1px 0 ${alpha('#071429', 0.16)}, 0 ${Math.max(4, Math.round(size * 0.12))}px ${Math.max(12, Math.round(size * 0.36))}px ${alpha('#071429', dark ? 0.28 : 0.18)}`,
            backdropFilter: soft ? 'none' : 'blur(12px) saturate(145%)',
            WebkitBackdropFilter: soft ? 'none' : 'blur(12px) saturate(145%)',
            '&::after': {
              content: '""',
              position: 'absolute',
              right: 0,
              bottom: 0,
              left: 0,
              height: '34%',
              background: `linear-gradient(180deg, transparent, ${alpha('#071429', soft ? 0.02 : 0.11)})`,
              pointerEvents: 'none',
            },
            '& > *': { position: 'relative', zIndex: 1 },
            '@media (prefers-reduced-transparency: reduce), (forced-colors: active)': {
              bgcolor: resolvedTone,
              backgroundImage: 'none',
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
              color: soft ? theme.palette.getContrastText(resolvedTone) : '#FFFFFF',
              borderColor: 'currentColor',
              boxShadow: 'none',
              '&::after': { display: 'none' },
            },
          };
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Box>
  );
}
