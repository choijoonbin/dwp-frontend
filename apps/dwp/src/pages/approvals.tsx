import { Navigate, useLocation } from 'react-router-dom';
import { PageCanvas } from '@dwp-frontend/design-system';
import { usePermissions } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';

import { ApprovalAdmin } from '../features/approvals/approval-admin';
import { ApprovalDelegations } from '../features/approvals/approval-delegations';
import { ApprovalHome } from '../features/approvals/approval-home';
import { ApprovalInbox } from '../features/approvals/approval-inbox';
import {
  APPROVAL_DEFAULT_PATH,
  findApprovalNavigationItem,
  isApprovalAdminView,
} from '../features/approvals/approval-navigation';
import { ApprovalRequests } from '../features/approvals/approval-requests';
import { ApprovalPageHeader } from '../features/approvals/approval-ui';
import { canAccessProductAreaNavigationItem } from '../layouts/product-area-permissions';

export default function ApprovalsPage({ governed = false }: { governed?: boolean }) {
  const { pathname } = useLocation();
  const { hasPermission } = usePermissions();
  const page = findApprovalNavigationItem(pathname);
  if (!page) return <Navigate to={APPROVAL_DEFAULT_PATH} replace />;
  if (!governed && !canAccessProductAreaNavigationItem(page, hasPermission))
    return <Navigate to={APPROVAL_DEFAULT_PATH} replace />;
  if (page.view === 'home') return <ApprovalHome />;
  let content: React.ReactNode;
  if (page.view === 'inbox') content = <ApprovalInbox view="INBOX" />;
  else if (page.view === 'completed') content = <ApprovalInbox view="COMPLETED" />;
  else if (page.view === 'delegations') content = <ApprovalDelegations />;
  else if (isApprovalAdminView(page.view))
    content = (
      <ApprovalAdmin
        view={
          page.view as
            'admin-overview' | 'workflows' | 'forms' | 'policies' | 'operations' | 'signatures'
        }
      />
    );
  else
    content = (
      <ApprovalRequests
        view={page.view as 'new' | 'drafts' | 'submitted' | 'needs-info' | 'archive'}
      />
    );
  return (
    <PageCanvas>
      <ApprovalPageHeader view={page.view} icon={page.icon} />
      <Box sx={{ mt: 3 }}>{content}</Box>
    </PageCanvas>
  );
}
