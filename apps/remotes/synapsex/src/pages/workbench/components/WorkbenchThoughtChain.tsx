/**
 * AI 사고 과정 시각화 (ThoughtChainUI 호환)
 * theme.vars.palette 전용, 하드코딩 색상 없음
 */

import type { Theme, SxProps } from '@mui/material/styles';

import { useEffect, useState } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';

import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Timeline from '@mui/lab/Timeline';
import TimelineDot from '@mui/lab/TimelineDot';
import TimelineItem from '@mui/lab/TimelineItem';
import Typography from '@mui/material/Typography';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineConnector from '@mui/lab/TimelineConnector';
import TimelineSeparator from '@mui/lab/TimelineSeparator';

import type { AiThought } from '../../cases/hooks/use-case-detail';

export type WorkbenchThoughtChainProps = {
  thoughts: AiThought[];
  /** THOUGHT_STREAM 수신 중일 때 마지막 thought를 타자 효과로 표시 */
  isStreamingLast?: boolean;
  sx?: SxProps<Theme>;
};

const TYPEWRITER_MS = 20;

const TypewriterText = ({ text, active }: { text: string; active: boolean }) => {
  const [visibleLength, setVisibleLength] = useState(0);
  useEffect(() => {
    if (!active) {
      setVisibleLength(text.length);
      return undefined;
    }
    const id = setInterval(() => {
      setVisibleLength((prev) => Math.min(prev + 1, text.length));
    }, TYPEWRITER_MS);
    return () => clearInterval(id);
  }, [active, text.length]);
  const len = active ? Math.min(visibleLength, text.length) : text.length;
  return <>{text.slice(0, len)}{active && len < text.length ? '\u200b' : ''}</>;
};

const getTypeIcon = (type: string): string => {
  switch (type) {
    case 'analysis':
      return 'solar:magnifer-zoom-in-bold';
    case 'planning':
      return 'solar:document-text-bold';
    case 'execution':
      return 'solar:settings-bold';
    case 'verification':
      return 'solar:check-circle-bold';
    default:
      return 'solar:brain-bold';
  }
};

const getTypeLabelKey = (type: string): string => {
  switch (type.toLowerCase()) {
    case 'analysis':
      return 'workbench.thought.analysis';
    case 'planning':
      return 'workbench.thought.planning';
    case 'execution':
      return 'workbench.thought.execution';
    case 'verification':
      return 'workbench.thought.verification';
    default:
      return 'workbench.thought.thinking';
  }
};

const getTypeColor = (type: string): 'info' | 'primary' | 'warning' | 'success' | 'grey' => {
  switch (type.toLowerCase()) {
    case 'analysis':
      return 'info';
    case 'planning':
      return 'primary';
    case 'execution':
      return 'warning';
    case 'verification':
      return 'success';
    default:
      return 'grey';
  }
};

/** Chip color: MUI Chip does not accept 'grey', use 'default'. */
const getChipColor = (type: string): 'info' | 'primary' | 'warning' | 'success' | 'default' => {
  const color = getTypeColor(type);
  return color === 'grey' ? 'default' : color;
};

export const WorkbenchThoughtChain = ({ thoughts, isStreamingLast = false, sx }: WorkbenchThoughtChainProps) => {
  const { t } = useTranslation('common');

  if (thoughts.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'background.neutral', ...sx }}>
        <Typography variant="body2" color="text.secondary">
          {t('workbench.detailHint')}
        </Typography>
      </Paper>
    );
  }

  return (
    <>
    <Timeline
      position="right"
      sx={{
        p: 0,
        m: 0,
        '& .MuiTimelineItem-root:before': { flex: 0, padding: 0 },
        ...sx,
      }}
    >
      {thoughts.map((thought, index) => (
        <TimelineItem key={thought.id}>
          <TimelineSeparator>
            <TimelineDot color={getTypeColor(thought.type)} variant="outlined">
              <Iconify icon={getTypeIcon(thought.type)} width={16} />
            </TimelineDot>
            {index < thoughts.length - 1 && <TimelineConnector />}
          </TimelineSeparator>
          <TimelineContent sx={{ pr: 0 }}>
            <Paper
              sx={{
                p: 2,
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                borderRadius: 2,
              }}
            >
              <Stack spacing={1.5}>
                {/* API aiThoughts.message(Aura 문장)를 카드 제목·본문으로 사용. "사고 중 Step X" 하드코딩 제거 */}
                {thought.content.length > 120 ? (
                  <>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.4 }}>
                      {thought.content.slice(0, 80)}…
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                      {isStreamingLast && index === thoughts.length - 1 ? (
                        <TypewriterText text={thought.content} active />
                      ) : (
                        thought.content
                      )}
                    </Typography>
                  </>
                ) : (
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                    {isStreamingLast && index === thoughts.length - 1 ? (
                      <TypewriterText text={thought.content} active />
                    ) : (
                      thought.content
                    )}
                  </Typography>
                )}
                {(thought.confidence != null || thought.timestamp) && (
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    {thought.confidence != null && (
                      <Chip
                        label={`${Math.round(thought.confidence * 100)}%`}
                        size="small"
                        variant="outlined"
                        color={thought.confidence > 0.8 ? 'success' : thought.confidence > 0.5 ? 'primary' : 'warning'}
                      />
                    )}
                    {thought.timestamp && (
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                        {new Date(thought.timestamp).toLocaleTimeString()}
                      </Typography>
                    )}
                  </Stack>
                )}
              </Stack>
            </Paper>
          </TimelineContent>
        </TimelineItem>
      ))}
    </Timeline>
    </>
  );
};
