import { useTranslation } from 'react-i18next';

import { ProductAdminSurface } from '../../components/product-admin-surface';
import { ServiceCatalogManager } from './service-catalog-manager';
import { ServiceOperationsManager } from './service-operations-manager';

export function ServicesAdminCatalog() {
  const { t } = useTranslation('services');
  return (
    <ProductAdminSurface
      eyebrow={t('administration.eyebrow')}
      title={t('administration.catalogTitle')}
      description={t('administration.catalogDescription')}
    >
      <ServiceCatalogManager />
    </ProductAdminSurface>
  );
}

export function ServicesAdminOperations() {
  const { t } = useTranslation('services');
  return (
    <ProductAdminSurface
      eyebrow={t('administration.eyebrow')}
      title={t('administration.operationsTitle')}
      description={t('administration.operationsDescription')}
    >
      <ServiceOperationsManager />
    </ProductAdminSurface>
  );
}
