import { useTranslation } from 'react-i18next';
import { BellRing, Mail, MessageSquare, Monitor, Smartphone } from 'lucide-react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

import { USER_CHANNELS } from './notification-model';
import { ManagedChip, UnavailableChannelChip } from './notification-type-setting-rows';
import {
  notificationPreferenceRadius,
  notificationPreferenceSelectedBackground,
  notificationPreferenceSoftBackground,
} from './notification-preference-styles';

import type {
  NotificationChannel,
  NotificationDeliveryProfile,
  NotificationEffectiveSettings,
} from '@dwp-frontend/shared-utils/api/notification-api';

const CHANNEL_ICON = {
  IN_APP: BellRing,
  EMAIL: Mail,
  WEB_PUSH: Monitor,
  MOBILE_PUSH: Smartphone,
  TEAMS: MessageSquare,
  SLACK: MessageSquare,
};

export function NotificationChannelGrid({
  profile,
  effectiveSettings,
  enabledChannels,
  disabled,
  profileIsPending = false,
  onChange,
}: {
  profile: NotificationDeliveryProfile;
  effectiveSettings?: NotificationEffectiveSettings;
  enabledChannels: ReadonlySet<NotificationChannel>;
  disabled: boolean;
  profileIsPending?: boolean;
  onChange: (channel: NotificationChannel, enabled: boolean) => void;
}) {
  const { t } = useTranslation('notifications');
  return (
    <Box
      data-testid="notification-channel-grid"
      sx={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        gap: 1,
        '@container notification-preferences (min-width: 300px)': {
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        },
        '@container notification-preferences (min-width: 640px)': {
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        },
        '@container notification-preferences (min-width: 960px)': {
          gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
        },
      }}
    >
      {USER_CHANNELS.map((channel) => {
        const Icon = CHANNEL_ICON[channel];
        const managed = effectiveSettings?.globalChannels[channel];
        const available = enabledChannels.has(channel);
        const checked =
          available &&
          (profileIsPending && !managed?.managed
            ? profile.channels[channel]
            : (managed?.effectiveValue ?? profile.channels[channel]));
        return (
          <Box
            key={channel}
            data-testid={`notification-channel-${channel}`}
            sx={{
              minWidth: 0,
              p: 1,
              border: 1,
              borderColor: checked ? 'primary.main' : 'transparent',
              borderRadius: notificationPreferenceRadius,
              bgcolor: checked
                ? notificationPreferenceSelectedBackground
                : notificationPreferenceSoftBackground,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={0.5}>
              <Box sx={{ display: 'flex', color: checked ? 'primary.main' : 'text.secondary' }}>
                <Icon size={18} aria-hidden="true" />
              </Box>
              <Switch
                size="small"
                checked={checked}
                disabled={disabled || !available || managed?.managed}
                onChange={(event) => onChange(channel, event.target.checked)}
                slotProps={{
                  input: {
                    role: 'switch',
                    'aria-label': t('preferences.global.channelToggle', {
                      channel: t(`channels.${channel}`),
                    }),
                  },
                }}
              />
            </Stack>
            <Typography
              variant="body2"
              fontWeight="fontWeightBold"
              sx={{
                mt: 0.5,
                overflowWrap: 'anywhere',
                color: available ? 'text.primary' : 'text.secondary',
              }}
            >
              {t(`channels.${channel}`)}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: 'block',
                mt: 0.25,
                overflowWrap: 'anywhere',
                '@media (min-width: 1200px)': {
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                },
              }}
            >
              {t(`preferences.global.channelDescription.${channel}`)}
            </Typography>
            <Box sx={{ pt: 0.75, mt: 'auto', minHeight: 22 }}>
              {!available ? (
                <UnavailableChannelChip />
              ) : managed?.managed ? (
                <ManagedChip owner={managed.ownerLabel} />
              ) : null}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
