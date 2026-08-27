import { CALENDAR_NAVIGATION } from '../features/calendar/calendar-navigation';
import { CALENDAR_PRODUCT_MANIFEST } from '../features/calendar/calendar-product-manifest';
import { ProductAreaLayout } from './product-area-layout';

export function CalendarLayout() {
  return (
    <ProductAreaLayout
      areaKey="calendar"
      manifest={CALENDAR_PRODUCT_MANIFEST}
      navigation={CALENDAR_NAVIGATION}
      translationNamespace="calendar"
    />
  );
}
