import { useTranslation } from 'react-i18next';
import { LoadingState, LocalErrorState, PageCanvas } from '@dwp-frontend/design-system';

import type { ReactNode } from 'react';

export function WorkHubInitialState({
  header,
  loading,
  retrying,
  onRetry,
}: {
  header: ReactNode;
  loading: boolean;
  retrying: boolean;
  onRetry: () => void;
}) {
  const { t } = useTranslation('work');
  return (
    <PageCanvas topInset="compact">
      {header}
      {loading ? (
        <LoadingState label={t('workPage.loading')} variant="skeleton" size="page" />
      ) : (
        <LocalErrorState
          title={t('workPage.loadErrorTitle')}
          description={t('workPage.loadErrorDescription')}
          retryLabel={t('workPage.retry')}
          onRetry={onRetry}
          retrying={retrying}
          size="page"
        />
      )}
    </PageCanvas>
  );
}
