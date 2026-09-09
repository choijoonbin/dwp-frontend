import { lazy, Suspense } from 'react';
import { DwpDatePickerProvider } from '@dwp-frontend/design-system/enterprise/date-time/date-picker-provider';

import { ProductRouteGuard, RouteFallback } from '../../routes/route-support';

const CalendarSchedule = lazy(() =>
  import('../../features/calendar/calendar-schedule').then((module) => ({
    default: module.CalendarSchedule,
  }))
);

/**
 * Calendar work surface used when work and meeting context are reviewed together.
 * It keeps the real Calendar API and authorization boundary while retaining the
 * `/work/calendar` context required by the global assistant handoff.
 */
export default function DwaionWorkCalendarContext() {
  return (
    <ProductRouteGuard resourceKey="APP.CALENDAR" permissionCode="VIEW" localDeny>
      <DwpDatePickerProvider>
        <Suspense fallback={<RouteFallback />}>
          <CalendarSchedule />
        </Suspense>
      </DwpDatePickerProvider>
    </ProductRouteGuard>
  );
}
