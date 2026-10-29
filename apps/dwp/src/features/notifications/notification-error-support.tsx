import { useCallback, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '@dwp-frontend/design-system/components/actions/action-button';
import { LocalErrorState } from '@dwp-frontend/design-system/components/states/state-panels';
import { foundationTokens } from '@dwp-frontend/design-system/foundation/tokens';
import { useToast } from '@dwp-frontend/shared-utils/toast/toast-store';

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  firstNotificationSupportId,
  notificationRouteSupportId,
} from './notification-route-error-support';

type ClipboardWriter = Pick<Clipboard, 'writeText'>;

export async function copyNotificationSupportId(
  supportId: string,
  clipboard: ClipboardWriter | null | undefined = globalThis.navigator?.clipboard
): Promise<boolean> {
  if (!clipboard?.writeText) return false;
  try {
    await clipboard.writeText(supportId);
    return true;
  } catch {
    return false;
  }
}

function supportIdFor(error: unknown | readonly unknown[]): string | null {
  return Array.isArray(error)
    ? firstNotificationSupportId(error)
    : notificationRouteSupportId(error);
}

function useNotificationSupportReference(error: unknown | readonly unknown[]) {
  const { t } = useTranslation('notifications');
  const toast = useToast();
  const supportId = supportIdFor(error);
  const copy = useCallback(() => {
    if (!supportId) return;
    void copyNotificationSupportId(supportId).then((copied) => {
      if (copied) toast.success(t('feedback.supportIdCopied'));
      else toast.error(t('feedback.supportIdCopyFailed'));
    });
  }, [supportId, t, toast]);
  return { supportId, copy };
}

type NotificationErrorStateProps = Omit<
  ComponentProps<typeof LocalErrorState>,
  'requestIdLabel' | 'supportLabel' | 'onSupport'
> & {
  error: unknown | readonly unknown[];
};

export function NotificationErrorState({ error, ...props }: NotificationErrorStateProps) {
  const { t } = useTranslation('notifications');
  const { supportId, copy } = useNotificationSupportReference(error);
  return (
    <LocalErrorState
      {...props}
      requestIdLabel={supportId ? t('support.idLabel', { supportId }) : undefined}
      supportLabel={supportId ? t('actions.copySupportId') : undefined}
      onSupport={supportId ? copy : undefined}
    />
  );
}

export function NotificationSupportReference({ error }: { error: unknown | readonly unknown[] }) {
  const { t } = useTranslation('notifications');
  const { supportId, copy } = useNotificationSupportReference(error);
  if (!supportId) return null;
  return (
    <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontFamily: foundationTokens.font.mono, overflowWrap: 'anywhere' }}
      >
        {t('support.idLabel', { supportId })}
      </Typography>
      <ActionButton intent="quiet" size="small" onClick={copy}>
        {t('actions.copySupportId')}
      </ActionButton>
    </Stack>
  );
}
