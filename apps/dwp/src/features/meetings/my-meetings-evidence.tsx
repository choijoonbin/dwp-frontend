import { useEffect, useRef, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react';
import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';
import { HttpError } from '@dwp-frontend/shared-utils';
import type { VideoMeetingSummary } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import {
  getVideoMeetingPreparation,
  respondVideoMeetingInvitation,
  type VideoMeetingPreparation,
} from '@dwp-frontend/shared-utils/api/video-meeting-preparation-api';
import { getVideoMeetingSchedule } from '@dwp-frontend/shared-utils/api/video-meeting-schedule-api';
import Stack from '@mui/material/Stack';
import { type MyMeetingEvidence } from './my-meetings-model';

/** Bounded enrichment of the current authorized server page; failed reads never reuse stale data. */
export function useMyMeetingsEvidence(items: VideoMeetingSummary[], scope: string) {
  const preparations = useQueries({
    queries: items.map((meeting) => ({
      queryKey: ['meetings', 'mine-evidence', scope, meeting.meetingId, 'preparation'],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        getVideoMeetingPreparation(meeting.meetingId, signal),
      staleTime: 30_000,
      gcTime: 0,
      retry: false,
      meta: { accessSensitive: true },
    })),
  });
  const schedules = useQueries({
    queries: items.map((meeting) => ({
      queryKey: ['meetings', 'mine-evidence', scope, meeting.meetingId, 'schedule'],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        getVideoMeetingSchedule(meeting.meetingId, signal),
      staleTime: 30_000,
      gcTime: 0,
      retry: false,
      meta: { accessSensitive: true },
    })),
  });
  const evidence: Record<string, MyMeetingEvidence> = {};
  items.forEach((meeting, index) => {
    const preparation = preparations[index];
    const schedule = schedules[index];
    evidence[meeting.meetingId] = {
      preparation: preparation.isError ? undefined : preparation.data,
      schedule: schedule.isError ? undefined : schedule.data,
      loading: preparation.isLoading || schedule.isLoading,
      failed: preparation.isError || schedule.isError,
    };
  });
  return {
    evidence,
    refresh: async () =>
      Promise.all([
        ...preparations.map((query) => query.refetch({ throwOnError: true })),
        ...schedules.map((query) => query.refetch({ throwOnError: true })),
      ]),
  };
}

export function MyMeetingResponseActions({
  meetingId,
  preparation,
  onChanged,
}: {
  meetingId: string;
  preparation: VideoMeetingPreparation;
  onChanged: () => Promise<unknown>;
}) {
  const { t } = useTranslation('meetings');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<'conflict' | 'revoked' | 'command' | null>(null);
  const [saved, setSaved] = useState(false);
  const mounted = useRef(false);
  const inFlight = useRef(false);
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const respond = async (response: 'ACCEPTED' | 'DECLINED') => {
    if (inFlight.current || failure || saved || !preparation.canRespond || !preparation.myResponse)
      return;
    const fingerprint = JSON.stringify([
      meetingId,
      response,
      preparation.invitationRevision,
      preparation.myResponse.version,
    ]);
    if (attempt.current?.fingerprint !== fingerprint)
      attempt.current = { fingerprint, key: crypto.randomUUID() };
    inFlight.current = true;
    setBusy(true);
    try {
      await respondVideoMeetingInvitation(
        meetingId,
        response,
        preparation.invitationRevision,
        preparation.myResponse.version,
        attempt.current.key
      );
      if (!mounted.current) return;
      setSaved(true);
      await onChanged();
    } catch (error) {
      if (!mounted.current) return;
      setFailure(
        error instanceof HttpError && [401, 403, 404].includes(error.status)
          ? 'revoked'
          : error instanceof HttpError && error.status === 409
            ? 'conflict'
            : 'command'
      );
    } finally {
      if (mounted.current) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  };
  return (
    <Stack gap={1}>
      {saved ? (
        <InlineFeedback severity="success">{t('preparation.responseSaved')}</InlineFeedback>
      ) : (
        <>
          {failure && (
            <InlineFeedback severity="warning">
              {t('scheduleManagement.errors.' + failure)}
            </InlineFeedback>
          )}
          {failure && failure !== 'revoked' ? (
            <ActionButton
              intent="secondary"
              disabled={busy}
              onClick={() => {
                if (inFlight.current) return;
                inFlight.current = true;
                setBusy(true);
                void onChanged()
                  .then(() => {
                    if (mounted.current) setFailure(null);
                  })
                  .catch(() => {
                    if (mounted.current) setFailure('command');
                  })
                  .finally(() => {
                    if (mounted.current) {
                      inFlight.current = false;
                      setBusy(false);
                    }
                  });
              }}
            >
              {t('actions.retry')}
            </ActionButton>
          ) : (
            <Stack direction="row" gap={1}>
              <ActionButton
                intent="primary"
                fullWidth
                disabled={busy || Boolean(failure)}
                startIcon={<Check size={16} aria-hidden="true" />}
                onClick={() => void respond('ACCEPTED')}
              >
                {t('preparation.responseActions.ACCEPTED')}
              </ActionButton>
              <ActionButton
                intent="secondary"
                fullWidth
                disabled={busy || Boolean(failure)}
                startIcon={<X size={16} aria-hidden="true" />}
                onClick={() => void respond('DECLINED')}
              >
                {t('preparation.responseActions.DECLINED')}
              </ActionButton>
            </Stack>
          )}
        </>
      )}
    </Stack>
  );
}
