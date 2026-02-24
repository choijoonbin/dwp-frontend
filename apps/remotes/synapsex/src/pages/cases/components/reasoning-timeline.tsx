/**
 * Reasoning Path — AI 사고 경로 타임라인
 * Hypothesis, Investigation 등 단계를 아이콘과 함께 시각화, 마크다운 스타일 렌더링
 */

import type { Theme, SxProps } from '@mui/material/styles';
import type { StreamingThought } from '@dwp-frontend/shared-utils';

import { useState, useEffect } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Timeline from '@mui/lab/Timeline';
import Skeleton from '@mui/material/Skeleton';
import TimelineDot from '@mui/lab/TimelineDot';
import TimelineItem from '@mui/lab/TimelineItem';
import Typography from '@mui/material/Typography';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineConnector from '@mui/lab/TimelineConnector';
import TimelineSeparator from '@mui/lab/TimelineSeparator';

import type { AiThought } from '../hooks/use-case-detail';

export type ReasoningTimelineProps = {
  thoughts: AiThought[];
  /** thought_pending 시 스켈레톤, AGENT_STREAM 도착 시 실제 텍스트로 전환 */
  pendingThought?: StreamingThought | null;
  /** 추론 카드 클릭 시 chunk_id가 있으면 규정집 영역 scrollIntoView + 하이라이트 */
  onThoughtClick?: (thought: AiThought) => void;
  sx?: SxProps<Theme>;
};

const getTypeIcon = (type: string): string => {
  const lower = type.toLowerCase();
  switch (lower) {
    case 'hypothesis':
      return 'solar:lightbulb-bold-duotone';
    case 'investigation':
      return 'solar:magnifer-zoom-in-bold-duotone';
    case 'analysis':
      return 'solar:graph-up-bold-duotone';
    case 'conclusion':
      return 'solar:check-circle-bold-duotone';
    case 'planning':
      return 'solar:document-text-bold-duotone';
    case 'execution':
      return 'solar:play-circle-bold-duotone';
    case 'verification':
      return 'solar:shield-check-bold-duotone';
    default:
      return 'solar:brain-bold-duotone';
  }
};

const getTypeColor = (type: string): 'info' | 'primary' | 'warning' | 'success' | 'grey' => {
  const lower = type.toLowerCase();
  switch (lower) {
    case 'hypothesis':
      return 'info';
    case 'investigation':
      return 'primary';
    case 'analysis':
      return 'primary';
    case 'conclusion':
      return 'success';
    case 'planning':
      return 'warning';
    case 'execution':
      return 'warning';
    case 'verification':
      return 'success';
    default:
      return 'grey';
  }
};

const getChipColor = (type: string): 'info' | 'primary' | 'warning' | 'success' | 'default' => {
  const color = getTypeColor(type);
  return color === 'grey' ? 'default' : color;
};

/** AGENT_STREAM 도착 시 타이핑 효과: visibleLength를 점진 증가시켜 마크다운 렌더링 */
const TYPING_INTERVAL_MS = 24;
const TYPING_CHUNK = 2;

