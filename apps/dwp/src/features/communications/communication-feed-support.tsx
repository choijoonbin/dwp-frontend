import { useTranslation } from 'react-i18next';
import { LoadingState } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

export function storyDate(value?: string | null) {
  return value ? formatDate(value, { dateStyle: 'medium' }) : '-';
}

export function FeedLoading() {
  const { t } = useTranslation('communications');
  return (
    <LoadingState
      label={t('productHome.loading')}
      variant="skeleton"
      size="page"
      embedded
      skeletonHeights={[460, 178, 178]}
      skeletonGap={2}
    />
  );
}
