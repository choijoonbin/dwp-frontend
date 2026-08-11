import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

import type { IconButtonProps } from '@mui/material/IconButton';
import type { TooltipProps } from '@mui/material/Tooltip';

export type IconActionIntent = 'default' | 'primary' | 'danger';

export type ActionIconButtonProps = Omit<IconButtonProps, 'aria-label' | 'color' | 'loading'> & {
  label: string;
  tooltip?: string;
  tooltipPlacement?: TooltipProps['placement'];
  intent?: IconActionIntent;
  loading?: boolean;
};

const INTENT_COLOR: Record<IconActionIntent, IconButtonProps['color']> = {
  default: 'default',
  primary: 'primary',
  danger: 'error',
};

export function ActionIconButton({
  label,
  tooltip = label,
  tooltipPlacement = 'top',
  intent = 'default',
  loading = false,
  disabled,
  ...props
}: ActionIconButtonProps) {
  return (
    <Tooltip title={tooltip} placement={tooltipPlacement}>
      <span style={{ display: 'inline-flex' }}>
        <IconButton
          {...props}
          aria-label={label}
          aria-busy={loading || undefined}
          color={INTENT_COLOR[intent]}
          disabled={disabled || loading}
          loading={loading}
        />
      </span>
    </Tooltip>
  );
}
