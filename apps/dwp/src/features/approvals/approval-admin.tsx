import { lazy } from 'react';

import type { ApprovalAdminView } from './approval-navigation';

const ApprovalAdminOverview = lazy(() =>
  import('./approval-admin-overview').then((module) => ({ default: module.ApprovalAdminOverview }))
);
const ApprovalFormStudio = lazy(() =>
  import('./approval-form-studio').then((module) => ({ default: module.ApprovalFormStudio }))
);
const ApprovalOperationsAdmin = lazy(() =>
  import('./approval-operations-admin').then((module) => ({
    default: module.ApprovalOperationsAdmin,
  }))
);
const ApprovalPolicyStudio = lazy(() =>
  import('./approval-policy-studio').then((module) => ({ default: module.ApprovalPolicyStudio }))
);
const ApprovalSignatureAdmin = lazy(() =>
  import('./approval-signature-admin').then((module) => ({
    default: module.ApprovalSignatureAdmin,
  }))
);
const ApprovalWorkflowStudio = lazy(() =>
  import('./approval-workflow-studio').then((module) => ({
    default: module.ApprovalWorkflowStudio,
  }))
);
const ApprovalAdminDocumentController = lazy(() =>
  import('./approval-admin-document-controller').then((module) => ({
    default: module.ApprovalAdminDocumentController,
  }))
);
const adminV2 = () => import('./admin-v2/approval-admin-v2-runtime');
const ApprovalAdminFormsRuntime = lazy(() =>
  adminV2().then((module) => ({ default: module.ApprovalAdminFormsRuntime }))
);
const ApprovalAdminRoutingRuntime = lazy(() =>
  adminV2().then((module) => ({ default: module.ApprovalAdminRoutingRuntime }))
);
const ApprovalAdminPoliciesRuntime = lazy(() =>
  adminV2().then((module) => ({ default: module.ApprovalAdminPoliciesRuntime }))
);
const ApprovalAdminIntegrationsRuntime = lazy(() =>
  adminV2().then((module) => ({ default: module.ApprovalAdminIntegrationsRuntime }))
);
const ApprovalAdminAuditRuntime = lazy(() =>
  adminV2().then((module) => ({ default: module.ApprovalAdminAuditRuntime }))
);
const ApprovalAdminOperationsRuntime = lazy(() =>
  adminV2().then((module) => ({ default: module.ApprovalAdminOperationsRuntime }))
);
const ApprovalAdminAnalyticsRuntime = lazy(() =>
  adminV2().then((module) => ({ default: module.ApprovalAdminAnalyticsRuntime }))
);
const ApprovalAdminDeploymentsRuntime = lazy(() =>
  adminV2().then((module) => ({ default: module.ApprovalAdminDeploymentsRuntime }))
);

export function ApprovalAdmin({ view }: { view: ApprovalAdminView }) {
  if (view === 'admin-overview') return <ApprovalAdminOverview />;
  if (view === 'workflows') return <ApprovalWorkflowStudio />;
  if (view === 'forms') {
    return <ApprovalAdminFormsRuntime matureWorkspace={<ApprovalFormStudio />} />;
  }
  if (view === 'routing') return <ApprovalAdminRoutingRuntime />;
  if (view === 'policies') {
    return (
      <ApprovalAdminPoliciesRuntime
        policyWorkspace={<ApprovalPolicyStudio />}
        documentWorkspace={<ApprovalAdminDocumentController />}
      />
    );
  }
  if (view === 'integrations') return <ApprovalAdminIntegrationsRuntime />;
  if (view === 'audit') return <ApprovalAdminAuditRuntime />;
  if (view === 'operations') {
    return <ApprovalAdminOperationsRuntime deliveryWorkspace={<ApprovalOperationsAdmin />} />;
  }
  if (view === 'signatures') return <ApprovalSignatureAdmin />;
  if (view === 'analytics') return <ApprovalAdminAnalyticsRuntime />;
  return <ApprovalAdminDeploymentsRuntime />;
}
