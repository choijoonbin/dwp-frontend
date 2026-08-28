import { CheckCircle2, RefreshCw, ShieldAlert } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import type { ReactNode } from 'react';
import type { HomeContributionBucketState } from '../contributions';

export type HomePurposeStatusState = Exclude<HomeContributionBucketState, 'AVAILABLE'>;

export type HomePurposeStatusAccessibility = Readonly<{
  role: 'alert' | 'status';
  live: 'assertive' | 'polite';
}>;

export function resolveHomePurposeStatusAccessibility(
  state: HomePurposeStatusState
): HomePurposeStatusAccessibility {
  return state === 'UNAVAILABLE'
    ? { role: 'alert', live: 'assertive' }
    : { role: 'status', live: 'polite' };
}

type HomePurposeStatusProps = Readonly<{
  state: HomePurposeStatusState;
  title: string;
  description: string;
  supportStack: boolean;
  fetching: boolean;
  retryLabel: string;
  supplement?: ReactNode;
  onRetry?: () => void;
}>;

export function HomePurposeStatus({
  state,
  title,
  description,
  supportStack,
  fetching,
  retryLabel,
  supplement,
  onRetry,
}: HomePurposeStatusProps) {
  const degraded = state === 'PARTIAL' || state === 'UNAVAILABLE';
  const warning = degraded || state === 'RESTRICTED';
  const accessibility = resolveHomePurposeStatusAccessibility(state);

  return (
    <Box
      data-home-purpose-status
      data-home-purpose-state={state.toLocaleLowerCase('en-US')}
      role={accessibility.role}
      aria-live={accessibility.live}
      aria-atomic="true"
      aria-busy={fetching || undefined}
      sx={(theme) => ({
        minHeight: supportStack ? 44 : 88,
        width: 1,
        p: supportStack ? 0.75 : 1.25,
        flex: '1 1 auto',
        display: 'grid',
        gridTemplateColumns: {
          xs: 'auto minmax(0, 1fr)',
          sm: 'auto minmax(0, 1fr) auto',
        },
        alignItems: 'center',
        columnGap: 1.25,
        rowGap: 0.75,
        color: 'text.secondary',
        bgcolor: alpha(
          warning ? theme.palette.warning.main : theme.palette.success.main,
          theme.palette.mode === 'dark' ? 0.1 : 0.045
        ),
        border: '1px solid',
        borderColor: alpha(warning ? theme.palette.warning.main : theme.palette.success.main, 0.18),
        borderRadius: 'var(--home-radius-item)',
        '@media (forced-colors: active)': {
          bgcolor: 'Canvas',
          borderColor: 'CanvasText',
        },
      })}
    >
      {warning ? (
        <ShieldAlert size={22} color="var(--mui-palette-warning-main)" aria-hidden="true" />
      ) : (
        <CheckCircle2 size={22} color="var(--mui-palette-success-main)" aria-hidden="true" />
      )}
      <Box>
        <Typography variant="subtitle2" color="text.primary" fontWeight={700}>
          {title}
        </Typography>
        <Typography variant="body2">{description}</Typography>
        {supplement}
      </Box>
      {degraded && onRetry && (
        <ActionButton
          data-home-purpose-retry
          intent="quiet"
          size="small"
          startIcon={<RefreshCw size={14} aria-hidden="true" />}
          onClick={onRetry}
          loading={fetching}
          sx={{
            minHeight: 44,
            whiteSpace: 'nowrap',
            justifySelf: 'end',
            gridColumn: { xs: '2', sm: 'auto' },
          }}
        >
          {retryLabel}
        </ActionButton>
      )}
    </Box>
  );
}
