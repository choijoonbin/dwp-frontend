import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, CalendarX2, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  ActionButton,
  DateTimePickerField,
  DwpDateTimeProvider,
  FormDialog,
  FormField,
  InlineFeedback,
  LoadingState,
  SelectField,
} from '@dwp-frontend/design-system';
import { HttpError, useToast } from '@dwp-frontend/shared-utils';
import type { VideoMeetingSummary } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import {
  cancelScheduledVideoMeeting,
  getVideoMeetingSchedule,
  previewVideoMeetingCancellation,
  previewVideoMeetingReschedule,
  rescheduleVideoMeeting,
  type VideoMeetingCancellationPreview,
  type VideoMeetingRescheduleInput,
  type VideoMeetingSeriesPreview,
} from '@dwp-frontend/shared-utils/api/video-meeting-schedule-api';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

type Props = {
  meeting: VideoMeetingSummary;
  onChanged: () => Promise<unknown>;
};
type Scope = 'THIS_ONLY' | 'THIS_AND_FUTURE';
type ChangeDraft = { startsAt: string | null; durationMinutes: number; scope: Scope };
const denied = (error: unknown) =>
  error instanceof HttpError && [401, 403, 404].includes(error.status);

export function MeetingScheduleManagement({ meeting, onChanged }: Props) {
  const { t, i18n } = useTranslation('meetings');
  const toast = useToast();
  const queryClient = useQueryClient();
  const editable =
    meeting.canHost && ['DRAFT', 'SCHEDULED', 'LOBBY'].includes(meeting.lifecycleState);
  const queryKey = ['meetings', 'schedule-management', meeting.meetingId] as const;
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => getVideoMeetingSchedule(meeting.meetingId, signal),
    enabled: editable,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    meta: { accessSensitive: true },
  });
  const [changeOpen, setChangeOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [change, setChange] = useState<ChangeDraft>({
    startsAt: meeting.startsAt,
    durationMinutes: meeting.durationMinutes,
    scope: 'THIS_ONLY',
  });
  const [cancelScope, setCancelScope] = useState<Scope>('THIS_ONLY');
  const [changePreview, setChangePreview] = useState<VideoMeetingSeriesPreview | null>(null);
  const [cancelPreview, setCancelPreview] = useState<VideoMeetingCancellationPreview | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'load' | 'conflict' | 'command' | 'revoked' | null>(null);
  const mounted = useRef(false);
  const generation = useRef(0);
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const current = ++generation.current;
    setChangeOpen(false);
    setCancelOpen(false);
    setChangePreview(null);
    setCancelPreview(null);
    setReviewed(false);
    setBusy(false);
    setError(null);
    attempt.current = null;
    inFlight.current = false;
    return () => {
      if (generation.current === current) generation.current += 1;
    };
  }, [meeting.meetingId]);
  useEffect(() => {
    if (denied(query.error)) setError('revoked');
    else if (query.isError) setError('load');
  }, [query.error, query.isError]);

  if (!editable) return null;
  if (query.isLoading || (query.isFetching && !query.data))
    return <LoadingState label={t('scheduleManagement.loading')} variant="skeleton" />;
  if (!query.data || error === 'revoked')
    return (
      <Stack gap={1.25} alignItems="flex-start">
        <InlineFeedback severity="warning">
          {t(
            error === 'revoked'
              ? 'scheduleManagement.accessRevoked'
              : 'scheduleManagement.loadFailed'
          )}
        </InlineFeedback>
        {error !== 'revoked' && (
          <ActionButton
            intent="secondary"
            size="small"
            disabled={query.isFetching}
            onClick={() => {
              setError(null);
              void query.refetch();
            }}
          >
            {t('actions.retry')}
          </ActionButton>
        )}
      </Stack>
    );

  const schedule = query.data;
  const canChangeFuture =
    schedule.seriesId !== null &&
    schedule.seriesVersion !== null &&
    schedule.occurrenceIndex !== null &&
    schedule.occurrenceCount !== null &&
    schedule.occurrenceIndex < schedule.occurrenceCount;
  const scopeOptions = [
    { value: 'THIS_ONLY' as const, label: t('scheduleManagement.thisOnly') },
    ...(canChangeFuture
      ? [
          {
            value: 'THIS_AND_FUTURE' as const,
            label: t('scheduleManagement.thisAndFuture'),
          },
        ]
      : []),
  ];
  const resetReview = () => {
    setChangePreview(null);
    setCancelPreview(null);
    setReviewed(false);
    setError(null);
    attempt.current = null;
  };
  const selectedSeriesVersion = (scope: Scope) =>
    scope === 'THIS_AND_FUTURE' ? schedule.seriesVersion : null;
  const changeInput = (): VideoMeetingRescheduleInput => ({
    startsAt: change.startsAt ?? '',
    durationMinutes: change.durationMinutes,
    timeZone: schedule.timeZone,
    scope: change.scope,
    expectedSeriesVersion: selectedSeriesVersion(change.scope),
    expectedVersion: schedule.meetingVersion,
    calendarFingerprint: changePreview?.previewFingerprint ?? null,
  });
  const commandFailure = async (failure: unknown, currentGeneration: number) => {
    if (!mounted.current || generation.current !== currentGeneration) return;
    if (denied(failure)) {
      setError('revoked');
      setChangeOpen(false);
      setCancelOpen(false);
    } else if (failure instanceof HttpError && failure.status === 409) {
      resetReview();
      setError('conflict');
      await query.refetch();
    } else setError('command');
  };
  const stableKey = (fingerprint: string) => {
    if (attempt.current?.fingerprint !== fingerprint)
      attempt.current = { fingerprint, key: crypto.randomUUID() };
    return attempt.current.key;
  };
  const reviewOrApplyChange = async () => {
    if (inFlight.current || !change.startsAt || !Number.isFinite(Date.parse(change.startsAt)))
      return;
    const currentGeneration = generation.current;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      if (!changePreview) {
        const result = await previewVideoMeetingReschedule(meeting.meetingId, changeInput());
        if (!mounted.current || generation.current !== currentGeneration) return;
        setChangePreview(result);
        setReviewed(false);
        return;
      }
      if (!reviewed) return;
      const input = changeInput();
      const fingerprint = JSON.stringify(input);
      const result = await rescheduleVideoMeeting(meeting.meetingId, input, stableKey(fingerprint));
      if (!mounted.current || generation.current !== currentGeneration) return;
      queryClient.setQueryData(queryKey, result);
      toast.success(t('scheduleManagement.changed'));
      setChangeOpen(false);
      resetReview();
      void Promise.allSettled([query.refetch(), onChanged()]);
    } catch (failure) {
      await commandFailure(failure, currentGeneration);
    } finally {
      if (mounted.current) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  };
  const reviewOrCancel = async () => {
    if (inFlight.current) return;
    const currentGeneration = generation.current;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    const input = {
      scope: cancelScope,
      expectedSeriesVersion: selectedSeriesVersion(cancelScope),
      expectedVersion: schedule.meetingVersion,
    };
    try {
      if (!cancelPreview) {
        const result = await previewVideoMeetingCancellation(meeting.meetingId, input);
        if (!mounted.current || generation.current !== currentGeneration) return;
        setCancelPreview(result);
        setReviewed(false);
        return;
      }
      if (!reviewed) return;
      const payload = { ...input, impactFingerprint: cancelPreview.impactFingerprint };
      const result = await cancelScheduledVideoMeeting(
        meeting.meetingId,
        payload,
        stableKey(JSON.stringify(payload))
      );
      if (!mounted.current || generation.current !== currentGeneration) return;
      queryClient.setQueryData(queryKey, result);
      toast.success(t('scheduleManagement.cancelled'));
      setCancelOpen(false);
      resetReview();
      void Promise.allSettled([query.refetch(), onChanged()]);
    } catch (failure) {
      await commandFailure(failure, currentGeneration);
    } finally {
      if (mounted.current) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  };
  const close = () => {
    if (busy) return;
    setChangeOpen(false);
    setCancelOpen(false);
    resetReview();
  };

  return (
    <Stack gap={1.5} data-testid="meeting-schedule-management">
      <Box>
        <Typography variant="caption" color="text.secondary">
          {t('scheduleManagement.deliveryState')}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {t(`scheduleManagement.delivery.${schedule.deliveryState}`)} ·{' '}
          {t('scheduleManagement.invitationRevision', {
            revision: schedule.invitationRevision,
          })}
        </Typography>
        {schedule.seriesId && (
          <Typography variant="caption" color="text.secondary">
            {t('scheduleManagement.seriesPosition', {
              current: schedule.occurrenceIndex,
              total: schedule.occurrenceCount,
            })}
          </Typography>
        )}
      </Box>
      {error && (
        <InlineFeedback severity="error">{t(`scheduleManagement.errors.${error}`)}</InlineFeedback>
      )}
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
        <ActionButton
          intent="secondary"
          startIcon={<Pencil size={16} aria-hidden="true" />}
          onClick={() => {
            setChange({
              startsAt: schedule.startsAt,
              durationMinutes: Math.round(
                (Date.parse(schedule.endsAt) - Date.parse(schedule.startsAt)) / 60_000
              ),
              scope: 'THIS_ONLY',
            });
            resetReview();
            setChangeOpen(true);
          }}
          sx={{ minHeight: 44, flex: 1 }}
        >
          {t('scheduleManagement.change')}
        </ActionButton>
        <ActionButton
          intent="danger"
          startIcon={<CalendarX2 size={16} aria-hidden="true" />}
          onClick={() => {
            setCancelScope('THIS_ONLY');
            resetReview();
            setCancelOpen(true);
          }}
          sx={{ minHeight: 44, flex: 1 }}
        >
          {t('scheduleManagement.cancel')}
        </ActionButton>
      </Stack>
      <DwpDateTimeProvider locale={i18n.language} timeZone={schedule.timeZone}>
        <FormDialog
          open={changeOpen}
          title={t('scheduleManagement.changeTitle')}
          description={t('scheduleManagement.changeDescription')}
          cancelLabel={t('actions.cancel')}
          submitLabel={
            changePreview
              ? t('scheduleManagement.applyChange')
              : t('scheduleManagement.reviewImpact')
          }
          submittingLabel={t('scheduleManagement.processing')}
          submitDisabled={Boolean(changePreview && !reviewed)}
          busy={busy}
          mobileFullScreen
          onClose={close}
          onSubmit={reviewOrApplyChange}
        >
          <Stack gap={2}>
            <DateTimePickerField
              required
              label={t('schedule.startsAt')}
              value={change.startsAt}
              disabled={busy}
              onValueChange={(startsAt) => {
                resetReview();
                setChange((current) => ({ ...current, startsAt }));
              }}
            />
            <FormField
              required
              type="number"
              label={t('schedule.duration')}
              value={change.durationMinutes}
              inputProps={{ min: 5, max: 1440 }}
              disabled={busy}
              onChange={(event) => {
                resetReview();
                setChange((current) => ({
                  ...current,
                  durationMinutes: Number(event.target.value),
                }));
              }}
            />
            <SelectField<Scope>
              label={t('scheduleManagement.scope')}
              value={change.scope}
              options={scopeOptions}
              disabled={busy}
              onValueChange={(scope) => {
                if (!scope) return;
                resetReview();
                setChange((current) => ({ ...current, scope }));
              }}
            />
            {changePreview && (
              <ScheduleChangeImpact
                preview={changePreview}
                timeZone={schedule.timeZone}
                reviewed={reviewed}
                onReviewed={setReviewed}
              />
            )}
          </Stack>
        </FormDialog>
      </DwpDateTimeProvider>
      <FormDialog
        open={cancelOpen}
        title={t('scheduleManagement.cancelTitle')}
        description={t('scheduleManagement.cancelDescription')}
        cancelLabel={t('actions.cancel')}
        submitLabel={
          cancelPreview
            ? t('scheduleManagement.confirmCancel')
            : t('scheduleManagement.reviewImpact')
        }
        submittingLabel={t('scheduleManagement.processing')}
        submitDisabled={Boolean(cancelPreview && !reviewed)}
        submitIntent="danger"
        busy={busy}
        mobileFullScreen
        onClose={close}
        onSubmit={reviewOrCancel}
      >
        <Stack gap={2}>
          <SelectField<Scope>
            label={t('scheduleManagement.scope')}
            value={cancelScope}
            options={scopeOptions}
            disabled={busy}
            onValueChange={(scope) => {
              if (!scope) return;
              resetReview();
              setCancelScope(scope);
            }}
          />
          {cancelPreview && (
            <InlineFeedback severity="warning">
              <Stack gap={1}>
                <Typography variant="body2" fontWeight="fontWeightBold">
                  {t('scheduleManagement.cancelImpact', {
                    count: cancelPreview.affectedOccurrenceCount,
                  })}
                </Typography>
                <Typography variant="caption">
                  {t('scheduleManagement.skippedImpact', {
                    count: cancelPreview.skippedImmutableOccurrenceCount,
                  })}
                </Typography>
                <Typography variant="caption">
                  {t('scheduleManagement.reconfirmationImpact', {
                    revision: cancelPreview.invitationRevision,
                  })}
                </Typography>
                <FormControlLabel
                  control={
                    <Checkbox checked={reviewed} onChange={(_, checked) => setReviewed(checked)} />
                  }
                  label={t('scheduleManagement.confirmImpact')}
                />
              </Stack>
            </InlineFeedback>
          )}
        </Stack>
      </FormDialog>
    </Stack>
  );
}

