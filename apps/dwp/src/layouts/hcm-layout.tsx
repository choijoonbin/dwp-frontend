import { visibleHcmNavigation } from '../features/hcm/hcm-navigation';
import { useHcmExperience } from '../features/hcm/use-hcm-experience';
import { ProductAreaLayout } from './product-area-layout';

export function HcmLayout() {
  const experience = useHcmExperience();
  const navigation = visibleHcmNavigation({
    isManager: experience.isManager,
    canOperate: experience.canOperate,
    canManageTime: experience.canManageTime,
    canManageAbsence: experience.canManageAbsence,
    canManageBenefits: experience.canManageBenefits,
    canManagePay: experience.canManagePay,
    canManageTalent: experience.canManageTalent,
  });

  return <ProductAreaLayout areaKey="hcm" navigation={navigation} translationNamespace="hcm" />;
}
