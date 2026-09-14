import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BellRing,
  CalendarClock,
  ChevronDown,
  CircleAlert,
  Database,
  MailCheck,
  Radio,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ActionButton, LoadingState } from '@dwp-frontend/design-system';

import { resolveNotificationDeliveryStatus } from './notification-delivery-status-model';
import { NotificationDeliveryEndpointInventory } from './notification-delivery-endpoints';
import {
  notificationPreferenceChipSx,
  notificationPreferenceRadius,
  notificationPreferenceSelectedBackground,
  notificationPreferenceSoftBackground,
} from './notification-preference-styles';

import type { LucideIcon } from 'lucide-react';
import type {
  NotificationCapabilities,
  NotificationDeliveryEndpoint,
  NotificationDeliveryProfile,
  NotificationEffectiveSettings,
} from '@dwp-frontend/shared-utils/api/notification-api';

function StatusItem({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Box
      sx={{
        minWidth: 0,
        minHeight: 64,
        p: { xs: 1, sm: 1.25 },
        display: 'grid',
        gridTemplateColumns: { xs: '28px minmax(0, 1fr)', sm: '32px minmax(0, 1fr)' },
        gap: 1,
        bgcolor: notificationPreferenceSoftBackground,
        borderRadius: notificationPreferenceRadius,
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: { xs: 28, sm: 32 },
          height: { xs: 28, sm: 32 },
          display: 'grid',
          placeItems: 'center',
          bgcolor: notificationPreferenceSelectedBackground,
          color: 'primary.main',
          borderRadius: notificationPreferenceRadius,
        }}
      >
        <Icon size={15} />
      </Box>
      <Box minWidth={0}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="body2" fontWeight="fontWeightBold" sx={{ overflowWrap: 'anywhere' }}>
          {value}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mt: 0.25, overflowWrap: 'anywhere' }}
        >
          {detail}
        </Typography>
      </Box>
    </Box>
  );
}