function ScheduleChangeImpact({
  preview,
  timeZone,
  reviewed,
  onReviewed,
}: {
  preview: VideoMeetingSeriesPreview;
  timeZone: string;
  reviewed: boolean;
  onReviewed: (value: boolean) => void;
}) {
  const { t, i18n } = useTranslation('meetings');
  return (
    <InlineFeedback severity={preview.hasCalendarAdjustments ? 'warning' : 'info'}>
      <Stack gap={1}>
        <Typography variant="body2" fontWeight="fontWeightBold">
          {t('scheduleManagement.changeImpact', { count: preview.occurrences.length })}
        </Typography>
        <Stack component="ol" gap={0.75} sx={{ m: 0, pl: 2.5, maxHeight: 220, overflowY: 'auto' }}>
          {preview.occurrences.map((occurrence) => (
            <Typography component="li" variant="caption" key={occurrence.occurrenceIndex}>
              <CalendarClock size={13} aria-hidden="true" />{' '}
              {formatDate(
                occurrence.startsAt,
                { dateStyle: 'medium', timeStyle: 'short', timeZone },
                resolveSupportedLocale(i18n.language)
              )}
              {occurrence.adjustment !== 'NONE'
                ? ` · ${t('scheduleWorkspace.adjustments.' + occurrence.adjustment)}`
                : ''}
            </Typography>
          ))}
        </Stack>
        <FormControlLabel
          control={<Checkbox checked={reviewed} onChange={(_, checked) => onReviewed(checked)} />}
          label={t('scheduleManagement.confirmImpact')}
        />
      </Stack>
    </InlineFeedback>
  );
}
