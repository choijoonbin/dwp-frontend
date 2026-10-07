import { lazy, Suspense } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { PageCanvas } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';

import { ProductAreaPageHeader } from '../components/product-area-page-header';
import { useOptionalAllowedProductSurface } from '../components/allowed-product-surface-context';
import {
  canAccessHcmNavigationAudience,
  findHcmNavigationItem,
  HCM_DEFAULT_PATH,
} from '../features/hcm/hcm-navigation';
import { useHcmAccess } from '../features/hcm/use-hcm-experience';
import { ProductAreaNavigationItemAccessGuard } from '../layouts/product-area-navigation-access-guard';
import { RouteFallback } from '../routes/route-support';
import { HRIS_HOME_RUNTIME_PROVIDER_REGISTRY } from '../features/hris/integration';

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
const HrisPayrollWorkspace = lazy(() =>
  import('../features/hris/payroll').then((module) => ({
    default: module.HrisPayrollWorkspace,
  }))
);
const HrisPayrollFoundationOperationsWorkspace = lazy(() =>
  import('../features/hris/payroll').then((module) => ({
    default: module.HrisPayrollFoundationOperationsWorkspace,
  }))
);
const HrisPerformanceWorkspace = lazy(() =>
  import('../features/hris/performance').then((module) => ({
    default: module.HrisPerformanceWorkspace,
  }))
);
const HrisPerformanceCycleOperationsWorkspace = lazy(() =>
  import('../features/hris/performance').then((module) => ({
    default: module.HrisPerformanceCycleOperationsWorkspace,
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
const HrisTimeWorkspace = lazy(() =>
  import('../features/hris/time').then((module) => ({
    default: module.HrisTimeWorkspace,
  }))
);
const HrisTimeOperationsWorkspace = lazy(() =>
  import('../features/hris/time').then((module) => ({
    default: module.HrisTimeOperationsWorkspace,
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
const HrisPeople360Workspace = lazy(() =>
  import('../features/hris/people').then((module) => ({
    default: module.HrisPeople360Workspace,
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
const HrisSystemWorkspace = lazy(() =>
  import('../features/hris/administration/system-access').then((module) => ({
    default: module.HrisSystemWorkspace,
  }))
);
function HcmPageContent({ page }: { page: HcmNavigationItem }) {
  if (page.view === 'home') {
    return (
      <Suspense fallback={<RouteFallback />}>
        <HcmHome moduleProviderRegistry={HRIS_HOME_RUNTIME_PROVIDER_REGISTRY} />
      </Suspense>
    );
  }

  if (page.view === 'system-access') {
    return (
      <PageCanvas>
        <Suspense fallback={<RouteFallback />}>
          <HrisSystemWorkspace />
        </Suspense>
      </PageCanvas>
    );
  }

  const content = {
    me: <MyHrProfile />,
    time: <HrisTimeWorkspace />,
    absence: <HrAbsenceWorkspace />,
    benefits: <HrBenefitsWorkspace />,
    pay: <HrisPayrollWorkspace />,
    talent: <HrisPerformanceWorkspace />,
    services: <HrServiceHub />,
    directory: <PeopleDirectory experience="directory" />,
    organization: <OrganizationExplorer experience="directory" />,
    team: <MyTeam />,
    'team-time': <HrTeamTimeWorkspace />,
    'team-absence': <HrTeamAbsenceWorkspace />,
    operations: <HrOperationsOverview />,
    people: <HrisPeople360Workspace />,
    assignments: <AssignmentRegister />,
    'time-operations': <HrisTimeOperationsWorkspace />,
    'absence-operations': <HrDomainOperations domain="ABSENCE" />,
    'benefits-operations': <HrDomainOperations domain="BENEFITS" />,
    // These owner workspaces bind every command to an exact generated ACTION contract. Their
    // governed executors fail closed when the server cannot issue matching authority; the
    // frontend never constructs or broadens that authority.
    'pay-operations': <HrisPayrollFoundationOperationsWorkspace />,
    'talent-operations': <HrisPerformanceCycleOperationsWorkspace />,
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

function LegacyHcmPageContent({ page }: { page: HcmNavigationItem }) {
  const access = useHcmAccess();
  if (!canAccessHcmNavigationAudience(page, access)) {
    return <Navigate to={HCM_DEFAULT_PATH} replace />;
  }
  return <HcmPageContent page={page} />;
}

export default function HcmPage() {
  const { pathname } = useLocation();
  const governedPage = useOptionalAllowedProductSurface();
  const page = findHcmNavigationItem(pathname);
  if (!page) return <Navigate to={HCM_DEFAULT_PATH} replace />;

  if (governedPage) return <HcmPageContent page={page} />;
  return (
    <ProductAreaNavigationItemAccessGuard item={page}>
      <LegacyHcmPageContent page={page} />
    </ProductAreaNavigationItemAccessGuard>
  );
}
