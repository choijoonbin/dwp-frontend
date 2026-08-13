import Button from '@mui/material/Button';

import type { ButtonProps } from '@mui/material/Button';

export type ActionIntent = 'primary' | 'secondary' | 'quiet' | 'danger';

export type ActionButtonProps = Omit<ButtonProps, 'color' | 'loading' | 'variant'> & {
  intent?: ActionIntent;
  loading?: boolean;
  loadingLabel?: string;
  to?: string;
};

export function resolveActionButtonAriaLabel(
  ariaLabel: string | undefined,
  loading: boolean,
  loadingLabel: string | undefined,
  children: React.ReactNode
): string | undefined {
  if (loading && loadingLabel) return loadingLabel;
  if (ariaLabel) return ariaLabel;
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  return undefined;
}

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
  const ariaLabel = resolveActionButtonAriaLabel(
    props['aria-label'],
    loading,
    loadingLabel,
    children
  );

  return (
    <Button
      {...INTENT_PROPS[intent]}
      {...props}
      disabled={disabled || loading}
      loading={loading}
      aria-busy={loading || undefined}
      aria-label={ariaLabel}
    >
      {children}
    </Button>
  );
}
