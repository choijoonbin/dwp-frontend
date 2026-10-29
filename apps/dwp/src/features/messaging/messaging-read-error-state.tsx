import { useTranslation } from 'react-i18next';
import { ErrorState } from '@dwp-frontend/design-system';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';

import type { ErrorStateProps } from '@dwp-frontend/design-system';

export type MessagingReadFailure = 'offline' | 'permission' | 'unavailable';

export function classifyMessagingReadFailure(error: unknown): MessagingReadFailure {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
  if (error instanceof HttpTransportError && error.reason === 'NETWORK') return 'offline';
  if (error instanceof HttpError && (error.status === 401 || error.status === 403)) {
    return 'permission';
  }
  return 'unavailable';
}

export function MessagingReadErrorState({
  error,
  title,
  retrying,
  onRetry,
  size = 'compact',
}: {
  error: unknown;
  title: string;
  retrying: boolean;
  onRetry: () => void;
  size?: ErrorStateProps['size'];
}) {
  const { t } = useTranslation('messaging');
  const failure = classifyMessagingReadFailure(error);

  return (
    <ErrorState
      title={title}
      description={t(`readFailure.${failure}`)}
      retryLabel={t('actions.retry')}
      retrying={retrying}
      onRetry={onRetry}
      size={size}
    />
  );
}
