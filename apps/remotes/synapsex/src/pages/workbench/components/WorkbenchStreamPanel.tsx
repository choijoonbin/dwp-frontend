/**
 * Workbench Stream — 실시간 에이전트 스트림 + 과거 로그 폴링
 *
 * - 라이브: 케이스 상세에서 '분석 실행' 시 POST analysis-runs → 응답의 streamUrl로 SSE 연결(useAnalysisRunStream).
 *   워크벤치는 동일 stream store를 구독하여 실시간 eventLog/streamingThought 표시. (고정 URL 호출 없음)
 * - 과거 로그: GET /api/synapse/dashboard/agent-stream (JSON) 10초 폴링만 사용.
 * - 최종 싱크: SSE completed/[DONE] 시 agent-stream API 1회 refetch 후 10초 주기 재개.
 * - 지금 AI가 하는 생각(Process) 전용 — 확정 결과는 추론 탭에서 표시.
 */

import type { Theme, SxProps } from '@mui/material/styles';

import { useRef, useEffect } from 'react';
import { keyframes } from '@emotion/react';
import { varAlpha } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { useStreamStore, useDashboardAgentActivityQuery } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';

/** Gemini 스타일 Pulsing AI Orb — 파란/보라 그라데이션 박동 원형 */
const orbPulse = keyframes`
  0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 0 0 rgba(66, 133, 244, 0.4); }
  50% { opacity: 0.9; transform: scale(1.08); box-shadow: 0 0 20px 4px rgba(155, 114, 207, 0.35); }
`;

const PulsingOrb = ({ size = 32 }: { size?: number }) => (
  <Box
    sx={{
      width: size,
      height: size,
      flexShrink: 0,
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #4285f4 0%, #9b72cf 50%, #5e35b1 100%)',
      animation: `${orbPulse} 2.2s ease-in-out infinite`,
      boxShadow: '0 0 12px 2px rgba(66, 133, 244, 0.25)',
    }}
  />
);

import { ErrorStateWithRetry } from '../../../components/ux/error-state-with-retry';
import { StreamMarkdownBlock, TypingMarkdownContent } from '../../../components/stream-markdown';
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
  const cleanStreamLines = useStreamStore((s) => s.cleanStreamLines);
  const streamingThought = useStreamStore((s) => s.streamingThought);
  const streamError = useStreamStore((s) => s.errorMessage);
  const autoStartedBanner = useStreamStore((s) => s.autoStartedBanner);

  const {
    data: rawItems,
    isLoading: historyLoading,
    error: historyError,
    refetch: refetchHistory,
  } = useDashboardAgentActivityQuery('6h', 50, {
    // 잠시 폴링 정지 (복구 시 아래 주석 해제 후 원래대로)
    refetchInterval: false,
    // refetchInterval: streamStatus === 'CONNECTING' || streamStatus === 'STREAMING' ? false : 10 * 1000,
  });
  const activities = mapAgentActivity(rawItems);

  const isLive = streamStatus === 'CONNECTING' || streamStatus === 'STREAMING';
  const hasCleanContent = cleanStreamLines.length > 0;
  /** 스트림 완료 직후에도 방금 보이던 라이브 내용 유지. Clean Stream 우선: content/thought_stream만 표시 */
  const showLive =
    isLive || (streamStatus === 'COMPLETED' && (eventLog.length > 0 || hasCleanContent));

  const prevStreamStatusRef = useRef(streamStatus);
  useEffect(() => {
    const wasLive =
      prevStreamStatusRef.current === 'CONNECTING' || prevStreamStatusRef.current === 'STREAMING';
    const isNowCompleted =
      streamStatus === 'COMPLETED' || streamStatus === 'IDLE' || streamStatus === 'ABORTED';
    prevStreamStatusRef.current = streamStatus;
    // SSE 완료 후 agent-stream API 1회 호출 — 향후 사용 여부 결정 후 주석 해제
    // if (wasLive && isNowCompleted) {
    //   refetchHistory();
    // }
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
          <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <Box
              component="pre"
              sx={{
                ...preSx,
                flex: 1,
                bgcolor: contentBg,
                color: 'text.secondary',
                p: 2,
                pt: 1.5,
                mx: 1,
                mb: 1.5,
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'flex-start', sm: 'flex-start' },
                gap: 1.5,
              }}
            >
            {showLive && (
              <Box sx={{ flexShrink: 0, pt: { xs: 0, sm: 0.25 } }}>
                <PulsingOrb size={28} />
              </Box>
            )}
            <Box component="span" sx={{ flex: 1, minWidth: 0, display: 'block' }}>
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
                {streamStatus === 'CONNECTING' && !hasCleanContent && (
                  <Typography component="span" variant="caption" color="text.secondary">
                    {t('workbench.streamConnecting', 'Connecting to live stream...')}
                  </Typography>
                )}
                {hasCleanContent ? (
                  <>
                    {cleanStreamLines.slice(0, -1).map((line, i) => (
                      <StreamMarkdownBlock key={`clean-${i}`} text={line} />
                    ))}
                    {cleanStreamLines.length > 0 && (
                      <Box sx={{ color: 'text.primary' }}>
                        {streamingThought?.pending ? (
                          <Skeleton variant="text" width="85%" sx={{ fontSize: '0.875rem' }} />
                        ) : (
                          <TypingMarkdownContent
                            text={cleanStreamLines[cleanStreamLines.length - 1] ?? ''}
                            active={isLive && !streamingThought?.content}
                          />
                        )}
                      </Box>
                    )}
                  </>
                ) : (
                  <>
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
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};
