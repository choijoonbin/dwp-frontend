import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, LockKeyhole, RefreshCw } from 'lucide-react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  HRIS_INTEGRATION_CONTROL_PLANE_DEFAULT_ADMISSIONS,
  HRIS_INTEGRATION_CONTROL_PLANE_FEATURE,
  HRIS_INTEGRATION_CONTROL_PLANE_RESPONSIVE_CONTRACT,
  isHrisIntegrationControlPlaneProjectionMounted,
} from './integration-control-plane-contract';

import type {
  HrisIntegrationControlPlaneAdmission,
  HrisIntegrationControlPlaneProjection,
  HrisIntegrationControlPlaneState,
} from './integration-control-plane-contract';

const STATE_COPY = Object.freeze({
  loading: Object.freeze({
    title: 'Loading integration governance',
    description: 'Confirming the current connector, policy and authorization projection.',
  }),
  empty: Object.freeze({
    title: 'No integration definitions',
    description: 'No connector is available in the authorized configuration scope.',
  }),
  complete: Object.freeze({
    title: 'Integration governance is current',
    description: 'Connector metadata, policy versions and effective status are synchronized.',
  }),
  partial: Object.freeze({
    title: 'Some integration evidence is unavailable',
    description: 'Only verified rows remain visible; every command is withheld.',
  }),
  unavailable: Object.freeze({
    title: 'Integration governance is unavailable',
    description: 'The trusted SYS-008 owner projection could not be confirmed.',
  }),
  forbidden: Object.freeze({
    title: 'Integration governance is not available',
    description: 'This session has no valid feature, projection or route decision.',
  }),
  retry: Object.freeze({
    title: 'Integration governance could not be refreshed',
    description: 'Retry after the trusted authorization context has been reconstructed.',
  }),
  'step-up': Object.freeze({
    title: 'Additional verification is required',
    description: 'Verify this session before continuing with a high-risk integration command.',
  }),
  'result-unknown': Object.freeze({
    title: 'Command result is not yet confirmed',
    description: 'Verified read data is preserved while the receipt outcome is reconciled.',
  }),
} satisfies Readonly<
  Record<HrisIntegrationControlPlaneState, Readonly<{ title: string; description: string }>>
>);

export type HrisIntegrationControlPlaneStatePanelProps = Readonly<{
  state: HrisIntegrationControlPlaneState;
  projection: HrisIntegrationControlPlaneProjection;
  onRetry?: () => void;
  onStepUp?: () => void;
}>;

function StateIcon({ state }: Readonly<{ state: HrisIntegrationControlPlaneState }>) {
  if (state === 'loading') return <CircularProgress size={22} aria-hidden="true" />;
  if (state === 'complete') return <CheckCircle2 size={22} aria-hidden="true" />;
  if (state === 'forbidden' || state === 'step-up') {
    return <LockKeyhole size={22} aria-hidden="true" />;
  }
  return <AlertCircle size={22} aria-hidden="true" />;
}

/** Presentational projection state. It performs no request and creates no main landmark. */
export function HrisIntegrationControlPlaneStatePanel({
  state,
  projection,
  onRetry,
  onStepUp,
}: HrisIntegrationControlPlaneStatePanelProps) {
  const copy = STATE_COPY[state];
  const isAlert = [
    'partial',
    'unavailable',
    'forbidden',
    'retry',
    'step-up',
    'result-unknown',
  ].includes(state);
  const titleId = `hris-integration-control-plane-${projection.toLowerCase()}-${state}-title`;
  return (
    <Paper
      component="section"
      variant="outlined"
      role={isAlert ? 'alert' : 'status'}
      aria-labelledby={titleId}
      aria-live={isAlert ? 'assertive' : 'polite'}
      aria-busy={state === 'loading'}
      data-testid="hris-integration-control-plane-state"
      data-state={state}
      data-projection={projection}
      data-required-feature={HRIS_INTEGRATION_CONTROL_PLANE_FEATURE}
      sx={{
        inlineSize: HRIS_INTEGRATION_CONTROL_PLANE_RESPONSIVE_CONTRACT.inlineSize,
        minWidth: HRIS_INTEGRATION_CONTROL_PLANE_RESPONSIVE_CONTRACT.minimumChildInlineSize,
        maxWidth: '100%',
        boxSizing: 'border-box',
        p: { xs: 2, sm: 2.5 },
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: HRIS_INTEGRATION_CONTROL_PLANE_RESPONSIVE_CONTRACT.contentColumns.narrow,
            md: HRIS_INTEGRATION_CONTROL_PLANE_RESPONSIVE_CONTRACT.contentColumns.wide,
          },
          alignItems: 'start',
          gap: 2,
          minWidth: 0,
        }}
      >
        <Stack direction="row" gap={1.25} minWidth={0} alignItems="flex-start">
          <Box sx={{ color: state === 'complete' ? 'success.main' : 'text.secondary', mt: 0.25 }}>
            <StateIcon state={state} />
          </Box>
          <Box minWidth={0}>
            <Typography id={titleId} component="h2" variant="subtitle1" fontWeight={760}>
              {copy.title}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                overflowWrap: HRIS_INTEGRATION_CONTROL_PLANE_RESPONSIVE_CONTRACT.textOverflow,
              }}
            >
              {copy.description}
            </Typography>
          </Box>
        </Stack>
        {state === 'retry' ? (
          <Button
            startIcon={<RefreshCw size={16} />}
            onClick={onRetry}
            sx={{ minWidth: 44, minHeight: 44 }}
          >
            Retry
          </Button>
        ) : null}
        {state === 'step-up' ? (
          <Button variant="contained" onClick={onStepUp} sx={{ minWidth: 44, minHeight: 44 }}>
            Verify session
          </Button>
        ) : null}
      </Box>
    </Paper>
  );
}

export type HrisIntegrationControlPlaneProjectionSurfaceProps = Readonly<{
  projection: HrisIntegrationControlPlaneProjection;
  admission?: HrisIntegrationControlPlaneAdmission;
  children?: ReactNode;
}>;

/**
 * SYS-008 owns one truth and exposes two policy projections. Both seams are sealed unmounted, so
 * this component cannot request data, add navigation or re-own the external DWP productivity page.
 */
export function HrisIntegrationControlPlaneProjectionSurface({
  projection,
  admission = HRIS_INTEGRATION_CONTROL_PLANE_DEFAULT_ADMISSIONS[projection],
  children,
}: HrisIntegrationControlPlaneProjectionSurfaceProps) {
  if (admission.projection !== projection) return null;
  return isHrisIntegrationControlPlaneProjectionMounted(admission) ? children : null;
}
