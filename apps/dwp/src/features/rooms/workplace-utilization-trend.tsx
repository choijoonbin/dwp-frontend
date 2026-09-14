import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import type { WorkplaceExperienceReport } from '@dwp-frontend/shared-utils';

export function WorkplaceUtilizationTrend({
  days,
}: {
  days: WorkplaceExperienceReport['dailyTrend'];
}) {
  const { t } = useTranslation('rooms');
  const id = useId();
  if (!days.length) return null;
  const x = (index: number) => 38 + (index * 530) / Math.max(1, days.length - 1);
  const y = (value: number) => 170 - value * 1.4;
  const segments = (key: 'utilizationPercent' | 'noShowPercent') => {
    const values: string[][] = [[]];
    days.forEach((day, index) => {
      const value = day[key];
      if (value === null) values.push([]);
      else values.at(-1)!.push(`${x(index)},${y(value)}`);
    });
    return values.filter((value) => value.length);
  };
  return (
    <Stack gap={1}>
      <Box
        component="svg"
        role="img"
        aria-labelledby={id}
        viewBox="0 0 600 210"
        sx={{ width: '100%', maxHeight: 260, color: 'text.secondary' }}
      >
        <title id={id}>{t('workplace.experience.polish.trendTitle')}</title>
        {[0, 50, 100].map((value) => (
          <g key={value}>
            <line
              x1="38"
              x2="568"
              y1={y(value)}
              y2={y(value)}
              stroke="currentColor"
              opacity=".18"
            />
            <Box
              component="text"
              x="2"
              y={y(value) + 4}
              fill="currentColor"
              sx={{ fontSize: (theme) => theme.typography.caption.fontSize }}
            >
              {value}%
            </Box>
          </g>
        ))}
        {segments('utilizationPercent').map((points, index) => (
          <Box
            component="polyline"
            key={`u${index}`}
            points={points.join(' ')}
            fill="none"
            strokeWidth="3"
            sx={{ stroke: (theme) => theme.palette.primary.main }}
          />
        ))}
        {segments('noShowPercent').map((points, index) => (
          <Box
            component="polyline"
            key={`n${index}`}
            points={points.join(' ')}
            fill="none"
            strokeWidth="2"
            strokeDasharray="6 4"
            sx={{ stroke: (theme) => theme.palette.secondary.main }}
          />
        ))}
        {days.map((day, index) =>
          day.utilizationPercent !== null ? (
            <Box
              component="circle"
              key={day.date}
              cx={x(index)}
              cy={y(day.utilizationPercent)}
              r="3"
              sx={{ fill: (theme) => theme.palette.primary.main }}
            />
          ) : null
        )}
        {days.map((day, index) =>
          day.noShowPercent !== null ? (
            <Box
              component="rect"
              key={`n${day.date}`}
              x={x(index) - 2.5}
              y={y(day.noShowPercent) - 2.5}
              width={5}
              height={5}
              sx={{ fill: (theme) => theme.palette.secondary.main }}
            />
          ) : null
        )}
        {[...new Set([0, Math.floor((days.length - 1) / 2), days.length - 1])]
          .filter((index) => index >= 0)
          .map((index) => (
            <Box
              component="text"
              key={index}
              x={x(index)}
              y="198"
              textAnchor="middle"
              fill="currentColor"
              sx={{ fontSize: (theme) => theme.typography.caption.fontSize }}
            >
              {days[index].date.slice(5)}
            </Box>
          ))}
      </Box>
      <Stack direction="row" gap={2} flexWrap="wrap">
        {(['utilization', 'noShowRate'] as const).map((key, index) => (
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
      <Box sx={{ bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06), px: 1.25, py: 0.75 }}>
        <Typography variant="caption" color="text.secondary">
          {t('workplace.experience.plannedOccupancyNotice')}
        </Typography>
      </Box>
    </Stack>
  );
}
