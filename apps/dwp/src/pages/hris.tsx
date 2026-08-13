import { Navigate, useLocation } from 'react-router-dom';
import { PageCanvas } from '@dwp-frontend/design-system';
import { usePermissions } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';

import { ProductAreaPageHeader } from '../components/product-area-page-header';
import { HrisHome } from '../features/hris/hris-home';
import { MyHrProfile } from '../features/hris/my-hr-profile';
import { MyTeam } from '../features/hris/my-team';
import { findHrisNavigationItem, HRIS_DEFAULT_PATH } from '../features/hris/hris-navigation';
import { useHrisExperience } from '../features/hris/use-hris-experience';
import { PeopleDirectory } from '../features/people/directory/people-directory';
import { OrganizationExplorer } from '../features/people/organization/organization-chart-manager';
import { AssignmentRegister } from '../features/workforce/assignment-register';
import { WorkforceDataOperations } from '../features/workforce/workforce-data-operations';
import { WorkforceExportCenter } from '../features/workforce/workforce-export-center';
import { WorkforceOverview } from '../features/workforce/workforce-overview';
import { WorkforceReferenceData } from '../features/workforce/workforce-reference-data';

export default function HrisPage() {
  const { pathname } = useLocation();
  const { hasPermission } = usePermissions();
  const experience = useHrisExperience();
  const page = findHrisNavigationItem(pathname);
  if (!page) return <Navigate to={HRIS_DEFAULT_PATH} replace />;
  if (page.audience === 'manager' && !experience.isManager) {
    return <Navigate to={HRIS_DEFAULT_PATH} replace />;
  }
  if (page.audience === 'operator' && !experience.canOperate) {
    return <Navigate to={HRIS_DEFAULT_PATH} replace />;
  }
  if (
    page.requiredResourceKey &&
    !(
      page.requiredAnyPermissionCodes?.some((code) =>
        hasPermission(page.requiredResourceKey!, code)
      ) ?? hasPermission(page.requiredResourceKey, page.requiredPermissionCode)
    )
  ) {
    return <Navigate to={HRIS_DEFAULT_PATH} replace />;
  }

  if (page.view === 'home') return <HrisHome />;

  const content = {
    me: <MyHrProfile />,
    directory: <PeopleDirectory experience="directory" />,
    organization: <OrganizationExplorer experience="directory" />,
    team: <MyTeam />,
    operations: <WorkforceOverview />,
    people: <PeopleDirectory experience="workforce" />,
    assignments: <AssignmentRegister />,
    'organization-design': <OrganizationExplorer experience="workforce" />,
    'reference-data': <WorkforceReferenceData />,
    'data-operations': <WorkforceDataOperations />,
    exports: <WorkforceExportCenter />,
  }[page.view];

  return (
    <PageCanvas>
      <ProductAreaPageHeader area="hris" view={page.view} icon={page.icon} />
      <Box sx={{ mt: 3 }}>{content}</Box>
    </PageCanvas>
  );
}
