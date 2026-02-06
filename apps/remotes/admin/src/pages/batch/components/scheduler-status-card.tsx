/**
 * Scheduler Status Card — Detect 배치 스케줄러 상태(조회 전용)
 * enabled, interval/cron, running, last success/fail, (optional) next planned
 */

import type { DetectSchedulerStatus } from '@dwp-frontend/shared-utils';

import { memo } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';

// ----------------------------------------------------------------------

type SchedulerStatusCardProps = {
  status: DetectSchedulerStatus | undefined;
  isLoading: boolean;
  error: Error | null;
  onViewLastRun?: (runId: string) => void;
  lastRunId?: string | number | null;
};

export const SchedulerStatusCard = memo(({
  status,
  isLoading,
  error,
  onViewLastRun,
  lastRunId,
}: SchedulerStatusCardProps) => {
  const { t } = useTranslation('admin');
  if (error) {
    return (
      <Card variant="outlined" sx={{ borderColor: 'error.light' }}>
        <CardContent sx={{ p: 2 }}>
          <Typography variant="body2" color="error">
            {error instanceof Error ? error.message : t('batch.scheduler.loadError')}
          </Typography>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !status) {
    return (
      <Card variant="outlined">
        <CardContent sx={{ p: 2 }}>
          <Skeleton variant="rectangular" height={80} />
        </CardContent>
      </Card>
    );
  }

  const scheduleLabel =
    status.scheduleType === 'cron' && status.cronExpression
      ? status.cronExpression
      : status.intervalMinutes != null
        ? t('batch.scheduler.intervalMinutes', { count: status.intervalMinutes })
        : '-';

  const lastSuccessLabel = status.lastSuccessAt
    ? new Date(status.lastSuccessAt).toLocaleString('ko-KR', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-';
  const lastFailLabel = status.lastFailAt
    ? new Date(status.lastFailAt).toLocaleString('ko-KR', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-';

  const isDegraded =
    status.lastFailAt &&
    status.lastSuccessAt &&
    new Date(status.lastFailAt).getTime() > new Date(status.lastSuccessAt).getTime();

  return (
    <Card variant="outlined">
      <CardContent sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Box
              sx={{
                px: 1,
                py: 0.25,
                borderRadius: 1,
                bgcolor: status.enabled ? 'success.lighter' : 'grey.200',
                border: 1,
                borderColor: status.enabled ? 'success.main' : 'grey.400',
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 600, color: status.enabled ? 'success.dark' : 'text.secondary' }}>
                {status.enabled ? t('batch.scheduler.auto') : t('batch.scheduler.off')}
              </Typography>
            </Box>
            {status.running && (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <CircularProgress size={14} />
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'info.main' }}>
                  {t('batch.scheduler.running')}
                </Typography>
              </Stack>
            )}
            {isDegraded && (
              <Box
                sx={{
                  px: 1,
                  py: 0.25,
                  borderRadius: 1,
                  bgcolor: 'warning.lighter',
                  border: 1,
                  borderColor: 'warning.main',
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'warning.dark' }}>
                  {t('batch.scheduler.degraded')}
                </Typography>
              </Box>
            )}
          </Stack>
          <Stack direction="row" spacing={3} flexWrap="wrap" sx={{ flex: 1 }}>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {t('batch.scheduler.intervalCron')}
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                {scheduleLabel}
              </Typography>
            </Box>
            {status.runningRunId && (
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {t('batch.scheduler.runningRun')}
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {status.runningRunId}
                </Typography>
              </Box>
            )}
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {t('batch.scheduler.lastSuccess')}
              </Typography>
              <Typography variant="body2">{lastSuccessLabel}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {t('batch.scheduler.lastFail')}
              </Typography>
              <Typography variant="body2" sx={{ color: status.lastFailAt ? 'error.main' : undefined }}>
                {lastFailLabel}
              </Typography>
            </Box>
            {status.nextPlannedAt && (
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {t('batch.scheduler.nextPlanned')}
                </Typography>
                <Typography variant="body2">
                  {new Date(status.nextPlannedAt).toLocaleString('ko-KR')}
                </Typography>
              </Box>
            )}
          </Stack>
          {lastRunId != null && onViewLastRun && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<Iconify icon="solar:eye-bold" width={16} />}
              onClick={() => onViewLastRun(String(lastRunId))}
            >
              {t('batch.scheduler.viewLastRun')}
            </Button>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
});
