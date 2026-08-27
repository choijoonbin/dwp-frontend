import { useLocation } from 'react-router-dom';
import { DwpDatePickerProvider } from '@dwp-frontend/design-system/enterprise/date-time/date-picker-provider';

import { CalendarAdminOverview } from '../features/calendar/calendar-admin';
import { CalendarAdminPolicies } from '../features/calendar/calendar-admin-policies';
import { ProductSurfaceLocalNotFound } from '../components/product-surface-local-not-found';
import { CalendarAvailability } from '../features/calendar/calendar-availability';
import { CalendarFocusPlanner } from '../features/calendar/calendar-focus-planner';
import { CalendarHome } from '../features/calendar/calendar-home';
import { CalendarInsights } from '../features/calendar/calendar-insights';
import { CalendarInvitations } from '../features/calendar/calendar-invitations';
import { findCalendarNavigationItem } from '../features/calendar/calendar-navigation';
import { CalendarSchedule } from '../features/calendar/calendar-schedule';
import { CalendarTrash } from '../features/calendar/calendar-trash';
import { CalendarAdminCompanyCalendars } from '../features/calendar/calendar-admin-company-calendars';
import { ProductAreaNavigationItemAccessGuard } from '../layouts/product-area-navigation-access-guard';

export default function CalendarPage() {
  const { pathname } = useLocation();
  const page = findCalendarNavigationItem(pathname);

  if (!page) return <ProductSurfaceLocalNotFound />;

  const content = {
    home: <CalendarHome />,
    schedule: <CalendarSchedule />,
    focus: <CalendarFocusPlanner />,
    invitations: <CalendarInvitations />,
    availability: <CalendarAvailability />,
    trash: <CalendarTrash />,
    insights: <CalendarInsights />,
    'admin-overview': <CalendarAdminOverview />,
    'admin-company-calendars': <CalendarAdminCompanyCalendars />,
    'admin-policies': <CalendarAdminPolicies />,
  }[page.view];

  return (
    <ProductAreaNavigationItemAccessGuard item={page}>
      <DwpDatePickerProvider>{content}</DwpDatePickerProvider>
    </ProductAreaNavigationItemAccessGuard>
  );
}
