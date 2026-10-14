import {
  ActionButton,
  GuidedEmptyState,
  InlineFeedback,
  LoadingState,
  LocalErrorState,
} from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useMemo } from 'react';

import { useProductSurfaceRequestScope } from '../../../../components/use-product-surface-request-scope';
import { PayrollCalculationReceiptEvidence } from '../components/payroll-calculation-receipt-evidence';
import { PayrollCalculationRunInspector } from '../components/payroll-calculation-run-inspector';
import { PayrollCalculationRunList } from '../components/payroll-calculation-run-list';
import {
  usePayrollCalculationCommandCenter,
  type PayrollCalculationCommandCenterController,
  type PayrollCalculationOwnerBinding,
} from '../hooks/use-payroll-calculation-command-center';
import { payrollCalculationCopy } from '../model/payroll-calculation-copy';

import type { PayrollCalculationDataSource } from '../api/payroll-calculation-api';
import type { PayrollCalculationCopy } from '../model/payroll-calculation-copy';

export type PayrollCalculationCommandCenterViewProps = Readonly<{
  controller: PayrollCalculationCommandCenterController;
  copy?: PayrollCalculationCopy;
}>;

function CommandFeedback({
  controller,
  copy,
}: Readonly<{
  controller: PayrollCalculationCommandCenterController;
  copy: PayrollCalculationCopy;
}>) {
  const feedback = controller.feedback;
  if (!feedback) return null;
  if (feedback.kind === 'SUCCEEDED') {
    return (
      <InlineFeedback severity="success" title={copy.successTitle}>
        {copy.successDescription} {feedback.receipt.receiptId}
      </InlineFeedback>
    );
  }
  if (feedback.kind === 'STEP_UP') {
    return (
      <InlineFeedback severity="info" title={copy.stepUpTitle}>
        {copy.stepUpDescription}
      </InlineFeedback>
    );
  }
  if (feedback.kind === 'RESULT_UNKNOWN') {
    return (
      <InlineFeedback severity="warning" title={copy.unknownTitle}>
        <Stack gap={1} alignItems="flex-start">
          <span>{copy.unknownDescription}</span>
          {controller.pendingHasReceipt ? (
            <ActionButton
              intent="secondary"
              size="small"
              disabled={controller.busy}
              onClick={() => void controller.reconcileReceipt()}
            >
              {copy.checkReceipt}
            </ActionButton>
          ) : (
            <ActionButton
              intent="secondary"
              size="small"
              disabled={controller.busy}
              onClick={controller.retryExact}
            >
              {copy.retryExact}
            </ActionButton>
          )}
        </Stack>
      </InlineFeedback>
    );
  }
  if (feedback.kind === 'PERMISSION') {
    return (
      <InlineFeedback severity="error" title={copy.permissionTitle}>
        {copy.permissionDescription}
      </InlineFeedback>
    );
  }
  if (feedback.kind === 'CONFLICT') {
    return (
      <InlineFeedback severity="warning" title={copy.conflictTitle}>
        {copy.conflictDescription}
      </InlineFeedback>
    );
  }
  return (
    <InlineFeedback severity="error" title={copy.rejectedTitle}>
      {feedback.kind === 'INVALID' ? feedback.message : copy.rejectedDescription}
    </InlineFeedback>
  );
}

