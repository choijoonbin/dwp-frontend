import { visibleHrisNavigation } from '../features/hris/hris-navigation';
import { useHrisExperience } from '../features/hris/use-hris-experience';
import { ProductAreaLayout } from './product-area-layout';

export function HrisLayout() {
  const experience = useHrisExperience();
  const navigation = visibleHrisNavigation({
    isManager: experience.isManager,
    canOperate: experience.canOperate,
  });

  return <ProductAreaLayout areaKey="hris" navigation={navigation} translationNamespace="hris" />;
}
