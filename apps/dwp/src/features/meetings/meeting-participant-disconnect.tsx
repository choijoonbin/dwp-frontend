import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ActionButton, ConfirmDialog, InlineFeedback } from '@dwp-frontend/design-system';
import { HttpError } from '@dwp-frontend/shared-utils';
import { disconnectVideoMeetingParticipant } from '@dwp-frontend/shared-utils/api/video-meeting-moderation-api';
import type { VideoMeetingParticipant } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import { useProductActionMutation } from '../../components/use-product-action-mutation';

export function MeetingParticipantDisconnect({
  meetingId,
  authorizationScope,
  participant,
}: {
  meetingId: string;
  authorizationScope: string;
  participant: VideoMeetingParticipant;
}) {
  const { t } = useTranslation('meetings');
  const client = useQueryClient();
  const authorizeDisconnect = useProductActionMutation(
    'route.meetings.work.participant-disconnect.action'
  );
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | 'pending' | 'done' | 'error' | 'stale'>(
    'idle'
  );
  const intent = useRef<{ key: string; version: number } | null>(null);
  const mounted = useRef(true);
  const sending = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const active = useRef({
    scope: authorizationScope,
    meetingId,
    participantId: participant.participantId,
    mounted: true,
  });
  const current = {
    scope: authorizationScope,
    meetingId,
    participantId: participant.participantId,
    mounted: true,
  };
  active.current = current;
  useEffect(() => {
    mounted.current = true;
    sending.current = false;
    intent.current = null;
    setOpen(false);
    setState('idle');
    setRefreshing(false);
    return () => {
      mounted.current = false;
    };
  }, [authorizationScope, meetingId, participant.participantId]);
  useEffect(() => {
    if (state !== 'stale' || participant.version === intent.current?.version) return;
    intent.current = null;
    sending.current = false;
    setOpen(false);
    setState(participant.attendanceState === 'DENIED' ? 'pending' : 'idle');
  }, [participant.attendanceState, participant.version, state]);
  const submit = async () => {
    if (sending.current) return;
    sending.current = true;
    const owner = active.current;
    const command = intent.current ?? { key: crypto.randomUUID(), version: participant.version };
    intent.current = command;
    setState('sending');
    const owns = () =>
      mounted.current &&
      active.current.scope === owner.scope &&
      active.current.meetingId === owner.meetingId &&
      active.current.participantId === owner.participantId;
    try {
      const receipt = await authorizeDisconnect((authority) =>
        disconnectVideoMeetingParticipant(
          meetingId,
          participant.participantId,
          command.version,
          command.key,
          authority
        )
      );
      if (!owns()) return;
      setState(receipt.state === 'DISCONNECTED' ? 'done' : 'pending');
      setOpen(false);
      await client.invalidateQueries({ queryKey: ['meetings', meetingId] });
    } catch (error) {
      if (!owns()) return;
      setOpen(false);
      setState(
        error instanceof HttpError && [401, 403, 404, 409].includes(error.status)
          ? 'stale'
          : 'error'
      );
      if (error instanceof HttpError && [401, 403, 404, 409].includes(error.status)) {
        void client.invalidateQueries({ queryKey: ['meetings', meetingId] });
      }
    } finally {
      if (owns()) sending.current = false;
    }
  };
  const refresh = async () => {
    if (refreshing || sending.current) return;
    const owner = active.current;
    setRefreshing(true);
    try {
      await client.refetchQueries({ queryKey: ['meetings', meetingId] }, { throwOnError: true });
      if (
        mounted.current &&
        active.current.scope === owner.scope &&
        active.current.meetingId === owner.meetingId &&
        active.current.participantId === owner.participantId
      ) {
        intent.current = null;
        setState('idle');
      }
    } catch {
      // Keep the stale state until a current meeting projection is available.
    } finally {
      if (
        mounted.current &&
        active.current.scope === owner.scope &&
        active.current.meetingId === owner.meetingId &&
        active.current.participantId === owner.participantId
      ) {
        setRefreshing(false);
      }
    }
  };
  return (
    <>
      <ActionButton
        intent="quiet"
        sx={{ minHeight: 44 }}
        disabled={state === 'sending' || state === 'done' || state === 'stale'}
        onClick={() => setOpen(true)}
        aria-label={t('room.moderation.disconnectNamed', { name: participant.displayName })}
      >
        {t(state === 'done' ? 'room.moderation.disconnected' : 'room.moderation.disconnect')}
      </ActionButton>
      {(state === 'pending' || state === 'error' || state === 'stale') && (
        <InlineFeedback severity={state === 'pending' ? 'info' : 'warning'}>
          {t(`room.moderation.${state}`)}
          <ActionButton
            intent="quiet"
            loading={state === 'stale' && refreshing}
            onClick={() => void (state === 'stale' ? refresh() : submit())}
            sx={{ minHeight: 44 }}
          >
            {t(state === 'stale' ? 'actions.refresh' : 'actions.retry')}
          </ActionButton>
        </InlineFeedback>
      )}
      <ConfirmDialog
        open={open}
        title={t('room.moderation.title')}
        description={t('room.moderation.description', { name: participant.displayName })}
        confirmLabel={t('room.moderation.disconnect')}
        cancelLabel={t('actions.cancel')}
        onClose={() => {
          if (state !== 'sending') setOpen(false);
        }}
        onConfirm={() => void submit()}
        busy={state === 'sending'}
        intent="danger"
        focusCancelAfterOpen
        minimumActionHeight={44}
        keepTitleWords
      />
    </>
  );
}
