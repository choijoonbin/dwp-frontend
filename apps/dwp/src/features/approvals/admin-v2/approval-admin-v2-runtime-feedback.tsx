import { useState } from 'react';
import { InlineFeedback } from '@dwp-frontend/design-system';

import Stack from '@mui/material/Stack';

import { ApprovalAdminV2CommandDialog } from './approval-admin-v2-command-dialog';

import type { ReactNode } from 'react';
import type { useApprovalAdminV2Command } from './use-approval-admin-v2-command';

type Controller = ReturnType<typeof useApprovalAdminV2Command>['controller'];

export type ApprovalAdminV2RuntimeFeedback = Readonly<{
  severity: 'info' | 'success' | 'warning' | 'error';
  title: string;
  detail: string;
}>;

export function useApprovalAdminV2RuntimeFeedback(
  initial: ApprovalAdminV2RuntimeFeedback | null = null
) {
  const [feedback, setFeedback] = useState<ApprovalAdminV2RuntimeFeedback | null>(initial);
  return {
    feedback,
    clearFeedback: () => setFeedback(null),
    unsupported: (title: string, detail: string) =>
      setFeedback({ severity: 'warning', title, detail }),
    success: (title: string, detail: string) => setFeedback({ severity: 'success', title, detail }),
    error: (title: string, detail: string) => setFeedback({ severity: 'error', title, detail }),
  } as const;
}

export function ApprovalAdminV2RuntimeLayer({
  feedback,
  dismissLabel,
  onDismiss,
  controller,
  children,
}: {
  feedback: ApprovalAdminV2RuntimeFeedback | null;
  dismissLabel: string;
  onDismiss: () => void;
  controller?: Controller;
  children: ReactNode;
}) {
  return (
    <Stack gap={2}>
      {feedback ? (
        <InlineFeedback
          severity={feedback.severity}
          title={feedback.title}
          onClose={onDismiss}
          closeLabel={dismissLabel}
        >
          {feedback.detail}
        </InlineFeedback>
      ) : null}
      {children}
      {controller ? <ApprovalAdminV2CommandDialog controller={controller} /> : null}
    </Stack>
  );
}
