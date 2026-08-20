import { useTranslation } from 'react-i18next';

import { ProductAdminSurface } from '../../components/product-admin-surface';
import { AnnouncementManager } from './announcement-manager';

export function CommunicationsAdminContent() {
  const { t } = useTranslation('communications');
  return (
    <ProductAdminSurface
      eyebrow={t('administration.eyebrow')}
      title={t('administration.contentTitle')}
      description={t('administration.contentDescription')}
    >
      <AnnouncementManager />
    </ProductAdminSurface>
  );
}
