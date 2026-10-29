import { useTranslation } from 'react-i18next';
import { Bookmark, Check, CheckCheck, Clock3 } from 'lucide-react';
import { ActionIconButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { NotificationCenterDetail } from './notification-center-detail';

import type {
  NotificationItem,
  NotificationTriageAction,
} from '@dwp-frontend/shared-utils/api/notification-api';
import type { RefObject } from 'react';

type BulkAction = Extract<NotificationTriageAction, 'READ' | 'SAVE' | 'SNOOZE' | 'COMPLETE'>;

export function NotificationCenterBulkToolbar({
  selectedCount,
  pending,
  online,
  onAction,
}: {
  selectedCount: number;
  pending: boolean;
  online: boolean;
  onAction: (action: BulkAction) => void;
}) {
  const { t } = useTranslation('notifications');
  if (selectedCount === 0) return null;
  const disabled = pending || !online;
  return (
    <Stack
      role="toolbar"
      aria-label={t('bulk.toolbarLabel')}
      direction="row"
      alignItems="center"
      gap={0.5}
      sx={{
        mt: 1,
        px: 1.25,
        py: 0.75,
        border: 1,
        borderColor: 'divider',
        borderRadius: (theme) => `${theme.shape.borderRadius}px`,
        bgcolor: 'action.hover',
      }}
    >
      <Typography variant="caption" fontWeight="fontWeightBold" sx={{ mr: 'auto' }}>
        {t('bulk.selected', { count: selectedCount })}
      </Typography>
      <ActionIconButton
        label={t('actions.markRead')}
        onClick={() => onAction('READ')}
        disabled={disabled}
        size="small"
      >
        <CheckCheck size={17} />
      </ActionIconButton>
      <ActionIconButton
        label={t('actions.save')}
        onClick={() => onAction('SAVE')}
        disabled={disabled}
        size="small"
      >
        <Bookmark size={17} />
      </ActionIconButton>
      <ActionIconButton
        label={t('actions.snooze')}
        onClick={() => onAction('SNOOZE')}
        disabled={disabled}
        size="small"
      >
        <Clock3 size={17} />
      </ActionIconButton>
      <ActionIconButton
        label={t('actions.complete')}
        onClick={() => onAction('COMPLETE')}
        disabled={disabled}
        size="small"
      >
        <Check size={17} />
      </ActionIconButton>
    </Stack>
  );
}

export function NotificationCenterDetailSurfaces({
  compact,
  open,
  privacyReady,
  item,
  inspectorRef,
  inspectorHeight,
  loading,
  error,
  errorValue,
  fetching,
  busy,
  onBack,
  onRetry,
  onTriage,
  onOpenTarget,
  onQuickReply,
}: {
  compact: boolean;
  open: boolean;
  privacyReady: boolean;
  item: NotificationItem | null;
  inspectorRef: RefObject<HTMLDivElement | null>;
  inspectorHeight?: number;
  loading: boolean;
  error: boolean;
  errorValue?: unknown | readonly unknown[];
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
  const detail = (mode: 'desktop' | 'mobile') => (
    <NotificationCenterDetail
      item={open && privacyReady ? item : null}
      open={open}
      mode={mode}
      loading={loading}
      error={error}
      errorValue={errorValue}
      fetching={fetching}
      busy={busy}
      onBack={onBack}
      onRetry={onRetry}
      onTriage={onTriage}
      onOpenTarget={onOpenTarget}
      onQuickReply={onQuickReply}
    />
  );

  return (
    <>
      <Box
        ref={inspectorRef}
        data-testid="notification-desktop-inspector"
        sx={{
          display: { xs: 'none', lg: 'block' },
          position: 'sticky',
          top: 'calc(var(--dwp-shell-desktop-sticky-offset, 64px) + 16px)',
          minWidth: 0,
          minHeight: 0,
          height: inspectorHeight ?? 'calc(100dvh - 360px)',
          scrollMarginBottom: (theme) => theme.spacing(2),
          overflow: 'hidden',
          border: 1,
          borderColor: 'divider',
          borderRadius: (theme) => `${theme.shape.borderRadius}px`,
          bgcolor: 'background.paper',
          boxShadow: 'var(--notification-panel-shadow)',
        }}
      >
        {detail('desktop')}
      </Box>
      <Drawer
        anchor="right"
        open={compact && open}
        onClose={onBack}
        slotProps={{
          paper: {
            sx: {
              width: { xs: '100%', sm: 520 },
              maxWidth: '100%',
              overflow: 'hidden',
              bgcolor: 'background.paper',
            },
          },
        }}
      >
        {detail('mobile')}
      </Drawer>
    </>
  );
}
