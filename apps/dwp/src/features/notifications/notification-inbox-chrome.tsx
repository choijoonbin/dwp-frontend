import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BellRing,
  CircleAlert,
  Clock3,
  MessageSquareText,
  Settings2,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { ActionButton, ActionIconButton, GlyphSurface } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { kpiView, notificationKpiCount } from './notification-inbox-model';

import type { NotificationConnectionState } from './use-notification-runtime';
import type { NotificationKpiKey, NotificationStreamGroupKey } from './notification-inbox-model';
import type {
  NotificationItem,
  NotificationSummary,
  NotificationView,
} from '@dwp-frontend/shared-utils/api/notification-api';

export function NotificationWorkbenchHeader({
  state,
  generatedAt,
  onOpenSettings,
}: {
  state: NotificationConnectionState;
  generatedAt?: string;
  onOpenSettings: () => void;
}) {
  const { t } = useTranslation('notifications');
  const connected = state === 'live';
  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      gap={1}
      sx={{ pb: 2.25, borderBottom: 1, borderColor: 'divider' }}
    >
      <Stack direction="row" spacing={1.5} alignItems="flex-start" minWidth={0}>
        <GlyphSurface size={42} variant="soft">
          <BellRing size={21} strokeWidth={1.9} />
        </GlyphSurface>
        <Box minWidth={0}>
          <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
            <Typography component="h1" variant="h4">
              {t('workbench.title')}
            </Typography>
            <Chip
              size="small"
              variant="outlined"
              label={connected ? t('workbench.live') : t(`states.${state}`)}
              icon={
                <Box
                  component="span"
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    bgcolor: connected ? 'success.main' : 'warning.main',
                  }}
                />
              }
              sx={{ height: 24, bgcolor: 'background.paper' }}
            />
          </Stack>
          {generatedAt && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.6 }}>
              {t('workbench.syncedAt', {
                time: formatDate(generatedAt, { hour: '2-digit', minute: '2-digit' }),
              })}
            </Typography>
          )}
        </Box>
      </Stack>
      <ActionIconButton label={t('actions.settings')} onClick={onOpenSettings}>
        <Settings2 size={18} />
      </ActionIconButton>
    </Stack>
  );
}

const KPI_ITEMS: Array<{
  key: NotificationKpiKey;
  icon: typeof BellRing;
}> = [
  { key: 'ACTIONABLE', icon: Zap },
  { key: 'UNREAD', icon: BellRing },
  { key: 'MENTIONS', icon: MessageSquareText },
  { key: 'SNOOZED', icon: Clock3 },
];