const TypingMarkdownContent = ({ text }: { text: string }) => {
  const [visibleLength, setVisibleLength] = useState(0);

  useEffect(() => {
    setVisibleLength(0);
    if (!text.length) return () => {};
    let mounted = true;
    const timer = setInterval(() => {
      if (!mounted) return;
      setVisibleLength((prev) => {
        const next = Math.min(prev + TYPING_CHUNK, text.length);
        return next;
      });
    }, TYPING_INTERVAL_MS);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [text]);

  const visible = text.slice(0, visibleLength);
  if (!visible) return null;
  return <MarkdownLikeContent text={visible} />;
};

/** 인라인 마크다운(**굵게**, *기울임*, `코드`)만 렌더링한 React 노드 배열 반환 */
const renderInlineMarkdown = (raw: string, keyPrefix: string): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  let remaining = raw;
  let key = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
    const italicMatch = remaining.match(/(?<!\*)\*([^*]+)\*(?!\*)/);
    const codeMatch = remaining.match(/`([^`]+)`/);
    const boldIdx = boldMatch?.index ?? Infinity;
    const italicIdx = italicMatch?.index ?? Infinity;
    const codeIdx = codeMatch?.index ?? Infinity;
    const first = Math.min(boldIdx, italicIdx, codeIdx);

    if (first === Infinity) {
      parts.push(<span key={`${keyPrefix}-${key++}`}>{remaining}</span>);
      break;
    }
    if (first > 0) {
      parts.push(<span key={`${keyPrefix}-${key++}`}>{remaining.slice(0, first)}</span>);
    }
    if (boldIdx === first && boldMatch) {
      parts.push(
        <Typography key={`${keyPrefix}-${key++}`} component="span" sx={{ fontWeight: 700 }}>
          {boldMatch[1]}
        </Typography>
      );
      remaining = remaining.slice(first + boldMatch[0].length);
    } else if (italicIdx === first && italicMatch) {
      parts.push(
        <Typography key={`${keyPrefix}-${key++}`} component="span" sx={{ fontStyle: 'italic' }}>
          {italicMatch[1]}
        </Typography>
      );
      remaining = remaining.slice(first + italicMatch[0].length);
    } else if (codeMatch) {
      parts.push(
        <Box
          key={`${keyPrefix}-${key++}`}
          component="span"
          sx={{
            fontFamily: 'monospace',
            fontSize: '0.875em',
            bgcolor: 'action.hover',
            px: 0.5,
            borderRadius: 0.5,
          }}
        >
          {codeMatch[1]}
        </Box>
      );
      remaining = remaining.slice(first + codeMatch[0].length);
    }
  }
  return parts;
};

const INLINE_KEY = 'inline';

/** 마크다운 표 한 줄 파싱: | cell | cell | → ['cell','cell'] */
const parseTableRow = (line: string): string[] | null => {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;
  const cells = trimmed
    .slice(1, -1)
    .split('|')
    .map((c) => c.trim());
  return cells.length > 0 ? cells : null;
};

/** 표 구분선인지 (|---|---|) */
const isTableSeparator = (line: string): boolean => /^\s*\|[\s\-:]+\|/.test(line.trim());

/**
 * Aura 추론 문장 마크다운 스타일 렌더링 (인하우스)
 * - **굵게** · *기울임* · `코드`
 * - 글머리 기호(- ), 번호(1. ) 리스트
 * - 표(| ... |) 형식
 * 줄바꿈(pre-wrap) 유지
 */
const MarkdownLikeContent = ({ text }: { text: string }) => {
  if (!text.trim()) return null;

  const lines = text.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let blockKey = 0;

  type BlockType = 'paragraph' | 'ul' | 'ol' | 'table';
  const state: { currentType: BlockType } = { currentType: 'paragraph' };
  const paragraphLines: string[] = [];
  const ulLines: string[] = [];
  const olLines: string[] = [];
  const tableRows: string[][] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    const joined = paragraphLines.join('\n');
    paragraphLines.length = 0;
    blocks.push(
      <Typography key={`p-${blockKey++}`} variant="body2" sx={{ lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
        {renderInlineMarkdown(joined, `${blockKey}-p`)}
      </Typography>
    );
  };

  const flushUl = () => {
    if (ulLines.length === 0) return;
    const items = [...ulLines];
    ulLines.length = 0;
    blocks.push(
      <Box key={`ul-${blockKey++}`} component="ul" sx={{ pl: 2.5, m: 0, my: 0.5 }}>
        {items.map((line, i) => (
          <Box key={`uli-${blockKey}-${i}`} component="li" sx={{ py: 0.25 }}>
            <Typography variant="body2" component="span" sx={{ lineHeight: 1.75 }}>
              {renderInlineMarkdown(line, `ul-${blockKey}-${i}`)}
            </Typography>
          </Box>
        ))}
      </Box>
    );
  };

  const flushOl = () => {
    if (olLines.length === 0) return;
    const items = [...olLines];
    olLines.length = 0;
    blocks.push(
      <Box key={`ol-${blockKey++}`} component="ol" sx={{ pl: 2.5, m: 0, my: 0.5 }}>
        {items.map((line, i) => (
          <Box key={`oli-${blockKey}-${i}`} component="li" sx={{ py: 0.25 }}>
            <Typography variant="body2" component="span" sx={{ lineHeight: 1.75 }}>
              {renderInlineMarkdown(line, `ol-${blockKey}-${i}`)}
            </Typography>
          </Box>
        ))}
      </Box>
    );
  };

  const flushTable = () => {
    if (tableRows.length === 0) return;
    const rows = [...tableRows];
    tableRows.length = 0;
    const header = rows[0];
    const bodyRows = rows.slice(1);
    blocks.push(
      <Box
        key={`table-${blockKey++}`}
        component="table"
        sx={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.875rem',
          my: 1,
          '& th, & td': { border: 1, borderColor: 'divider', px: 1, py: 0.75, textAlign: 'left' },
          '& th': { bgcolor: 'action.hover', fontWeight: 600 },
        }}
      >
        <Box component="thead">
          <Box component="tr">
            {header.map((cell, i) => (
              <Box key={`th-${i}`} component="th">
                {cell}
              </Box>
            ))}
          </Box>
        </Box>
        <Box component="tbody">
          {bodyRows.map((row, ri) => (
            <Box key={`tr-${ri}`} component="tr">
              {row.map((cell, ci) => (
                <Box key={`td-${ri}-${ci}`} component="td">
                  {renderInlineMarkdown(cell, `t-${blockKey}-${ri}-${ci}`)}
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      </Box>
    );
  };

  const flush = (nextType: BlockType) => {
    if (state.currentType === 'paragraph') flushParagraph();
    else if (state.currentType === 'ul') flushUl();
    else if (state.currentType === 'ol') flushOl();
    else if (state.currentType === 'table') flushTable();
    state.currentType = nextType;
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trimStart();
    const tableCells = parseTableRow(line);

    if (tableCells !== null && !isTableSeparator(line)) {
      if (state.currentType !== 'table') flush('table');
      tableRows.push(tableCells);
      i += 1;
      continue;
    }
    if (state.currentType === 'table') flush('paragraph');

    if (/^\s*[-*]\s+/.test(line)) {
      if (state.currentType !== 'ul') flush('ul');
      ulLines.push(trimmed.replace(/^\s*[-*]\s+/, '').trim());
      i += 1;
      continue;
    }
    if (state.currentType === 'ul') flush('paragraph');

    if (/^\s*\d+\.\s+/.test(line)) {
      if (state.currentType !== 'ol') flush('ol');
      olLines.push(trimmed.replace(/^\s*\d+\.\s+/, '').trim());
      i += 1;
      continue;
    }
    if (state.currentType === 'ol') flush('paragraph');

    paragraphLines.push(line);
    i += 1;
  }

  flush('paragraph');

  return (
    <Stack spacing={0.5} sx={{ '& > *': { minHeight: 0 } }}>
      {blocks}
    </Stack>
  );
};

const ThoughtItemContent = ({
  thought,
  t,
}: {
  thought: AiThought;
  t: (key: string, opts?: { n?: number }) => string;
}) => (
  <>
    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
      {/* "사고 중 Step X" 제거 — aiThoughts.message를 카드 제목·본문으로 사용 */}
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
    <MarkdownLikeContent text={thought.content} />
  </>
);

export const ReasoningTimeline = ({ thoughts, pendingThought, onThoughtClick, sx }: ReasoningTimelineProps) => {
  const { t } = useTranslation('common');
  const hasPending = pendingThought != null;
  const showEmpty = thoughts.length === 0 && !hasPending;

  if (showEmpty) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'background.neutral', ...sx }}>
        <Typography variant="body2" color="text.secondary">
          {t('caseDetail.reasoningPathEmpty')}
        </Typography>
      </Paper>
    );
  }

  const totalItems = thoughts.length + (hasPending ? 1 : 0);

  return (
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
              <Iconify icon={getTypeIcon(thought.type)} width={18} />
            </TimelineDot>
            {index < totalItems - 1 && <TimelineConnector />}
          </TimelineSeparator>
          <TimelineContent sx={{ pr: 0, pb: 2 }}>
            <Paper
              component={thought.chunkId && onThoughtClick ? 'button' : 'div'}
              type={thought.chunkId && onThoughtClick ? 'button' : undefined}
              onClick={
                thought.chunkId && onThoughtClick
                  ? () => onThoughtClick(thought)
                  : undefined
              }
              sx={{
                p: 2,
                width: '100%',
                textAlign: 'left',
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                borderRadius: 2,
                cursor: thought.chunkId && onThoughtClick ? 'pointer' : undefined,
                '&:hover': thought.chunkId && onThoughtClick ? { bgcolor: 'action.hover' } : undefined,
              }}
            >
              <Stack spacing={1.5}>
                <ThoughtItemContent thought={thought} t={t} />
              </Stack>
            </Paper>
          </TimelineContent>
        </TimelineItem>
      ))}
      {hasPending && pendingThought && (
        <TimelineItem key="streaming-pending">
          <TimelineSeparator>
            <TimelineDot color={getTypeColor(pendingThought.type)} variant="outlined">
              <Iconify icon={getTypeIcon(pendingThought.type)} width={18} />
            </TimelineDot>
          </TimelineSeparator>
          <TimelineContent sx={{ pr: 0, pb: 2 }}>
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
                {/* "사고 중 Step X" 하드코딩 제거 — API message(Aura 문장)를 제목·본문으로 사용 */}
                {pendingThought.pending ? (
                  <Stack spacing={1}>
                    <Skeleton variant="text" sx={{ fontSize: '0.875rem' }} width="90%" />
                    <Skeleton variant="text" sx={{ fontSize: '0.875rem' }} width="70%" />
                    <Skeleton variant="text" sx={{ fontSize: '0.875rem' }} width="60%" />
                  </Stack>
                ) : pendingThought.content ? (
                  <TypingMarkdownContent text={pendingThought.content} />
                ) : null}
              </Stack>
            </Paper>
          </TimelineContent>
        </TimelineItem>
      )}
    </Timeline>
  );
};
