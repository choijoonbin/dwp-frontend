import { useEffect, useState } from 'react';
import { DatePickerField, FormDialog, FormField } from '@dwp-frontend/design-system';

import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

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
        title="Record an immutable correction"
        description={`Period ${timecard.periodStart} to ${timecard.periodEnd}. Positive and negative minute adjustments are appended to the ledger.`}
        cancelLabel="Cancel"
        submitLabel="Record correction"
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
            Existing ledger rows are never replaced. Use a negative value to reverse minutes and a
            positive value to add minutes.
          </Typography>
          <DatePickerField
            autoFocus
            fullWidth
            label="Work date"
            value={workDate}
            onValueChange={(value) => setWorkDate(value ?? '')}
            minDate={timecard.periodStart}
            maxDate={timecard.periodEnd}
          />
          <FormField
            fullWidth
            label="Pay code"
            value={payCode}
            onChange={(event) => setPayCode(event.target.value)}
            inputProps={{ maxLength: 64 }}
          />
          <FormField
            fullWidth
            label="Minute adjustment"
            type="number"
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
            supportingText="Enter a whole number from -1440 to 1440, excluding zero."
            inputProps={{ min: -1_440, max: 1_440, step: 1 }}
          />
          <FormField
            fullWidth
            label="Correction reason code"
            value={correctionReason}
            onChange={(event) => setCorrectionReason(event.target.value)}
            inputProps={{ maxLength: 64 }}
          />
        </Stack>
      </FormDialog>

      <FormDialog
        open={mode === 'SUBMIT'}
        title="Submit this timecard"
        description="Submission moves the current OPEN version to SUBMITTED. The server rechecks authority and version before accepting it."
        cancelLabel="Cancel"
        submitLabel="Submit timecard"
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
            label="Submission reason code (optional)"
            value={submitReason}
            onChange={(event) => setSubmitReason(event.target.value)}
            inputProps={{ maxLength: 64 }}
          />
        </Stack>
      </FormDialog>

      <FormDialog
        open={mode === 'DECIDE'}
        title="Record an independent decision"
        description="The worker, submitter, and latest correction maker cannot decide this timecard. Authority is re-evaluated at dispatch."
        cancelLabel="Cancel"
        submitLabel="Record decision"
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
            label="Decision"
            value={decision}
            onChange={(event) => setDecision(event.target.value as TimecardDecision)}
          >
            <MenuItem value="APPROVE">Approve</MenuItem>
            <MenuItem value="REJECT">Reject</MenuItem>
            <MenuItem value="REQUIRE_CORRECTION">Require correction</MenuItem>
          </FormField>
          <FormField
            fullWidth
            label="Decision reason code"
            value={decisionReason}
            onChange={(event) => setDecisionReason(event.target.value)}
            inputProps={{ maxLength: 64 }}
          />
          <FormField
            fullWidth
            multiline
            minRows={3}
            label="Restricted audit comment (optional)"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            supportingText={`${comment.length}/1000. This comment is not included in the domain event.`}
            inputProps={{ maxLength: 1_000 }}
          />
        </Stack>
      </FormDialog>
    </>
  );
}
