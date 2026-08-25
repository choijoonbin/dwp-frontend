import { useLocation } from 'react-router-dom';
import { DwpDatePickerProvider } from '@dwp-frontend/design-system/enterprise/date-time/date-picker-provider';

import { CalendarAdminOverview, CalendarAdminPolicies } from '../features/calendar/calendar-admin';
import { ProductSurfaceLocalNotFound } from '../components/product-surface-local-not-found';
import { CalendarAvailability } from '../features/calendar/calendar-availability';
import { CalendarHome } from '../features/calendar/calendar-home';
import { CalendarInsights } from '../features/calendar/calendar-insights';
import { findCalendarNavigationItem } from '../features/calendar/calendar-navigation';
import { CalendarSchedule } from '../features/calendar/calendar-schedule';
import { ProductAreaNavigationItemAccessGuard } from '../layouts/product-area-navigation-access-guard';

export default function CalendarPage() {
  const { pathname } = useLocation();
  const page = findCalendarNavigationItem(pathname);

  if (!page) return <ProductSurfaceLocalNotFound />;

  const content = {
    home: <CalendarHome />,
    schedule: <CalendarSchedule />,
    availability: <CalendarAvailability />,
    insights: <CalendarInsights />,
    'admin-overview': <CalendarAdminOverview />,
    'admin-policies': <CalendarAdminPolicies />,
  }[page.view];

  return (
    <ProductAreaNavigationItemAccessGuard item={page}>
      <DwpDatePickerProvider>{content}</DwpDatePickerProvider>
    </ProductAreaNavigationItemAccessGuard>
  );
}
