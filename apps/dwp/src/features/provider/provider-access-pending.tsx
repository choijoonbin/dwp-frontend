import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PageCanvas } from '@dwp-frontend/design-system/components/page-canvas/page-canvas';
import { GuidedEmptyState } from '@dwp-frontend/design-system/components/states/state-panels';

/** Durable Provider plane is accepted, but no Provider role is inferred from the plane alone. */
export function ProviderAccessPending() {
  const { t } = useTranslation('provider');
  const navigate = useNavigate();
  return (
    <PageCanvas>
      <GuidedEmptyState
        kind="permission"
        title={t('accessPending.title')}
        description={t('accessPending.description')}
        actionLabel={t('accessPending.accountAction')}
        onAction={() => navigate('/account/settings/appearance')}
        size="standard"
      />
    </PageCanvas>
  );
}
