import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HttpError, resolveNotificationTarget, useToast } from '@dwp-frontend/shared-utils';

export function useNotificationTargetNavigation(
  onOpenTarget?: (href: string) => void,
  onUnavailable?: () => void
) {
  const { t } = useTranslation('notifications');
  const toast = useToast();
  const [openingId, setOpeningId] = useState<string | null>(null);

  const openTarget = useCallback(
    async (notificationId: string) => {
      if (openingId) return;
      setOpeningId(notificationId);
      try {
        const resolution = await resolveNotificationTarget(notificationId);
        const href = resolution.action.href;
        if (!href) throw new Error('The notification target did not include a route.');
        if (onOpenTarget) onOpenTarget(href);
        else window.location.assign(href);
      } catch (error) {
        if (error instanceof HttpError && error.status === 410) {
          toast.warning(t('feedback.targetUnavailable'));
          onUnavailable?.();
        } else {
          toast.error(t('feedback.targetOpenError'));
        }
      } finally {
        setOpeningId(null);
      }
    },
    [onOpenTarget, onUnavailable, openingId, t, toast]
  );

  return { openTarget, openingId };
}
