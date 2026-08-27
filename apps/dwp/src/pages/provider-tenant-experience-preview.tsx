import { Navigate, useParams } from 'react-router-dom';
import { PageCanvas } from '@dwp-frontend/design-system';

import { ProviderTenantExperiencePreview } from '../features/provider/provider-tenant-experience-preview';

export default function ProviderTenantExperiencePreviewPage() {
  const { tenantId } = useParams();
  if (!tenantId) return <Navigate to="/provider/tenants" replace />;
  return (
    <PageCanvas>
      <ProviderTenantExperiencePreview tenantId={tenantId} />
    </PageCanvas>
  );
}
