import { ActionButton, FormDialog, InlineFeedback } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';

import {
  normalizePayrollActionComment,
  PAYROLL_ACTION_COMMENT_MAX_CODE_POINTS,
  payrollActionCommentCodePointCount,
} from '../model/payroll-calculation-contract';
import type {
  PayrollCalculationCommandKind,
  PayrollCalculationRun,
} from '../model/payroll-calculation-contract';
import type { PayrollCalculationCopy } from '../model/payroll-calculation-copy';

export type PayrollCalculationRunInspectorProps = Readonly<{
  run: PayrollCalculationRun | null;
  copy: PayrollCalculationCopy;
  busy: boolean;
  canCalculate: boolean;
  canApprove: boolean;
  canFinalize: boolean;
  onCalculate: (comment?: string) => void;
  onApprove: (comment?: string) => void;
  onFinalize: (comment?: string) => void;
}>;

function Fact({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <Box component="div" minWidth={0}>
      <Typography component="dt" variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
    </Box>
  );
}

export function PayrollCalculationRunInspector({
  run,
  copy,
  busy,
  canCalculate,
  canApprove,
  canFinalize,
  onCalculate,
  onApprove,
  onFinalize,
}: PayrollCalculationRunInspectorProps) {
  const [comment, setComment] = useState('');
  const [review, setReview] = useState<PayrollCalculationCommandKind | null>(null);
  const commentCodePointCount = payrollActionCommentCodePointCount(comment);
  const reviewTitle =
    review === 'CALCULATE'
      ? copy.reviewCalculateTitle
      : review === 'APPROVE'
        ? copy.reviewApproveTitle
        : copy.reviewFinalizeTitle;
  const impact =
    review === 'CALCULATE'
      ? copy.impactCalculate
      : review === 'APPROVE'
        ? copy.impactApprove
        : copy.impactFinalize;
  const submitReview = () => {
    const command = review;
    setReview(null);
    if (command === 'CALCULATE') onCalculate(comment);
    if (command === 'APPROVE') onApprove(comment);
    if (command === 'FINALIZE') onFinalize(comment);
  };
  return (
    <>
      <Paper
        component="aside"
        variant="outlined"
        sx={{ p: 2, minWidth: 0 }}
        aria-label={copy.inspect}
      >
        <Typography component="h2" variant="h6">
          {copy.inspect}
        </Typography>
        {!run ? (
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {copy.noSelection}
          </Typography>
        ) : (
          <Stack gap={2} sx={{ mt: 1.5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
              <Typography variant="subtitle1" sx={{ overflowWrap: 'anywhere' }}>
                {run.runId}
              </Typography>
              <Chip size="small" label={run.state} />
            </Stack>
            <Box
              component="dl"
              sx={{
                m: 0,
                display: 'grid',
                gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
                gap: 1.5,
              }}
            >
              <Fact label={copy.payPeriod} value={run.payPeriodId} />
              <Fact label={copy.runType} value={run.runType} />
              <Fact label={copy.workers} value={String(run.workerCount)} />
              <Fact label={copy.version} value={String(run.version)} />
              <Fact label={copy.gross} value={`${run.gross.amount} ${run.gross.currency}`} />
              <Fact label={copy.net} value={`${run.net.amount} ${run.net.currency}`} />
            </Box>
            <InlineFeedback severity="info" title={copy.commands}>
              {copy.commandGuard}
            </InlineFeedback>
            <TextField
              label={copy.comment}
              value={comment}
              onChange={(event) => setComment(normalizePayrollActionComment(event.target.value))}
              helperText={`${commentCodePointCount}/${PAYROLL_ACTION_COMMENT_MAX_CODE_POINTS}`}
              multiline
              minRows={2}
              disabled={busy}
              fullWidth
            />
            <Stack direction={{ xs: 'column', sm: 'row', lg: 'column', xl: 'row' }} gap={1}>
              <ActionButton
                intent="primary"
                disabled={!canCalculate}
                onClick={() => setReview('CALCULATE')}
                sx={{ width: { xs: '100%', xl: 'auto' } }}
              >
                {copy.calculate}
              </ActionButton>
              <ActionButton
                intent="secondary"
                disabled={!canApprove}
                onClick={() => setReview('APPROVE')}
                sx={{ width: { xs: '100%', xl: 'auto' } }}
              >
                {copy.approve}
              </ActionButton>
              <ActionButton
                intent="danger"
                disabled={!canFinalize}
                onClick={() => setReview('FINALIZE')}
                sx={{ width: { xs: '100%', xl: 'auto' } }}
              >
                {copy.finalize}
              </ActionButton>
            </Stack>
          </Stack>
        )}
      </Paper>
      <FormDialog
        open={review !== null}
        title={reviewTitle}
        description={copy.reviewDescription}
        cancelLabel={copy.cancel}
        submitLabel={copy.confirm}
        submitIntent={review === 'FINALIZE' ? 'danger' : 'primary'}
        submitDisabled={!run || busy}
        busy={busy}
        mobileFullScreen
        onClose={() => setReview(null)}
        onSubmit={submitReview}
      >
        {run && (
          <Stack gap={1.5}>
            <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
              {run.runId} · {copy.version} {run.version}
            </Typography>
            <InlineFeedback severity="warning" title={copy.impactTitle}>
              {impact}
            </InlineFeedback>
            <InlineFeedback severity="info" title={copy.recoveryTitle}>
              {copy.recoveryDescription}
            </InlineFeedback>
          </Stack>
        )}
      </FormDialog>
    </>
  );
}
