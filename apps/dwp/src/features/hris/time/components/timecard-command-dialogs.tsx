import { useEffect, useState } from 'react';
import { DatePickerField, FormDialog, FormField } from '@dwp-frontend/design-system';

import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';

import type { ReactNode } from 'react';
import type {
  Timecard,
  TimecardCorrectionCommand,
  TimecardDecision,
  TimecardDecisionCommand,
  TimecardSubmitCommand,
} from '../model/timecard-model';

export type TimecardDialogMode = 'CORRECT' | 'SUBMIT' | 'DECIDE' | null;

const dialogPaperSx = {
  maxWidth: 'min(calc(100% - 2rem), 40rem)',
  '@media (forced-colors: active)': { border: '2px solid CanvasText' },
} as const;

function boundedCode(value: string): boolean {
  const candidate = value.trim();
  return candidate.length >= 1 && candidate.length <= 64;
}

export function TimecardCommandDialogs({
  mode,
  timecard,
  busy,
  commandDisabled = false,
  notice,
  onClose,
  onCorrect,
  onSubmit,
  onDecide,
}: {
  mode: TimecardDialogMode;
  timecard: Timecard;
  busy: boolean;
  commandDisabled?: boolean;
  notice?: ReactNode;
  onClose: () => void;
  onCorrect: (command: TimecardCorrectionCommand) => void;
  onSubmit: (command: TimecardSubmitCommand) => void;
  onDecide: (command: TimecardDecisionCommand) => void;
}) {
  const { t } = useTranslation('hcm');
  const [workDate, setWorkDate] = useState(timecard.periodStart);
  const [payCode, setPayCode] = useState('REGULAR');
  const [minutes, setMinutes] = useState('');
  const [correctionReason, setCorrectionReason] = useState('TIMECARD_CORRECTION');
  const [submitReason, setSubmitReason] = useState('');
  const [decision, setDecision] = useState<TimecardDecision>('APPROVE');
  const [decisionReason, setDecisionReason] = useState('TIMECARD_REVIEW');
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (!mode) return;
    setWorkDate(timecard.periodStart);
    setPayCode('REGULAR');
    setMinutes('');
    setCorrectionReason('TIMECARD_CORRECTION');
    setSubmitReason('');
    setDecision('APPROVE');
    setDecisionReason('TIMECARD_REVIEW');
    setComment('');
  }, [mode, timecard.periodStart, timecard.timecardId]);

  const minuteValue = Number(minutes);
  const correctionValid =
    workDate >= timecard.periodStart &&
    workDate <= timecard.periodEnd &&
    boundedCode(payCode) &&
    boundedCode(correctionReason) &&
    minutes.trim().length > 0 &&
    Number.isSafeInteger(minuteValue) &&
    minuteValue >= -1_440 &&
    minuteValue <= 1_440 &&
    minuteValue !== 0;
  const submitValid = submitReason.trim().length === 0 || boundedCode(submitReason);
  const decisionValid = boundedCode(decisionReason) && comment.trim().length <= 1_000;

  return (
    <>
      <FormDialog
        open={mode === 'CORRECT'}
        title={t('hrisTime.i18nClosure.timecard.dialog.correctionTitle')}
        description={t('hrisTime.i18nClosure.timecard.dialog.correctionDescription', {
          start: timecard.periodStart,
          end: timecard.periodEnd,
        })}
        cancelLabel={t('hrisTime.i18nClosure.common.cancel')}
        submitLabel={t('hrisTime.i18nClosure.timecard.dialog.correctionSubmit')}
        busy={busy}
        submitDisabled={!correctionValid || busy || commandDisabled}
        mobileFullScreen
        paperSx={dialogPaperSx}
        onClose={onClose}
        onSubmit={() => {
          if (!correctionValid || commandDisabled) return;
          onCorrect({
            reasonCode: correctionReason.trim(),
            entries: [
              {
                workDate,
                payCode: payCode.trim(),
                minutes: minuteValue,
              },
            ],
          });
        }}
      >
        <Stack gap={2}>
          {notice}
          <Typography variant="body2" color="text.secondary">
            {t('hrisTime.i18nClosure.timecard.dialog.ledgerDescription')}
          </Typography>
          <DatePickerField
            autoFocus
            fullWidth
            label={t('hrisTime.i18nClosure.timecard.dialog.workDate')}
            value={workDate}
            onValueChange={(value) => setWorkDate(value ?? '')}
            minDate={timecard.periodStart}
            maxDate={timecard.periodEnd}
          />
          <FormField
            fullWidth
            label={t('hrisTime.i18nClosure.timecard.dialog.payCode')}
            value={payCode}
            onChange={(event) => setPayCode(event.target.value)}
            inputProps={{ maxLength: 64 }}
          />
          <FormField
            fullWidth
            label={t('hrisTime.i18nClosure.timecard.dialog.minuteAdjustment')}
            type="number"
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
            supportingText={t('hrisTime.i18nClosure.timecard.dialog.minuteHelp')}
            inputProps={{ min: -1_440, max: 1_440, step: 1 }}
          />
          <FormField
            fullWidth
            label={t('hrisTime.i18nClosure.timecard.dialog.correctionReasonCode')}
            value={correctionReason}
            onChange={(event) => setCorrectionReason(event.target.value)}
            inputProps={{ maxLength: 64 }}
          />
        </Stack>
      </FormDialog>

      <FormDialog
        open={mode === 'SUBMIT'}
        title={t('hrisTime.i18nClosure.timecard.dialog.submitTitle')}
        description={t('hrisTime.i18nClosure.timecard.dialog.submitDescription')}
        cancelLabel={t('hrisTime.i18nClosure.common.cancel')}
        submitLabel={t('hrisTime.i18nClosure.timecard.dialog.submitAction')}
        busy={busy}
        submitDisabled={!submitValid || busy || commandDisabled}
        mobileFullScreen
        paperSx={dialogPaperSx}
        onClose={onClose}
        onSubmit={() => {
          if (!submitValid || commandDisabled) return;
          const reasonCode = submitReason.trim();
          onSubmit(reasonCode ? { reasonCode } : {});
        }}
      >
        <Stack gap={2}>
          {notice}
          <FormField
            autoFocus
            fullWidth
            label={t('hrisTime.i18nClosure.timecard.dialog.submitReasonCode')}
            value={submitReason}
            onChange={(event) => setSubmitReason(event.target.value)}
            inputProps={{ maxLength: 64 }}
          />
        </Stack>
      </FormDialog>

      <FormDialog
        open={mode === 'DECIDE'}
        title={t('hrisTime.i18nClosure.timecard.dialog.decisionTitle')}
        description={t('hrisTime.i18nClosure.timecard.dialog.decisionDescription')}
        cancelLabel={t('hrisTime.i18nClosure.common.cancel')}
        submitLabel={t('hrisTime.i18nClosure.timecard.dialog.decisionSubmit')}
        busy={busy}
        submitDisabled={!decisionValid || busy || commandDisabled}
        mobileFullScreen
        paperSx={dialogPaperSx}
        onClose={onClose}
        onSubmit={() => {
          if (!decisionValid || commandDisabled) return;
          const normalizedComment = comment.trim();
          onDecide({
            decision,
            reasonCode: decisionReason.trim(),
            ...(normalizedComment ? { comment: normalizedComment } : {}),
          });
        }}
      >
        <Stack gap={2}>
          {notice}
          <FormField
            autoFocus
            select
            fullWidth
            label={t('hrisTime.i18nClosure.timecard.dialog.decision')}
            value={decision}
            onChange={(event) => setDecision(event.target.value as TimecardDecision)}
          >
            <MenuItem value="APPROVE">{t('hrisTime.i18nClosure.timecard.dialog.approve')}</MenuItem>
            <MenuItem value="REJECT">{t('hrisTime.i18nClosure.timecard.dialog.reject')}</MenuItem>
            <MenuItem value="REQUIRE_CORRECTION">
              {t('hrisTime.i18nClosure.timecard.dialog.requireCorrection')}
            </MenuItem>
          </FormField>
          <FormField
            fullWidth
            label={t('hrisTime.i18nClosure.timecard.dialog.decisionReasonCode')}
            value={decisionReason}
            onChange={(event) => setDecisionReason(event.target.value)}
            inputProps={{ maxLength: 64 }}
          />
          <FormField
            fullWidth
            multiline
            minRows={3}
            label={t('hrisTime.i18nClosure.timecard.dialog.auditComment')}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            supportingText={t('hrisTime.i18nClosure.timecard.dialog.auditCommentHelp', {
              count: comment.length,
            })}
            inputProps={{ maxLength: 1_000 }}
          />
        </Stack>
      </FormDialog>
    </>
  );
}
