import { useEffect, useRef, useState } from 'react';
import { FormDialog, InlineFeedback } from '@dwp-frontend/design-system';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';

import type { ClockEvent, RecordClockEventRequest } from '../model/clock-ingestion-model';
import type { ClockIngestionCopy } from '../model/clock-ingestion-copy';

type RecordDraft = Readonly<{
  sourcePublicId: string;
  sourceEventKey: string;
  sourceSequence: string;
  sourceType: RecordClockEventRequest['sourceType'];
  devicePublicId: string;
  captureMode: RecordClockEventRequest['captureMode'];
  offlineBatchPublicId: string;
  workerPublicId: string;
  peopleAssignmentPublicId: string;
  peopleAssignmentRevision: string;
  eventType: RecordClockEventRequest['eventType'];
  occurredAt: string;
  sourceLocalDateTime: string;
  sourceTimeZone: string;
  sourceUtcOffsetMinutes: string;
  dstResolution: RecordClockEventRequest['dstResolution'];
  instantAuthority: RecordClockEventRequest['instantAuthority'];
  tzdbVersion: string;
  timeZoneRuleVersion: string;
  sourceProvenanceDigest: string;
  trustLevel: RecordClockEventRequest['trustLevel'];
}>;

function initialDraft(timeZone: string, defaults?: Partial<RecordClockEventRequest>): RecordDraft {
  return {
    sourcePublicId: defaults?.sourcePublicId ?? '',
    sourceEventKey: defaults?.sourceEventKey ?? '',
    sourceSequence: String(defaults?.sourceSequence ?? 1),
    sourceType: defaults?.sourceType ?? 'API',
    devicePublicId: defaults?.devicePublicId ?? '',
    captureMode: defaults?.captureMode ?? 'ONLINE',
    offlineBatchPublicId: defaults?.offlineBatchPublicId ?? '',
    workerPublicId: defaults?.workerPublicId ?? '',
    peopleAssignmentPublicId: defaults?.peopleAssignmentPublicId ?? '',
    peopleAssignmentRevision: String(defaults?.peopleAssignmentRevision ?? 0),
    eventType: defaults?.eventType ?? 'IN',
    occurredAt: defaults?.occurredAt ?? '',
    sourceLocalDateTime: defaults?.sourceLocalDateTime ?? '',
    sourceTimeZone: defaults?.sourceTimeZone ?? timeZone,
    sourceUtcOffsetMinutes: String(defaults?.sourceUtcOffsetMinutes ?? 0),
    dstResolution: defaults?.dstResolution ?? 'EXACT_OFFSET_SUPPLIED',
    instantAuthority: defaults?.instantAuthority ?? 'SOURCE_INSTANT',
    tzdbVersion: defaults?.tzdbVersion ?? '',
    timeZoneRuleVersion: defaults?.timeZoneRuleVersion ?? '',
    sourceProvenanceDigest: defaults?.sourceProvenanceDigest ?? '',
    trustLevel: defaults?.trustLevel ?? 'STANDARD',
  };
}

function requestFromDraft(draft: RecordDraft): RecordClockEventRequest {
  return Object.freeze({
    ...draft,
    sourceSequence: Number(draft.sourceSequence),
    devicePublicId: draft.devicePublicId || null,
    offlineBatchPublicId: draft.offlineBatchPublicId || null,
    peopleAssignmentRevision: Number(draft.peopleAssignmentRevision),
    sourceUtcOffsetMinutes: Number(draft.sourceUtcOffsetMinutes),
  });
}

function draftIsComplete(draft: RecordDraft): boolean {
  return (
    Boolean(
      draft.sourcePublicId &&
      draft.sourceEventKey &&
      draft.workerPublicId &&
      draft.peopleAssignmentPublicId &&
      draft.occurredAt &&
      draft.sourceLocalDateTime &&
      draft.sourceTimeZone &&
      draft.tzdbVersion &&
      draft.timeZoneRuleVersion &&
      draft.sourceProvenanceDigest
    ) &&
    Number.isSafeInteger(Number(draft.sourceSequence)) &&
    Number(draft.sourceSequence) >= 1 &&
    Number.isSafeInteger(Number(draft.peopleAssignmentRevision)) &&
    Number(draft.peopleAssignmentRevision) >= 0 &&
    Number.isSafeInteger(Number(draft.sourceUtcOffsetMinutes)) &&
    (['MOBILE', 'KIOSK', 'DEVICE'].includes(draft.sourceType)
      ? Boolean(draft.devicePublicId)
      : !draft.devicePublicId) &&
    (draft.captureMode === 'OFFLINE'
      ? Boolean(draft.offlineBatchPublicId)
      : !draft.offlineBatchPublicId)
  );
}

