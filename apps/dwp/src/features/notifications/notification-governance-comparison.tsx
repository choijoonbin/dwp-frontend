import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type {
  NotificationPolicyChannelRule,
  NotificationTemplateContent,
  TenantNotificationPolicy,
} from '@dwp-frontend/shared-utils/api/notification-api';

function changeLabel(current: unknown, proposed: unknown) {
  return current === proposed ? 'unchanged' : 'changed';
}

function policyValue(
  policy: TenantNotificationPolicy | null | undefined,
  field: 'mandatory' | 'quietHoursBypass' | 'digestMode'
) {
  if (!policy) return null;
  return policy[field];
}

function channelValue(channel: NotificationPolicyChannelRule | undefined) {
  if (!channel) return null;
  return [
    channel.enabled,
    channel.defaultMode,
    channel.userOverridable,
    channel.maxPerWindow ?? null,
  ].join(':');
}

function PolicyValue({ value }: { value: string }) {
  return (
    <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
      {value}
    </Typography>
  );
}

export function NotificationPolicyComparison({
  current,
  proposed,
}: {
  current?: TenantNotificationPolicy | null;
  proposed: TenantNotificationPolicy;
}) {
  const { t } = useTranslation('notifications');
  const fields = [
    {
      key: 'mandatory',
      label: t('admin.policies.fields.mandatory'),
      current: current
        ? t(`admin.policies.${current.mandatory ? 'yes' : 'no'}`)
        : t('admin.governance.noCurrentValue'),
      proposed: t(`admin.policies.${proposed.mandatory ? 'yes' : 'no'}`),
      state: changeLabel(policyValue(current, 'mandatory'), policyValue(proposed, 'mandatory')),
    },
    {
      key: 'quietHoursBypass',
      label: t('admin.policies.fields.quietHours'),
      current: current
        ? t(`admin.policies.${current.quietHoursBypass ? 'bypass' : 'respectQuietHours'}`)
        : t('admin.governance.noCurrentValue'),
      proposed: t(`admin.policies.${proposed.quietHoursBypass ? 'bypass' : 'respectQuietHours'}`),
      state: changeLabel(
        policyValue(current, 'quietHoursBypass'),
        policyValue(proposed, 'quietHoursBypass')
      ),
    },
    {
      key: 'digestMode',
      label: t('admin.policies.fields.digest'),
      current: current
        ? t(`admin.policies.digest.${current.digestMode}`)
        : t('admin.governance.noCurrentValue'),
      proposed: t(`admin.policies.digest.${proposed.digestMode}`),
      state: changeLabel(policyValue(current, 'digestMode'), policyValue(proposed, 'digestMode')),
    },
  ];
  const currentChannels = new Map(
    (current?.channels ?? []).map((channel) => [channel.channel, channel])
  );

  return (
    <Box component="section" aria-labelledby="notification-policy-comparison-title">
      <Typography id="notification-policy-comparison-title" component="h3" variant="subtitle1">
        {t('admin.governance.comparisonTitle')}
      </Typography>
      <Box component="dl" sx={{ m: 0, mt: 1, borderBlock: 1, borderColor: 'divider' }}>
        {fields.map((field) => (
          <Box
            key={field.key}
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'minmax(120px,.7fr) repeat(2,minmax(0,1fr)) auto',
              },
              gap: 1,
              alignItems: 'center',
              py: 1,
              borderBottom: 1,
              borderColor: 'divider',
              '&:last-of-type': { borderBottom: 0 },
            }}
          >
            <Typography component="dt" variant="caption" color="text.secondary">
              {field.label}
            </Typography>
            <Box component="dd" sx={{ m: 0 }}>
              <Typography variant="caption" color="text.secondary">
                {t('admin.governance.current')}
              </Typography>
              <PolicyValue value={field.current} />
            </Box>
            <Box component="dd" sx={{ m: 0 }}>
              <Typography variant="caption" color="text.secondary">
                {t('admin.governance.proposed')}
              </Typography>
              <PolicyValue value={field.proposed} />
            </Box>
            <Chip
              size="small"
              variant="outlined"
              color={field.state === 'changed' ? 'warning' : 'default'}
              label={t(`admin.governance.${field.state}`)}
            />
          </Box>
        ))}
      </Box>

      <Typography component="h4" variant="subtitle2" sx={{ mt: 2 }}>
        {t('admin.policies.channelsTitle')}
      </Typography>
      <Stack sx={{ mt: 0.75, borderBlock: 1, borderColor: 'divider' }}>
        {proposed.channels.map((channel) => {
          const currentChannel = currentChannels.get(channel.channel);
          const state = changeLabel(channelValue(currentChannel), channelValue(channel));
          const describe = (value?: NotificationPolicyChannelRule) =>
            value
              ? t('admin.governance.channelSummary', {
                  delivery: t(`admin.policies.${value.enabled ? 'enabled' : 'disabled'}`),
                  mode: t(`admin.policies.mode.${value.defaultMode}`),
                  control: t(
                    `admin.policies.${value.userOverridable ? 'userOverridable' : 'managedByTenant'}`
                  ),
                })
              : t('admin.governance.noCurrentValue');
          return (
            <Box
              key={channel.channel}
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'minmax(120px,.7fr) repeat(2,minmax(0,1fr)) auto',
                },
                gap: 1,
                alignItems: 'center',
                py: 1,
                borderBottom: 1,
                borderColor: 'divider',
                '&:last-of-type': { borderBottom: 0 },
              }}
            >
              <Typography variant="subtitle2">{t(`channels.${channel.channel}`)}</Typography>
              <PolicyValue value={describe(currentChannel)} />
              <PolicyValue value={describe(channel)} />
              <Chip
                size="small"
                variant="outlined"
                color={state === 'changed' ? 'warning' : 'default'}
                label={t(`admin.governance.${state}`)}
              />
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}

