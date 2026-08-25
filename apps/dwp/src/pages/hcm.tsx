import { lazy, Suspense } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { PageCanvas } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';

import { ProductAreaPageHeader } from '../components/product-area-page-header';
import { useOptionalAllowedProductSurface } from '../components/allowed-product-surface-context';
import { findHcmNavigationItem, HCM_DEFAULT_PATH } from '../features/hcm/hcm-navigation';
import { useHcmExperience } from '../features/hcm/use-hcm-experience';
import { ProductAreaNavigationItemAccessGuard } from '../layouts/product-area-navigation-access-guard';
import { RouteFallback } from '../routes/route-support';

import type { HcmNavigationItem } from '../features/hcm/hcm-navigation';

const HcmHome = lazy(() =>
  import('../features/hcm/hcm-home').then((module) => ({
    default: module.HcmHome,
  }))
);
const HrAbsenceWorkspace = lazy(() =>
  import('../features/hcm/hr-absence-workspace').then((module) => ({
    default: module.HrAbsenceWorkspace,
  }))
);
const HrBenefitsWorkspace = lazy(() =>
  import('../features/hcm/hr-benefits-pay-talent').then((module) => ({
    default: module.HrBenefitsWorkspace,
  }))
);
const HrPayWorkspace = lazy(() =>
  import('../features/hcm/hr-benefits-pay-talent').then((module) => ({
    default: module.HrPayWorkspace,
  }))
);
const HrTalentWorkspace = lazy(() =>
  import('../features/hcm/hr-benefits-pay-talent').then((module) => ({
    default: module.HrTalentWorkspace,
  }))
);
const HrDomainOperations = lazy(() =>
  import('../features/hcm/hr-domain-operations').then((module) => ({
    default: module.HrDomainOperations,
  }))
);
const HrServiceHub = lazy(() =>
  import('../features/hcm/hr-service-hub').then((module) => ({
    default: module.HrServiceHub,
  }))
);
const HrTimeWorkspace = lazy(() =>
  import('../features/hcm/hr-time-workspace').then((module) => ({
    default: module.HrTimeWorkspace,
  }))
);
const HrTeamTimeWorkspace = lazy(() =>
  import('../features/hcm/hr-team-time-workspace').then((module) => ({
    default: module.HrTeamTimeWorkspace,
  }))
);
const HrTeamAbsenceWorkspace = lazy(() =>
  import('../features/hcm/hr-team-absence-workspace').then((module) => ({
    default: module.HrTeamAbsenceWorkspace,
  }))
);
const HrOperationsOverview = lazy(() =>
  import('../features/hcm/hr-operations-overview').then((module) => ({
    default: module.HrOperationsOverview,
  }))
);
const MyHrProfile = lazy(() =>
  import('../features/hcm/my-hr-profile').then((module) => ({
    default: module.MyHrProfile,
  }))
);
const MyTeam = lazy(() =>
  import('../features/hcm/my-team').then((module) => ({
    default: module.MyTeam,
  }))
);
const PeopleDirectory = lazy(() =>
  import('../features/people/directory/people-directory').then((module) => ({
    default: module.PeopleDirectory,
  }))
);
const OrganizationExplorer = lazy(() =>
  import('../features/people/organization/organization-chart-manager').then((module) => ({
    default: module.OrganizationExplorer,
  }))
);
const AssignmentRegister = lazy(() =>
  import('../features/workforce/assignment-register').then((module) => ({
    default: module.AssignmentRegister,
  }))
);
const WorkforceDataOperations = lazy(() =>
  import('../features/workforce/workforce-data-operations').then((module) => ({
    default: module.WorkforceDataOperations,
  }))
);
const WorkforceExportCenter = lazy(() =>
  import('../features/workforce/workforce-export-center').then((module) => ({
    default: module.WorkforceExportCenter,
  }))
);
const WorkforceReferenceData = lazy(() =>
  import('../features/workforce/workforce-reference-data').then((module) => ({
    default: module.WorkforceReferenceData,
  }))
);

function HcmPageContent({
  page,
  governedPage,
}: {
  page: HcmNavigationItem;
  governedPage: boolean;
}) {
  const experience = useHcmExperience();
  if (!governedPage && page.audience === 'manager' && !experience.isManager) {
    return <Navigate to={HCM_DEFAULT_PATH} replace />;
  }
  if (!governedPage && page.audience === 'operator' && !experience.canOperate) {
    return <Navigate to={HCM_DEFAULT_PATH} replace />;
  }
  const domainAudienceAllowed =
    (page.audience === 'time-admin' && experience.canManageTime) ||
    (page.audience === 'absence-admin' && experience.canManageAbsence) ||
    (page.audience === 'benefits-admin' && experience.canManageBenefits) ||
    (page.audience === 'pay-admin' && experience.canManagePay) ||
    (page.audience === 'talent-admin' && experience.canManageTalent);
  if (
    !governedPage &&
    !['all', 'manager', 'operator'].includes(page.audience) &&
    !domainAudienceAllowed
  ) {
    return <Navigate to={HCM_DEFAULT_PATH} replace />;
  }

  if (page.view === 'home') {
    return (
      <Suspense fallback={<RouteFallback />}>
        <HcmHome />
      </Suspense>
    );
  }

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
    'team-time': <HrTeamTimeWorkspace />,
    'team-absence': <HrTeamAbsenceWorkspace />,
    operations: <HrOperationsOverview />,
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
      <Box sx={{ mt: 3 }}>
        <Suspense fallback={<RouteFallback />}>{content}</Suspense>
      </Box>
    </PageCanvas>
  );
}

export default function HcmPage() {
  const { pathname } = useLocation();
  const governedPage = useOptionalAllowedProductSurface();
  const page = findHcmNavigationItem(pathname);
  if (!page) return <Navigate to={HCM_DEFAULT_PATH} replace />;

  const content = <HcmPageContent page={page} governedPage={Boolean(governedPage)} />;
  if (governedPage) return content;
  return (
    <ProductAreaNavigationItemAccessGuard item={page}>
      {content}
    </ProductAreaNavigationItemAccessGuard>
  );
}
