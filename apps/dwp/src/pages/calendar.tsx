import { lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { DwpDatePickerProvider } from '@dwp-frontend/design-system/enterprise/date-time/date-picker-provider';

import { ProductSurfaceLocalNotFound } from '../components/product-surface-local-not-found';
import { findCalendarNavigationItem } from '../features/calendar/calendar-navigation';
import { ProductAreaNavigationItemAccessGuard } from '../layouts/product-area-navigation-access-guard';
import { RouteFallback } from '../routes/route-support';

const CalendarHome = lazy(() =>
  import('../features/calendar/calendar-home').then((module) => ({
    default: module.CalendarHome,
  }))
);
const CalendarSchedule = lazy(() =>
  import('../features/calendar/calendar-schedule').then((module) => ({
    default: module.CalendarSchedule,
  }))
);
const CalendarFocusPlanner = lazy(() =>
  import('../features/calendar/calendar-focus-planner').then((module) => ({
    default: module.CalendarFocusPlanner,
  }))
);
const CalendarInvitations = lazy(() =>
  import('../features/calendar/calendar-invitations').then((module) => ({
    default: module.CalendarInvitations,
  }))
);
const CalendarAvailability = lazy(() =>
  import('../features/calendar/calendar-availability').then((module) => ({
    default: module.CalendarAvailability,
  }))
);
const CalendarTrash = lazy(() =>
  import('../features/calendar/calendar-trash').then((module) => ({
    default: module.CalendarTrash,
  }))
);
const CalendarInsights = lazy(() =>
  import('../features/calendar/calendar-insights').then((module) => ({
    default: module.CalendarInsights,
  }))
);
const CalendarAdminOverview = lazy(() =>
  import('../features/calendar/calendar-admin').then((module) => ({
    default: module.CalendarAdminOverview,
  }))
);
const CalendarAdminCompanyCalendars = lazy(() =>
  import('../features/calendar/calendar-admin-company-calendars').then((module) => ({
    default: module.CalendarAdminCompanyCalendars,
  }))
);
const CalendarAdminPolicies = lazy(() =>
  import('../features/calendar/calendar-admin-policies').then((module) => ({
    default: module.CalendarAdminPolicies,
  }))
);

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
      <DwpDatePickerProvider>
        <Suspense fallback={<RouteFallback />}>{content}</Suspense>
      </DwpDatePickerProvider>
    </ProductAreaNavigationItemAccessGuard>
  );
}
