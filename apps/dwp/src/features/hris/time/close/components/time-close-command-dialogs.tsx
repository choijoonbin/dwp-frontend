import { useEffect, useState } from 'react';
import { FormDialog } from '@dwp-frontend/design-system';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import type { ReactNode } from 'react';
import type {
  PayrollTimeHandoffCommand,
  TimeCloseCommand,
  TimeCloseValidationCommand,
  TimeReopenCommand,
} from '../api/time-close-api';
import type { TimeCloseDialogMode } from '../hooks/use-time-close-commands';
import type { TimeClosePeriod } from '../model/time-close-model';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const REASON = /^[A-Z][A-Z0-9._-]{0,79}$/u;
const paperSx = {
  width: 'min(42rem, calc(100vw - 2rem))',
  maxWidth: 'calc(100vw - 2rem)',
  '@media (forced-colors: active)': { border: '2px solid CanvasText' },
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
  },
} as const;

function instantNow(): string {
  return new Date().toISOString();
}

export function TimeCloseCommandDialogs({
  mode,
  period,
  busy,
  commandDisabled,
  notice,
  onClose,
  onValidate,
  onClosePeriod,
  onReopen,
  onCreateHandoff,
}: Readonly<{
  mode: TimeCloseDialogMode;
  period: TimeClosePeriod;
  busy: boolean;
  commandDisabled: boolean;
  notice?: ReactNode;
  onClose: () => void;
  onValidate: (request: TimeCloseValidationCommand) => void;
  onClosePeriod: (request: TimeCloseCommand) => void;
  onReopen: (request: TimeReopenCommand) => void;
  onCreateHandoff: (request: PayrollTimeHandoffCommand) => void;
}>) {
  const [asOf, setAsOf] = useState(instantNow);
  const [approvalReceiptId, setApprovalReceiptId] = useState('');
  const [reasonCode, setReasonCode] = useState('PERIOD_REOPEN_APPROVED');
  const [closedTimeResultId, setClosedTimeResultId] = useState('');
  const [payrollEntityId, setPayrollEntityId] = useState('');
  const [payPeriodId, setPayPeriodId] = useState('');

  useEffect(() => {
    if (!mode) return;
    setAsOf(instantNow());
    setApprovalReceiptId('');
    setReasonCode('PERIOD_REOPEN_APPROVED');
    setClosedTimeResultId('');
    setPayrollEntityId('');
    setPayPeriodId('');
  }, [mode, period.periodId]);

  const approvalValid = UUID.test(approvalReceiptId);
  const reopenValid = approvalValid && REASON.test(reasonCode);
  const handoffValid =
    UUID.test(closedTimeResultId) && UUID.test(payrollEntityId) && UUID.test(payPeriodId);
  const valid =
    mode === 'VALIDATE' ||
    (mode === 'CLOSE' && approvalValid) ||
    (mode === 'REOPEN' && reopenValid) ||
    (mode === 'HANDOFF' && handoffValid);
  const title = {
    VALIDATE: 'Validate period close',
    CLOSE: 'Close this time period',
    REOPEN: 'Reopen as a forward correction',
    HANDOFF: 'Create Payroll handoff',
  }[mode ?? 'VALIDATE'];
  const submitLabel = {
    VALIDATE: 'Validate period',
    CLOSE: 'Close period',
    REOPEN: 'Reopen period',
    HANDOFF: 'Create handoff',
  }[mode ?? 'VALIDATE'];

  return (
    <FormDialog
      open={mode !== null}
      title={title}
      description={`${period.title}. Aggregate version ${period.version ?? 'unavailable'} is rechecked before dispatch.`}
      cancelLabel="Cancel"
      submitLabel={submitLabel}
      submittingLabel="Submitting…"
      submitDisabled={!valid || commandDisabled || busy}
      busy={busy}
      mobileFullScreen
      paperSx={paperSx}
      onClose={onClose}
      onSubmit={() => {
        if (!valid || commandDisabled) return;
        if (mode === 'VALIDATE') onValidate({ asOf });
        if (mode === 'CLOSE') onClosePeriod({ asOf, approvalReceiptId });
        if (mode === 'REOPEN') onReopen({ asOf, approvalReceiptId, reasonCode });
        if (mode === 'HANDOFF') {
          onCreateHandoff({ closedTimeResultId, payrollEntityId, payPeriodId });
        }
      }}
    >
      <Stack gap={2}>
        {notice}
        <Typography variant="body2" color="text.secondary">
          Validation and command results are immutable owner evidence. Refresh never rewrites a
          prior blocker, result, event, or receipt.
        </Typography>
        {(mode === 'CLOSE' || mode === 'REOPEN') && (
          <TextField
            autoFocus
            fullWidth
            required
            label="Approval receipt ID"
            value={approvalReceiptId}
            onChange={(event) => setApprovalReceiptId(event.target.value.trim())}
            error={approvalReceiptId.length > 0 && !approvalValid}
            helperText="Use the approved UUID for this exact period and version."
            inputProps={{ maxLength: 36 }}
          />
        )}
        {mode === 'REOPEN' && (
          <TextField
            fullWidth
            required
            label="Reopen reason code"
            value={reasonCode}
            onChange={(event) => setReasonCode(event.target.value.toUpperCase())}
            error={reasonCode.length > 0 && !REASON.test(reasonCode)}
            helperText="Forward correction only; the closed result and prior events remain immutable."
            inputProps={{ maxLength: 80 }}
          />
        )}
        {mode === 'HANDOFF' && (
          <>
            <TextField
              autoFocus
              fullWidth
              required
              label="Closed-time result ID"
              value={closedTimeResultId}
              onChange={(event) => setClosedTimeResultId(event.target.value.trim())}
              error={closedTimeResultId.length > 0 && !UUID.test(closedTimeResultId)}
              inputProps={{ maxLength: 36 }}
            />
            <TextField
              fullWidth
              required
              label="Payroll entity ID"
              value={payrollEntityId}
              onChange={(event) => setPayrollEntityId(event.target.value.trim())}
              error={payrollEntityId.length > 0 && !UUID.test(payrollEntityId)}
              inputProps={{ maxLength: 36 }}
            />
            <TextField
              fullWidth
              required
              label="Pay period ID"
              value={payPeriodId}
              onChange={(event) => setPayPeriodId(event.target.value.trim())}
              error={payPeriodId.length > 0 && !UUID.test(payPeriodId)}
              inputProps={{ maxLength: 36 }}
            />
          </>
        )}
        {mode === 'VALIDATE' && (
          <Typography role="status" variant="body2">
            Validation captures the blocker snapshot for the current version without closing or
            partially mutating the period.
          </Typography>
        )}
      </Stack>
    </FormDialog>
  );
}
