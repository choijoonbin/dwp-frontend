import { useTranslation } from 'react-i18next';
import { ArrowLeft, Inbox } from 'lucide-react';

import { ActionIconButton } from '@dwp-frontend/design-system/components/actions/action-icon-button';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@dwp-frontend/design-system/components/states/state-panels';
import { foundationTokens } from '@dwp-frontend/design-system/foundation/tokens';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { NotificationDetailPane } from './notification-detail-pane';

import type {
  NotificationItem,
  NotificationTriageAction,
} from '@dwp-frontend/shared-utils/api/notification-api';
import type { ReactNode } from 'react';

function MobileDetailState({ children, onBack }: { children: ReactNode; onBack: () => void }) {
  const { t } = useTranslation('notifications');
  return (
    <Box
      component="aside"
      aria-label={t('detail.regionLabel')}
      sx={{
        minWidth: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        gap={1}
        sx={{
          minHeight: 52,
          flexShrink: 0,
          px: 1.5,
          py: 0.5,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <ActionIconButton
          label={t('actions.back')}
          onClick={onBack}
          size="small"
          sx={{
            width: foundationTokens.density.comfortable.controlHeight,
            height: foundationTokens.density.comfortable.controlHeight,
          }}
        >
          <ArrowLeft size={18} />
        </ActionIconButton>
        <Typography
          component="h2"
          variant="subtitle1"
          fontWeight="fontWeightBold"
          sx={{ minWidth: 0, overflowWrap: 'anywhere' }}
        >
          {t('detail.title')}
        </Typography>
      </Stack>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{children}</Box>
    </Box>
  );
}

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
        key={item.notificationId}
        item={item}
        mode={mode}
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
      <MobileDetailState onBack={onBack}>
        <LoadingState
          label={t('states.loadingDetail')}
          variant="skeleton"
          skeletonRows={5}
          size="page"
        />
      </MobileDetailState>
    );
  }
  if (open && error) {
    const state = (
      <ErrorState
        title={t('states.detailErrorTitle')}
        description={t('states.detailErrorDescription')}
        retryLabel={t('actions.retry')}
        onRetry={onRetry}
        retrying={fetching}
        size={desktop ? 'compact' : 'page'}
      />
    );
    return desktop ? state : <MobileDetailState onBack={onBack}>{state}</MobileDetailState>;
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
