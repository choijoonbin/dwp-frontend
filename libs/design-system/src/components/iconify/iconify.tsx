import type { IconProps } from '@iconify/react';

import { useId } from 'react';
import { Icon } from '@iconify/react';

import { styled } from '@mui/material/styles';

import { mergeClasses } from '../../utils';
import { iconifyClasses } from './classes';
import { registerIcons } from './register-icons';

import type { IconifyName } from './register-icons';

// ----------------------------------------------------------------------

export type IconifyProps = React.ComponentProps<typeof IconRoot> &
  Omit<IconProps, 'icon'> & {
    /**
     * Prefer registered icons (IconifyName) for offline usage.
     * You can also pass any Iconify icon string to load online.
     */
    icon: IconifyName | string;
  };

export function Iconify({ className, icon, width = 20, height, sx, ...other }: IconifyProps) {
  const id = useId();

  registerIcons();

  return (
    <IconRoot
      ssr
      id={id}
      icon={icon}
      className={mergeClasses([iconifyClasses.root, className])}
      sx={[
        {
          width,
          flexShrink: 0,
          height: height ?? width,
          display: 'inline-flex',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    />
  );
}

// ----------------------------------------------------------------------

const IconRoot = styled(Icon)``;
