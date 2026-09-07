import { visibleHcmNavigation } from '../features/hcm/hcm-navigation';
import { HCM_PRODUCT_MANIFEST } from '../features/hcm/hcm-product-manifest';
import { canAccessLegacyHcmSurface, useHcmAccess } from '../features/hcm/hcm-surface-access';
import { ProductAreaLayout } from './product-area-layout';

import type { HcmLegacySurfaceId } from '../features/hcm/hcm-surface-access';

export function HcmLayout() {
  const access = useHcmAccess();
  const navigation = visibleHcmNavigation({
    isManager: access.isManager,
    canOperate: access.canOperate,
    canManageTime: access.canManageTime,
    canManageAbsence: access.canManageAbsence,
    canManageBenefits: access.canManageBenefits,
    canManagePay: access.canManagePay,
    canManageTalent: access.canManageTalent,
    canAccessOperationsOverview: access.canAccessOperationsOverview,
    canAccessOrganizationDesign: access.canAccessOrganizationDesign,
    canAccessReferenceData: access.canAccessReferenceData,
    canAccessDataOperations: access.canAccessDataOperations,
    canAccessExports: access.canAccessExports,
  });

  return (
    <ProductAreaLayout
      areaKey="hcm"
      manifest={HCM_PRODUCT_MANIFEST}
      navigation={navigation}
      translationNamespace="hcm"
      canAccessLegacySurface={(surface) =>
        canAccessLegacyHcmSurface(surface.id as HcmLegacySurfaceId, {
          canAccessPersonal: access.canAccessPersonal,
          isManager: access.isManager,
          canAccessOperationsOverview: access.canAccessOperationsOverview,
          canAccessOrganizationDesign: access.canAccessOrganizationDesign,
          canAccessReferenceData: access.canAccessReferenceData,
          canAccessDataOperations: access.canAccessDataOperations,
          canAccessExports: access.canAccessExports,
        })
      }
    />
  );
}
