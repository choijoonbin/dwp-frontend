import { useTranslation } from 'react-i18next';
import { ErrorState, LoadingState } from '@dwp-frontend/design-system';

export function ManagementPanelLoading({ label }: { label: string }) {
  return <LoadingState label={label} size="page" />;
}

export function ManagementPanelError({
  message,
  retryLabel,
  onRetry,
  retrying,
}: {
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const { t } = useTranslation('common');
  return (
    <ErrorState
      title={t('error.loadFailed')}
      description={message}
      retryLabel={retryLabel}
      onRetry={onRetry}
      retrying={retrying}
      size="standard"
    />
  );
}
