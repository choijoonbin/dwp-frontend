import { AlertTriangle, CheckCircle2, CirclePause, LoaderCircle } from 'lucide-react';

import type {
  MailAccount,
  MailAccountConnectionState,
  MailAccountSynchronizationState,
} from '@dwp-frontend/shared-utils';

type AccountStatusPresentation = {
  color: 'success' | 'info' | 'warning' | 'error';
  icon: typeof CheckCircle2;
  labelKey: string;
};

export function accountStatusPresentation(account: MailAccount): AccountStatusPresentation {
  const connection: Record<MailAccountConnectionState, AccountStatusPresentation> = {
    ACTIVE: { color: 'success', icon: CheckCircle2, labelKey: 'accounts.status.ready' },
    REAUTHENTICATION_REQUIRED: {
      color: 'warning',
      icon: AlertTriangle,
      labelKey: 'accounts.status.reauthenticationRequired',
    },
    SUSPENDED: { color: 'error', icon: CirclePause, labelKey: 'accounts.status.suspended' },
    DISCONNECTED: { color: 'error', icon: AlertTriangle, labelKey: 'accounts.status.disconnected' },
  };
  if (account.connectionState !== 'ACTIVE') return connection[account.connectionState];
  const synchronization: Record<MailAccountSynchronizationState, AccountStatusPresentation> = {
    READY: connection.ACTIVE,
    SYNCING: { color: 'info', icon: LoaderCircle, labelKey: 'accounts.status.syncing' },
    DEGRADED: { color: 'warning', icon: AlertTriangle, labelKey: 'accounts.status.degraded' },
    PAUSED: { color: 'warning', icon: CirclePause, labelKey: 'accounts.status.paused' },
  };
  return synchronization[account.synchronizationState];
}
