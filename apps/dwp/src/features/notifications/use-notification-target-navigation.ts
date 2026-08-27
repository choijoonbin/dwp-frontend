import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HttpError, resolveNotificationTarget, useToast } from '@dwp-frontend/shared-utils';

const ENCODED_AUTHORITY_SEPARATOR = /(^\/%2f|%5c)/i;

export function normalizeNotificationTargetHref(
  href: string,
  baseHref = window.location.href
): string | null {
  if (
    !href.startsWith('/') ||
    href.startsWith('//') ||
    href.includes('\\') ||
    ENCODED_AUTHORITY_SEPARATOR.test(href) ||
    [...href].some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    })
  ) {
    return null;
  }
  try {
    const base = new URL(baseHref);
    const target = new URL(href, base);
    if (target.origin !== base.origin || !['http:', 'https:'].includes(target.protocol))
      return null;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return null;
  }
}

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
        const normalizedHref = normalizeNotificationTargetHref(href);
        if (!normalizedHref) throw new Error('The notification target route is unsafe.');
        if (onOpenTarget) onOpenTarget(normalizedHref);
        else window.location.assign(normalizedHref);
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
