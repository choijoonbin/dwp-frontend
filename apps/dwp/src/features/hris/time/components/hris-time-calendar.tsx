import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Pencil } from 'lucide-react';
import { ActionButton, GuidedEmptyState } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { HrisDomainSection } from '../../shared';
import { minutesLabel, resolveTimeDateCommandState } from '../model/hris-time-model';

import type {
  TimeCalendarPeriod,
  TimeCardDisplay,
  TimeEntryDisplay,
} from '../model/hris-time-model';

const WEEKDAY_DEFAULTS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export function HrisTimeCalendar({
  card,
  entries,
  period,
  connectedScheduleDates,
  onEdit,
}: {
  card: TimeCardDisplay;
  entries: readonly TimeEntryDisplay[];
  period: TimeCalendarPeriod;
  connectedScheduleDates?: ReadonlySet<string>;
  onEdit: (date: string, entry?: TimeEntryDisplay) => void;
}) {
  const { t } = useTranslation('hcm');
  const entriesByDate = useMemo(
    () => new Map(entries.map((entry) => [entry.workDate, entry])),
    [entries]
  );

  return (
    <HrisDomainSection
      title={t('domains.time.weekTitle')}
      description={t('domains.time.weekDescription', {
        start: card.periodStart,
        end: card.periodEnd,
      })}
    >
      {period.state === 'INVALID' ? (
        <GuidedEmptyState
          kind="empty"
          size="compact"
          title={t('hrisTime.calendar.invalidTitle', {
            defaultValue: 'The time-card period is invalid',
          })}
          description={t('hrisTime.calendar.invalidDescription', {
            defaultValue:
              'No calendar was generated because the source period is missing, reversed, or longer than the supported review window.',
          })}
        />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              xl:
                period.dates.length === 7
                  ? 'repeat(7, minmax(0, 1fr))'
                  : 'repeat(4, minmax(0, 1fr))',
            },
          }}
        >
          {period.dates.map((day, index) => {
            const entry = entriesByDate.get(day.date);
            const command = resolveTimeDateCommandState({
              card,
              date: day.date,
              entry,
              period,
              connectedScheduleDates,
            });
            return (
              <Paper
                square
                elevation={0}
                key={day.date}
                component="article"
                sx={{
                  minHeight: 148,
                  p: 1.5,
                  borderTop: index ? 1 : 0,
                  borderLeft: { xs: 0, sm: index % 2 ? 1 : 0, xl: index ? 1 : 0 },
                  borderColor: 'divider',
                  bgcolor: day.isoDayOfWeek > 5 ? 'action.hover' : 'background.paper',
                }}
              >
                <Stack
                  direction="row"
                  alignItems="flex-start"
                  justifyContent="space-between"
                  gap={1}
                >
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {t(`hrisTime.weekday.${day.isoDayOfWeek}`, {
                        defaultValue: WEEKDAY_DEFAULTS[day.isoDayOfWeek - 1],
                      })}
                    </Typography>
                    <Typography component="p" variant="subtitle2">
                      {day.date}
                    </Typography>
                  </Box>
                  {entry ? (
                    <Box color="success.main" display="flex">
                      <CheckCircle2 size={17} aria-hidden="true" />
                    </Box>
                  ) : command.reason === 'CONNECTED_SCHEDULE' ? (
                    <Box color="warning.main" display="flex">
                      <AlertTriangle size={17} aria-hidden="true" />
                    </Box>
                  ) : null}
                </Stack>
                <Typography component="p" variant="h6" sx={{ mt: 1.5 }}>
                  {entry ? minutesLabel(entry.minutes) : '-'}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  {entry?.workMode
                    ? t(`domains.time.workModes.${entry.workMode}`)
                    : t('domains.time.notRecorded')}
                </Typography>
                {command.editable ? (
                  <ActionButton
                    intent="quiet"
                    size="small"
                    startIcon={<Pencil size={14} aria-hidden="true" />}
                    onClick={() => onEdit(day.date, entry)}
                    sx={{ mt: 1 }}
                  >
                    {entry ? t('domains.actions.edit') : t('domains.actions.add')}
                  </ActionButton>
                ) : (
                  <Typography
                    component="span"
                    aria-disabled="true"
                    variant="caption"
                    color="text.secondary"
                    display="block"
                    sx={{ mt: 1 }}
                  >
                    {t(`hrisTime.editability.${command.reason}`, {
                      defaultValue:
                        command.reason === 'SCHEDULE_UNAVAILABLE'
                          ? 'Schedule not connected'
                          : command.reason === 'REFERENCE_DATA'
                            ? 'Reference data · read only'
                            : 'Read only',
                    })}
                  </Typography>
                )}
              </Paper>
            );
          })}
        </Box>
      )}
    </HrisDomainSection>
  );
}
