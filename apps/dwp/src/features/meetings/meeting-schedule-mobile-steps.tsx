import { useTranslation } from 'react-i18next';
import { Sparkles, CalendarClock, ChartNoAxesColumn } from 'lucide-react';
import { ActionButton, ProgressMeter } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { meetingInsetSurface, meetingShape, meetingSoftShadow } from './meeting-visual-system';
import type { MeetingScheduleDraft } from './meeting-schedule-model';

export function MeetingScheduleMobileSteps({
  step,
  busy,
  onStep,
  templateApplied,
}: {
  step: number;
  busy: boolean;
  onStep: (value: number) => void;
  templateApplied: boolean;
}) {
  const { t } = useTranslation('meetings');
  const steps = ['information', 'people', 'repeat', 'review'] as const;
  return (
    <Box sx={{ display: { xs: 'block', md: 'none' }, mb: 3 }}>
      <Stack direction="row" justifyContent="space-between" gap={1} sx={{ mb: 1 }}>
        <Typography variant="caption" color="primary.main" fontWeight="fontWeightBold">
          {t('scheduleWorkspace.design.stepProgress', { step: step + 1, total: 4 })}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {Math.round(((step + 1) / 4) * 100)}%
        </Typography>
      </Stack>
      <Box
        aria-hidden="true"
        sx={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 0.75 }}
      >
        {steps.map((value, index) => (
          <Box
            key={value}
            sx={{
              height: 5,
              borderRadius: meetingShape.inset,
              bgcolor: index <= step ? 'primary.main' : 'action.selected',
            }}
          />
        ))}
      </Box>
      <Box
        component="nav"
        aria-label={t('scheduleWorkspace.stepsLabel')}
        sx={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 0.5, mt: 1 }}
      >
        {steps.map((value, index) => (
          <ActionButton
            key={value}
            size="small"
            intent="quiet"
            aria-current={step === index ? 'step' : undefined}
            disabled={busy || index > step + 1}
            onClick={() => onStep(index)}
            sx={{
              minWidth: 0,
              px: 0.5,
              whiteSpace: 'normal',
              minHeight: 44,
              color: step === index ? 'primary.main' : 'text.secondary',
              fontWeight: step === index ? 'fontWeightBold' : 'fontWeightMedium',
            }}
          >
            {index + 1}. {t('scheduleWorkspace.steps.' + value)}
          </ActionButton>
        ))}
      </Box>
      <Stack
        direction="row"
        gap={1.5}
        alignItems="center"
        sx={(theme) => ({
          bgcolor: 'background.paper',
          p: 1.5,
          mt: 2.5,
          borderRadius: meetingShape.card,
          boxShadow: meetingSoftShadow(theme),
        })}
      >
        <Sparkles size={20} aria-hidden="true" />
        <Typography variant="body2" fontWeight="fontWeightBold">
          {t(
            templateApplied
              ? 'scheduleWorkspace.templateApplied'
              : 'scheduleWorkspace.blankTemplate'
          )}
        </Typography>
      </Stack>
    </Box>
  );
}

export function MeetingScheduleNextPreview({ time, count }: { time: string; count: number }) {
  const { t } = useTranslation('meetings');
  return (
    <Stack
      direction="row"
      gap={1.5}
      alignItems="center"
      sx={(theme) => ({
        ...meetingInsetSurface(theme),
        p: 2,
        mt: 3,
        display: { xs: 'flex', md: 'none' },
      })}
    >
      <CalendarClock size={20} aria-hidden="true" />
      <Typography variant="body2">
        {t('scheduleWorkspace.design.nextPreview', { time, count })}
      </Typography>
    </Stack>
  );
}

export function MeetingScheduleCoverage({ draft }: { draft: MeetingScheduleDraft }) {
  const { t } = useTranslation('meetings');
  const planned = draft.agendaItems.reduce(
    (total, item) => total + (Number.isFinite(item.plannedMinutes) ? item.plannedMinutes : 0),
    0
  );
  return (
    <Stack
      direction="row"
      gap={1.5}
      sx={(theme) => ({
        bgcolor: 'background.paper',
        p: 2,
        borderRadius: meetingShape.card,
        boxShadow: meetingSoftShadow(theme),
      })}
    >
      <ChartNoAxesColumn size={24} aria-hidden="true" />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <ProgressMeter
          label={t('scheduleWorkspace.design.agendaCoverage')}
          value={draft.durationMinutes > 0 ? (planned / draft.durationMinutes) * 100 : 0}
          tone={planned > draft.durationMinutes ? 'warning' : 'primary'}
        />
        <Typography variant="caption" color="text.secondary">
          {t('scheduleWorkspace.design.agendaCoverageHint', {
            planned,
            duration: draft.durationMinutes,
          })}
        </Typography>
      </Box>
    </Stack>
  );
}
