import { lazy, Suspense, type ReactNode } from 'react';
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
import {
  assignmentProposalActionAvailable,
  assignmentProposalCreateReference,
} from '../features/hris/employment/assignment-proposal-model';

import type { HcmNavigationItem, HcmView } from '../features/hcm/hcm-navigation';
import type {
  AssignmentProposalPort,
  AssignmentProposalWorkspacePortProps,
} from '../components/assignment-proposal-port';

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
const HrisPerformanceReviewOperationsPopulationFreezeRuntime = lazy(() =>
  import('../features/hris/performance/population-freeze').then((module) => ({
    default: module.HrisPerformanceReviewOperationsPopulationFreezeRuntime,
  }))
);
const HrisCompensationPlanningOperationsRuntime = lazy(() =>
  import('../features/hris/performance/compensation-planning').then((module) => ({
    default: module.HrisCompensationPlanningOperationsRuntime,
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
const HrisClockIngestionOperationsWorkspace = lazy(() =>
  import('../features/hris/integration/hris-clock-ingestion-operations-workspace').then(
    (module) => ({
      default: module.HrisClockIngestionOperationsWorkspace,
    })
  )
);
const HrisOrganizationPositionsRouteAdmission = lazy(() =>
  import('../features/hris/integration/hris-feature-route-admission').then((module) => ({
    default: module.HrisOrganizationPositionsRouteAdmission,
  }))
);
const HrisPayrollPopulationRouteAdmission = lazy(() =>
  import('../features/hris/integration/hris-feature-route-admission').then((module) => ({
    default: module.HrisPayrollPopulationRouteAdmission,
  }))
);
const HrisOperationsRouteAdmission = lazy(() =>
  import('../features/hris/integration/hris-feature-route-admission').then((module) => ({
    default: module.HrisOperationsRouteAdmission,
  }))
);
const HrisTimeInterpretationOperationsWorkspace = lazy(() =>
  import('../features/hris/time').then((module) => ({
    default: module.HrisTimeInterpretationOperationsWorkspace,
  }))
);
const HrisPayrollConfigurationWorkspace = lazy(() =>
  import('../features/hris/integration/hris-payroll-configuration-workspace').then((module) => ({
    default: module.HrisPayrollConfigurationWorkspace,
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
const HrisEmploymentDocumentsWorkspace = lazy(() =>
  import('../features/hris/people').then((module) => ({
    default: module.HrisEmploymentDocumentsWorkspace,
  }))
);
const HrisEmploymentAssignmentsWorkspace = lazy(() =>
  import('../features/hris/people').then((module) => ({
    default: module.HrisEmploymentAssignmentsWorkspace,
  }))
);
const HrisHrm007TeamPeopleChangesRouteAdmission = lazy(() =>
  import('../features/hris/integration/hris-hrm-007-route-admission').then((module) => ({
    default: module.HrisHrm007TeamPeopleChangesRouteAdmission,
  }))
);
const HrisHrm007AppointmentsRouteAdmission = lazy(() =>
  import('../features/hris/integration/hris-hrm-007-route-admission').then((module) => ({
    default: module.HrisHrm007AppointmentsRouteAdmission,
  }))
);
const HrisHrm007PeopleEmploymentRouteAdmission = lazy(() =>
  import('../features/hris/integration/hris-hrm-007-route-admission').then((module) => ({
    default: module.HrisHrm007PeopleEmploymentRouteAdmission,
  }))
);
const HrisWorkflowPolicyRouteAdmission = lazy(() =>
  import('../features/hris/integration/hris-sys-003-route-admission').then((module) => ({
    default: module.HrisWorkflowPolicyRouteAdmission,
  }))
);
const HrisTeamDelegationRouteAdmission = lazy(() =>
  import('../features/hris/integration/hris-sys-003-route-admission').then((module) => ({
    default: module.HrisTeamDelegationRouteAdmission,
  }))
);
const HrisEmployeeChangeWorkspace = lazy(() =>
  import('../features/hris/employee-services/employee-change').then((module) => ({
    default: module.HrisEmployeeChangeWorkspace,
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
const AssignmentProposalWorkspace = lazy(() =>
  import('../features/hris/employment/assignment-proposal-workspace').then((module) => ({
    default: module.AssignmentProposalWorkspace,
  }))
);
const assignmentProposalPort: AssignmentProposalPort = {
  Workspace: (props: AssignmentProposalWorkspacePortProps) => (
    <AssignmentProposalWorkspace {...props} />
  ),
  actionAvailable: assignmentProposalActionAvailable,
  createReference: assignmentProposalCreateReference,
};
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
const HrisReferenceConfigurationWorkspace = lazy(() =>
  import('../features/hris/administration/reference-configuration').then((module) => ({
    default: module.HrisReferenceConfigurationWorkspace,
  }))
);
const HrisSystemWorkspace = lazy(() =>
  import('../features/hris/administration/system-access').then((module) => ({
    default: module.HrisSystemWorkspace,
  }))
);
const HrisNavigationPolicyCommandRuntime = lazy(() =>
  import('../features/hris/administration/navigation-policy').then((module) => ({
    default: module.HrisNavigationPolicyCommandRuntime,
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

  const contentByView: Partial<Record<HcmView, ReactNode>> = {
    me: <MyHrProfile />,
    'employment-documents': <HrisEmploymentDocumentsWorkspace />,
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
    'team-leave': <HrTeamAbsenceWorkspace />,
    'team-people-changes': <HrisHrm007TeamPeopleChangesRouteAdmission />,
    'team-delegation': <HrisTeamDelegationRouteAdmission />,
    'operations-home': <HrOperationsOverview />,
    people: <HrisPeople360Workspace />,
    'employee-change-requests': <HrisEmployeeChangeWorkspace />,
    'employment-assignments': <HrisEmploymentAssignmentsWorkspace />,
    'people-appointments': <HrisHrm007AppointmentsRouteAdmission />,
    'organization-positions': <HrisOrganizationPositionsRouteAdmission />,
    'payroll-population': <HrisPayrollPopulationRouteAdmission />,
    assignments: <AssignmentRegister assignmentProposal={assignmentProposalPort} />,
    'time-operations': <HrisTimeOperationsWorkspace />,
    'time-work-plans': <HrisTimeOperationsWorkspace />,
    'time-clock-ingestion': <HrisClockIngestionOperationsWorkspace entryMode="CLOCK_INGESTION" />,
    'time-interpretation': <HrisTimeInterpretationOperationsWorkspace />,
    'time-exceptions': <HrisClockIngestionOperationsWorkspace entryMode="TIME_EXCEPTIONS" />,
    'time-leave-operations': <HrDomainOperations domain="ABSENCE" />,
    'benefits-operations': <HrDomainOperations domain="BENEFITS" />,
    // These owner workspaces bind every command to an exact generated ACTION contract. Their
    // governed executors fail closed when the server cannot issue matching authority; the
    // frontend never constructs or broadens that authority.
    'pay-operations': <HrisPayrollFoundationOperationsWorkspace />,
    'talent-operations': <HrisPerformanceCycleOperationsWorkspace />,
    'performance-goal-cycles': <HrisPerformanceCycleOperationsWorkspace />,
    'performance-review-operations': <HrisPerformanceReviewOperationsPopulationFreezeRuntime />,
    'compensation-planning': <HrisCompensationPlanningOperationsRuntime />,
    'organization-design': <OrganizationExplorer experience="workforce" />,
    'settings-reference': <HrisReferenceConfigurationWorkspace />,
    'settings-payroll': <HrisPayrollConfigurationWorkspace />,
    'settings-navigation-policy': <HrisNavigationPolicyCommandRuntime />,
    'settings-operations': <HrisOperationsRouteAdmission />,
    'settings-people-employment': <HrisHrm007PeopleEmploymentRouteAdmission />,
    'settings-workflow': <HrisWorkflowPolicyRouteAdmission />,
    'reference-data': <WorkforceReferenceData />,
    'data-operations': <WorkforceDataOperations />,
    exports: <WorkforceExportCenter />,
  };
  const content = contentByView[page.view];

  if (!content) return <Navigate to="/403" replace />;

  if (
    page.view === 'organization-positions' ||
    page.view === 'payroll-population' ||
    page.view === 'settings-operations' ||
    page.view === 'team-people-changes' ||
    page.view === 'team-delegation' ||
    page.view === 'people-appointments' ||
    page.view === 'settings-people-employment' ||
    page.view === 'settings-workflow'
  ) {
    return (
      <PageCanvas>
        <Suspense fallback={<RouteFallback />}>{content}</Suspense>
      </PageCanvas>
    );
  }

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
