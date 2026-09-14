import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionButton, SelectField, foundationTokens } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import type { WorkplaceExperienceReport } from '@dwp-frontend/shared-utils';

type Cell = WorkplaceExperienceReport['hourlyHeatmap'][number];
export function WorkplaceUtilizationHeatmap({
  cells,
  workingDayStart,
  workingDayEnd,
  selectedStartsAt,
  onSelect,
}: {
  cells: Cell[];
  workingDayStart: string;
  workingDayEnd: string;
  selectedStartsAt?: string;
  onSelect: (cell: Cell) => void;
}) {
  const { t } = useTranslation('rooms');
  const [allHours, setAllHours] = useState(false);
  const [day, setDay] = useState('');
  const dates = useMemo(() => [...new Set(cells.map((cell) => cell.date))].sort(), [cells]);
  const selectedDay = dates.includes(day) ? day : (dates.at(-1) ?? '');
  const startHour = Number.parseInt(workingDayStart, 10),
    endHour = Number.parseInt(workingDayEnd, 10);
  const hours = Array.from({ length: 24 }, (_, hour) => hour).filter(
    (hour) => allHours || (hour >= startHour && hour <= endHour)
  );
  const bySlot = useMemo(() => {
    const values = new Map<string, Cell[]>();
    cells.forEach((cell) => {
      const key = `${cell.date}:${cell.hour}`;
      values.set(key, [...(values.get(key) ?? []), cell]);
    });
    return values;
  }, [cells]);
  const renderCell = (cell: Cell) => (
    <Box
      component="button"
      type="button"
      key={cell.startsAt}
      aria-label={`${cell.date} ${cell.hour}:00 (${cell.offset}) ${cell.utilizationPercent === null ? t('workplace.experience.unavailable') : `${cell.utilizationPercent.toFixed(1)}%`}`}
      aria-pressed={selectedStartsAt === cell.startsAt}
      onClick={() => onSelect(cell)}
      sx={{
        width: '100%',
        minWidth: 44,
        minHeight: 44,
        p: 0.5,
        cursor: 'pointer',
        border: selectedStartsAt === cell.startsAt ? 2 : 1,
        borderColor: selectedStartsAt === cell.startsAt ? 'primary.main' : 'divider',
        borderRadius: foundationTokens.radius.compact + 'px',
        bgcolor: (theme) =>
          cell.utilizationPercent === null
            ? theme.palette.action.disabledBackground
            : cell.utilizationPercent >= 70
              ? theme.palette.primary.main
              : alpha(theme.palette.primary.main, 0.08 + cell.utilizationPercent / 120),
        color:
          cell.utilizationPercent !== null && cell.utilizationPercent >= 70
            ? 'primary.contrastText'
            : 'text.primary',
        font: 'inherit',
        '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.main', outlineOffset: 2 },
        '@media (forced-colors: active)': { borderColor: 'ButtonText', outlineColor: 'Highlight' },
      }}
    >
      <Typography component="span" variant="caption" fontWeight="fontWeightBold">
        {cell.utilizationPercent === null ? '—' : `${cell.utilizationPercent.toFixed(0)}%`}
      </Typography>
      {(bySlot.get(`${cell.date}:${cell.hour}`)?.length ?? 0) > 1 && (
        <Typography component="span" variant="caption" sx={{ display: 'block' }}>
          {cell.offset}
        </Typography>
      )}
    </Box>
  );
  return (
    <Stack gap={1.5}>
      <Stack
        direction="row"
        gap={1}
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
      >
        <Stack direction="row" gap={0.5} alignItems="center">
          <Typography variant="caption">{t('workplace.experience.polish.heatmapLow')}</Typography>
          {[0, 25, 50, 75, 100].map((value) => (
            <Box
              key={value}
              aria-hidden="true"
              sx={{
                width: 18,
                height: 10,
                borderRadius: foundationTokens.radius.compact + 'px',
                bgcolor: (theme) =>
                  value >= 70
                    ? theme.palette.primary.main
                    : alpha(theme.palette.primary.main, 0.08 + value / 120),
              }}
            />
          ))}
          <Typography variant="caption">{t('workplace.experience.polish.heatmapHigh')}</Typography>
        </Stack>
        <ActionButton
          intent={allHours ? 'secondary' : 'quiet'}
          aria-pressed={allHours}
          onClick={() => setAllHours(!allHours)}
        >
          {t('workplace.experience.polish.allHours')}
        </ActionButton>
      </Stack>
      <Box sx={{ display: { xs: 'none', md: 'block' }, overflowX: 'auto', pb: 1 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: `64px repeat(${dates.length}, minmax(58px, 1fr))`,
            gap: 0.5,
            minWidth: Math.max(360, dates.length * 62 + 64),
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ py: 1 }}>
            {t('workplace.experience.hour')}
          </Typography>
          {dates.map((date) => (
            <Typography
              key={date}
              variant="caption"
              fontWeight="fontWeightBold"
              sx={{ textAlign: 'center', py: 1 }}
            >
              {date.slice(5)}
            </Typography>
          ))}
          {hours.map((hour) => (
            <Box key={hour} sx={{ display: 'contents' }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'flex', alignItems: 'center' }}
              >
                {String(hour).padStart(2, '0')}:00
              </Typography>
              {dates.map((date) => (
                <Stack key={`${date}:${hour}`} gap={0.5}>
                  {bySlot.get(`${date}:${hour}`)?.map(renderCell) ?? (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ minHeight: 44, display: 'grid', placeItems: 'center' }}
                    >
                      —
                    </Typography>
                  )}
                </Stack>
              ))}
            </Box>
          ))}
        </Box>
      </Box>
      <Stack gap={1.25} sx={{ display: { md: 'none' } }}>
        <SelectField
          size="small"
          label={t('workplace.experience.polish.heatmapDay')}
          value={selectedDay}
          onValueChange={setDay}
          options={dates.map((date) => ({ value: date, label: date }))}
        />
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 0.75 }}>
          {hours.map((hour) => (
            <Stack key={hour} gap={0.5}>
              <Typography variant="caption" color="text.secondary">
                {String(hour).padStart(2, '0')}:00
              </Typography>
              {bySlot.get(`${selectedDay}:${hour}`)?.map(renderCell) ?? (
                <Typography variant="caption">—</Typography>
              )}
            </Stack>
          ))}
        </Box>
      </Stack>
    </Stack>
  );
}
