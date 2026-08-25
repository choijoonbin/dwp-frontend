import { useTranslation } from 'react-i18next';
import { GuidedEmptyState } from '@dwp-frontend/design-system/components/states/state-panels';

/** Keeps an unknown product URL inside its current Work or Management shell. */
export function ProductSurfaceLocalNotFound() {
  const { t } = useTranslation('common');
  return (
    <div data-testid="product-surface-local-not-found">
      <GuidedEmptyState
        kind="empty"
        title={t('productSurface.notFound.title')}
        description={t('productSurface.notFound.description')}
        size="page"
      />
    </div>
  );
}
