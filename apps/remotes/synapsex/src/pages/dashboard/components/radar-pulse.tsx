/**
 * Autonomous Pulse Center — Pure CSS/SVG radar/pulse animation for "Live SCAN" mood.
 * No data binding; visual only.
 */

import { useTranslation } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

const RADAR_SIZE = 180;

export const RadarPulse = () => {
  const { t } = useTranslation('common');

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 220,
        position: 'relative',
        '@keyframes radar-sweep': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        '@keyframes radar-ping': {
          '0%, 100%': { opacity: 0.9 },
          '50%': { opacity: 0.5 },
        },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          width: RADAR_SIZE,
          height: RADAR_SIZE,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          width={RADAR_SIZE}
          height={RADAR_SIZE}
          viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}
          style={{ overflow: 'visible' }}
        >
          <defs>
            <linearGradient id="radar-sweep-icc" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--mui-palette-primary-main)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="var(--mui-palette-primary-main)" stopOpacity="0" />
            </linearGradient>
            <filter id="radar-glow-icc">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {[1, 2, 3, 4].map((i) => (
            <circle
              key={i}
              cx={RADAR_SIZE / 2}
              cy={RADAR_SIZE / 2}
              r={(RADAR_SIZE / 2) * (i / 4)}
              fill="none"
              stroke="var(--mui-palette-primary-main)"
              strokeOpacity={0.3 - i * 0.05}
              strokeWidth={1}
            />
          ))}
          <g
            style={{
              transformOrigin: `${RADAR_SIZE / 2}px ${RADAR_SIZE / 2}px`,
              animation: 'radar-sweep 4s linear infinite',
            }}
          >
            <line
              x1={RADAR_SIZE / 2}
              y1={RADAR_SIZE / 2}
              x2={RADAR_SIZE / 2}
              y2={0}
              stroke="var(--mui-palette-primary-main)"
              strokeOpacity="0.3"
              strokeWidth={2}
              filter="url(#radar-glow-icc)"
            />
            <polygon
              points={`${RADAR_SIZE / 2},${RADAR_SIZE / 2} ${RADAR_SIZE / 2},0 ${RADAR_SIZE / 2 + 4},${RADAR_SIZE / 2 + 8}`}
              fill="url(#radar-sweep-icc)"
              fillOpacity="0.3"
            />
          </g>
          <circle
            cx={RADAR_SIZE / 2}
            cy={RADAR_SIZE / 2}
            r={6}
            fill="var(--mui-palette-primary-main)"
            fillOpacity="0.3"
            style={{ animation: 'radar-ping 2s ease-in-out infinite' }}
          />
        </svg>
      </Box>
      <Typography
        variant="caption"
        sx={{
          mt: 1.5,
          fontWeight: 600,
          color: 'primary.main',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {t('dashboard.icc.liveScan')}
      </Typography>
    </Box>
  );
};
