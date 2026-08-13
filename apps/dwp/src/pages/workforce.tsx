import { Navigate, useParams } from 'react-router-dom';
import { PageCanvas } from '@dwp-frontend/design-system';
import { usePermissions } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';

import { ProductAreaPageHeader } from '../components/product-area-page-header';
import { PeopleDirectory } from '../features/people/directory/people-directory';
import { OrganizationExplorer } from '../features/people/organization/organization-chart-manager';
import { AssignmentRegister } from '../features/workforce/assignment-register';
import {
  findWorkforceNavigationItem,
  WORKFORCE_DEFAULT_PATH,
} from '../features/workforce/workforce-navigation';
import { WorkforceOverview } from '../features/workforce/workforce-overview';
import { WorkforceReferenceData } from '../features/workforce/workforce-reference-data';
import { WorkforceDataOperations } from '../features/workforce/workforce-data-operations';
import { WorkforceExportCenter } from '../features/workforce/workforce-export-center';

export default function WorkforcePage() {
  const { view } = useParams();
  const { hasPermission } = usePermissions();
  const page = findWorkforceNavigationItem(view);
  if (!page) return <Navigate to={WORKFORCE_DEFAULT_PATH} replace />;
  if (
    page.requiredResourceKey &&
    !hasPermission(page.requiredResourceKey, page.requiredPermissionCode)
  ) {
    return <Navigate to={WORKFORCE_DEFAULT_PATH} replace />;
  }

  const content = {
    overview: <WorkforceOverview />,
    people: <PeopleDirectory experience="workforce" />,
    assignments: <AssignmentRegister />,
    organization: <OrganizationExplorer experience="workforce" />,
    'reference-data': <WorkforceReferenceData />,
    'data-operations': <WorkforceDataOperations />,
    exports: <WorkforceExportCenter />,
  }[page.view];

  return (
    <PageCanvas>
      <ProductAreaPageHeader area="workforce" view={page.view} icon={page.icon} />
      <Box sx={{ mt: 3 }}>{content}</Box>
    </PageCanvas>
  );
}
