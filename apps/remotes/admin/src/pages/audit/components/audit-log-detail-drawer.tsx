// ----------------------------------------------------------------------

import type { AuditLogDetail } from '@dwp-frontend/shared-utils';

import { memo } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { ApiErrorAlert } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Drawer from '@mui/material/Drawer';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';

// ----------------------------------------------------------------------

type AuditLogDetailDrawerProps = {
  open: boolean;
  onClose: () => void;
  logId: string | null;
  logDetail: AuditLogDetail | undefined;
  isLoading: boolean;
  error: Error | null;
};

export const AuditLogDetailDrawer = memo(({
  open,
  onClose,
  logId,
  logDetail,
  isLoading,
  error,
}: AuditLogDetailDrawerProps) => {
  const formatJson = (obj: Record<string, unknown> | null | undefined): string => {
    if (!obj) return '-';
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  };

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 600 } } }}>
      <Box sx={{ p: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Typography variant="h6">감사 로그 상세</Typography>
          <IconButton onClick={onClose}>
            <Iconify icon="solar:close-circle-bold" />
          </IconButton>
        </Stack>

        {error ? (
          <ApiErrorAlert error={error} />
        ) : isLoading ? (
          <Stack spacing={2}>
            <Skeleton variant="rectangular" height={200} />
            <Skeleton variant="rectangular" height={200} />
            <Skeleton variant="rectangular" height={200} />
          </Stack>
        ) : !logDetail ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            로그 정보를 불러올 수 없습니다.
          </Typography>
        ) : (
          <Stack spacing={3}>
            {/* Basic Info */}
            <Stack spacing={2}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                기본 정보
              </Typography>
              <Stack spacing={1}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    발생일시
                  </Typography>
                  <Typography variant="body2">
                    {new Date(logDetail.occurredAt).toLocaleString('ko-KR', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false,
                    })}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    실행자
                  </Typography>
                  <Typography variant="body2">
                    {String(logDetail.actor ?? logDetail.actorUserId ?? '-')}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    액션
                  </Typography>
                  <Typography variant="body2">{logDetail.action}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    리소스 타입
                  </Typography>
                  <Typography variant="body2">{logDetail.resourceType}</Typography>
                </Box>
                {logDetail.resourceId && (
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      리소스 ID
                    </Typography>
                    <Typography variant="body2">{logDetail.resourceId}</Typography>
                  </Box>
                )}
                {(logDetail.ipAddress ?? logDetail.userAgent ?? logDetail.beforeValue ?? logDetail.afterValue) && (
                  <>
                    {logDetail.ipAddress != null && (
                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          IP
                        </Typography>
                        <Typography variant="body2">{logDetail.ipAddress}</Typography>
                      </Box>
                    )}
                    {logDetail.userAgent != null && (
                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          User-Agent
                        </Typography>
                        <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                          {logDetail.userAgent}
                        </Typography>
                      </Box>
                    )}
                    {logDetail.beforeValue != null && (
                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          변경 전 (요약)
                        </Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                          {logDetail.beforeValue}
                        </Typography>
                      </Box>
                    )}
                    {logDetail.afterValue != null && (
                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          변경 후 (요약)
                        </Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                          {logDetail.afterValue}
                        </Typography>
                      </Box>
                    )}
                  </>
                )}
              </Stack>
            </Stack>

            <Divider />

            {/* Before */}
            <Stack spacing={2}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                변경 전 (Before)
              </Typography>
              <Box
                sx={{
                  p: 2,
                  bgcolor: 'background.neutral',
                  borderRadius: 1,
                  maxHeight: 300,
                  overflow: 'auto',
                }}
              >
                <Typography
                  component="pre"
                  variant="caption"
                  sx={{
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    m: 0,
                  }}
                >
                  {formatJson(logDetail.before)}
                </Typography>
              </Box>
            </Stack>

            {/* After */}
            <Stack spacing={2}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                변경 후 (After)
              </Typography>
              <Box
                sx={{
                  p: 2,
                  bgcolor: 'background.neutral',
                  borderRadius: 1,
                  maxHeight: 300,
                  overflow: 'auto',
                }}
              >
                <Typography
                  component="pre"
                  variant="caption"
                  sx={{
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    m: 0,
                  }}
                >
                  {formatJson(logDetail.after)}
                </Typography>
              </Box>
            </Stack>

            {/* Metadata */}
            {logDetail.metadata && (
              <>
                <Divider />
                <Stack spacing={2}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                    메타데이터
                  </Typography>
                  <Box
                    sx={{
                      p: 2,
                      bgcolor: 'background.neutral',
                      borderRadius: 1,
                      maxHeight: 300,
                      overflow: 'auto',
                    }}
                  >
                    <Typography
                      component="pre"
                      variant="caption"
                      sx={{
                        fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        m: 0,
                      }}
                    >
                      {formatJson(logDetail.metadata)}
                    </Typography>
                  </Box>
                </Stack>
              </>
            )}
          </Stack>
        )}
      </Box>
    </Drawer>
  );
});

AuditLogDetailDrawer.displayName = 'AuditLogDetailDrawer';
