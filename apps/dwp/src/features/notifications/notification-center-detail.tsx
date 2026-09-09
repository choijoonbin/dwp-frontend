import { useTranslation } from 'react-i18next';
import { Inbox } from 'lucide-react';

import { EmptyState, ErrorState, LoadingState } from '@dwp-frontend/design-system';

import { NotificationDetailPane } from './notification-detail-pane';

import type {
  NotificationItem,
  NotificationTriageAction,
} from '@dwp-frontend/shared-utils/api/notification-api';

export function NotificationCenterDetail({
  item,
  open,
  mode,
  loading,
  error,
  fetching,
  busy,
  onBack,
  onRetry,
  onTriage,
  onOpenTarget,
  onQuickReply,
}: {
  item: NotificationItem | null;
  open: boolean;
  mode: 'desktop' | 'mobile';
  loading: boolean;
  error: boolean;
  fetching: boolean;
  busy: boolean;
  onBack: () => void;
  onRetry: () => void;
  onTriage: (action: NotificationTriageAction, snoozedUntil?: string) => void;
  onOpenTarget?: (href: string) => void;
  onQuickReply: (
    target: { conversationId: string; replyToMessageId?: string },
    body: string,
    idempotencyKey: string
  ) => Promise<void>;
}) {
  const { t } = useTranslation('notifications');
  const desktop = mode === 'desktop';

  if (item) {
    return (
      <NotificationDetailPane
        item={item}
        onBack={onBack}
        onTriage={onTriage}
        onOpenTarget={onOpenTarget}
        onQuickReply={onQuickReply}
        busy={busy}
      />
    );
  }
  if (open && loading) {
    return desktop ? (
      <LoadingState
        label={t('states.loadingDetail')}
        variant="skeleton"
        skeletonRows={5}
        embedded
      />
    ) : (
      <LoadingState
        label={t('states.loadingDetail')}
        variant="skeleton"
        skeletonRows={5}
        size="page"
      />
    );
  }
  if (open && error) {
    return (
      <ErrorState
        title={t('states.detailErrorTitle')}
        description={t('states.detailErrorDescription')}
        retryLabel={t('actions.retry')}
        onRetry={onRetry}
        retrying={fetching}
        size={desktop ? 'compact' : 'page'}
      />
    );
  }
  if (!desktop) return null;
  return (
    <EmptyState
      icon={<Inbox size={28} />}
      title={t('detail.emptyTitle')}
      description={t('detail.emptyDescription')}
      size="compact"
    />
  );
}