export function PayrollCalculationCommandCenterView({
  controller,
  copy = payrollCalculationCopy,
}: PayrollCalculationCommandCenterViewProps) {
  const state = controller.state;
  return (
    <Stack
      gap={2.5}
      data-testid="payroll-calculation-command-center"
      data-feature-state="owner-activation-required"
      sx={{
        minWidth: 0,
        '@media (prefers-reduced-motion: reduce)': {
          '&, & *': { animation: 'none !important', transition: 'none !important' },
        },
        '@media (forced-colors: active)': {
          '& .MuiPaper-outlined': { borderColor: 'CanvasText' },
        },
      }}
    >
      <Stack
        component="header"
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ md: 'flex-start' }}
        gap={2}
      >
        <Box minWidth={0}>
          <Typography variant="overline" color="text.secondary">
            {copy.eyebrow}
          </Typography>
          <Typography component="h1" variant="h4" sx={{ overflowWrap: 'anywhere' }}>
            {copy.title}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 800 }}>
            {copy.description}
          </Typography>
          {state.kind === 'READY' && (
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={0.75} sx={{ mt: 1.5 }}>
              <Chip
                size="small"
                color={controller.stale ? 'warning' : 'success'}
                label={controller.stale ? 'STALE' : 'CURRENT'}
              />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ alignSelf: { sm: 'center' } }}
              >
                {copy.lastRefresh}: {new Date(state.loadedAt).toISOString()}
              </Typography>
            </Stack>
          )}
        </Box>
        <ActionButton
          intent="secondary"
          disabled={controller.busy || state.kind === 'LOADING'}
          onClick={controller.refresh}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          {copy.refresh}
        </ActionButton>
      </Stack>

      <Box aria-live="polite" aria-atomic="true">
        {controller.partial && (
          <InlineFeedback severity="warning" title={copy.partialTitle}>
            {copy.partialDescription}
          </InlineFeedback>
        )}
        {controller.stale && (
          <InlineFeedback severity="warning" title={copy.staleTitle}>
            {copy.staleDescription}
          </InlineFeedback>
        )}
        <CommandFeedback controller={controller} copy={copy} />
      </Box>

      {state.kind === 'LOADING' && (
        <Paper variant="outlined" sx={{ p: 2 }} aria-busy="true" role="status">
          <LoadingState size="page" variant="skeleton" skeletonRows={4} label={copy.loading} />
        </Paper>
      )}
      {state.kind === 'EMPTY' && (
        <GuidedEmptyState
          kind="empty"
          size="page"
          title={copy.emptyTitle}
          description={copy.emptyDescription}
        />
      )}
      {(state.kind === 'DENIED' || state.kind === 'CLOSED') && (
        <GuidedEmptyState
          kind="permission"
          size="page"
          title={copy.deniedTitle}
          description={copy.deniedDescription}
        />
      )}
      {state.kind === 'ERROR' && (
        <LocalErrorState
          size="page"
          title={copy.unavailableTitle}
          description={copy.unavailableDescription}
          retryLabel={copy.refresh}
          onRetry={controller.refresh}
        />
      )}
      {state.kind === 'READY' && (
        <>
          <Box
            data-testid="payroll-calculation-responsive-grid"
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                lg: 'minmax(0, 3fr) minmax(300px, 2fr)',
              },
              gap: 2,
              alignItems: 'start',
              minWidth: 0,
            }}
          >
            <PayrollCalculationRunList
              runs={controller.runs}
              selectedId={controller.selectedId}
              copy={copy}
              disabled={controller.busy}
              onSelect={controller.select}
            />
            <PayrollCalculationRunInspector
              run={controller.selected}
              copy={copy}
              busy={controller.busy}
              canCalculate={controller.canCalculate}
              canApprove={controller.canApprove}
              canFinalize={controller.canFinalize}
              onCalculate={controller.calculate}
              onApprove={controller.approve}
              onFinalize={controller.finalize}
            />
          </Box>
          <PayrollCalculationReceiptEvidence receipts={controller.receipts} copy={copy} />
        </>
      )}
    </Stack>
  );
}

export type HrisPayrollCalculationCommandCenterProps = Readonly<{
  runIds: readonly string[];
  receiptIds?: readonly string[];
  ownerBinding?: PayrollCalculationOwnerBinding;
  dataSource?: PayrollCalculationDataSource;
  idFactory?: () => string;
  now?: () => number;
  staleAfterMs?: number;
  copy?: PayrollCalculationCopy;
}>;

/**
 * PAY-011 route adapter. The generated v41 route projection is supplied by Control integration;
 * this module remains inactive and fail-closed until its five exact owner bindings are injected.
 */
export function HrisPayrollCalculationCommandCenter({
  runIds,
  receiptIds,
  ownerBinding,
  dataSource,
  idFactory,
  now,
  staleAfterMs,
  copy,
}: HrisPayrollCalculationCommandCenterProps) {
  const requestScope = useProductSurfaceRequestScope({
    productKey: 'hcm',
    surfaceKey: 'hcm.operations',
  });
  const scope = useMemo(
    () => ({
      ready:
        requestScope.ready &&
        Boolean(requestScope.contextScopeKey) &&
        Boolean(requestScope.queryMeta.decisionRevision),
      contextScopeKey: requestScope.contextScopeKey,
      decisionRevision: requestScope.queryMeta.decisionRevision,
    }),
    [requestScope.contextScopeKey, requestScope.queryMeta.decisionRevision, requestScope.ready]
  );
  const controller = usePayrollCalculationCommandCenter({
    runIds,
    ...(receiptIds ? { receiptIds } : {}),
    scope,
    ownerBinding,
    ...(dataSource ? { dataSource } : {}),
    ...(idFactory ? { idFactory } : {}),
    ...(now ? { now } : {}),
    ...(staleAfterMs !== undefined ? { staleAfterMs } : {}),
  });
  return <PayrollCalculationCommandCenterView controller={controller} copy={copy} />;
}

export default HrisPayrollCalculationCommandCenter;
