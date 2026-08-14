import { Navigate, useLocation } from 'react-router-dom';
import { DwpDatePickerProvider } from '@dwp-frontend/design-system/enterprise/date-time/date-picker-provider';
import { usePermissions } from '@dwp-frontend/shared-utils';

import {
  CalendarAdminOverview,
  CalendarAdminPolicies,
  CalendarAdminResources,
} from '../features/calendar/calendar-admin';
import { CalendarAvailability } from '../features/calendar/calendar-availability';
import { CalendarHome } from '../features/calendar/calendar-home';
import { CalendarInsights } from '../features/calendar/calendar-insights';
import {
  CALENDAR_DEFAULT_PATH,
  findCalendarNavigationItem,
} from '../features/calendar/calendar-navigation';
import { CalendarResources } from '../features/calendar/calendar-resources';
import { CalendarSchedule } from '../features/calendar/calendar-schedule';

export default function CalendarPage() {
  const { pathname } = useLocation();
  const { hasPermission } = usePermissions();
  const page = findCalendarNavigationItem(pathname);

  if (!page) return <Navigate to={CALENDAR_DEFAULT_PATH} replace />;
  if (
    page.requiredResourceKey &&
    !hasPermission(page.requiredResourceKey, page.requiredPermissionCode)
  ) {
    return <Navigate to={CALENDAR_DEFAULT_PATH} replace />;
  }

  const content = {
    home: <CalendarHome />,
    schedule: <CalendarSchedule />,
    availability: <CalendarAvailability />,
    resources: <CalendarResources />,
    insights: <CalendarInsights />,
    'admin-overview': <CalendarAdminOverview />,
    'admin-resources': <CalendarAdminResources />,
    'admin-policies': <CalendarAdminPolicies />,
  }[page.view];

  return <DwpDatePickerProvider>{content}</DwpDatePickerProvider>;
}
