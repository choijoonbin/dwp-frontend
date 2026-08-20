import { WORK_NAVIGATION } from '../features/work/work-navigation';
import { ProductAreaLayout } from './product-area-layout';

export function WorkLayout() {
  return (
    <ProductAreaLayout areaKey="work" navigation={WORK_NAVIGATION} translationNamespace="work" />
  );
}
