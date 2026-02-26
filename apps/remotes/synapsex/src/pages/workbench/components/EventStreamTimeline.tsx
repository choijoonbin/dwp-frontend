/**
 * 이벤트 중심 스트림 타임라인 (자율형 에이전트)
 * NODE_START/TOOL_CALL/COMPLETED/FAILED 등 시스템 이벤트 카드 표시
 * CoT 원문 노출 금지, 이벤트/근거/신뢰신호만 표시
 */

import type { Theme, SxProps } from '@mui/material/styles';
import type { StreamTimelineStep } from '@dwp-frontend/shared-utils';

import { useMemo } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export type EventStreamTimelineProps = {
  steps: StreamTimelineStep[];
  sx?: SxProps<Theme>;
};

/** dedupe key: event_type + node + input_hash + timestamp(초단위) */
function dedupeSteps(steps: StreamTimelineStep[]): StreamTimelineStep[] {
  const seen = new Set<string>();
  return steps.filter((s) => {
    const tsSec = s.at != null ? Math.floor(s.at / 1000) : '';
    const key = `${s.type}|${s.node ?? ''}|${s.input_hash ?? ''}|${tsSec}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const getEventIcon = (type: StreamTimelineStep['type']): string => {
  switch (type) {
    case 'started':
    case 'NODE_START':
      return 'solar:play-circle-bold';
    case 'NODE_END':
      return 'solar:stop-circle-bold';
    case 'step':
    case 'TOOL_CALL':
      return 'solar:settings-bold';
    case 'TOOL_RESULT':
      return 'solar:check-circle-bold';
    case 'EVIDENCE_ADDED':
      return 'solar:document-add-bold';
    case 'EVIDENCE_REJECTED':
      return 'solar:document-remove-bold';
    case 'GATE_APPLIED':
      return 'solar:shield-check-bold';
    case 'completed':
    case 'COMPLETED':
      return 'solar:check-circle-bold';
    case 'failed':
    case 'FAILED':
      return 'solar:close-circle-bold';
    default:
      return 'solar:history-bold';
  }
};

const getEventColor = (
  type: StreamTimelineStep['type']
): 'primary' | 'success' | 'error' | 'warning' | 'default' => {
  switch (type) {
    case 'started':
    case 'NODE_START':
      return 'primary';
    case 'step':
    case 'TOOL_CALL':
    case 'TOOL_RESULT':
    case 'NODE_END':
    case 'GATE_APPLIED':
      return 'primary';
    case 'EVIDENCE_ADDED':
      return 'success';
    case 'EVIDENCE_REJECTED':
      return 'warning';
    case 'completed':
    case 'COMPLETED':
      return 'success';
    case 'failed':
    case 'FAILED':
      return 'error';
    default:
      return 'default';
  }
};

const getEventLabel = (type: StreamTimelineStep['type'], t: (k: string, o?: { defaultValue?: string }) => string): string => {
  switch (type) {
    case 'started':
      return t('workbench.eventStarted', { defaultValue: '시작' });
    case 'step':
      return t('workbench.eventStep', { defaultValue: '단계' });
    case 'completed':
      return t('workbench.eventCompleted', { defaultValue: '완료' });
    case 'failed':
      return t('workbench.eventFailed', { defaultValue: '실패' });
    case 'NODE_START':
      return '노드 시작';
    case 'NODE_END':
      return '노드 종료';
    case 'TOOL_CALL':
      return '도구 호출';
    case 'TOOL_RESULT':
      return '도구 결과';
    case 'EVIDENCE_ADDED':
      return '근거 추가';
    case 'EVIDENCE_REJECTED':
      return '근거 제외';
    case 'GATE_APPLIED':
      return '게이트 적용';
    case 'COMPLETED':
      return '완료';
    case 'FAILED':
      return '실패';
    default:
      return type;
  }
};

export const EventStreamTimeline = ({ steps, sx }: EventStreamTimelineProps) => {
  const { t } = useTranslation('common');
  const deduped = useMemo(() => dedupeSteps(steps), [steps]);

  if (deduped.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'background.neutral', ...sx }}>
        <Typography variant="body2" color="text.secondary">
          {t('workbench.eventStreamEmpty', { defaultValue: '이벤트 데이터 없음' })}
        </Typography>
      </Paper>
    );
  }

  return (
    <Stack spacing={1.5} sx={sx}>
      {deduped.map((step, idx) => {
        const color = getEventColor(step.type);
        const timeStr = step.at
          ? new Date(step.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          : null;
        const summaryMessage = step.message ?? step.detail ?? step.label ?? getEventLabel(step.type, t);

        return (
          <Paper
            key={`ev-${idx}-${step.type}-${step.label ?? ''}`}
            variant="outlined"
            sx={{
              p: 1.5,
              borderLeft: 3,
              borderLeftColor: `${color}.main`,
              bgcolor: 'background.paper',
            }}
          >
            <Stack direction="row" spacing={1} alignItems="flex-start" flexWrap="wrap">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                <Iconify icon={getEventIcon(step.type)} width={18} sx={{ color: `${color}.main` }} />
                <Chip
                  size="small"
                  label={step.label ?? getEventLabel(step.type, t)}
                  color={color}
                  variant="outlined"
                  sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                />
                {timeStr && (
                  <Typography variant="caption" color="text.secondary">
                    {timeStr}
                  </Typography>
                )}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                {(step.node || step.decision_code) && (
                  <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mb: 0.5 }}>
                    {step.node && (
                      <Typography variant="caption" color="text.secondary">
                        node: {step.node}
                      </Typography>
                    )}
                    {step.decision_code && (
                      <Typography variant="caption" color="text.secondary">
                        decision: {step.decision_code}
                      </Typography>
                    )}
                  </Stack>
                )}
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                  {summaryMessage}
                </Typography>
                <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
                  {step.tool && (
                    <Chip size="small" label={`tool: ${step.tool}`} variant="outlined" sx={{ fontSize: '0.65rem' }} />
                  )}
                  {step.latency_ms != null && Number.isFinite(step.latency_ms) && (
                    <Chip
                      size="small"
                      label={`${step.latency_ms}ms`}
                      variant="outlined"
                      sx={{ fontSize: '0.65rem' }}
                    />
                  )}
                  {Array.isArray(step.evidence_ids) && step.evidence_ids.length > 0 && (
                    <Chip
                      size="small"
                      label={`근거 ${step.evidence_ids.length}건`}
                      variant="outlined"
                      sx={{ fontSize: '0.65rem' }}
                    />
                  )}
                  {step.type === 'failed' && step.stage && (
                    <Typography variant="caption" color="error.main">
                      stage: {step.stage}
                    </Typography>
                  )}
                  {step.percent != null && Number.isFinite(step.percent) && step.type === 'step' && (
                    <Chip
                      size="small"
                      label={`${step.percent}%`}
                      variant="outlined"
                      sx={{ fontSize: '0.65rem' }}
                    />
                  )}
                </Stack>
              </Box>
            </Stack>
          </Paper>
        );
      })}
    </Stack>
  );
};
