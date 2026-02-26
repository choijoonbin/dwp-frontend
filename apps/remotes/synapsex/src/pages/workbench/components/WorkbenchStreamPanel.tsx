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

import { keyframes } from '@emotion/react';
import { varAlpha } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { useStreamStore, useDashboardAgentActivityQuery } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';

/** Gemini 스타일 Pulsing AI Orb — 상태에 따라 색상: thinking(파랑/보라) | risk(노랑/빨강) */
const orbPulseThinking = keyframes`
  0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 0 0 rgba(66, 133, 244, 0.4); }
  50% { opacity: 0.9; transform: scale(1.08); box-shadow: 0 0 20px 4px rgba(155, 114, 207, 0.35); }
`;
const orbPulseRisk = keyframes`
  0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
  50% { opacity: 0.9; transform: scale(1.08); box-shadow: 0 0 20px 4px rgba(239, 68, 68, 0.35); }
`;

type OrbVariant = 'thinking' | 'risk';

const PulsingOrb = ({ size = 22, variant = 'thinking' }: { size?: number; variant?: OrbVariant }) => (
  <Box
    sx={{
      position: 'relative',
      width: size,
      height: size,
      flexShrink: 0,
      borderRadius: '50%',
      background:
        variant === 'risk'
          ? 'linear-gradient(135deg, #f59e0b 0%, #ef4444 50%, #dc2626 100%)'
          : 'linear-gradient(135deg, #4285f4 0%, #9b72cf 50%, #5e35b1 100%)',
      animation: `${variant === 'risk' ? orbPulseRisk : orbPulseThinking} 2.2s ease-in-out infinite`,
      boxShadow:
        variant === 'risk'
          ? '0 0 12px 2px rgba(245, 158, 11, 0.25)'
          : '0 0 12px 2px rgba(66, 133, 244, 0.25)',
      '&::after': {
        content: '""',
        position: 'absolute',
        inset: -4,
        borderRadius: '50%',
        border: variant === 'risk' ? '1px solid rgba(245, 158, 11, 0.28)' : '1px solid rgba(66, 133, 244, 0.28)',
      },
    }}
  />
);

import { PanelHeader } from './PanelHeader';
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
  /** Orb 색상: thinking(파랑/보라) | risk(노랑/빨강) — 고위험/위반 탐지 시 risk */
  orbVariant?: OrbVariant;
  sx?: SxProps<Theme>;
};

export const WorkbenchStreamPanel = ({
  getGlassPanelSx,
  selectedCaseId = null,
  orbVariant = 'thinking',
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
  const isStreaming = streamStatus === 'STREAMING';
  const hasCleanContent = cleanStreamLines.length > 0;
  /** 마지막 라인 (타이핑 중인 문장) */
  const lastLine = cleanStreamLines.length > 0 ? cleanStreamLines[cleanStreamLines.length - 1] : null;

  const formatTimestamp = (ms: number) => {
    const d = new Date(ms);
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  };
  /** 스트림 완료 직후에도 방금 보이던 라이브 내용 유지. Clean Stream 우선: content/thought_stream만 표시 */
  const showLive =
    isLive || (streamStatus === 'COMPLETED' && (eventLog.length > 0 || hasCleanContent));

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
      <PanelHeader title={t('workbench.streamTitle')} />

      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          backgroundImage: `radial-gradient(circle at 1px 1px, ${theme.palette.divider} 1px, transparent 0)`,
          backgroundSize: '12px 12px',
          backgroundPosition: '0 0',
        }}
      >
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
                pt: 2.25,
                mt: 1,
                mx: 1,
                mb: 1.5,
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'flex-start', sm: 'flex-start' },
                gap: 1.5,
              }}
            >
            {isStreaming && (
              <Box sx={{ flexShrink: 0, pt: { xs: 0, sm: 0.25 } }}>
                <PulsingOrb size={20} variant={orbVariant} />
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
                      <Box key={`clean-${i}`} component="span" sx={{ display: 'block', mb: 1 }}>
                        <Typography component="span" variant="caption" sx={{ color: 'text.disabled', mr: 1 }}>
                          {formatTimestamp(line.at)}
                        </Typography>
                        <StreamMarkdownBlock text={line.text} />
                      </Box>
                    ))}
                    {lastLine && (
                      <Box sx={{ color: 'text.primary' }}>
                        <Typography component="span" variant="caption" sx={{ color: 'text.disabled', mr: 1 }}>
                          {formatTimestamp(lastLine.at)}
                        </Typography>
                        {streamingThought?.pending ? (
                          <Skeleton variant="text" width="85%" sx={{ fontSize: '0.875rem' }} />
                        ) : (
                          <TypingMarkdownContent
                            text={lastLine.text}
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
                  activities.map((a, idx) => {
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
                        key={`${a.id ?? 'activity'}-${a.timestamp ?? 'no-ts'}-${a.action ?? 'no-action'}-${idx}`}
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
