import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { MessagingMeetingLabels } from './messaging-meeting-dialog';

export function useMessagingMeetingLabels() {
  const { t } = useTranslation('messaging');

  return useMemo<MessagingMeetingLabels>(
    () => ({
      title: t('conversation.meetingDialog.title'),
      description: t('conversation.meetingDialog.description'),
      close: t('actions.close'),
      loading: t('conversation.meetingDialog.loading'),
      unavailable: t('conversation.meetingDialog.unavailable'),
      active: t('conversation.meetingDialog.active'),
      ready: t('conversation.meetingDialog.ready'),
      start: t('conversation.meetingDialog.start'),
      join: t('conversation.meetingDialog.join'),
      preparing: t('conversation.meetingDialog.preparing'),
      retry: t('actions.retry'),
      joinLabel: t('conversation.meetingDialog.joinLabel'),
      microphone: t('conversation.meetingDialog.microphone'),
      camera: t('conversation.meetingDialog.camera'),
      displayName: t('conversation.meetingDialog.displayName'),
      error: t('conversation.meetingDialog.error'),
      live: t('conversation.meetingDialog.live'),
      connecting: t('conversation.meetingDialog.connecting'),
      connectionError: t('conversation.meetingDialog.connectionError'),
      permissionError: t('conversation.meetingDialog.permissionError'),
      disconnected: t('conversation.meetingDialog.disconnected'),
      endForEveryone: t('conversation.meetingDialog.endForEveryone'),
      ending: t('conversation.meetingDialog.ending'),
    }),
    [t]
  );
}
