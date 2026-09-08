import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Bot, Hand, ListChecks, MessageSquareText, UsersRound, X } from 'lucide-react';
import { InlineFeedback } from '@dwp-frontend/design-system';
import { getVideoMeetingPreparation } from '@dwp-frontend/shared-utils/api/video-meeting-preparation-api';
import type { VideoMeetingEffectivePermissions } from '@dwp-frontend/shared-utils/api/video-meeting-api';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { MeetingLiveFacilitation } from './meeting-live-facilitation';
import { containMeetingOverlayTab } from './meeting-overlay-focus-boundary';
import { meetingInsetSurface } from './meeting-visual-system';

export type MeetingRoomPanel = 'agenda' | 'chat' | 'floor' | 'participants' | 'ai' | null;

export function canOpenMeetingRoomPanel(
  panel: MeetingRoomPanel,
  permissions: VideoMeetingEffectivePermissions
): boolean {
  if (panel === 'participants') return permissions.participantList;
  if (panel === 'chat') return permissions.chat;
  if (panel === 'floor') return permissions.handRaise;
  return panel === 'agenda' || panel === 'ai';
}

const RAIL_TABS = [
  { key: 'agenda', icon: ListChecks },
  { key: 'chat', icon: MessageSquareText },
  { key: 'floor', icon: Hand },
  { key: 'participants', icon: UsersRound },
  { key: 'ai', icon: Bot },
] as const;

export function MeetingRoomRailNavigation({
  activePanel,
  permissions,
  onSelect,
}: {
  activePanel: Exclude<MeetingRoomPanel, null>;
  permissions: VideoMeetingEffectivePermissions;
  onSelect: (panel: Exclude<MeetingRoomPanel, null>) => void;
}) {
  const { t } = useTranslation('meetings');
  return (
    <div className="dwp-meeting-room-rail__tabs" role="tablist" aria-label={t('room.rail.label')}>
      {RAIL_TABS.filter(({ key }) => canOpenMeetingRoomPanel(key, permissions)).map(
        ({ key, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={activePanel === key}
            aria-controls={
              key === 'chat' || key === 'floor'
                ? 'meeting-collaboration-panel'
                : key === 'participants'
                  ? 'meeting-participants-panel'
                  : `meeting-room-${key}-panel`
            }
            tabIndex={activePanel === key ? 0 : -1}
            onClick={() => onSelect(key)}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const tabs = Array.from(
                event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                  '[role="tab"]'
                ) ?? []
              );
              const currentIndex = tabs.indexOf(event.currentTarget);
              const nextIndex =
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? tabs.length - 1
                    : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) %
                      tabs.length;
              tabs[nextIndex]?.focus();
              tabs[nextIndex]?.click();
            }}
          >
            <Icon size={16} aria-hidden="true" />
            <Typography component="span" variant="caption" fontWeight="fontWeightBold">
              {t(`room.rail.tabs.${key}`)}
            </Typography>
          </button>
        )
      )}
    </div>
  );
}

export function MeetingRoomContextPanel({
  meetingId,
  kind,
  onClose,
}: {
  meetingId: string;
  kind: 'agenda' | 'ai';
  onClose: () => void;
}) {
  const { t } = useTranslation('meetings');
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const preparation = useQuery({
    queryKey: ['meetings', meetingId, 'preparation', 'facilitation'],
    queryFn: ({ signal }) => getVideoMeetingPreparation(meetingId, signal),
    enabled: kind === 'agenda',
    staleTime: 15_000,
    refetchInterval: kind === 'agenda' ? 30_000 : false,
    gcTime: 0,
    meta: { accessSensitive: true },
    retry: 1,
  });

  useEffect(() => closeRef.current?.focus(), [kind]);

  const title = t(`room.rail.tabs.${kind}`);
  return (
    <aside
      ref={panelRef}
      id={`meeting-room-${kind}-panel`}
      className="dwp-meeting-side-panel dwp-meeting-room-context"
      aria-labelledby={`meeting-room-${kind}-title`}
      onKeyDownCapture={(event) => containMeetingOverlayTab(event, panelRef.current)}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        onClose();
      }}
    >
      <header className="dwp-meeting-side-panel__header">
        <div>
          <strong id={`meeting-room-${kind}-title`}>{title}</strong>
          <small>{t(`room.rail.${kind}.description`)}</small>
        </div>
        <button
          ref={closeRef}
          type="button"
          className="dwp-meeting-side-panel__close"
          aria-label={t('actions.close')}
          title={t('actions.close')}
          onClick={onClose}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      {kind === 'agenda' ? (
        <Box className="dwp-meeting-room-context__body">
          {preparation.isLoading ? (
            <Typography role="status" variant="body2" color="text.secondary">
              {t('room.rail.agenda.loading')}
            </Typography>
          ) : preparation.isError || !preparation.data ? (
            <InlineFeedback severity="warning">{t('room.rail.agenda.unavailable')}</InlineFeedback>
          ) : preparation.data.agendaItems.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t('room.rail.agenda.empty')}
            </Typography>
          ) : (
            <Stack component="ol" gap={1} sx={{ m: 0, mb: 2, p: 0, listStyle: 'none' }}>
              {preparation.data.agendaItems.map((item, index) => (
                <Box
                  component="li"
                  key={item.itemId}
                  sx={(theme) => ({ ...meetingInsetSurface(theme), p: 1.5 })}
                >
                  <Stack direction="row" justifyContent="space-between" gap={1}>
                    <Typography variant="body2" fontWeight="fontWeightBold">
                      {String(index + 1).padStart(2, '0')} · {item.title}
                    </Typography>
                    {item.plannedMinutes != null && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ flex: '0 0 auto' }}
                      >
                        {t('units.minutes', { count: item.plannedMinutes })}
                      </Typography>
                    )}
                  </Stack>
                  {item.objective && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mt: 0.5 }}
                    >
                      {item.objective}
                    </Typography>
                  )}
                  {item.ownerDisplayName && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mt: 0.5 }}
                    >
                      {t('room.rail.agenda.owner', { name: item.ownerDisplayName })}
                    </Typography>
                  )}
                </Box>
              ))}
            </Stack>
          )}
          <MeetingLiveFacilitation meetingId={meetingId} onClose={onClose} embedded />
        </Box>
      ) : (
        <Box className="dwp-meeting-room-context__body">
          <InlineFeedback severity="info" title={t('room.rail.ai.unavailableTitle')}>
            <Typography variant="body2">{t('room.rail.ai.unavailableDescription')}</Typography>
          </InlineFeedback>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            {t('room.rail.ai.boundary')}
          </Typography>
        </Box>
      )}
    </aside>
  );
}
