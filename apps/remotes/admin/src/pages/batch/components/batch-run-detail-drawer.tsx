// ----------------------------------------------------------------------

import type { DetectRunDetail } from '@dwp-frontend/shared-utils';

import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { ApiErrorAlert, buildAuditUrl } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';

// ----------------------------------------------------------------------

type BatchRunDetailDrawerProps = {
  open: boolean;
  onClose: () => void;
  runId: string | null;
  runDetail: DetectRunDetail | undefined;
  isLoading: boolean;
  error: Error | null;
};

export const BatchRunDetailDrawer = memo(({
  open,
  onClose,
  runId,
  runDetail,
  isLoading,
  error,
}: BatchRunDetailDrawerProps) => {
  const { t } = useTranslation('admin');
  const formatJson = (obj: Record<string, unknown> | null | undefined): string => {
    if (!obj) return '-';
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  };

  const auditUrl = runDetail?.traceId
    ? buildAuditUrl({ q: runDetail.traceId, range: '24h' })
    : runDetail?.runId != null
      ? buildAuditUrl({ runId: String(runDetail.runId), range: '24h' })
      : '/synapse/audit';

  const casesUrl = runId ? `/synapse/cases?runId=${encodeURIComponent(runId)}` : '/synapse/cases';

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 520 },
          bgcolor: 'background.paper',
        },
      }}
    >
      <Box sx={{ p: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Typography variant="h6">{t('batch.runDetail.title')}</Typography>
          <IconButton onClick={onClose}>
            <Iconify icon="solar:close-circle-bold" />
          </IconButton>
        </Stack>

        {error ? (
          <ApiErrorAlert error={error} />
        ) : isLoading ? (
          <Stack spacing={2}>
            <Skeleton variant="rectangular" height={120} />
            <Skeleton variant="rectangular" height={120} />
          </Stack>
        ) : !runDetail ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t('batch.runDetail.loadError')}
          </Typography>
        ) : (
          <Stack spacing={3}>
            <Stack spacing={2}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                {t('batch.runDetail.basicInfo')}
              </Typography>
              <Stack spacing={1}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {t('batch.table.runId')}
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {runDetail.runId}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {t('batch.table.started')}
                  </Typography>
                  <Typography variant="body2">
                    {runDetail.startedAt
                      ? new Date(runDetail.startedAt).toLocaleString('ko-KR')
                      : '-'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {t('batch.table.status')}
                  </Typography>
                  <Typography variant="body2">{runDetail.status}</Typography>
                </Box>
                {(runDetail.createdCount != null ||
                  runDetail.updatedCount != null ||
                  runDetail.suppressedCount != null) && (
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {t('batch.runDetail.counts')}
                    </Typography>
                    <Typography variant="body2">
                      {t('batch.runDetail.created')}: {runDetail.createdCount ?? 0} · {t('batch.runDetail.updated')}: {runDetail.updatedCount ?? 0}{' '}
                      · {t('batch.runDetail.suppressed')}: {runDetail.suppressedCount ?? 0}
                    </Typography>
                  </Box>
                )}
                {(runDetail.message || runDetail.skipReason) && (
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {runDetail.status === 'SKIPPED' ? t('batch.runDetail.skipReason') : t('batch.runDetail.message')}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'warning.main' }}>
                      {runDetail.skipReason ?? runDetail.message}
                    </Typography>
                  </Box>
                )}
                {runDetail.status === 'SKIPPED' && runDetail.runningRunId && (
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {t('batch.runDetail.runningRunId')}
                    </Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {runDetail.runningRunId}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Stack>

            {runDetail.countsJson && Object.keys(runDetail.countsJson).length > 0 && (
              <>
                <Divider />
                <Stack spacing={2}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                    {t('batch.runDetail.countsBreakdown')}
                  </Typography>
                  <Box
                    component="pre"
                    sx={{
                      p: 2,
                      borderRadius: 1,
                      bgcolor: 'action.hover',
                      fontSize: '0.75rem',
                      overflow: 'auto',
                      maxHeight: 200,
                    }}
                  >
                    {formatJson(runDetail.countsJson)}
                  </Box>
                </Stack>
              </>
            )}

            {runDetail.status === 'FAILED' && (
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: 'error.lighter',
                  border: 1,
                  borderColor: 'error.light',
                }}
              >
                <Typography variant="caption" sx={{ color: 'error.dark', fontWeight: 500 }}>
                  {t('batch.runDetail.failedAuditHint')}
                </Typography>
              </Box>
            )}
            <Divider />
            <Stack spacing={1}>
              <Button
                component={Link}
                to={auditUrl}
                variant="outlined"
                size="small"
                color={runDetail.status === 'FAILED' ? 'error' : 'primary'}
                startIcon={<Iconify icon="solar:clipboard-list-bold-duotone" width={18} />}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('batch.runDetail.viewAudit')}
              </Button>
              <Button
                component={Link}
                to={casesUrl}
                variant="outlined"
                size="small"
                startIcon={<Iconify icon="solar:clipboard-list-bold-duotone" width={18} />}
              >
                {t('batch.runDetail.affectedCases')}
              </Button>
            </Stack>
          </Stack>
        )}
      </Box>
    </Drawer>
  );
});
