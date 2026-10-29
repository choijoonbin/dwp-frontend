import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  createNotificationIdempotencyKey,
  getNotificationDeliveryProfile,
  updateNotificationDeliveryProfile,
  type NotificationDeliveryProfile,
} from '@dwp-frontend/shared-utils/api/notification-api';
import { useToast } from '@dwp-frontend/shared-utils';

import { notificationQueryKeys } from './integration-contract';
import {
  isNotificationPreferenceConflict,
  rebaseNotificationDeliveryProfile,
} from './notification-preference-save-policy';
import {
  createLatestNotificationProfileSaveQueue,
  type NotificationProfileSaveQueueOptions,
} from './notification-preference-save-queue';

export type NotificationProfileSaveState = 'idle' | 'saving' | 'saved' | 'recovered' | 'error';

export function useNotificationProfileSaveController({
  profile,
  scheduleTimeZone,
  online,
  onDraftChange,
  onSaveStateChange,
  refetchProfile,
}: {
  profile?: NotificationDeliveryProfile;
  scheduleTimeZone: string;
  online: boolean;
  onDraftChange: (profile: NotificationDeliveryProfile) => void;
  onSaveStateChange: (state: NotificationProfileSaveState) => void;
  refetchProfile: () => void;
}) {
  const { t } = useTranslation('notifications');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [lastError, setLastError] = useState<unknown>(null);
  const persistedProfileRef = useRef<NotificationDeliveryProfile | null>(null);
  const unsavedProfileIntentRef = useRef(false);
  const timeZoneSyncAttemptRef = useRef<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    persistedProfileRef.current = profile;
    if (!unsavedProfileIntentRef.current) onDraftChange(profile);
  }, [onDraftChange, profile]);

  const callbacksRef = useRef<NotificationProfileSaveQueueOptions | null>(null);
  callbacksRef.current = {
    persist: async (next) => {
      const base = persistedProfileRef.current ?? next;
      try {
        return {
          saved: await updateNotificationDeliveryProfile(
            next,
            createNotificationIdempotencyKey('delivery-profile')
          ),
          recovered: false,
        };
      } catch (error) {
        if (!isNotificationPreferenceConflict(error)) throw error;
        const latest = await getNotificationDeliveryProfile();
        const rebased = rebaseNotificationDeliveryProfile(base, next, latest);
        return {
          saved: await updateNotificationDeliveryProfile(
            rebased,
            createNotificationIdempotencyKey('delivery-profile-retry')
          ),
          recovered: true,
        };
      }
    },
    onBusyChange: setPending,
    onSuccess: ({ saved, recovered }, { latest }) => {
      persistedProfileRef.current = saved;
      queryClient.setQueryData(notificationQueryKeys.preferences(), saved);
      void queryClient.invalidateQueries({ queryKey: notificationQueryKeys.effectiveSettings() });
      if (!latest) return;
      setLastError(null);
      unsavedProfileIntentRef.current = false;
      onDraftChange(saved);
      onSaveStateChange(recovered ? 'recovered' : 'saved');
      if (recovered) toast.success(t('preferences.feedback.conflictRecovered'));
    },
    onError: (error, { latest }) => {
      if (!latest) return;
      setLastError(error);
      onSaveStateChange('error');
      toast.error(t('preferences.feedback.profileError'));
      refetchProfile();
      void queryClient.invalidateQueries({ queryKey: notificationQueryKeys.effectiveSettings() });
    },
  };

  const queueRef = useRef<ReturnType<typeof createLatestNotificationProfileSaveQueue> | null>(null);
  if (!queueRef.current) {
    queueRef.current = createLatestNotificationProfileSaveQueue({
      persist: (next) => callbacksRef.current!.persist(next),
      onBusyChange: (busy) => callbacksRef.current!.onBusyChange(busy),
      onSuccess: (outcome, context) => callbacksRef.current!.onSuccess(outcome, context),
      onError: (error, context) => callbacksRef.current!.onError(error, context),
    });
  }
  useEffect(
    () => () => {
      queueRef.current?.dispose();
    },
    []
  );

  const saveProfile = useCallback(
    (next: NotificationDeliveryProfile) => {
      const synchronized = {
        ...next,
        quietHours: { ...next.quietHours, timeZone: scheduleTimeZone },
      };
      unsavedProfileIntentRef.current = true;
      setLastError(null);
      onDraftChange(synchronized);
      onSaveStateChange('saving');
      queueRef.current?.enqueue(synchronized);
    },
    [onDraftChange, onSaveStateChange, scheduleTimeZone]
  );

  useEffect(() => {
    const syncKey = profile ? `${profile.version}:${scheduleTimeZone}` : null;
    if (
      !profile ||
      !online ||
      pending ||
      profile.quietHours.timeZone === scheduleTimeZone ||
      timeZoneSyncAttemptRef.current === syncKey
    ) {
      return;
    }
    timeZoneSyncAttemptRef.current = syncKey;
    saveProfile({
      ...profile,
      quietHours: { ...profile.quietHours, timeZone: scheduleTimeZone },
    });
  }, [online, pending, profile, saveProfile, scheduleTimeZone]);

  return { pending, saveProfile, lastError };
}