function contentValue(
  content: NotificationTemplateContent,
  key: keyof NotificationTemplateContent
) {
  return content[key] || '';
}

export function NotificationTemplateComparison({
  current,
  proposed,
  checksum,
}: {
  current: NotificationTemplateContent;
  proposed: NotificationTemplateContent;
  checksum: string;
}) {
  const { t } = useTranslation('notifications');
  const fields: Array<keyof NotificationTemplateContent> = [
    'title',
    'preview',
    'body',
    'actionLabel',
  ];
  return (
    <Box component="section" aria-labelledby="notification-template-comparison-title">
      <Stack direction="row" gap={1} alignItems="center" justifyContent="space-between">
        <Typography id="notification-template-comparison-title" component="h3" variant="subtitle1">
          {t('admin.governance.comparisonTitle')}
        </Typography>
        <Typography component="code" variant="caption" color="text.secondary">
          {t('admin.templates.checksum', { checksum })}
        </Typography>
      </Stack>
      <Box sx={{ mt: 1, borderBlock: 1, borderColor: 'divider' }}>
        {fields.map((field) => {
          const previous = contentValue(current, field);
          const next = contentValue(proposed, field);
          const state = changeLabel(previous, next);
          return (
            <Box
              key={field}
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'minmax(110px,.55fr) repeat(2,minmax(0,1fr)) auto',
                },
                gap: 1,
                alignItems: 'start',
                py: 1.25,
                borderBottom: 1,
                borderColor: 'divider',
                '&:last-of-type': { borderBottom: 0 },
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {t(`admin.templates.fields.${field}`)}
              </Typography>
              {[previous, next].map((value, index) => (
                <Box key={index} sx={{ minWidth: 0 }}>
                  <Typography variant="caption" color="text.secondary">
                    {t(index === 0 ? 'admin.governance.current' : 'admin.governance.proposed')}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                  >
                    {value || t('admin.templates.emptyContent')}
                  </Typography>
                </Box>
              ))}
              <Chip
                size="small"
                variant="outlined"
                color={state === 'changed' ? 'warning' : 'default'}
                label={t(`admin.governance.${state}`)}
              />
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