export function ClockRecordDialog({
  open,
  busy,
  retryExact,
  timeZone,
  defaults,
  copy,
  onClose,
  onSubmit,
  onRetryExact,
}: Readonly<{
  open: boolean;
  busy: boolean;
  retryExact: boolean;
  timeZone: string;
  defaults?: Partial<RecordClockEventRequest>;
  copy: ClockIngestionCopy;
  onClose: () => void;
  onSubmit: (request: RecordClockEventRequest) => Promise<void>;
  onRetryExact: () => Promise<void>;
}>) {
  const [draft, setDraft] = useState(() => initialDraft(timeZone, defaults));
  const wasOpenRef = useRef(false);
  const update = <K extends keyof RecordDraft>(key: K, value: RecordDraft[K]) =>
    setDraft((current) => {
      const next = { ...current, [key]: value };
      if (key === 'sourceType' && !['MOBILE', 'KIOSK', 'DEVICE'].includes(String(value))) {
        next.devicePublicId = '';
      }
      if (key === 'captureMode' && value !== 'OFFLINE') next.offlineBatchPublicId = '';
      return next;
    });

  useEffect(() => {
    if (open && !wasOpenRef.current && !retryExact) {
      setDraft(initialDraft(timeZone, defaults));
    }
    wasOpenRef.current = open;
  }, [defaults, open, retryExact, timeZone]);

  const text = (
    key: keyof RecordDraft,
    label: string,
    options: Readonly<{ type?: string; required?: boolean; disabled?: boolean }> = {}
  ) => (
    <TextField
      key={key}
      label={label}
      value={draft[key]}
      type={options.type}
      required={options.required ?? true}
      disabled={busy || retryExact || options.disabled}
      onChange={(event) => update(key, event.target.value as never)}
      fullWidth
      size="small"
      slotProps={{ htmlInput: { autoComplete: 'off' } }}
    />
  );

  const select = <K extends keyof RecordDraft>(
    key: K,
    label: string,
    values: readonly RecordDraft[K][]
  ) => (
    <TextField
      key={key}
      select
      label={label}
      value={draft[key]}
      disabled={busy || retryExact}
      onChange={(event) => update(key, event.target.value as RecordDraft[K])}
      fullWidth
      size="small"
    >
      {values.map((value) => (
        <MenuItem key={String(value)} value={String(value)}>
          {String(value)}
        </MenuItem>
      ))}
    </TextField>
  );

  return (
    <FormDialog
      open={open}
      title={copy.recordDialogTitle}
      description={copy.recordDialogDescription}
      cancelLabel={copy.close}
      submitLabel={retryExact ? copy.retryExact : copy.submitRecord}
      submittingLabel={copy.commandWorking}
      onClose={onClose}
      onSubmit={() => (retryExact ? onRetryExact() : onSubmit(requestFromDraft(draft)))}
      busy={busy}
      submitDisabled={!retryExact && !draftIsComplete(draft)}
      maxWidth="md"
      desktopMaxWidth={840}
      mobileFullScreen
    >
      <Stack gap={2} sx={{ pt: 0.5 }}>
        {retryExact && (
          <InlineFeedback severity="warning" title={copy.resultUnknownTitle}>
            {copy.resultUnknownDescription}
          </InlineFeedback>
        )}
        <Stack
          sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}
        >
          {text('sourcePublicId', copy.sourcePublicId)}
          {text('sourceEventKey', copy.sourceEventKey)}
          {text('sourceSequence', copy.sourceSequence, { type: 'number' })}
          {select('sourceType', copy.sourceType, [
            'WEB',
            'MOBILE',
            'KIOSK',
            'DEVICE',
            'IMPORT',
            'API',
          ])}
          {text('devicePublicId', copy.devicePublicId, {
            required: ['MOBILE', 'KIOSK', 'DEVICE'].includes(draft.sourceType),
            disabled: !['MOBILE', 'KIOSK', 'DEVICE'].includes(draft.sourceType),
          })}
          {select('captureMode', copy.captureMode, ['ONLINE', 'OFFLINE'])}
          {text('offlineBatchPublicId', copy.offlineBatchPublicId, {
            required: draft.captureMode === 'OFFLINE',
            disabled: draft.captureMode !== 'OFFLINE',
          })}
          {text('workerPublicId', copy.workerPublicId)}
          {text('peopleAssignmentPublicId', copy.assignmentPublicId)}
          {text('peopleAssignmentRevision', copy.assignmentRevision, { type: 'number' })}
          {select('eventType', copy.eventType, ['IN', 'OUT', 'BREAK_START', 'BREAK_END'])}
          {text('occurredAt', copy.occurredAt)}
          {text('sourceLocalDateTime', copy.sourceLocalDateTime)}
          {text('sourceTimeZone', copy.sourceTimeZone)}
          {text('sourceUtcOffsetMinutes', copy.sourceUtcOffset, { type: 'number' })}
          {select('dstResolution', copy.dstResolution, [
            'EXACT_OFFSET_SUPPLIED',
            'EARLIER_OFFSET_SELECTED',
            'LATER_OFFSET_SELECTED',
            'GAP_SHIFT_FORWARD',
          ])}
          {select('instantAuthority', copy.instantAuthority, [
            'SOURCE_INSTANT',
            'LOCAL_WITH_OFFSET',
            'SERVER_RESOLVED',
          ])}
          {text('tzdbVersion', copy.tzdbVersion)}
          {text('timeZoneRuleVersion', copy.timeZoneRuleVersion)}
          {select('trustLevel', copy.trustLevel, ['LOW', 'STANDARD', 'VERIFIED'])}
        </Stack>
        {text('sourceProvenanceDigest', copy.sourceProvenanceDigest)}
      </Stack>
    </FormDialog>
  );
}

