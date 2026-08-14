import { CALENDAR_NAVIGATION } from '../features/calendar/calendar-navigation';
import { ProductAreaLayout } from './product-area-layout';

export function CalendarLayout() {
  return (
    <ProductAreaLayout
      areaKey="calendar"
      navigation={CALENDAR_NAVIGATION}
      translationNamespace="calendar"
    />
  );
}
