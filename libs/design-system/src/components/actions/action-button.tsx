import Button from '@mui/material/Button';

import type { ButtonProps } from '@mui/material/Button';

export type ActionIntent = 'primary' | 'secondary' | 'quiet' | 'danger';

export type ActionButtonProps = Omit<ButtonProps, 'color' | 'loading' | 'variant'> & {
  intent?: ActionIntent;
  loading?: boolean;
  loadingLabel?: string;
  to?: string;
};

const INTENT_PROPS: Record<ActionIntent, Pick<ButtonProps, 'color' | 'variant'>> = {
  primary: { color: 'primary', variant: 'contained' },
  secondary: { color: 'primary', variant: 'outlined' },
  quiet: { color: 'inherit', variant: 'text' },
  danger: { color: 'error', variant: 'contained' },
};

export function ActionButton({
  intent = 'secondary',
  loading = false,
  loadingLabel,
  disabled,
  children,
  ...props
}: ActionButtonProps) {
  return (
    <Button
      {...INTENT_PROPS[intent]}
      {...props}
      disabled={disabled || loading}
      loading={loading}
      aria-busy={loading || undefined}
      aria-label={loading && loadingLabel ? loadingLabel : props['aria-label']}
    >
      {children}
    </Button>
  );
}
