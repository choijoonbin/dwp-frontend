import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '@dwp-frontend/design-system';
import type { WorkplacePolicyImpact } from '@dwp-frontend/shared-utils';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export function WorkplacePolicyImpactChart({
  days,
}: {
  days: WorkplacePolicyImpact['dailyImpact'];
}) {
  const { t } = useTranslation('rooms');
  const id = useId();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  if (!days.length) return null;
  const maximum = Math.max(1, ...days.map((day) => day.reviewedBookings));
  const x = (index: number) => 38 + (index * 438) / Math.max(1, days.length - 1);
  const y = (value: number) => 160 - (value * 130) / maximum;
  const points = (key: 'reviewedBookings' | 'affectedBookings') =>
    days.map((day, index) => `${x(index)},${y(day[key])}`).join(' ');
  const selected = days.find((day) => day.date === selectedDate);
  return (
    <Stack gap={1}>
      <Typography component="h3" variant="subtitle2">
        {t('workplace.experience.dailyPolicyImpact')}
      </Typography>
      <Typography id={`${id}-desc`} variant="caption" color="text.secondary">
        {t('workplace.experience.dailyPolicyImpactDescription')}
      </Typography>
      <Box
        component="svg"
        role="img"
        aria-labelledby={`${id}-desc`}
        viewBox="0 0 500 190"
        sx={{
          width: '100%',
          maxHeight: 240,
          color: 'text.secondary',
          '@media (forced-colors: active)': { color: 'CanvasText' },
        }}
      >
        {[0, Math.ceil(maximum / 2), maximum]
          .filter((value, index, values) => values.indexOf(value) === index)
          .map((value) => (
            <g key={value}>
              <line
                x1="38"
                x2="476"
                y1={y(value)}
                y2={y(value)}
                stroke="currentColor"
                opacity=".2"
              />
              <Box
                component="text"
                x="4"
                y={y(value) + 4}
                fill="currentColor"
                sx={{ fontSize: (theme) => theme.typography.caption.fontSize }}
              >
                {value}
              </Box>
            </g>
          ))}
        {[...new Set([0, Math.floor((days.length - 1) / 2), days.length - 1])].map((index) => (
          <Box
            component="text"
            key={index}
            x={x(index)}
            y="183"
            textAnchor="middle"
            fill="currentColor"
            sx={{ fontSize: (theme) => theme.typography.caption.fontSize }}
          >
            {days[index].date.slice(5)}
          </Box>
        ))}
        <Box
          component="polyline"
          points={points('reviewedBookings')}
          fill="none"
          sx={{ stroke: (theme) => theme.palette.primary.main }}
          strokeWidth="3"
        />
        <Box
          component="polyline"
          points={points('affectedBookings')}
          fill="none"
          sx={{ stroke: (theme) => theme.palette.secondary.main }}
          strokeWidth="3"
          strokeDasharray="6 4"
        />
        {days.map((day, index) => (
          <g key={day.date}>
            <Box
              component="circle"
              cx={x(index)}
              cy={y(day.reviewedBookings)}
              r="3"
              sx={{ fill: (theme) => theme.palette.primary.main }}
            />
            <Box
              component="circle"
              cx={x(index)}
              cy={y(day.affectedBookings)}
              r="3"
              sx={{ fill: (theme) => theme.palette.secondary.main }}
            />
          </g>
        ))}
      </Box>
      <Stack direction="row" gap={2} flexWrap="wrap">
        {(['reviewedBookings', 'futureImpact'] as const).map((key, index) => (
          <Stack key={key} direction="row" alignItems="center" gap={0.75}>
            <Box
              aria-hidden="true"
              sx={{
                width: 22,
                borderTop: '3px solid',
                borderColor: index ? 'secondary.main' : 'primary.main',
                borderTopStyle: index ? 'dashed' : 'solid',
              }}
            />
            <Typography variant="caption">{t(`workplace.experience.${key}`)}</Typography>
          </Stack>
        ))}
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))',
          gap: 0.75,
        }}
      >
        {days.map((day) => (
          <ActionButton
            key={day.date}
            intent={selectedDate === day.date ? 'primary' : 'quiet'}
            aria-pressed={selectedDate === day.date}
            onClick={() => setSelectedDate(day.date)}
            sx={{ minHeight: 44 }}
          >
            {day.date.slice(5)} · {day.reviewedBookings}/{day.affectedBookings}
          </ActionButton>
        ))}
      </Box>
      {selected ? (
        <Typography variant="body2">
          {selected.date} · {t('workplace.experience.reviewedBookings')}:{' '}
          {selected.reviewedBookings} · {t('workplace.experience.futureImpact')}:{' '}
          {selected.affectedBookings}
        </Typography>
      ) : null}
    </Stack>
  );
}
