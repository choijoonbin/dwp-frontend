import { ActionButton, LoadingState } from '@dwp-frontend/design-system';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, LockKeyhole, RefreshCw } from 'lucide-react';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  HRIS_AUTOMATION_CONTROL_PLANE_DEFAULT_ADMISSION,
  HRIS_AUTOMATION_CONTROL_PLANE_FEATURE,
  HRIS_AUTOMATION_CONTROL_PLANE_RESPONSIVE_CONTRACT,
  isHrisAutomationControlPlaneChildMounted,
} from './automation-control-plane-contract';

import type {
  HrisAutomationControlPlaneAdmission,
  HrisAutomationControlPlaneState,
} from './automation-control-plane-contract';

const STATE_COPY = Object.freeze({
  loading: Object.freeze({
    title: 'Loading automation governance',
    description: 'Confirming the current catalog, run and authorization projections.',
  }),
  empty: Object.freeze({
    title: 'No automation definitions',
    description: 'No definition is available in the authorized configuration scope.',
  }),
  complete: Object.freeze({
    title: 'Automation governance is current',
    description: 'Definitions, schedules and run evidence are synchronized.',
  }),
  partial: Object.freeze({
    title: 'Some automation evidence is unavailable',
    description: 'Only confirmed projections are shown; commands remain unavailable.',
  }),
  unavailable: Object.freeze({
    title: 'Automation governance is unavailable',
    description: 'The trusted owner projection could not be confirmed.',
  }),
  forbidden: Object.freeze({
    title: 'Automation governance is not available',
    description: 'This session does not have the required feature, page or operation decision.',
  }),
  retry: Object.freeze({
    title: 'Automation governance could not be refreshed',
    description: 'Retry after the trusted authorization context has been reconstructed.',
  }),
  'step-up': Object.freeze({
    title: 'Additional verification is required',
    description: 'Verify this session before continuing with a high-risk governance command.',
  }),
} satisfies Readonly<
  Record<HrisAutomationControlPlaneState, Readonly<{ title: string; description: string }>>
>);

export type HrisAutomationControlPlaneStatePanelProps = Readonly<{
  state: HrisAutomationControlPlaneState;
  onRetry?: () => void;
  onStepUp?: () => void;
}>;

function StateIcon({ state }: Readonly<{ state: HrisAutomationControlPlaneState }>) {
  if (state === 'complete') return <CheckCircle2 size={22} aria-hidden="true" />;
  if (state === 'forbidden' || state === 'step-up') {
    return <LockKeyhole size={22} aria-hidden="true" />;
  }
  return <AlertCircle size={22} aria-hidden="true" />;
}

/** Presentational state contract. It performs no network request and owns no route. */
export function HrisAutomationControlPlaneStatePanel({
  state,
  onRetry,
  onStepUp,
}: HrisAutomationControlPlaneStatePanelProps) {
  const { t } = useTranslation('hcm');
  const copy = STATE_COPY[state];
  const isAlert = ['partial', 'unavailable', 'forbidden', 'retry', 'step-up'].includes(state);
  const titleId = `hris-automation-control-plane-${state}-title`;
  return (
    <Paper
      component="section"
      variant="outlined"
      role={isAlert ? 'alert' : 'status'}
      aria-labelledby={titleId}
      aria-live={isAlert ? 'assertive' : 'polite'}
      aria-busy={state === 'loading'}
      data-testid="hris-automation-control-plane-state"
      data-state={state}
      data-required-feature={HRIS_AUTOMATION_CONTROL_PLANE_FEATURE}
      sx={{
        inlineSize: HRIS_AUTOMATION_CONTROL_PLANE_RESPONSIVE_CONTRACT.inlineSize,
        minWidth: HRIS_AUTOMATION_CONTROL_PLANE_RESPONSIVE_CONTRACT.minimumChildInlineSize,
        maxWidth: '100%',
        boxSizing: 'border-box',
        p: { xs: 2, sm: 2.5 },
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: HRIS_AUTOMATION_CONTROL_PLANE_RESPONSIVE_CONTRACT.contentColumns.narrow,
            md: HRIS_AUTOMATION_CONTROL_PLANE_RESPONSIVE_CONTRACT.contentColumns.wide,
          },
          alignItems: 'start',
          gap: 2,
          minWidth: 0,
        }}
      >
        <Stack direction="row" gap={1.25} minWidth={0} alignItems="flex-start">
          {state !== 'loading' ? (
            <Box sx={{ color: state === 'complete' ? 'success.main' : 'text.secondary', mt: 0.25 }}>
              <StateIcon state={state} />
            </Box>
          ) : null}
          <Box minWidth={0}>
            {state === 'loading' ? (
              <Box
                id={titleId}
                role="heading"
                aria-level={2}
                sx={{
                  '& [role="status"]': { gap: 1.25 },
                  '& .MuiTypography-root': {
                    typography: 'subtitle1',
                    fontWeight: 'fontWeightBold',
                  },
                }}
              >
                <LoadingState embedded spinnerSize={22} label={copy.title} />
              </Box>
            ) : (
              <Typography
                id={titleId}
                component="h2"
                variant="subtitle1"
                fontWeight="fontWeightBold"
              >
                {copy.title}
              </Typography>
            )}
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                overflowWrap: HRIS_AUTOMATION_CONTROL_PLANE_RESPONSIVE_CONTRACT.textOverflow,
                ...(state === 'loading' ? { pl: 4 } : {}),
              }}
            >
              {copy.description}
            </Typography>
          </Box>
        </Stack>
        {state === 'retry' ? (
          <ActionButton
            intent="quiet"
            startIcon={<RefreshCw size={16} />}
            onClick={onRetry}
            sx={{ minWidth: 44, minHeight: 44 }}
          >
            {t('common.retry')}
          </ActionButton>
        ) : null}
        {state === 'step-up' ? (
          <ActionButton intent="primary" onClick={onStepUp} sx={{ minWidth: 44, minHeight: 44 }}>
            {t('administration.common.verifySession')}
          </ActionButton>
        ) : null}
      </Box>
    </Paper>
  );
}

export type HrisAutomationControlPlaneChildSurfaceProps = Readonly<{
  admission?: HrisAutomationControlPlaneAdmission;
  children?: ReactNode;
}>;

/**
 * SYS-006 composition seam inside the existing SYS-002 page. The sealed mount policy is false, so
 * this boundary cannot render a child, initiate a request or create a second page/sidebar owner.
 */
export function HrisAutomationControlPlaneChildSurface({
  admission = HRIS_AUTOMATION_CONTROL_PLANE_DEFAULT_ADMISSION,
  children,
}: HrisAutomationControlPlaneChildSurfaceProps) {
  return isHrisAutomationControlPlaneChildMounted(admission) ? children : null;
}