export function ClockVoidDialog({
  event,
  busy,
  retryExact,
  copy,
  onClose,
  onSubmit,
  onRetryExact,
}: Readonly<{
  event: ClockEvent | null;
  busy: boolean;
  retryExact: boolean;
  copy: ClockIngestionCopy;
  onClose: () => void;
  onSubmit: (reasonCode: string) => Promise<void>;
  onRetryExact: () => Promise<void>;
}>) {
  const [reasonCode, setReasonCode] = useState('');
  useEffect(() => {
    if (event && !retryExact) setReasonCode('');
  }, [event, retryExact]);
  const validReason = /^[A-Z][A-Z0-9_]{1,79}$/u.test(reasonCode);
  return (
    <FormDialog
      open={Boolean(event)}
      title={copy.voidDialogTitle}
      description={copy.voidDialogDescription}
      cancelLabel={copy.close}
      submitLabel={retryExact ? copy.retryExact : copy.submitVoid}
      submittingLabel={copy.commandWorking}
      submitIntent="danger"
      onClose={onClose}
      onSubmit={() => (retryExact ? onRetryExact() : onSubmit(reasonCode))}
      busy={busy}
      submitDisabled={!retryExact && !validReason}
      maxWidth="sm"
    >
      <Stack gap={2} sx={{ pt: 0.5 }}>
        {retryExact && (
          <InlineFeedback severity="warning" title={copy.resultUnknownTitle}>
            {copy.resultUnknownDescription}
          </InlineFeedback>
        )}
        <TextField
          autoFocus
          fullWidth
          required
          size="small"
          label={copy.voidReasonCode}
          value={reasonCode}
          disabled={busy || retryExact}
          helperText={copy.voidReasonHelp}
          onChange={(event) => setReasonCode(event.target.value.toUpperCase())}
        />
      </Stack>
    </FormDialog>
  );
}
