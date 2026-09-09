import { useTranslation } from 'react-i18next';
import { MoonStar, UserRound } from 'lucide-react';
import type {
  NotificationPolicySimulationContext,
  NotificationPolicySimulationOutcome,
} from '@dwp-frontend/shared-utils/api/notification-api';
import { FormField, TimePickerField } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

const PERSONAS: readonly NotificationPolicySimulationContext['persona'][] = [
  'KNOWLEDGE_WORKER',
  'FRONTLINE',
  'EXECUTIVE',
  'ON_CALL',
];

const TIME_ZONES = [
  'Asia/Seoul',
  'Asia/Singapore',
  'Europe/London',
  'America/New_York',
  'UTC',
] as const;

export const DEFAULT_NOTIFICATION_POLICY_SIMULATION: NotificationPolicySimulationContext = {
  persona: 'KNOWLEDGE_WORKER',
  timeZone: 'Asia/Seoul',
  localTime: '09:00',
  focusMode: false,
  quietHoursActive: false,
};

export function NotificationPolicySimulationControls({
  value,
  onChange,
}: {
  value: NotificationPolicySimulationContext;
  onChange: (value: NotificationPolicySimulationContext) => void;
}) {
  const { t } = useTranslation('notifications');
  return (
    <Box
      component="section"
      data-testid="notification-policy-simulation-controls"
      sx={{ border: 1, borderColor: 'divider', p: 1.5 }}
    >
      <Stack direction="row" gap={1} alignItems="flex-start">
        <UserRound size={18} />
        <Box>
          <Typography variant="subtitle2">{t('admin.policies.simulation.title')}</Typography>
          <Typography variant="caption" color="text.secondary">
            {t('admin.policies.simulation.description')}
          </Typography>
        </Box>
      </Stack>
      <Box
        sx={{
          mt: 1.5,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
          gap: 1.25,
        }}
      >
        <FormField
          select
          label={t('admin.policies.simulation.persona')}
          value={value.persona}
          onChange={(event) =>
            onChange({
              ...value,
              persona: event.target.value as NotificationPolicySimulationContext['persona'],
            })
          }
        >
          {PERSONAS.map((persona) => (
            <MenuItem key={persona} value={persona}>
              {t(`admin.policies.simulation.personas.${persona}`)}
            </MenuItem>
          ))}
        </FormField>
        <FormField
          select
          label={t('admin.policies.simulation.timeZone')}
          value={value.timeZone}
          onChange={(event) => onChange({ ...value, timeZone: event.target.value })}
        >
          {TIME_ZONES.map((timeZone) => (
            <MenuItem key={timeZone} value={timeZone}>
              {timeZone}
            </MenuItem>
          ))}
        </FormField>
        <TimePickerField
          label={t('admin.policies.simulation.localTime')}
          value={value.localTime}
          onValueChange={(localTime) => {
            if (localTime) onChange({ ...value, localTime: localTime.slice(0, 5) });
          }}
          timeSteps={{ minutes: 5 }}
        />
      </Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={{ xs: 0, sm: 2 }} sx={{ mt: 0.75 }}>
        <FormControlLabel
          control={
            <Switch
              checked={value.focusMode}
              onChange={(event) => onChange({ ...value, focusMode: event.target.checked })}
            />
          }
          label={t('admin.policies.simulation.focusMode')}
        />
        <FormControlLabel
          control={
            <Switch
              checked={value.quietHoursActive}
              onChange={(event) => onChange({ ...value, quietHoursActive: event.target.checked })}
            />
          }
          label={t('admin.policies.simulation.quietHoursActive')}
        />
      </Stack>
    </Box>
  );
}

export function NotificationPolicySimulationResult({
  value,
}: {
  value: NotificationPolicySimulationOutcome;
}) {
  const { t } = useTranslation('notifications');
  return (
    <Box
      data-testid="notification-policy-simulation-result"
      sx={{ border: 1, borderColor: 'divider', p: 1.5 }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
        <Stack direction="row" gap={1} alignItems="flex-start">
          <MoonStar size={18} />
          <Box>
            <Typography variant="subtitle2">
              {t('admin.policies.simulation.resultTitle')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('admin.policies.simulation.contextSummary', {
                persona: t(`admin.policies.simulation.personas.${value.context.persona}`),
                timeZone: value.context.timeZone,
                localTime: value.context.localTime,
              })}
            </Typography>
          </Box>
        </Stack>
        <Chip
          size="small"
          variant="outlined"
          color={value.attentionRisk === 'HIGH' ? 'warning' : 'default'}
          label={t('admin.policies.simulation.attentionRisk', {
            risk: t(`admin.policies.simulation.risk.${value.attentionRisk}`),
          })}
        />
      </Stack>
      <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 1.25 }}>
        {value.channels.map((channel) => (
          <Chip
            key={channel.channel}
            size="small"
            variant="outlined"
            color={
              channel.outcome === 'IMMEDIATE'
                ? 'success'
                : channel.outcome === 'DEFERRED'
                  ? 'warning'
                  : 'default'
            }
            label={t('admin.policies.simulation.channelOutcome', {
              channel: t(`channels.${channel.channel}`),
              outcome: t(`admin.policies.simulation.outcomes.${channel.outcome}`),
              reason: t(`admin.policies.simulation.reasons.${channel.reason}`),
            })}
          />
        ))}
      </Stack>
      {value.providerCostState === 'RATE_CARD_REQUIRED' && (
        <Typography variant="caption" color="warning.main" sx={{ mt: 1, display: 'block' }}>
          {t('admin.policies.simulation.rateCardRequired')}
        </Typography>
      )}
    </Box>
  );
}
