import { ACTIVITY_NAVIGATION } from '../features/activity/activity-navigation';
import { ProductAreaLayout } from './product-area-layout';

export function ActivityLayout() {
  return (
    <ProductAreaLayout
      areaKey="activity"
      navigation={ACTIVITY_NAVIGATION}
      translationNamespace="work"
    />
  );
}
