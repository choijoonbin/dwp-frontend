import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import {
  applyNotificationBulkAction,
  createNotificationIdempotencyKey,
  undoNotificationBulkAction,
  type NotificationTriageAction,
} from '@dwp-frontend/shared-utils/api/notification-api';
import { useToast } from '@dwp-frontend/shared-utils';

import { defaultSnoozeTime } from './notification-model';

type UndoReceipt = { token: string; expiresAt: string };

export function useNotificationBulkActions({
  selectedIds,
  setSelectedIds,
  refresh,
}: {
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  refresh: () => Promise<void>;
}) {
  const { t } = useTranslation('notifications');
  const toast = useToast();
  const [undoReceipt, setUndoReceipt] = useState<UndoReceipt | null>(null);

  useEffect(() => {
    if (!undoReceipt) return;
    const remaining = Math.max(0, new Date(undoReceipt.expiresAt).getTime() - Date.now());
    const timeout = window.setTimeout(() => setUndoReceipt(null), remaining);
    return () => window.clearTimeout(timeout);
  }, [undoReceipt]);

  const bulkMutation = useMutation({
    mutationFn: async (
      action: Extract<NotificationTriageAction, 'READ' | 'SAVE' | 'SNOOZE' | 'COMPLETE'>
    ) => {
      const result = await applyNotificationBulkAction({
        notificationIds: [...selectedIds],
        action,
        snoozedUntil: action === 'SNOOZE' ? defaultSnoozeTime(4) : undefined,
        idempotencyKey: createNotificationIdempotencyKey(
          `center-selection-${action.toLowerCase()}`
        ),
      });
      const failedIds = result.results
        .filter((item) => item.outcome !== 'APPLIED' && item.outcome !== 'ALREADY_APPLIED')
        .map((item) => item.notificationId);
      return { result, failedIds };
    },
    onSuccess: async ({ result, failedIds }) => {
      setSelectedIds(new Set(failedIds));
      setUndoReceipt(
        result.undoToken &&
          result.undoExpiresAt &&
          new Date(result.undoExpiresAt).getTime() > Date.now()
          ? { token: result.undoToken, expiresAt: result.undoExpiresAt }
          : null
      );
      await refresh();
      toast.success(
        failedIds.length > 0
          ? t('feedback.bulkPartial', { count: failedIds.length })
          : t('feedback.bulkSuccess', { count: result.results.length })
      );
    },
    onError: () => toast.error(t('feedback.bulkError')),
  });

  const undoMutation = useMutation({
    mutationFn: (token: string) =>
      undoNotificationBulkAction(token, createNotificationIdempotencyKey('center-selection-undo')),
    onSuccess: async (result) => {
      const failedIds = result.results
        .filter((item) => item.outcome !== 'APPLIED' && item.outcome !== 'ALREADY_APPLIED')
        .map((item) => item.notificationId);
      setSelectedIds(new Set(failedIds));
      setUndoReceipt(null);
      await refresh();
      toast.success(
        failedIds.length > 0
          ? t('feedback.bulkUndoPartial', { count: failedIds.length })
          : t('feedback.bulkUndoSuccess', { count: result.results.length })
      );
    },
    onError: () => {
      toast.error(t('feedback.bulkUndoError'));
    },
  });

  return {
    bulkMutation,
    undoMutation,
    undoReceipt,
    dismissUndo: () => setUndoReceipt(null),
  };
}
