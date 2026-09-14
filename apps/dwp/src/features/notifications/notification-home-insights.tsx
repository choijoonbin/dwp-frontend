import { useTranslation } from 'react-i18next';
import {
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Grid3X3,
  Layers3,
  Mail,
  Monitor,
  MessageSquareText,
  Settings2,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  ActionIconButton,
  EmptyState,
  GlyphSurface,
  LoadingState,
  LocalErrorState,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { notificationCenterPath } from './notification-navigation';

import type {
  AppNotificationCounter,
  NotificationDeliveryProfile,
} from '@dwp-frontend/shared-utils';
import type { LucideIcon } from 'lucide-react';
import type { NotificationDeliveryStatus } from './notification-delivery-status-model';

const SOURCE_ICON: Record<string, LucideIcon> = {
  approvals: CheckCircle2,
  approval: CheckCircle2,
  calendar: CalendarDays,
  hcm: UsersRound,
  mail: Mail,
  meetings: CalendarDays,
  messaging: MessageSquareText,
  services: BriefcaseBusiness,
  security: ShieldCheck,
  space: Layers3,
  spaces: Layers3,
};

export function NotificationHomeInsights({
  apps,
  appsLoading,
  appsError,
  appsRefreshing,
  profile,
  deliveryStatus,
  onRetryApps,
  onOpenSettings,
}: {
  apps: AppNotificationCounter[];
  appsLoading: boolean;
  appsError: boolean;
  appsRefreshing: boolean;
  profile: NotificationDeliveryProfile;
  deliveryStatus: NotificationDeliveryStatus;
  onRetryApps: () => void;
  onOpenSettings: () => void;
}) {
  const { t } = useTranslation('notifications');

  return (
    <Stack
      component="aside"
      data-testid="notification-home-insights"
      spacing={1.5}
      aria-label={t('home.summaryLabel')}
    >
      <Box
        component="section"
        aria-labelledby="notification-home-apps"
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: (theme) => `${theme.shape.borderRadius}px`,
          bgcolor: 'background.paper',
          boxShadow: 'var(--notification-panel-shadow)',
        }}
      >
        <Stack direction="row" alignItems="center" gap={1} sx={{ px: 2, pt: 2, pb: 1 }}>
          <Grid3X3 size={17} color="var(--dwp-product-accent)" aria-hidden="true" />
          <Typography
            id="notification-home-apps"
            component="h2"
            variant="subtitle1"
            fontWeight="fontWeightBold"
          >
            {t('preferences.apps.title')}
          </Typography>
        </Stack>
        <Box sx={{ px: 2, pb: 1 }}>
          {appsLoading ? (
            <LoadingState label={t('states.loadingAppSettings')} size="compact" />
          ) : appsError ? (
            <LocalErrorState
              title={t('states.loadErrorTitle')}
              description={t('states.loadErrorDescription')}
              retryLabel={t('actions.retry')}
              onRetry={onRetryApps}
              retrying={appsRefreshing}
              size="compact"
            />
          ) : apps.length ? (
            apps.map((app) => {
              const normalizedAppKey = app.appKey.toLocaleLowerCase('en-US');
              const AppIcon = SOURCE_ICON[normalizedAppKey] ?? Bell;
              const appName = t(`sources.${normalizedAppKey}`, { defaultValue: app.appKey });
              return (
                <Box key={app.appKey}>
                  <ButtonBase
                    component={Link}
                    to={notificationCenterPath({ view: 'ALL', appKey: app.appKey })}
                    aria-label={t('home.openAppNotifications', { app: appName })}
                    sx={{
                      width: 1,
                      py: 1,
                      textAlign: 'left',
                      borderRadius: (theme) => `${theme.shape.borderRadius}px`,
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" width={1}>
                      <GlyphSurface size={28} variant="soft">
                        <AppIcon size={16} strokeWidth={1.8} />
                      </GlyphSurface>
                      <Box minWidth={0} flex={1}>
                        <Typography variant="body2" fontWeight="fontWeightMedium">
                          {appName}
                        </Typography>
                      </Box>
                      <Stack direction="row" gap={0.75} alignItems="center">
                        <Chip
                          size="small"
                          label={`${t('home.metrics.unread')} ${app.totalUnread}`}
                          sx={{ height: 22, fontVariantNumeric: 'tabular-nums' }}
                        />
                        <Typography
                          variant="caption"
                          color={app.actionableUnread > 0 ? 'error.main' : 'text.secondary'}
                        >
                          {t('home.metrics.actionable')} {app.actionableUnread}
                        </Typography>
                      </Stack>
                    </Stack>
                  </ButtonBase>
                </Box>
              );
            })
          ) : (
            <EmptyState
              title={t('preferences.apps.emptyTitle')}
              description={t('preferences.apps.emptyDescription')}
              icon={<Bell size={22} />}
              size="compact"
            />
          )}
        </Box>
      </Box>

      <Box
        component="section"
        aria-labelledby="notification-home-delivery"
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: (theme) => `${theme.shape.borderRadius}px`,
          bgcolor: 'background.paper',
          boxShadow: 'var(--notification-panel-shadow)',
          px: 2,
          py: 1.5,
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
          <Box>
            <Typography
              id="notification-home-delivery"
              component="h2"
              variant="subtitle1"
              fontWeight="fontWeightBold"
            >
              {t('settings.title')}
            </Typography>
          </Box>
          <ActionIconButton label={t('actions.settings')} size="small" onClick={onOpenSettings}>
            <Settings2 size={16} />
          </ActionIconButton>
        </Stack>
        <Box sx={{ mt: 1 }}>
          {[
            {
              icon: Monitor,
              label: t('preferences.presentation.banner'),
              value: t(`preferences.presentation.bannerModes.${profile.presentation.bannerMode}`),
            },
            {
              icon: Clock3,
              label: t('preferences.quiet.title'),
              value: profile.quietHours.enabled
                ? `${profile.quietHours.start}–${profile.quietHours.end}`
                : t('preferences.digest.modes.OFF'),
            },
            {
              icon: Mail,
              label: t('preferences.status.external.label'),
              value:
                deliveryStatus.externalDeliveryEnabled == null
                  ? t('preferences.status.state.CHECKING')
                  : deliveryStatus.externalDeliveryEnabled
                    ? t('preferences.status.external.enabled', {
                        count: deliveryStatus.externalChannels.length,
                      })
                    : t('preferences.status.external.disabled'),
            },
            {
              icon: ShieldCheck,
              label: t('preferences.status.policy.label'),
              value: t(`preferences.status.policy.${deliveryStatus.policyState}`),
            },
          ].map((metric, index) => (
            <Box key={metric.label}>
              <Stack
                direction="row"
                alignItems="center"
                gap={1}
                sx={{
                  py: 0.85,
                  px: 0.75,
                  bgcolor: index % 2 === 0 ? 'action.hover' : 'transparent',
                  borderRadius: (theme) => `${theme.shape.borderRadius}px`,
                }}
              >
                <Box aria-hidden="true" sx={{ color: 'primary.main', display: 'grid' }}>
                  <metric.icon size={17} strokeWidth={1.8} />
                </Box>
                <Typography variant="caption" color="text.secondary" flex={1}>
                  {metric.label}
                </Typography>
                <Typography variant="caption" fontWeight="fontWeightMedium" textAlign="right">
                  {metric.value}
                </Typography>
              </Stack>
            </Box>
          ))}
        </Box>
      </Box>
    </Stack>
  );
}
