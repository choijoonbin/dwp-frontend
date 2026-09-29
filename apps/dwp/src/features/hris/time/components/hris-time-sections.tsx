import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Pencil, ShieldCheck } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { HrisDomainSection, HrisStatusChip } from '../../shared';
import { resolveTimeDateCommandState } from '../model/hris-time-model';

import type {
  TimeCalendarPeriod,
  TimeCardDisplay,
  TimeEntryDisplay,
  TimeExceptionDisplay,
} from '../model/hris-time-model';

export function HrisTimeSourceBoundary({
  dataOrigin,
  scheduleConnected,
  nonStandardPeriod,
}: {
  dataOrigin: string;
  scheduleConnected: boolean;
  nonStandardPeriod: boolean;
}) {
  const { t } = useTranslation('hcm');
  return (
    <Paper component="aside" role="note" variant="outlined" sx={{ p: 1.5 }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'stretch', md: 'center' }}
        justifyContent="space-between"
        gap={1}
      >
        <Stack direction="row" gap={1} alignItems="flex-start">
          <ShieldCheck size={18} aria-hidden="true" />
          <Box minWidth={0}>
            <Typography component="h2" variant="subtitle2">
              {t('hrisTime.boundary.title', { defaultValue: 'Time-card command boundary' })}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {scheduleConnected
                ? t('hrisTime.boundary.scheduleConnected', {
                    defaultValue:
                      'Editable dates come from the connected company work schedule. Card version and HRIS authority are revalidated for every command.',
                  })
                : t('hrisTime.boundary.scheduleUnavailable', {
                    defaultValue:
                      'The current API does not provide a per-day company work schedule. Existing source entries may be corrected, but empty dates remain read only instead of assuming Monday-Friday.',
                  })}
            </Typography>
            {nonStandardPeriod && (
              <Typography variant="caption" color="warning.main" display="block">
                {t('hrisTime.boundary.nonStandardPeriod', {
                  defaultValue:
                    'This source period is not an exact Monday-Sunday week. Its actual date range is shown without reshaping it.',
                })}
              </Typography>
            )}
          </Box>
        </Stack>
        <Chip
          size="small"
          variant="outlined"
          label={t('hrisTime.boundary.origin', {
            defaultValue: 'Origin: {{value}}',
            value: dataOrigin || 'UNKNOWN',
          })}
        />
      </Stack>
    </Paper>
  );
}

export function HrisTimeExceptions({
  card,
  entries,
  period,
  exceptions,
  connectedScheduleDates,
  onEdit,
}: {
  card: TimeCardDisplay;
  entries: readonly TimeEntryDisplay[];
  period: TimeCalendarPeriod;
  exceptions: readonly TimeExceptionDisplay[];
  connectedScheduleDates?: ReadonlySet<string>;
  onEdit: (date: string, entry?: TimeEntryDisplay) => void;
}) {
  const { t } = useTranslation('hcm');
  const entriesByDate = useMemo(
    () => new Map(entries.map((entry) => [entry.workDate, entry])),
    [entries]
  );
  if (exceptions.length === 0) return null;
  return (
    <HrisDomainSection
      title={t('domains.time.exceptionTitle')}
      description={t('domains.time.exceptionDescription')}
    >
      <Box>
        {exceptions.map((exception, index) => {
          const entry = entriesByDate.get(exception.occurredOn);
          const command = resolveTimeDateCommandState({
            card,
            date: exception.occurredOn,
            entry,
            period,
            connectedScheduleDates,
          });
          const canCorrect = exception.lifecycleState === 'OPEN' && command.editable;
          return (
            <Box key={exception.exceptionId}>
              {index > 0 && <Divider />}
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                alignItems={{ xs: 'stretch', md: 'center' }}
                gap={1.25}
                sx={{ px: 2, py: 1.5 }}
              >
                <Stack direction="row" gap={1} alignItems="flex-start" minWidth={0} flex={1}>
                  <AlertTriangle size={18} aria-hidden="true" />
                  <Box minWidth={0}>
                    <Typography component="h3" variant="subtitle2">
                      {exception.message}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {exception.exceptionCode} · {exception.occurredOn}
                    </Typography>
                    {exception.resolutionNote && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {exception.resolutionNote}
                      </Typography>
                    )}
                  </Box>
                </Stack>
                <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Chip
                    size="small"
                    variant="outlined"
                    color={
                      exception.severity === 'BLOCKING'
                        ? 'error'
                        : exception.severity === 'WARNING'
                          ? 'warning'
                          : 'info'
                    }
                    label={t(`domains.time.severity.${exception.severity}`)}
                  />
                  <HrisStatusChip status={exception.lifecycleState} />
                  {canCorrect && (
                    <ActionButton
                      intent="secondary"
                      size="small"
                      startIcon={<Pencil size={14} aria-hidden="true" />}
                      onClick={() => onEdit(exception.occurredOn, entry)}
                    >
                      {t('domains.time.correctEntry')}
                    </ActionButton>
                  )}
                </Stack>
              </Stack>
            </Box>
          );
        })}
      </Box>
    </HrisDomainSection>
  );
}
