import { useEffect, useState } from 'react';
import { FormDialog, FormField } from '@dwp-frontend/design-system';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('hcm');
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
    VALIDATE: t('hrisTime.i18nClosure.close.dialog.validateTitle'),
    CLOSE: t('hrisTime.i18nClosure.close.dialog.closeTitle'),
    REOPEN: t('hrisTime.i18nClosure.close.dialog.reopenTitle'),
    HANDOFF: t('hrisTime.i18nClosure.close.dialog.handoffTitle'),
  }[mode ?? 'VALIDATE'];
  const submitLabel = {
    VALIDATE: t('hrisTime.i18nClosure.close.dialog.validateSubmit'),
    CLOSE: t('hrisTime.i18nClosure.close.dialog.closeSubmit'),
    REOPEN: t('hrisTime.i18nClosure.close.dialog.reopenSubmit'),
    HANDOFF: t('hrisTime.i18nClosure.close.dialog.handoffSubmit'),
  }[mode ?? 'VALIDATE'];

  return (
    <FormDialog
      open={mode !== null}
      title={title}
      description={t('hrisTime.i18nClosure.close.dialog.description', {
        title: period.title,
        version: period.version ?? t('hrisTime.i18nClosure.common.unavailable'),
      })}
      cancelLabel={t('hrisTime.i18nClosure.common.cancel')}
      submitLabel={submitLabel}
      submittingLabel={t('hrisTime.i18nClosure.common.submitting')}
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
          {t('hrisTime.i18nClosure.close.dialog.immutableEvidence')}
        </Typography>
        {(mode === 'CLOSE' || mode === 'REOPEN') && (
          <FormField
            autoFocus
            fullWidth
            required
            label={t('hrisTime.i18nClosure.close.dialog.approvalReceiptId')}
            value={approvalReceiptId}
            onChange={(event) => setApprovalReceiptId(event.target.value.trim())}
            errorMessage={
              approvalReceiptId.length > 0 && !approvalValid
                ? t('hrisTime.i18nClosure.close.dialog.approvalReceiptHelp')
                : undefined
            }
            supportingText={t('hrisTime.i18nClosure.close.dialog.approvalReceiptHelp')}
            inputProps={{ maxLength: 36 }}
          />
        )}
        {mode === 'REOPEN' && (
          <FormField
            fullWidth
            required
            label={t('hrisTime.i18nClosure.close.dialog.reopenReasonCode')}
            value={reasonCode}
            onChange={(event) => setReasonCode(event.target.value.toUpperCase())}
            errorMessage={
              reasonCode.length > 0 && !REASON.test(reasonCode)
                ? t('hrisTime.i18nClosure.close.dialog.reopenReasonHelp')
                : undefined
            }
            supportingText={t('hrisTime.i18nClosure.close.dialog.reopenReasonHelp')}
            inputProps={{ maxLength: 80 }}
          />
        )}
        {mode === 'HANDOFF' && (
          <>
            <FormField
              autoFocus
              fullWidth
              required
              label={t('hrisTime.i18nClosure.close.dialog.closedTimeResultId')}
              value={closedTimeResultId}
              onChange={(event) => setClosedTimeResultId(event.target.value.trim())}
              errorMessage={
                closedTimeResultId.length > 0 && !UUID.test(closedTimeResultId)
                  ? t('hrisTime.i18nClosure.close.dialog.closedTimeResultError')
                  : undefined
              }
              inputProps={{ maxLength: 36 }}
            />
            <FormField
              fullWidth
              required
              label={t('hrisTime.i18nClosure.close.dialog.payrollEntityId')}
              value={payrollEntityId}
              onChange={(event) => setPayrollEntityId(event.target.value.trim())}
              errorMessage={
                payrollEntityId.length > 0 && !UUID.test(payrollEntityId)
                  ? t('hrisTime.i18nClosure.close.dialog.payrollEntityError')
                  : undefined
              }
              inputProps={{ maxLength: 36 }}
            />
            <FormField
              fullWidth
              required
              label={t('hrisTime.i18nClosure.close.dialog.payPeriodId')}
              value={payPeriodId}
              onChange={(event) => setPayPeriodId(event.target.value.trim())}
              errorMessage={
                payPeriodId.length > 0 && !UUID.test(payPeriodId)
                  ? t('hrisTime.i18nClosure.close.dialog.payPeriodError')
                  : undefined
              }
              inputProps={{ maxLength: 36 }}
            />
          </>
        )}
        {mode === 'VALIDATE' && (
          <Typography role="status" variant="body2">
            {t('hrisTime.i18nClosure.close.dialog.validationDescription')}
          </Typography>
        )}
      </Stack>
    </FormDialog>
  );
}
