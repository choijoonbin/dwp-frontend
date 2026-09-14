import { ApprovalRequestComposer } from './approval-request-composer';
import { ApprovalRequestLifecycle } from './approval-request-lifecycle';
import { ApprovalRequestDrafts } from './approval-request-drafts';

import type { ApprovalRequestView } from './approval-request-model';

export function ApprovalRequests({ view }: { view: 'new' | ApprovalRequestView }) {
  if (view === 'drafts') return <ApprovalRequestDrafts />;
  return view === 'new' ? <ApprovalRequestComposer /> : <ApprovalRequestLifecycle view={view} />;
}
