import type { LinkProps } from '@mui/material/Link';

import { useId } from 'react';
import { mergeClasses } from 'minimal-shared/utils';

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

  const gradientId = useId();

  const TEXT_PRIMARY = theme.vars.palette.text.primary;
  const PRIMARY_LIGHT = theme.vars.palette.primary.light;
  const PRIMARY_MAIN = theme.vars.palette.primary.main;
  const PRIMARY_DARKER = theme.vars.palette.primary.dark;

  const singleLogo = (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id={`${gradientId}-dwp-v3`}
          x1="0"
          y1="0"
          x2="40"
          y2="40"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={PRIMARY_LIGHT} />
          <stop offset="1" stopColor={PRIMARY_MAIN} />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="10" fill={`url(#${gradientId}-dwp-v3)`} />
      <path
        d="M10 12V28M10 12H16C19.5 12 21 13.5 21 16.5V23.5C21 26.5 19.5 28 16 28H10"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M24 12V28M24 12H28C30.5 12 31.5 13 31.5 15.5V18.5C31.5 21 30.5 22 28 22H24"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M14 20L17 24L20 20"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
          overflow: 'visible',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
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
