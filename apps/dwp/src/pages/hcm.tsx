import { Navigate, useLocation } from 'react-router-dom';
import { PageCanvas } from '@dwp-frontend/design-system';
import { usePermissions } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';

import { ProductAreaPageHeader } from '../components/product-area-page-header';
import { HcmHome } from '../features/hcm/hcm-home';
import { HrAbsenceWorkspace } from '../features/hcm/hr-absence-workspace';
import {
  HrBenefitsWorkspace,
  HrPayWorkspace,
  HrTalentWorkspace,
} from '../features/hcm/hr-benefits-pay-talent';
import { HrDomainOperations } from '../features/hcm/hr-domain-operations';
import { HrServiceHub } from '../features/hcm/hr-service-hub';
import { HrTimeWorkspace } from '../features/hcm/hr-time-workspace';
import { MyHrProfile } from '../features/hcm/my-hr-profile';
import { MyTeam } from '../features/hcm/my-team';
import { findHcmNavigationItem, HCM_DEFAULT_PATH } from '../features/hcm/hcm-navigation';
import { useHcmExperience } from '../features/hcm/use-hcm-experience';
import { PeopleDirectory } from '../features/people/directory/people-directory';
import { OrganizationExplorer } from '../features/people/organization/organization-chart-manager';
import { AssignmentRegister } from '../features/workforce/assignment-register';
import { WorkforceDataOperations } from '../features/workforce/workforce-data-operations';
import { WorkforceExportCenter } from '../features/workforce/workforce-export-center';
import { WorkforceOverview } from '../features/workforce/workforce-overview';
import { WorkforceReferenceData } from '../features/workforce/workforce-reference-data';

export default function HcmPage() {
  const { pathname } = useLocation();
  const { hasPermission } = usePermissions();
  const experience = useHcmExperience();
  const page = findHcmNavigationItem(pathname);
  if (!page) return <Navigate to={HCM_DEFAULT_PATH} replace />;
  if (page.audience === 'manager' && !experience.isManager) {
    return <Navigate to={HCM_DEFAULT_PATH} replace />;
  }
  if (page.audience === 'operator' && !experience.canOperate) {
    return <Navigate to={HCM_DEFAULT_PATH} replace />;
  }
  const domainAudienceAllowed =
    (page.audience === 'time-admin' && experience.canManageTime) ||
    (page.audience === 'absence-admin' && experience.canManageAbsence) ||
    (page.audience === 'benefits-admin' && experience.canManageBenefits) ||
    (page.audience === 'pay-admin' && experience.canManagePay) ||
    (page.audience === 'talent-admin' && experience.canManageTalent);
  if (!['all', 'manager', 'operator'].includes(page.audience) && !domainAudienceAllowed) {
    return <Navigate to={HCM_DEFAULT_PATH} replace />;
  }
  if (
    page.requiredResourceKey &&
    !(
      page.requiredAnyPermissionCodes?.some((code) =>
        hasPermission(page.requiredResourceKey!, code)
      ) ?? hasPermission(page.requiredResourceKey, page.requiredPermissionCode)
    )
  ) {
    return <Navigate to={HCM_DEFAULT_PATH} replace />;
  }

  if (page.view === 'home') return <HcmHome />;

  const content = {
    me: <MyHrProfile />,
    time: <HrTimeWorkspace />,
    absence: <HrAbsenceWorkspace />,
    benefits: <HrBenefitsWorkspace />,
    pay: <HrPayWorkspace />,
    talent: <HrTalentWorkspace />,
    services: <HrServiceHub />,
    directory: <PeopleDirectory experience="directory" />,
    organization: <OrganizationExplorer experience="directory" />,
    team: <MyTeam />,
    'team-time': <HrTimeWorkspace mode="team" />,
    'team-absence': <HrAbsenceWorkspace mode="team" />,
    operations: <WorkforceOverview />,
    people: <PeopleDirectory experience="workforce" />,
    assignments: <AssignmentRegister />,
    'time-operations': <HrDomainOperations domain="TIME" />,
    'absence-operations': <HrDomainOperations domain="ABSENCE" />,
    'benefits-operations': <HrDomainOperations domain="BENEFITS" />,
    'pay-operations': <HrDomainOperations domain="PAY" />,
    'talent-operations': <HrDomainOperations domain="TALENT" />,
    'organization-design': <OrganizationExplorer experience="workforce" />,
    'reference-data': <WorkforceReferenceData />,
    'data-operations': <WorkforceDataOperations />,
    exports: <WorkforceExportCenter />,
  }[page.view];

  return (
    <PageCanvas>
      <ProductAreaPageHeader area="hcm" view={page.view} icon={page.icon} />
      <Box sx={{ mt: 3 }}>{content}</Box>
    </PageCanvas>
  );
}
