import { lazy } from 'react';
import Stack from '@mui/material/Stack';

import type { ApprovalView } from './approval-navigation';

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

export function ApprovalAdmin({
  view,
}: {
  view: Extract<
    ApprovalView,
    'admin-overview' | 'workflows' | 'forms' | 'policies' | 'operations' | 'signatures'
  >;
}) {
  if (view === 'admin-overview') return <ApprovalAdminOverview />;
  if (view === 'workflows') return <ApprovalWorkflowStudio />;
  if (view === 'forms') return <ApprovalFormStudio />;
  if (view === 'policies')
    return (
      <Stack gap={3}>
        <ApprovalPolicyStudio />
        <ApprovalAdminDocumentController />
      </Stack>
    );
  if (view === 'operations') return <ApprovalOperationsAdmin />;
  return <ApprovalSignatureAdmin />;
}
