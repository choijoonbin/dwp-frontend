import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  Bell,
  BellRing,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Layers3,
  Mail,
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
  ProgressMeter,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { notificationCenterPath } from './notification-navigation';

import type {
  AppNotificationCounter,
  NotificationDeliveryProfile,
} from '@dwp-frontend/shared-utils';
import type { LucideIcon } from 'lucide-react';

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
  onRetryApps,
  onOpenSettings,
}: {
  apps: AppNotificationCounter[];
  appsLoading: boolean;
  appsError: boolean;
  appsRefreshing: boolean;
  profile: NotificationDeliveryProfile;
  onRetryApps: () => void;
  onOpenSettings: () => void;
}) {
  const { t } = useTranslation('notifications');
  const appScale = Math.max(1, ...apps.map((app) => app.totalUnread));
  const channels = Object.values(profile.channels);
  const deliveryMetrics = {
    enabledChannels: channels.filter(Boolean).length,
    totalChannels: channels.length,
  };

  return (
    <Stack component="aside" spacing={1.5} aria-label={t('home.summaryLabel')}>
      <Box
        component="section"
        aria-labelledby="notification-home-apps"
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 'shape.borderRadius',
          bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ px: 1.5, pt: 1.4, pb: 1.1 }}>
          <Typography
            id="notification-home-apps"
            component="h2"
            variant="subtitle1"
            fontWeight="fontWeightBold"
          >
            {t('preferences.apps.title')}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.2 }}>
            {t('home.appDistribution')}
          </Typography>
        </Box>
        <Divider />
        <Box sx={{ px: 1.5 }}>
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
            apps.map((app, index) => {
              const normalizedAppKey = app.appKey.toLocaleLowerCase('en-US');
              const AppIcon = SOURCE_ICON[normalizedAppKey] ?? Bell;
              const appName = t(`sources.${normalizedAppKey}`, { defaultValue: app.appKey });
              return (
                <Box key={app.appKey}>
                  {index > 0 && <Divider />}
                  <ButtonBase
                    component={Link}
                    to={notificationCenterPath({ view: 'ALL', appKey: app.appKey })}
                    aria-label={t('home.openAppNotifications', { app: appName })}
                    sx={{
                      width: 1,
                      py: 1.15,
                      textAlign: 'left',
                      borderRadius: 'shape.borderRadius',
                    }}
                  >
                    <Stack direction="row" spacing={1.1} alignItems="flex-start" width={1}>
                      <GlyphSurface size={32} variant="soft">
                        <AppIcon size={16} strokeWidth={1.8} />
                      </GlyphSurface>
                      <Box minWidth={0} flex={1}>
                        <ProgressMeter
                          label={appName}
                          value={(app.totalUnread / appScale) * 100}
                          valueLabel={`${t('home.metrics.unread')} ${app.totalUnread}`}
                          size="compact"
                        />
                        <Stack direction="row" gap={1.25} sx={{ mt: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            {t('home.metrics.actionable')} {app.actionableUnread}
                          </Typography>
                          <Typography variant="caption" color="error.main">
                            {t('priority.URGENT')} {app.urgentUnread}
                          </Typography>
                        </Stack>
                      </Box>
                      <ArrowRight size={15} aria-hidden="true" />
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
          borderRadius: 'shape.borderRadius',
          bgcolor: 'background.paper',
          px: 1.5,
          py: 1.4,
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
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.2 }}>
              {t('settings.description')}
            </Typography>
          </Box>
          <ActionIconButton label={t('actions.settings')} size="small" onClick={onOpenSettings}>
            <Settings2 size={16} />
          </ActionIconButton>
        </Stack>
        <Box sx={{ mt: 1.1, borderTop: 1, borderColor: 'divider' }}>
          {[
            {
              icon: BellRing,
              label: t('preferences.global.title'),
              value: `${deliveryMetrics.enabledChannels} / ${deliveryMetrics.totalChannels}`,
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
              label: t('preferences.digest.title'),
              value: t(`preferences.digest.modes.${profile.digest.mode}`),
            },
          ].map((metric, index) => (
            <Box key={metric.label}>
              {index > 0 && <Divider />}
              <Stack direction="row" alignItems="center" gap={1.1} sx={{ py: 1.25 }}>
                <Box aria-hidden="true" sx={{ color: 'primary.main', display: 'grid' }}>
                  <metric.icon size={17} strokeWidth={1.8} />
                </Box>
                <Typography variant="body2" color="text.secondary" flex={1}>
                  {metric.label}
                </Typography>
                <Typography variant="body2" fontWeight="fontWeightBold" textAlign="right">
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
