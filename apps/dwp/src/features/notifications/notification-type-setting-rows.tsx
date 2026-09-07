import { useTranslation } from 'react-i18next';
import { Building2, RotateCcw } from 'lucide-react';
import {
  type NotificationAppSetting,
  type NotificationChannel,
  type NotificationDeliveryMode,
  type NotificationTypeSetting,
} from '@dwp-frontend/shared-utils/api/notification-api';
import { ActionButton, EmptyState, FormField } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { USER_CHANNELS } from './notification-model';

export function ManagedChip({ owner }: { owner?: string | null }) {
  const { t } = useTranslation('notifications');
  return (
    <Tooltip title={owner ? t('preferences.managedBy', { owner }) : t('preferences.managed')}>
      <Chip
        size="small"
        variant="outlined"
        icon={<Building2 size={13} />}
        label={t('preferences.managed')}
      />
    </Tooltip>
  );
}

export function UnavailableChannelChip() {
  const { t } = useTranslation('notifications');
  return <Chip size="small" variant="outlined" label={t('preferences.channelUnavailable')} />;
}

export function TypeSettingRows({
  app,
  disabled,
  onUpdate,
  onReset,
  busyType,
  enabledChannels,
  externalDeliveryEnabled,
}: {
  app: NotificationAppSetting;
  disabled: boolean;
  onUpdate: (
    setting: NotificationTypeSetting,
    patch: { mode?: NotificationDeliveryMode; channel?: NotificationChannel; enabled?: boolean }
  ) => void;
  onReset: (setting: NotificationTypeSetting) => void;
  busyType: string | null;
  enabledChannels: ReadonlySet<NotificationChannel>;
  externalDeliveryEnabled: boolean;
}) {
  const { t } = useTranslation('notifications');
  if (app.types.length === 0) {
    return (
      <EmptyState
        title={t('preferences.apps.emptyTypesTitle')}
        description={t('preferences.apps.emptyTypesDescription')}
        size="compact"
      />
    );
  }

  return (
    <Stack divider={<Divider flexItem />}>
      {app.types.map((setting) => {
        const translationKey = `preferences.types.${setting.typeKey.replace(/\./g, '_')}`;
        const typeName = t(`${translationKey}.label`, { defaultValue: setting.typeName });
        const typeDescription = t(`${translationKey}.description`, {
          defaultValue: setting.description ?? '',
        });
        return (
          <Box key={setting.typeKey} sx={{ px: { xs: 1.5, sm: 2 }, py: 1.75 }}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              justifyContent="space-between"
              alignItems={{ xs: 'stretch', md: 'flex-start' }}
              gap={2}
            >
              <Box minWidth={0} sx={{ flex: 1 }}>
                <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
                  <Typography component="h4" variant="subtitle2">
                    {typeName}
                  </Typography>
                  {setting.mandatory && (
                    <Chip
                      size="small"
                      color="info"
                      variant="outlined"
                      label={t('preferences.mandatory')}
                    />
                  )}
                  {setting.quietHoursBypass && (
                    <Tooltip title={t('preferences.quiet.managedBypassDescription')}>
                      <Chip
                        size="small"
                        color="warning"
                        variant="outlined"
                        label={t('preferences.quiet.managedBypass')}
                      />
                    </Tooltip>
                  )}
                  {setting.mode.managed && <ManagedChip owner={setting.mode.ownerLabel} />}
                </Stack>
                {typeDescription && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                    {typeDescription}
                  </Typography>
                )}
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 0.5 }}
                >
                  {t('preferences.inheritedFrom', {
                    source: t(`preferences.sources.${setting.mode.source}`),
                  })}
                </Typography>
              </Box>
              <Stack gap={1.25} alignItems={{ xs: 'stretch', md: 'flex-end' }}>
                <FormField
                  select
                  size="small"
                  value={setting.mode.effectiveValue}
                  disabled={disabled || setting.mode.managed || busyType === setting.typeKey}
                  onChange={(event) =>
                    onUpdate(setting, { mode: event.target.value as NotificationDeliveryMode })
                  }
                  label={t('preferences.deliveryMode')}
                  sx={{ minWidth: 180 }}
                >
                  {(externalDeliveryEnabled
                    ? (['IMMEDIATE', 'DAILY_DIGEST', 'WEEKLY_DIGEST', 'MUTED'] as const)
                    : (['IMMEDIATE', 'MUTED'] as const)
                  ).map((mode) => (
                    <MenuItem key={mode} value={mode}>
                      {t(`preferences.modes.${mode}`)}
                    </MenuItem>
                  ))}
                </FormField>
                {setting.ruleId && (
                  <ActionButton
                    intent="quiet"
                    size="small"
                    startIcon={<RotateCcw size={15} />}
                    disabled={disabled || busyType === setting.typeKey}
                    onClick={() => onReset(setting)}
                  >
                    {t('preferences.resetToManaged')}
                  </ActionButton>
                )}
              </Stack>
            </Stack>
            <Stack direction="row" gap={1.5} flexWrap="wrap" sx={{ mt: 1.25 }}>
              {USER_CHANNELS.map((channel) => {
                const value = setting.channels[channel];
                if (!value) return null;
                const available = enabledChannels.has(channel);
                return (
                  <FormControlLabel
                    key={channel}
                    control={
                      <Switch
                        size="small"
                        checked={available && value.effectiveValue}
                        disabled={
                          disabled || !available || value.managed || busyType === setting.typeKey
                        }
                        onChange={(event) =>
                          onUpdate(setting, { channel, enabled: event.target.checked })
                        }
                        slotProps={{
                          input: {
                            'aria-label': t('preferences.channelToggle', {
                              type: typeName,
                              channel: t(`channels.${channel}`),
                            }),
                          },
                        }}
                      />
                    }
                    label={
                      <Stack direction="row" gap={0.5} alignItems="center">
                        <Typography variant="body2">{t(`channels.${channel}`)}</Typography>
                        {!available && <UnavailableChannelChip />}
                        {value.managed && <ManagedChip owner={value.ownerLabel} />}
                      </Stack>
                    }
                  />
                );
              })}
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
}
