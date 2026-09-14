import { useTranslation } from 'react-i18next';
import { Building2, Clock3, RotateCcw } from 'lucide-react';
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
import {
  notificationPreferenceChipSx,
  notificationPreferenceRadius,
  notificationPreferenceSoftBackground,
} from './notification-preference-styles';

const MATRIX_QUERY = '@container notification-type-settings (min-width: 900px)';
const TYPE_MODE_QUERY = '@container notification-type-settings (min-width: 520px)';
const MATRIX_COLUMNS = 'minmax(180px, 1.3fr) minmax(156px, .95fr) minmax(0, 3fr)';
const CHANNEL_COLUMNS = `repeat(${USER_CHANNELS.length}, minmax(0, 1fr))`;

export function ManagedChip({ owner }: { owner?: string | null }) {
  const { t } = useTranslation('notifications');
  return (
    <Tooltip title={owner ? t('preferences.managedBy', { owner }) : t('preferences.managed')}>
      <Chip
        size="small"
        variant="outlined"
        icon={<Building2 size={13} />}
        label={t('preferences.managed')}
        sx={{
          ...notificationPreferenceChipSx,
          bgcolor: notificationPreferenceSoftBackground,
          color: 'text.secondary',
        }}
      />
    </Tooltip>
  );
}

export function UnavailableChannelChip() {
  const { t } = useTranslation('notifications');
  return (
    <Tooltip title={t('preferences.channelUnavailable')}>
      <Chip
        size="small"
        variant="outlined"
        icon={<Clock3 size={13} />}
        label={t('preferences.channelUnavailable')}
        sx={{
          ...notificationPreferenceChipSx,
          bgcolor: notificationPreferenceSoftBackground,
          color: 'text.secondary',
        }}
      />
    </Tooltip>
  );
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
    <Box
      sx={{
        minWidth: 0,
        containerType: 'inline-size',
        containerName: 'notification-type-settings',
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          display: 'none',
          px: 2,
          py: 0.75,
          columnGap: 2,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: notificationPreferenceSoftBackground,
          [MATRIX_QUERY]: { display: 'grid', gridTemplateColumns: MATRIX_COLUMNS },
        }}
      >
        <Typography variant="caption" color="text.secondary" fontWeight="fontWeightMedium">
          {t(`sources.${app.appKey.toLowerCase()}`, { defaultValue: app.appName })}
        </Typography>
        <Typography variant="caption" color="text.secondary" fontWeight="fontWeightMedium">
          {t('preferences.deliveryMode')}
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: CHANNEL_COLUMNS, gap: 0.75, minWidth: 0 }}>
          {USER_CHANNELS.map((channel) => (
            <Typography
              key={channel}
              variant="caption"
              color="text.secondary"
              fontWeight="fontWeightMedium"
              sx={{ minWidth: 0, textAlign: 'center', overflowWrap: 'anywhere' }}
            >
              {t(`channels.${channel}`)}
            </Typography>
          ))}
        </Box>
      </Box>
      <Stack divider={<Divider flexItem />}>
        {app.types.map((setting) => {
          const translationKey = `preferences.types.${setting.typeKey.replace(/\./g, '_')}`;
          const typeName = t(`${translationKey}.label`, { defaultValue: setting.typeName });
          const typeDescription = t(`${translationKey}.description`, {
            defaultValue: setting.description ?? '',
          });
          return (
            <Box
              key={setting.typeKey}
              sx={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr)',
                columnGap: 2,
                rowGap: 1.25,
                alignItems: 'start',
                px: { xs: 1.5, sm: 2 },
                py: 1.25,
                bgcolor: 'background.paper',
                position: 'relative',
                '&::before': {
                  position: 'absolute',
                  inset: '0 auto 0 0',
                  width: 3,
                  bgcolor:
                    setting.mandatory || setting.mode.managed ? 'primary.main' : 'transparent',
                  content: '""',
                },
                [TYPE_MODE_QUERY]: {
                  gridTemplateColumns: 'minmax(0, 1fr) minmax(156px, .75fr)',
                },
                [MATRIX_QUERY]: { gridTemplateColumns: MATRIX_COLUMNS },
              }}
            >
              <Box minWidth={0}>
                <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
                  <Typography
                    component="h4"
                    variant="body2"
                    fontWeight="fontWeightBold"
                    sx={{ overflowWrap: 'anywhere' }}
                  >
                    {typeName}
                  </Typography>
                  {setting.mandatory && (
                    <Chip
                      size="small"
                      color="info"
                      variant="outlined"
                      label={t('preferences.mandatory')}
                      sx={notificationPreferenceChipSx}
                    />
                  )}
                  {setting.quietHoursBypass && (
                    <Tooltip title={t('preferences.quiet.managedBypassDescription')}>
                      <Chip
                        size="small"
                        color="warning"
                        variant="outlined"
                        label={t('preferences.quiet.managedBypass')}
                        sx={notificationPreferenceChipSx}
                      />
                    </Tooltip>
                  )}
                  {setting.mode.managed && <ManagedChip owner={setting.mode.ownerLabel} />}
                </Stack>
                {typeDescription && (
                  <Tooltip title={typeDescription}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        mt: 0.25,
                        display: '-webkit-box',
                        WebkitBoxOrient: 'vertical',
                        WebkitLineClamp: 2,
                        overflow: 'hidden',
                        overflowWrap: 'anywhere',
                        [MATRIX_QUERY]: { WebkitLineClamp: 1 },
                      }}
                    >
                      {typeDescription}
                    </Typography>
                  </Tooltip>
                )}
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 0.25, overflowWrap: 'anywhere' }}
                >
                  {t('preferences.inheritedFrom', {
                    source: t(`preferences.sources.${setting.mode.source}`),
                  })}
                </Typography>
              </Box>
              <Stack gap={0.5} sx={{ minWidth: 0 }}>
                <FormField
                  fullWidth
                  select
                  size="small"
                  value={setting.mode.effectiveValue}
                  disabled={disabled || setting.mode.managed || busyType === setting.typeKey}
                  onChange={(event) =>
                    onUpdate(setting, { mode: event.target.value as NotificationDeliveryMode })
                  }
                  label={t('preferences.deliveryMode')}
                  sx={{ minWidth: 0 }}
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
                    sx={{
                      minWidth: 0,
                      maxWidth: '100%',
                      minHeight: 28,
                      borderRadius: notificationPreferenceRadius,
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                      whiteSpace: 'normal',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {t('preferences.resetToManaged')}
                  </ActionButton>
                )}
              </Stack>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 132px), 1fr))',
                  gridColumn: '1 / -1',
                  gap: 0.75,
                  minWidth: 0,
                  [MATRIX_QUERY]: { gridColumn: 'auto', gridTemplateColumns: CHANNEL_COLUMNS },
                }}
              >
                {USER_CHANNELS.map((channel) => {
                  const value = setting.channels[channel];
                  if (!value) {
                    return (
                      <Tooltip key={channel} title={t('preferences.valueNotProvided')}>
                        <Box
                          component="span"
                          sx={{
                            display: 'none',
                            color: 'text.secondary',
                            [MATRIX_QUERY]: {
                              display: 'grid',
                              placeItems: 'center',
                              minHeight: 52,
                            },
                          }}
                        >
                          -
                        </Box>
                      </Tooltip>
                    );
                  }
                  const available = enabledChannels.has(channel);
                  return (
                    <FormControlLabel
                      key={channel}
                      sx={{
                        m: 0,
                        minWidth: 0,
                        alignItems: 'flex-start',
                        '& .MuiFormControlLabel-label': { minWidth: 0, flex: 1 },
                        [MATRIX_QUERY]: {
                          flexDirection: 'column',
                          alignItems: 'center',
                          '& .MuiFormControlLabel-label': { width: 1, flex: '0 0 auto' },
                        },
                      }}
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
                        <Stack
                          gap={0.5}
                          alignItems="flex-start"
                          sx={{
                            minWidth: 0,
                            minHeight: 32,
                            py: 0.5,
                            [MATRIX_QUERY]: { alignItems: 'center', minHeight: 20, py: 0 },
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{ overflowWrap: 'anywhere', [MATRIX_QUERY]: { display: 'none' } }}
                          >
                            {t(`channels.${channel}`)}
                          </Typography>
                          {!available && <UnavailableChannelChip />}
                          {value.managed && <ManagedChip owner={value.ownerLabel} />}
                        </Stack>
                      }
                    />
                  );
                })}
              </Box>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
