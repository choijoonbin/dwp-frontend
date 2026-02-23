/**
 * Workbench Stream — 실시간 에이전트 스트림 + 과거 로그 폴링
 *
 * - 라이브: 케이스 상세에서 '분석 실행' 시 POST analysis-runs → 응답의 streamUrl로 SSE 연결(useAnalysisRunStream).
 *   워크벤치는 동일 stream store를 구독하여 실시간 eventLog/streamingThought 표시. (고정 URL 호출 없음)
 * - 과거 로그: GET /api/synapse/dashboard/agent-stream (JSON) 10초 폴링만 사용.
 * - 최종 싱크: SSE completed/[DONE] 시 agent-stream API 1회 refetch 후 10초 주기 재개.
 */

import type { Theme, SxProps } from '@mui/material/styles';

import { useRef, useEffect } from 'react';
import { varAlpha } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { useStreamStore, useDashboardAgentActivityQuery } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';

import { ErrorStateWithRetry } from '../../../components/ux/error-state-with-retry';
import {
  mapAgentActivity,
  getAgentEventTypeLabelKey,
} from '../../dashboard/adapters/dashboard-adapter';

const preSx = {
  flex: 1,
  m: 0,
  p: 1.5,
  fontFamily: 'monospace',
  fontSize: '0.75rem',
  lineHeight: 1.6,
  whiteSpace: 'pre-wrap' as const,
  wordBreak: 'break-all' as const,
  overflow: 'auto' as const,
  border: 1,
  borderColor: 'divider',
  borderRadius: 1,
  mx: 1.5,
  mb: 1.5,
};

export type WorkbenchStreamPanelProps = {
  getGlassPanelSx: (theme: Theme) => Record<string, unknown>;
  /** 선택된 케이스 ID — 있으면 해당 케이스 스트림, 없으면 대시보드 라이브 스트림 */
  selectedCaseId?: string | null;
  sx?: SxProps<Theme>;
};

export const WorkbenchStreamPanel = ({
  getGlassPanelSx,
  selectedCaseId = null,
  sx,
}: WorkbenchStreamPanelProps) => {
  const { t } = useTranslation('common');
  const theme = useTheme();

  const streamStatus = useStreamStore((s) => s.status);
  const eventLog = useStreamStore((s) => s.eventLog);
  const streamingThought = useStreamStore((s) => s.streamingThought);
  const streamError = useStreamStore((s) => s.errorMessage);
  const autoStartedBanner = useStreamStore((s) => s.autoStartedBanner);

  const {
    data: rawItems,
    isLoading: historyLoading,
    error: historyError,
    refetch: refetchHistory,
  } = useDashboardAgentActivityQuery('6h', 50, {
    refetchInterval:
      streamStatus === 'CONNECTING' || streamStatus === 'STREAMING' ? false : 10 * 1000,
  });
  const activities = mapAgentActivity(rawItems);

  const isLive = streamStatus === 'CONNECTING' || streamStatus === 'STREAMING';
  const showLive = isLive;

  const prevStreamStatusRef = useRef(streamStatus);
  useEffect(() => {
    const wasLive =
      prevStreamStatusRef.current === 'CONNECTING' || prevStreamStatusRef.current === 'STREAMING';
    const isNowCompleted =
      streamStatus === 'COMPLETED' || streamStatus === 'IDLE' || streamStatus === 'ABORTED';
    prevStreamStatusRef.current = streamStatus;
    if (wasLive && isNowCompleted) {
      refetchHistory();
    }
  }, [streamStatus, refetchHistory]);

  const contentBg = varAlpha(
    theme.vars.palette.grey['900Channel'],
    theme.palette.mode === 'dark' ? 0.6 : 0.08
  );

  return (
    <Box
      sx={{
        ...getGlassPanelSx(theme),
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        borderRadius: 0,
        borderLeft: `1px solid ${varAlpha(theme.vars.palette.dividerChannel, 0.12)}`,
        ...sx,
      }}
    >
      <Box
        sx={{
          height: 'var(--workbench-panel-header-height, 56px)',
          minHeight: 'var(--workbench-panel-header-height, 56px)',
          pt: 0,
          px: 2,
          pb: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <Typography variant="subtitle2" color="text.secondary">
          {t('workbench.streamTitle')}
        </Typography>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {streamStatus === 'ERROR' && streamError && (
          <ErrorStateWithRetry
            message={streamError}
            onRetry={() => refetchHistory()}
          />
        )}
        {historyError && streamStatus !== 'ERROR' && (
          <ErrorStateWithRetry
            message={historyError instanceof Error ? historyError.message : undefined}
            onRetry={() => refetchHistory()}
          />
        )}

        {!(streamStatus === 'ERROR' && streamError) && !historyError && (
          <Box
            component="pre"
            sx={{
              ...preSx,
              bgcolor: contentBg,
              color: 'text.secondary',
            }}
          >
            {showLive && autoStartedBanner && (
              <Typography
                component="span"
                variant="caption"
                sx={{
                  display: 'block',
                  color: 'info.main',
                  fontWeight: 600,
                  mb: 1,
                }}
              >
                {t('workbench.autoStartedBanner')}
              </Typography>
            )}
            {showLive ? (
              <>
                {streamStatus === 'CONNECTING' && eventLog.length === 0 && (
                  <Typography component="span" variant="caption" color="text.secondary">
                    {t('workbench.streamConnecting', 'Connecting to live stream...')}
                  </Typography>
                )}
                {eventLog.map((line, i) => (
                  <Box
                    component="span"
                    key={`log-${i}`}
                    sx={{ display: 'block', color: 'text.secondary' }}
                  >
                    {line}
                  </Box>
                ))}
                {streamingThought != null && (
                  <Box
                    component="span"
                    sx={{
                      display: 'block',
                      mt: 0.5,
                      color: 'primary.main',
                      fontWeight: streamingThought.pending ? 400 : 500,
                    }}
                  >
                    {streamingThought.pending ? (
                      <Skeleton variant="text" width="80%" sx={{ fontSize: '0.75rem' }} />
                    ) : (
                      streamingThought.content
                    )}
                  </Box>
                )}
              </>
            ) : (
              <>
                {historyLoading && (
                  <Typography component="span" variant="caption" color="text.secondary">
                    {t('workbench.streamLoading', 'Loading agent activity...')}
                  </Typography>
                )}
                {!historyLoading && activities.length === 0 && (
                  <Typography component="span" variant="caption" color="text.secondary">
                    {t('workbench.streamHint')}
                  </Typography>
                )}
                {!historyLoading &&
                  activities.length > 0 &&
                  activities.map((a) => {
                    const time = new Date(a.timestamp).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    });
                    const labelKey = `dashboard.agentStream.eventType.${getAgentEventTypeLabelKey(a.action)}`;
                    const label = t(labelKey);
                    const line = `[${time}] ${label}: ${a.message || a.status}`;
                    return (
                      <Box
                        component="span"
                        key={a.id}
                        sx={{ display: 'block', color: 'text.secondary' }}
                      >
                        {line}
                      </Box>
                    );
                  })}
              </>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
};
