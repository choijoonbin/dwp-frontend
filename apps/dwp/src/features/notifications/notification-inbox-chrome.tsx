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
import type { ReactNode } from 'react';
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
      data-testid="notification-workbench-header"
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      gap={1}
      sx={{
        p: { xs: 1.25, md: 1.5 },
        border: 1,
        borderColor: 'divider',
        borderRadius: (theme) => `${theme.shape.borderRadius}px`,
        bgcolor: 'background.paper',
        boxShadow: 'var(--notification-panel-shadow)',
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center" minWidth={0}>
        <GlyphSurface size={38} variant="soft">
          <BellRing size={19} strokeWidth={1.9} />
        </GlyphSurface>
        <Box minWidth={0}>
          <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
            <Typography component="h1" variant="h5">
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
  return (
    <Box
      role="group"
      aria-label={t('home.summaryLabel')}
      sx={{
        mt: 1.5,
        p: { xs: 0.5, sm: 1.25 },
        display: 'flex',
        alignItems: 'center',
        flexWrap: { xs: 'nowrap', sm: 'wrap' },
        gap: { xs: 0.25, sm: 0.75 },
        border: 1,
        borderColor: 'divider',
        borderRadius: (theme) => `${theme.shape.borderRadius}px`,
        bgcolor: 'background.paper',
      }}
    >
      {KPI_ITEMS.map(({ key, icon: Icon }) => {
        const target = kpiView(key);
        const active = view === target.view && readState === target.readState;
        return (
          <ButtonBase
            key={key}
            aria-pressed={active}
            aria-label={`${notificationKpiCount(summary, key)} ${t(`workbench.kpis.${key}`)}`}
            onClick={() => onSelect(key)}
            sx={{
              minWidth: 0,
              minHeight: 36,
              px: { xs: 0.4, sm: 1.25 },
              py: 0.65,
              flex: { xs: '1 1 0', sm: '0 0 auto' },
              justifyContent: 'flex-start',
              textAlign: 'left',
              borderRadius: (theme) => `${theme.shape.borderRadius}px`,
              bgcolor: active ? 'primary.main' : 'action.hover',
              color: active ? 'primary.contrastText' : 'text.secondary',
              '&:hover': { bgcolor: active ? 'primary.dark' : 'action.hover' },
              '&:focus-visible': {
                outline: '2px solid',
                outlineColor: 'primary.main',
                outlineOffset: 2,
              },
            }}
          >
            <Stack
              direction="row"
              spacing={{ xs: 0.35, sm: 0.75 }}
              justifyContent="center"
              alignItems="center"
              minWidth={0}
              width={1}
            >
              <Box component="span" sx={{ display: { xs: 'none', sm: 'grid' } }}>
                <Icon size={15} aria-hidden="true" />
              </Box>
              <Typography variant="caption" component="span" fontWeight="fontWeightBold" noWrap>
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                  {t(`workbench.kpis.${key}`)}
                </Box>
                <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                  {t(`workbench.kpisCompact.${key}`)}
                </Box>
              </Typography>
              <Box
                component="span"
                sx={(theme) => ({
                  minWidth: { xs: 18, sm: 20 },
                  height: { xs: 18, sm: 20 },
                  px: { xs: 0.35, sm: 0.55 },
                  display: 'inline-grid',
                  placeItems: 'center',
                  borderRadius: '50%',
                  bgcolor: active
                    ? alpha(theme.palette.primary.contrastText, 0.2)
                    : 'action.selected',
                })}
              >
                <Typography
                  component="span"
                  variant="caption"
                  fontWeight="fontWeightBold"
                  color="inherit"
                >
                  {notificationKpiCount(summary, key)}
                </Typography>
              </Box>
            </Stack>
          </ButtonBase>
        );
      })}
      <Box
        sx={{
          minHeight: 36,
          ml: { xs: 0, md: 'auto' },
          mt: { xs: 0.25, md: 0 },
          pt: { xs: 0.75, md: 0 },
          pl: { xs: 0.25, md: 1.5 },
          pr: 0.75,
          display: { xs: 'none', sm: 'flex' },
          alignItems: 'center',
          flex: { xs: '1 0 100%', md: '0 0 auto' },
          borderTop: { xs: 1, md: 0 },
          borderLeft: { xs: 0, md: 1 },
          borderColor: 'divider',
        }}
      >
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          width={1}
          gap={1.5}
        >
          <Stack direction="row" alignItems="baseline" gap={0.55} sx={{ flexShrink: 0 }}>
            <Typography variant="caption" color="text.secondary" noWrap>
              {t('workbench.kpis.INBOX')}
            </Typography>
            <Typography component="span" variant="subtitle2" fontWeight="fontWeightBold">
              {inboxTotal}
            </Typography>
          </Stack>
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
        mt: 1.25,
        px: { xs: 1.25, md: 1.5 },
        py: 1.15,
        border: 1,
        borderColor: alpha(theme.palette.primary.main, 0.28),
        borderRadius: (theme) => `${theme.shape.borderRadius}px`,
        bgcolor: alpha(theme.palette.primary.main, 0.055),
      })}
    >
      <Stack direction="row" alignItems="center" gap={{ xs: 0.75, sm: 1.25 }}>
        <Stack direction="row" spacing={1.2} alignItems="flex-start" minWidth={0} sx={{ flex: 1 }}>
          <Box
            sx={{
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
              width: 32,
              height: 32,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              borderRadius: (theme) => `${theme.shape.borderRadius}px`,
            }}
          >
            <Sparkles size={16} aria-hidden="true" />
          </Box>
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
              sx={{
                mt: 0.2,
                overflowWrap: 'anywhere',
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: { xs: 2, sm: 1 },
                overflow: 'hidden',
              }}
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
        <Stack direction="row" spacing={0.25} justifyContent="flex-end" flexShrink={0}>
          <ActionButton intent="primary" size="small" onClick={onReview}>
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              {t('workbench.digest.review')}
            </Box>
            <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
              {t('workbench.digest.reviewCompact')}
            </Box>
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
  title,
  actions,
}: {
  groupKey: NotificationStreamGroupKey;
  count: number;
  headingId?: string;
  headingComponent?: 'h2' | 'h3';
  title?: string;
  actions?: ReactNode;
}) {
  const { t } = useTranslation('notifications');
  const Icon =
    groupKey === 'ACTION_REQUIRED'
      ? CircleAlert
      : groupKey === 'CONVERSATIONS'
        ? MessageSquareText
        : BellRing;
  const tone =
    groupKey === 'ACTION_REQUIRED'
      ? 'error.main'
      : groupKey === 'CONVERSATIONS'
        ? 'success.main'
        : 'primary.main';
  const chipColor =
    groupKey === 'ACTION_REQUIRED' ? 'error' : groupKey === 'CONVERSATIONS' ? 'success' : 'primary';
  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      gap={1}
      sx={{ pb: 1, pt: 0.5 }}
    >
      <Stack direction="row" alignItems="center" gap={0.75} minWidth={0} flexWrap="wrap">
        <Box aria-hidden="true" sx={{ color: tone, display: 'grid' }}>
          <Icon size={16} />
        </Box>
        <Typography
          id={headingId}
          component={headingComponent}
          variant="subtitle2"
          fontWeight="fontWeightBold"
        >
          {title ?? t(`workbench.groups.${groupKey}.title`)}
        </Typography>
        <Chip size="small" color={chipColor} label={count} sx={{ height: 20 }} />
      </Stack>
      {actions ??
        (groupKey === 'ACTION_REQUIRED' && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: { xs: 'none', md: 'block' } }}
          >
            {t('workbench.groups.ACTION_REQUIRED.description')}
          </Typography>
        ))}
    </Stack>
  );
}