export function NotificationKpiFilterBar({
  summary,
  view,
  readState,
  onSelect,
}: {
  summary: NotificationSummary;
  view: NotificationView;
  readState: 'ALL' | 'UNREAD' | 'READ';
  onSelect: (key: NotificationKpiKey) => void;
}) {
  const { t } = useTranslation('notifications');
  const inboxTotal = summary.viewCounts.ALL;
  const unreadShare = Math.min(
    100,
    Math.max(0, Math.round((summary.totalUnread / Math.max(1, inboxTotal)) * 100))
  );
  return (
    <Box
      role="group"
      aria-label={t('home.summaryLabel')}
      sx={{
        mt: 2,
        display: 'grid',
        gap: '1px',
        gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(5, minmax(0, 1fr))' },
        border: 1,
        borderColor: 'divider',
        borderRadius: 'shape.borderRadius',
        overflow: 'hidden',
        bgcolor: 'divider',
      }}
    >
      {KPI_ITEMS.map(({ key, icon: Icon }) => {
        const target = kpiView(key);
        const active = view === target.view && readState === target.readState;
        return (
          <ButtonBase
            key={key}
            aria-pressed={active}
            onClick={() => onSelect(key)}
            sx={{
              minWidth: 0,
              minHeight: 72,
              px: 1.75,
              py: 1.25,
              justifyContent: 'flex-start',
              textAlign: 'left',
              bgcolor: active ? 'var(--dwp-product-selection)' : 'background.paper',
              color: active ? 'var(--dwp-product-accent)' : 'text.primary',
              '&:hover': { bgcolor: active ? 'var(--dwp-product-selection)' : 'action.hover' },
              '&:focus-visible': {
                outline: '2px solid',
                outlineColor: 'primary.main',
                outlineOffset: -2,
              },
            }}
          >
            <Stack direction="row" spacing={1.1} alignItems="center" minWidth={0}>
              <Icon size={17} aria-hidden="true" />
              <Box minWidth={0}>
                <Typography variant="h6" component="span" fontWeight="fontWeightBold">
                  {notificationKpiCount(summary, key)}
                </Typography>
                <Typography
                  variant="caption"
                  component="span"
                  display="block"
                  color="text.secondary"
                  noWrap
                >
                  {t(`workbench.kpis.${key}`)}
                </Typography>
              </Box>
            </Stack>
          </ButtonBase>
        );
      })}
      <Box
        sx={{
          minHeight: 72,
          px: 1.75,
          py: 1.25,
          display: 'flex',
          alignItems: 'center',
          bgcolor: 'background.paper',
          gridColumn: { xs: '1 / -1', lg: 'auto' },
        }}
      >
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          width={1}
          gap={1.5}
        >
          <Box sx={{ flexShrink: 0 }}>
            <Typography component="span" variant="h6" fontWeight="fontWeightBold">
              {inboxTotal}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" noWrap>
              {t('workbench.kpis.INBOX')}
            </Typography>
          </Box>
          <Box
            role="progressbar"
            aria-label={t('workbench.kpis.UNREAD_SHARE')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={unreadShare}
            title={t('workbench.kpis.UNREAD_SHARE_VALUE', { value: unreadShare })}
            sx={{
              width: { xs: 84, lg: 60, xl: 84 },
              minWidth: 24,
              height: 6,
              overflow: 'hidden',
              borderRadius: 'shape.borderRadius',
              bgcolor: 'action.selected',
            }}
          >
            <Box
              sx={{
                width: `${unreadShare}%`,
                height: 1,
                borderRadius: 'inherit',
                bgcolor: 'success.main',
                transition: (theme) =>
                  theme.transitions.create('width', {
                    duration: theme.transitions.duration.shorter,
                  }),
                '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
              }}
            />
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}

export function NotificationDigestBanner({
  summary,
  lead,
  onReview,
}: {
  summary: NotificationSummary;
  lead?: NotificationItem;
  onReview: () => void;
}) {
  const { t } = useTranslation('notifications');
  const [visible, setVisible] = useState(true);
  const actionableCount = notificationKpiCount(summary, 'ACTIONABLE');
  if (!visible || (!lead && actionableCount === 0)) return null;
  return (
    <Box
      component="section"
      aria-labelledby="notification-digest-title"
      sx={(theme) => ({
        mt: 1.5,
        px: { xs: 1.5, md: 2 },
        py: 1.4,
        borderLeft: 3,
        borderColor: 'primary.main',
        bgcolor: alpha(theme.palette.primary.main, 0.07),
      })}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        gap={1.25}
      >
        <Stack direction="row" spacing={1.2} alignItems="flex-start" minWidth={0} sx={{ flex: 1 }}>
          <Sparkles size={18} color="var(--dwp-product-accent)" aria-hidden="true" />
          <Box minWidth={0}>
            <Typography
              id="notification-digest-title"
              component="h2"
              variant="subtitle2"
              fontWeight="fontWeightBold"
            >
              {t('workbench.digest.title')}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.2, overflowWrap: 'anywhere' }}
            >
              {lead
                ? t('workbench.digest.withLead', {
                    count: actionableCount,
                    title: lead.title,
                  })
                : t('workbench.digest.withoutLead', { count: actionableCount })}
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
          <ActionButton intent="primary" size="small" onClick={onReview}>
            {t('workbench.digest.review')}
          </ActionButton>
          <ActionIconButton
            label={t('workbench.digest.dismiss')}
            size="small"
            onClick={() => setVisible(false)}
          >
            <X size={17} />
          </ActionIconButton>
        </Stack>
      </Stack>
    </Box>
  );
}

export function NotificationStreamGroupHeading({
  groupKey,
  count,
  headingId,
  headingComponent = 'h2',
}: {
  groupKey: NotificationStreamGroupKey;
  count: number;
  headingId?: string;
  headingComponent?: 'h2' | 'h3';
}) {
  const { t } = useTranslation('notifications');
  const Icon =
    groupKey === 'ACTION_REQUIRED'
      ? CircleAlert
      : groupKey === 'CONVERSATIONS'
        ? MessageSquareText
        : BellRing;
  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      gap={1}
      sx={{ py: 1.15 }}
    >
      <Stack direction="row" alignItems="center" gap={0.75}>
        <Icon size={16} color="var(--dwp-product-accent)" aria-hidden="true" />
        <Typography
          id={headingId}
          component={headingComponent}
          variant="subtitle2"
          fontWeight="fontWeightBold"
        >
          {t(`workbench.groups.${groupKey}.title`)}
        </Typography>
        <Chip size="small" label={count} sx={{ height: 20 }} />
      </Stack>
      {groupKey === 'ACTION_REQUIRED' && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: { xs: 'none', md: 'block' } }}
        >
          {t('workbench.groups.ACTION_REQUIRED.description')}
        </Typography>
      )}
    </Stack>
  );
}
