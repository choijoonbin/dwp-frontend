import type { LinkProps } from '@mui/material/Link';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import { styled } from '@mui/material/styles';

import { logoClasses } from './classes';
import { mergeClasses } from '../../utils';

// ----------------------------------------------------------------------

export type LogoProps = LinkProps & {
  isSingle?: boolean;
  disabled?: boolean;
  collapsed?: boolean;
  expandedText?: string;
  collapsedText?: string;
};

export function Logo({
  sx,
  disabled,
  className,
  href = '/',
  isSingle = true,
  collapsed = false,
  expandedText = 'DitalWorkPlace',
  collapsedText = 'DWP',
  ...other
}: LogoProps) {
  const singleLogo = (
    <Box
      sx={{
        width: 40,
        height: 40,
        borderRadius: 1.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
        fontWeight: 'bold',
        fontSize: '1.25rem',
        transition: 'all 0.3s ease',
      }}
    >
      D
    </Box>
  );

  const fullLogo = (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <Box
        sx={{
          width: collapsed ? 52 : 170,
          height: 36,
          borderRadius: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: collapsed ? 1 : 1.5,
          background:
            'linear-gradient(135deg, rgba(234, 0, 44, 0.92) 0%, rgba(255, 122, 0, 0.86) 100%)',
          color: '#fff',
          fontWeight: 'bold',
          fontSize: collapsed ? '0.85rem' : '0.95rem',
          letterSpacing: 0,
          boxShadow: '0 4px 10px rgba(234, 0, 44, 0.18)',
          transition: 'all 0.2s ease',
          whiteSpace: 'nowrap',
        }}
      >
        {collapsed ? collapsedText : expandedText}
      </Box>
    </Box>
  );

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
          ...(!isSingle && { width: collapsed ? 52 : 170, height: 36 }),
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
