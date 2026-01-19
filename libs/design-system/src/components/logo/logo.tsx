import type { LinkProps } from '@mui/material/Link';

import { mergeClasses } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import { styled, useTheme } from '@mui/material/styles';

import { logoClasses } from './classes';

// ----------------------------------------------------------------------

export type LogoProps = LinkProps & {
  isSingle?: boolean;
  disabled?: boolean;
};

export function Logo({
  sx,
  disabled,
  className,
  href = '/',
  isSingle = true,
  ...other
}: LogoProps) {
  const theme = useTheme();

  const singleLogo = (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'stretch',
        padding: 0,
        margin: 0,
      }}
    >
      <Box
        component="img"
        src="/assets/images/dwp.png"
        alt="DWP Logo"
        sx={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          position: 'relative',
          zIndex: 1,
          transition: 'opacity 0.3s ease',
          padding: 0,
          margin: 0,
        }}
      />
      {/* 테마 primary 색상을 반영하는 오버레이 */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(135deg, ${theme.vars.palette.primary.main}20, ${theme.vars.palette.primary.light}15)`,
          mixBlendMode: 'multiply',
          zIndex: 2,
          pointerEvents: 'none',
          transition: 'background 0.3s ease',
        }}
      />
    </Box>
  );

  const fullLogo = singleLogo;

  return (
    <LogoRoot
      href={href}
      aria-label="Logo"
      underline="none"
      className={mergeClasses([logoClasses.root, className])}
      sx={[
        {
          width: 40,
          height: 40,
          overflow: 'hidden',
          display: 'inline-flex',
          alignItems: 'stretch',
          justifyContent: 'stretch',
          padding: 0,
          margin: 0,
          ...(!isSingle && { width: 102, height: 36 }),
          ...(disabled && { pointerEvents: 'none' }),
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      {isSingle ? singleLogo : fullLogo}
    </LogoRoot>
  );
}

// ----------------------------------------------------------------------

const LogoRoot = styled(Link)(() => ({
  flexShrink: 0,
  color: 'transparent',
  display: 'inline-flex',
  verticalAlign: 'middle',
}));