export function NotificationDeliveryStatusPanel({
  capabilities,
  profile,
  effectiveSettings,
  effectiveSettingsFailed,
  refreshing,
  onRefresh,
  endpoints,
  endpointsLoading,
  endpointsFailed,
  revokingEndpointId,
  onRetryEndpoints,
  onRevokeEndpoint,
  defaultDiagnosticsOpen = false,
}: {
  capabilities?: NotificationCapabilities;
  profile: NotificationDeliveryProfile;
  effectiveSettings?: NotificationEffectiveSettings;
  effectiveSettingsFailed: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  endpoints?: NotificationDeliveryEndpoint[];
  endpointsLoading: boolean;
  endpointsFailed: boolean;
  revokingEndpointId?: string | null;
  onRetryEndpoints: () => void;
  onRevokeEndpoint: (endpoint: NotificationDeliveryEndpoint) => Promise<void>;
  defaultDiagnosticsOpen?: boolean;
}) {
  const { t } = useTranslation('notifications');
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(defaultDiagnosticsOpen);
  const status = resolveNotificationDeliveryStatus({
    capabilities,
    profile,
    effectiveSettings,
    effectiveSettingsFailed,
  });
  const stateColor =
    status.state === 'READY'
      ? 'success'
      : status.state === 'BLOCKED'
        ? 'error'
        : status.state === 'PARTIAL'
          ? 'warning'
          : 'default';

  return (
    <Box
      component="section"
      aria-labelledby="notification-delivery-status-title"
      sx={{
        mt: 2,
        p: { xs: 1.5, md: 2 },
        bgcolor: 'background.paper',
        borderRadius: notificationPreferenceRadius,
        containerType: 'inline-size',
        containerName: 'notification-delivery-status',
      }}
    >
      <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" sx={{ mb: 1.5 }}>
        <Typography id="notification-delivery-status-title" component="h2" variant="h6">
          {t('preferences.status.title')}
        </Typography>
        <Chip
          size="small"
          color={stateColor}
          variant={status.state === 'CHECKING' ? 'outlined' : 'filled'}
          label={t(`preferences.status.state.${status.state}`)}
          sx={notificationPreferenceChipSx}
        />
        <Typography variant="caption" color="text.secondary" sx={{ ml: { sm: 'auto' } }}>
          {status.generatedAt
            ? t('preferences.status.verifiedAt', {
                time: formatDate(status.generatedAt, { dateStyle: 'medium', timeStyle: 'short' }),
              })
            : t('preferences.status.verifying')}
        </Typography>
        <ActionButton
          intent="quiet"
          size="small"
          startIcon={<RefreshCw size={16} />}
          loading={refreshing}
          loadingLabel={t('preferences.status.rechecking')}
          onClick={onRefresh}
        >
          {t('preferences.status.recheck')}
        </ActionButton>
      </Stack>
      {!capabilities ? (
        <LoadingState
          label={t('preferences.status.verifying')}
          variant="skeleton"
          skeletonRows={1}
          skeletonHeight={76}
          embedded
        />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            gap: 1,
            bgcolor: 'background.paper',
            '@container notification-delivery-status (min-width: 300px)': {
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            },
            '@container notification-delivery-status (min-width: 900px)': {
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            },
          }}
        >
          <StatusItem
            icon={BellRing}
            label={t('preferences.status.inApp.label')}
            value={t(`preferences.status.inApp.${status.inAppEnabled ? 'enabled' : 'disabled'}`)}
            detail={t('preferences.status.inApp.detail')}
          />
          <StatusItem
            icon={MailCheck}
            label={t('preferences.status.external.label')}
            value={
              status.externalDeliveryEnabled
                ? t('preferences.status.external.enabled', {
                    count: status.externalChannels.length,
                  })
                : t('preferences.status.external.disabled')
            }
            detail={t('preferences.status.external.detail')}
          />
          <StatusItem
            icon={CalendarClock}
            label={t('preferences.status.focus.label')}
            value={
              status.quietHoursEnabled
                ? t('preferences.status.focus.enabled', {
                    start: profile.quietHours.start,
                    end: profile.quietHours.end,
                  })
                : t('preferences.status.focus.disabled')
            }
            detail={profile.quietHours.timeZone}
          />
          <StatusItem
            icon={status.policyState === 'CURRENT' ? ShieldCheck : CircleAlert}
            label={t('preferences.status.policy.label')}
            value={t(`preferences.status.policy.${status.policyState}`)}
            detail={t(`preferences.status.digest.${status.digestMode}`)}
          />
        </Box>
      )}
      <ActionButton
        intent="quiet"
        size="small"
        endIcon={<ChevronDown size={16} />}
        aria-expanded={diagnosticsOpen}
        aria-controls="notification-delivery-technical-details"
        onClick={() => setDiagnosticsOpen((open) => !open)}
        sx={{ mt: 1 }}
      >
        {t(
          diagnosticsOpen
            ? 'preferences.status.hideDiagnostics'
            : 'preferences.status.showDiagnostics'
        )}
      </ActionButton>
      <Box
        id="notification-delivery-technical-details"
        sx={{ display: diagnosticsOpen ? 'block' : 'none' }}
      >
        {capabilities && (
          <Box
            data-testid="notification-delivery-diagnostics"
            sx={{
              mt: 1.75,
              pt: 1.5,
              borderTop: 1,
              borderColor: 'divider',
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr)',
              gap: 1.5,
              '@container notification-delivery-status (min-width: 600px)': {
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              },
            }}
          >
            <StatusItem
              icon={Database}
              label={t('preferences.status.runtime.storeLabel')}
              value={t(
                `preferences.status.runtime.${status.canonicalStore ?? 'UNKNOWN'}`,
                status.canonicalStore ?? t('preferences.status.runtime.unknown')
              )}
              detail={t('preferences.status.runtime.storeDetail')}
            />
            <StatusItem
              icon={Radio}
              label={t('preferences.status.runtime.realtimeLabel')}
              value={t(
                `preferences.status.runtime.${status.realtimeTransport ?? 'UNKNOWN'}`,
                status.realtimeTransport ?? t('preferences.status.runtime.unknown')
              )}
              detail={t('preferences.status.runtime.realtimeDetail')}
            />
            <Box sx={{ minWidth: 0, gridColumn: '1 / -1' }}>
              <Typography variant="caption" color="text.secondary">
                {t('preferences.status.channelsLabel')}
              </Typography>
              <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 0.75 }}>
                {status.enabledChannels.map((channel) => (
                  <Chip
                    key={channel}
                    size="small"
                    color="success"
                    variant="outlined"
                    sx={notificationPreferenceChipSx}
                    label={t('preferences.status.channelReady', {
                      channel: t(`channels.${channel}`),
                    })}
                  />
                ))}
                {status.unavailableChannels.map((channel) => (
                  <Chip
                    key={channel}
                    size="small"
                    variant="outlined"
                    sx={notificationPreferenceChipSx}
                    label={t('preferences.status.channelUnavailable', {
                      channel: t(`channels.${channel}`),
                    })}
                  />
                ))}
              </Stack>
            </Box>
          </Box>
        )}
        <NotificationDeliveryEndpointInventory
          endpoints={endpoints}
          loading={endpointsLoading}
          failed={endpointsFailed}
          revokingId={revokingEndpointId}
          onRetry={onRetryEndpoints}
          onRevoke={onRevokeEndpoint}
        />
      </Box>
    </Box>
  );
}
