import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Clock3, ListChecks, MonitorUp, ShieldCheck, Vote } from 'lucide-react';
import { getVideoMeetingFacilitation } from '@dwp-frontend/shared-utils/api/video-meeting-facilitation-api';

import { facilitationPollingInterval } from './meeting-live-facilitation-model';

export function MeetingStageWaiting() {
  const { t } = useTranslation('meetings');
  return (
    <div className="dwp-meeting-stage-waiting" data-testid="meeting-stage-waiting">
      <div className="dwp-meeting-stage-waiting__label">
        <MonitorUp size={16} aria-hidden="true" />
        <span>{t('room.design.stage')}</span>
      </div>
      <div className="dwp-meeting-stage-waiting__content">
        <div className="dwp-meeting-stage-waiting__icon">
          <MonitorUp size={32} aria-hidden="true" />
        </div>
        <h2>{t('room.design.waitingTitle')}</h2>
        <p>{t('room.design.waitingDescription')}</p>
      </div>
      <div className="dwp-meeting-stage-waiting__footer">
        <ShieldCheck size={16} aria-hidden="true" />
        <span>{t('room.design.mediaBoundary')}</span>
      </div>
    </div>
  );
}

export function MeetingRoomLiveSummary({
  meetingId,
  onOpenAgenda,
  enabled,
}: {
  meetingId: string;
  onOpenAgenda: () => void;
  enabled: boolean;
}) {
  const { t } = useTranslation('meetings');
  const snapshot = useQuery({
    enabled,
    queryKey: ['meetings', meetingId, 'live-facilitation'],
    queryFn: () => getVideoMeetingFacilitation(meetingId),
    refetchInterval: (query) =>
      query.state.status === 'error' ? false : facilitationPollingInterval(query.state.data),
    retry: false,
    gcTime: 0,
    meta: { accessSensitive: true },
  });
  if (!snapshot.data || snapshot.isError) return null;
  const data = snapshot.data;
  const poll = data.polls.find((item) => item.state === 'OPEN');
  const activeTimer = data.timer.state === 'RUNNING' || data.timer.state === 'PAUSED';
  return (
    <div className="dwp-meeting-live-summary" data-testid="meeting-live-summary">
      <div className="dwp-meeting-live-summary__icon">
        {poll ? <Vote size={22} aria-hidden="true" /> : <ListChecks size={22} aria-hidden="true" />}
      </div>
      <div className="dwp-meeting-live-summary__text">
        <strong>
          {poll?.question ?? data.timer.agendaItemTitle ?? t('room.rail.agenda.interactiveTitle')}
        </strong>
        <span>
          {poll ? (
            t('room.design.votes', { count: poll.totalVotes })
          ) : activeTimer ? (
            <>
              <Clock3 size={12} aria-hidden="true" />{' '}
              {t('units.minutes', { count: Math.ceil((data.timer.remainingSeconds ?? 0) / 60) })}
            </>
          ) : (
            t('room.design.openToolsHint')
          )}
        </span>
      </div>
      <button type="button" onClick={onOpenAgenda}>
        {t(poll ? 'room.design.openPoll' : 'room.controls.agenda')}
      </button>
    </div>
  );
}
