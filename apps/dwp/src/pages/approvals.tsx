import { lazy, Suspense } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { PageCanvas } from '@dwp-frontend/design-system';
import { usePermissions } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';

import {
  APPROVAL_DEFAULT_PATH,
  findApprovalNavigationItem,
  isApprovalAdminView,
  isApprovalAdminV2View,
} from '../features/approvals/approval-navigation';
import { ApprovalPageHeader } from '../features/approvals/approval-ui';
import { canAccessProductAreaNavigationItem } from '../layouts/product-area-permissions';
import { RouteFallback } from '../routes/route-support';

const ApprovalAdmin = lazy(() =>
  import('../features/approvals/approval-admin').then((module) => ({
    default: module.ApprovalAdmin,
  }))
);
const ApprovalDelegations = lazy(() =>
  import('../features/approvals/approval-delegations').then((module) => ({
    default: module.ApprovalDelegations,
  }))
);
const ApprovalHome = lazy(() =>
  import('../features/approvals/approval-home').then((module) => ({
    default: module.ApprovalHome,
  }))
);
const ApprovalInbox = lazy(() =>
  import('../features/approvals/approval-inbox').then((module) => ({
    default: module.ApprovalInbox,
  }))
);
const ApprovalRequests = lazy(() =>
  import('../features/approvals/approval-requests').then((module) => ({
    default: module.ApprovalRequests,
  }))
);

export default function ApprovalsPage({ governed = false }: { governed?: boolean }) {
  const { pathname } = useLocation();
  const { hasPermission } = usePermissions();
  const page = findApprovalNavigationItem(pathname);
  if (!page) return <Navigate to={APPROVAL_DEFAULT_PATH} replace />;
  if (!governed && !canAccessProductAreaNavigationItem(page, hasPermission))
    return <Navigate to={APPROVAL_DEFAULT_PATH} replace />;
  if (page.view === 'home')
    return (
      <Suspense fallback={<RouteFallback />}>
        <ApprovalHome />
      </Suspense>
    );
  let content: React.ReactNode;
  if (page.view === 'inbox') content = <ApprovalInbox view="INBOX" />;
  else if (page.view === 'completed') content = <ApprovalInbox view="COMPLETED" />;
  else if (page.view === 'delegations') content = <ApprovalDelegations />;
  else if (isApprovalAdminView(page.view)) content = <ApprovalAdmin view={page.view} />;
  else
    content = (
      <ApprovalRequests
        view={page.view as 'new' | 'drafts' | 'submitted' | 'needs-info' | 'archive'}
      />
    );
  return (
    <PageCanvas topInset="compact">
      {isApprovalAdminV2View(page.view) ? null : (
        <ApprovalPageHeader view={page.view} icon={page.icon} />
      )}
      <Box sx={{ mt: isApprovalAdminV2View(page.view) ? 0 : { xs: 2.5, md: 3 } }}>
        <Suspense fallback={<RouteFallback />}>{content}</Suspense>
      </Box>
    </PageCanvas>
  );
}
