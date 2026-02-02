import { Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import LinearProgress from '@mui/material/LinearProgress';

import type { StatsEvidence } from './types';

// ----------------------------------------------------------------------

interface StatsEvidenceCardProps {
  stats: StatsEvidence;
  title?: string;
  subtitle?: string;
}

export function StatsEvidenceCard({
  stats,
  title = 'Statistical Evidence',
  subtitle,
}: StatsEvidenceCardProps) {
  const { zScore, mean, std, delta } = stats;

  // Z-score severity color
  const zScoreColor =
    Math.abs(zScore) >= 3 ? 'error' : Math.abs(zScore) >= 2 ? 'warning' : 'info';
  const zScoreSeverity =
    Math.abs(zScore) >= 3 ? 'Critical' : Math.abs(zScore) >= 2 ? 'High' : 'Medium';

  return (
    <Card variant="outlined">
      <CardHeader
        avatar={
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 1,
              bgcolor: `${zScoreColor}.lighter`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Iconify icon="solar:chart-2-bold" width={20} sx={{ color: `${zScoreColor}.main` }} />
          </Box>
        }
        title={
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
        }
        subheader={
          subtitle || `Amount is ${Math.abs(zScore).toFixed(1)}σ away from 12-month mean`
        }
        sx={{ pb: 0 }}
      />
      <CardContent>
        <Stack spacing={2}>
          {/* Z-Score Badge */}
          <Box
            sx={{
              p: 1.5,
              borderRadius: 1,
              bgcolor: `${zScoreColor}.lighter`,
              border: 1,
              borderColor: `${zScoreColor}.main`,
            }}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                Z-Score Severity
              </Typography>
              <Typography
                variant="h6"
                sx={{ fontWeight: 700, color: `${zScoreColor}.main` }}
              >
                {zScoreSeverity}
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={Math.min(Math.abs(zScore) * 20, 100)}
              color={zScoreColor}
              sx={{ mt: 1, height: 6, borderRadius: 3 }}
            />
          </Box>

          {/* Stats Grid */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 1.5,
            }}
          >
            <StatItem
              icon="solar:chart-bold"
              label="Z-Score"
              value={`${zScore.toFixed(2)}σ`}
              color={zScoreColor}
            />
            <StatItem
              icon="solar:graph-up-bold"
              label="Delta"
              value={`$${delta.toLocaleString()}`}
              color="primary"
            />
            <StatItem
              icon="solar:pie-chart-bold"
              label="Mean"
              value={`$${mean.toLocaleString()}`}
              color="info"
            />
            <StatItem
              icon="solar:chart-square-bold"
              label="Std Dev"
              value={`$${std.toLocaleString()}`}
              color="secondary"
            />
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------------

interface StatItemProps {
  icon: string;
  label: string;
  value: string;
  color?: 'error' | 'warning' | 'info' | 'primary' | 'secondary' | 'success';
}

function StatItem({ icon, label, value, color = 'info' }: StatItemProps) {
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 1,
        bgcolor: 'action.hover',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Iconify icon={icon} width={14} sx={{ color: 'text.secondary' }} />
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      </Stack>
      <Typography variant="body2" sx={{ fontWeight: 600, color: `${color}.main` }}>
        {value}
      </Typography>
    </Box>
  );
}
