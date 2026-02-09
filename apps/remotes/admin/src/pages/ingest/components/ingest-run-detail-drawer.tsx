// ----------------------------------------------------------------------

import type { IngestRunDetail } from '@dwp-frontend/shared-utils';

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

type IngestRunDetailDrawerProps = {
  open: boolean;
  onClose: () => void;
  runId: string | null;
  runDetail: IngestRunDetail | undefined;
  isLoading: boolean;
  error: Error | null;
};

export const IngestRunDetailDrawer = memo(({
  open,
  onClose,
  runId,
  runDetail,
  isLoading,
  error,
}: IngestRunDetailDrawerProps) => {
  const { t } = useTranslation('admin');

  const auditUrl = runDetail?.traceId
    ? buildAuditUrl({ q: runDetail.traceId, range: '24h' })
    : runDetail?.runId != null
      ? buildAuditUrl({ runId: String(runDetail.runId), range: '24h' })
      : '/synapse/audit';

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
          <Typography variant="h6">{t('ingest.runDetail.title')}</Typography>
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
            {t('ingest.runDetail.loadError')}
          </Typography>
        ) : (
          <Stack spacing={3}>
            <Stack spacing={2}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                {t('ingest.runDetail.basicInfo')}
              </Typography>
              <Stack spacing={1}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {t('ingest.table.runId')}
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {runDetail.runId}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {t('ingest.table.started')}
                  </Typography>
                  <Typography variant="body2">
                    {runDetail.startedAt
                      ? new Date(runDetail.startedAt).toLocaleString('ko-KR')
                      : '-'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {t('ingest.table.status')}
                  </Typography>
                  <Typography variant="body2">{runDetail.status}</Typography>
                </Box>
                {(runDetail.ingestedCount != null || runDetail.failedCount != null) && (
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {t('ingest.runDetail.ingested')} / {t('ingest.runDetail.failed')}
                    </Typography>
                    <Typography variant="body2">
                      {runDetail.ingestedCount ?? 0} / {runDetail.failedCount ?? 0}
                    </Typography>
                  </Box>
                )}
                {(runDetail.message || runDetail.skipReason) && (
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {runDetail.status === 'SKIPPED' ? t('ingest.runDetail.skipReason') : t('ingest.runDetail.message')}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'warning.main' }}>
                      {runDetail.skipReason ?? runDetail.message}
                    </Typography>
                  </Box>
                )}
                {runDetail.status === 'SKIPPED' && runDetail.runningRunId && (
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {t('ingest.runDetail.runningRunId')}
                    </Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {runDetail.runningRunId}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Stack>

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
                  {runDetail.message ?? t('batch.runDetail.failedAuditHint')}
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
                {t('ingest.runDetail.viewAudit')}
              </Button>
            </Stack>
          </Stack>
        )}
      </Box>
    </Drawer>
  );
});
