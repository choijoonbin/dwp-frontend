import type { Theme, SxProps } from '@mui/material/styles';
import type { CaseAnalysisDto } from '@dwp-frontend/shared-utils';

import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { Iconify, varAlpha } from '@dwp-frontend/design-system';
import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  getMe,
  useAuth,
  useStreamStore,
  useAgentEventsQuery,
  filterStepsForDefaultView,
  agentEventsToTimelineSteps,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Accordion from '@mui/material/Accordion';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import { alpha, useTheme } from '@mui/material/styles';
import TableContainer from '@mui/material/TableContainer';
import FormControlLabel from '@mui/material/FormControlLabel';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';

import { PanelHeader } from '../../workbench/components/PanelHeader';
import { StatusBadge } from '../../../components/finance/status-badge';
import { EventStreamTimeline } from '../../workbench/components/EventStreamTimeline';
import { WorkbenchItemDetailGrid } from '../../workbench/components/WorkbenchItemDetailGrid';
import { WorkbenchActionHistoryTimeline } from '../../workbench/components/WorkbenchActionHistoryTimeline';

import type {
  AiThought,
  FiDocItem,
  FinalReportItem,
  EvidenceLinkItem,
  ActionHistoryItem,
  EvidenceUsageStatus,
  LogicCheckpointItem,
} from '../../cases/hooks/use-case-detail';

type NewCaseTab = 'thought' | 'review' | 'evidence' | 'report';

export type WorkbenchNewCasePanelProps = {
  selectedCaseId?: string | null;
  title?: string;
  caseNumber?: string;
  caseStatus?: string;
  briefingInsight?: string;
  reasoningProcess?: string[];
  logicCheckpoints?: LogicCheckpointItem[];
  evidenceLinks?: EvidenceLinkItem[];
  finalReport?: FinalReportItem | null;
  aiThoughts?: AiThought[];
  actionHistory?: ActionHistoryItem[];
  fiDocItems?: FiDocItem[];
  targetBuzei?: string;
  itemsCurrency?: string;
  isLoading?: boolean;
  explanationLoading?: boolean;
  onRequestExplanation?: () => void;
  analysisData?: CaseAnalysisDto | null;
  /** case detail API의 reasoning (analysis API 실패 시 fallback) */
  caseDetailReasoning?: Record<string, unknown> | null;
  getGlassPanelSx: (theme: Theme) => Record<string, unknown>;
  sx?: SxProps<Theme>;
};

type SentenceCitationItem = {
  sentence_index?: number;
  sentence?: string;
  citation_ids?: string[];
  grounded?: boolean;
  [key: string]: unknown;
};

type CitationItem = {
  citation_id?: string;
  chunk_id?: string;
  excerpt?: string;
  sourceKey?: string;
  source_key?: string;
  target_buzei?: string | number;
  [key: string]: unknown;
};

const QUALITY_GATE_META: Record<
  string,
  { label: string; description: string; color: 'error' | 'warning' | 'info' | 'default' }
> = {
  OK: { label: '정상', description: '분석 신뢰 신호가 정상 범위입니다.', color: 'default' },
  RAG_ZERO: { label: 'RAG 0건', description: '관련 근거 검색 결과가 없습니다.', color: 'error' },
  EVIDENCE_MISSING: { label: '근거 데이터 없음', description: '결론에 필요한 근거 데이터가 없습니다.', color: 'warning' },
  EVIDENCE_COVERAGE_LOW: {
    label: '근거 부족',
    description: '문장별 근거 커버리지가 낮아 신뢰도가 제한됩니다.',
    color: 'warning',
  },
  SENTENCE_CITATION_MISSING: {
    label: '문장 근거 미연결',
    description: '핵심 문장에 citation 연결이 부족합니다.',
    color: 'warning',
  },
  POLICY_CONFLICT: { label: '판단 근거 상충', description: '판단 근거 상충이 감지되었습니다.', color: 'info' },
  POLICY_CONFLICT_DETECTED: { label: '판단 근거 상충', description: '판단 근거 상충이 감지되었습니다.', color: 'info' },
  POLICY_REEVAL_APPLIED: {
    label: '정책 재검토 적용',
    description: '판단 근거 상충으로 보수적 재평가가 적용되었습니다.',
    color: 'info',
  },
  INPUT_PARTIAL: { label: '입력 데이터 일부 누락', description: '입력 데이터가 부분 누락되었습니다.', color: 'warning' },
  RISK_ARTICLE_MISMATCH: {
    label: '위험유형-조항 불일치',
    description: '위험 유형과 조항 매핑이 일치하지 않습니다.',
    color: 'warning',
  },
  FACT_CONTEXT_PARTIAL: {
    label: '사실 컨텍스트 일부 누락',
    description: '사실 컨텍스트 정보가 일부 누락되었습니다.',
    color: 'warning',
  },
};

const QUALITY_GATE_PRIORITY = [
  'OK',
  'RAG_ZERO',
  'EVIDENCE_MISSING',
  'POLICY_CONFLICT',
  'POLICY_CONFLICT_DETECTED',
  'INPUT_PARTIAL',
  'RISK_ARTICLE_MISMATCH',
  'FACT_CONTEXT_PARTIAL',
  'SENTENCE_CITATION_MISSING',
  'EVIDENCE_COVERAGE_LOW',
  'POLICY_REEVAL_APPLIED',
];

const sortQualityGateCodes = (codes: string[]) =>
  [...codes].sort((a, b) => {
    const ai = QUALITY_GATE_PRIORITY.indexOf(a);
    const bi = QUALITY_GATE_PRIORITY.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });

const normalizeQualityGateCode = (code: string): string => code.split('(')[0]?.split(':')[0]?.trim() ?? code;

const normalizeAndSortSignals = (signals: string[]): string[] => {
  const normalized = Array.from(
    new Set(
      signals
        .map((s) => (typeof s === 'string' ? normalizeQualityGateCode(s) : ''))
        .filter((s): s is string => s.length > 0)
    )
  );
  const withoutOk = normalized.length > 1 ? normalized.filter((s) => s !== 'OK') : normalized;
  return sortQualityGateCodes(withoutOk);
};

const toFriendlyQualityGateLabel = (rawCode: string): string => {
  const raw = String(rawCode ?? '').trim();
  if (!raw) return '-';
  // 백엔드가 표시용 문구를 내려주는 경우(예: 한글)는 원문 그대로 사용
  if (!/^[A-Z0-9_:\-() ]+$/.test(raw)) return raw;
  const normalized = normalizeQualityGateCode(rawCode);
  const meta = QUALITY_GATE_META[normalized];
  if (meta) return meta.label;
  return `기타 (${normalized})`;
};

const getRegulationStatusMeta = (
  statusCode: LogicCheckpointItem['statusCode'],
  legacyStatus: LogicCheckpointItem['status'],
  isHoldStateOverride?: boolean
): { label: string; color: 'success' | 'error' | 'warning' | 'default' } => {
  let code = statusCode ?? (legacyStatus === 'violation' ? 'VIOLATION' : 'COMPLIANT');
  if (isHoldStateOverride && code === 'COMPLIANT') {
    code = 'NEEDS_REVIEW';
  }
  switch (code) {
    case 'VIOLATION':
      return { label: '위반', color: 'error' };
    case 'HOLD':
      return { label: '판단 보류', color: 'warning' };
    case 'CONFLICT':
      return { label: '충돌', color: 'warning' };
    case 'NEEDS_REVIEW':
      return { label: '재검토 필요', color: 'default' };
    default:
      return { label: '준수', color: 'success' };
  }
};

const composeRegulationPath = (item: LogicCheckpointItem): string => {
  const parts = [item.version, item.chapter, item.article, item.clause]
    .map((v) => String(v ?? '').trim())
    .filter((v) => v.length > 0);
  return parts.length > 0 ? parts.join(' > ') : '-';
};

export function WorkbenchNewCasePanel({
  selectedCaseId,
  title,
  caseNumber,
  caseStatus,
  briefingInsight,
  reasoningProcess = [],
  logicCheckpoints = [],
  evidenceLinks = [],
  finalReport = null,
  aiThoughts = [],
  actionHistory = [],
  fiDocItems = [],
  targetBuzei,
  itemsCurrency,
  isLoading = false,
  explanationLoading = false,
  onRequestExplanation,
  analysisData = null,
  caseDetailReasoning = null,
  getGlassPanelSx,
  sx,
}: WorkbenchNewCasePanelProps) {
  const { t } = useTranslation('common');
  const theme = useTheme();
  const { isAuthenticated } = useAuth();
  const [tab, setTab] = useState<NewCaseTab>('thought');
  const [debugTimelineView, setDebugTimelineView] = useState(false);
  const [scrollToBuzei, setScrollToBuzei] = useState<string | null>(null);
  const [highlightedCitationId, setHighlightedCitationId] = useState<string | null>(null);
  const [highlightedCitationIds, setHighlightedCitationIds] = useState<string[]>([]);
  const [highlightedSentenceIndices, setHighlightedSentenceIndices] = useState<number[]>([]);
  const runId = analysisData?.runId ?? (analysisData as { runId?: string } | undefined)?.runId;
  const agentEventsQuery = useAgentEventsQuery(selectedCaseId ?? undefined, runId ?? null, {
    enabled: Boolean(selectedCaseId),
    view: debugTimelineView ? 'debug' : 'default',
  });
  const agentEventsStepsRaw = useMemo(
    () => agentEventsToTimelineSteps(agentEventsQuery.data),
    [agentEventsQuery.data]
  );
  const agentEventsSteps = useMemo(() => {
    if (debugTimelineView) return agentEventsStepsRaw;
    return filterStepsForDefaultView(agentEventsStepsRaw);
  }, [agentEventsStepsRaw, debugTimelineView]);
  /** analysis 응답의 aiThoughts/activityHistory → StreamTimelineStep 변환 (eventType, message, occurredAt) */
  const analysisTimelineSteps = useMemo(() => {
    const raw =
      (analysisData?.aiThoughts ?? analysisData?.activityHistory ?? []) as Array<{
        eventType?: string;
        stage?: string;
        message?: string;
        occurredAt?: string;
        occurred_at?: string;
      }>;
    return raw.map((item) => ({
      type: 'step' as const,
      label: item.eventType ?? item.stage ?? 'step',
      detail: item.message ?? '',
      message: item.message ?? '',
      at: (item.occurredAt ?? item.occurred_at)
        ? new Date(item.occurredAt ?? item.occurred_at!).getTime()
        : undefined,
    }));
  }, [analysisData?.aiThoughts, analysisData?.activityHistory]);
  /** detail.aiThoughts → StreamTimelineStep 변환 */
  const detailThoughtsSteps = useMemo(
    () =>
      aiThoughts.map((thought) => ({
        type: 'step' as const,
        label: thought.type,
        detail: thought.content,
        message: thought.content,
        at: thought.timestamp ? new Date(thought.timestamp).getTime() : undefined,
      })),
    [aiThoughts]
  );
  /** 1순위: agent-events(데이터 있을 때만), 2순위: analysis aiThoughts/activityHistory, 3순위: detail.aiThoughts.
   * agent-events 로딩 중에는 fallback 사용 보류 → agent_stream이 먼저 보이는 현상 방지 */
  const effectiveTimelineSteps = useMemo(() => {
    if (agentEventsSteps.length > 0) return agentEventsSteps;
    if (agentEventsQuery.isFetching && !agentEventsQuery.data) {
      return [];
    }
    if (analysisTimelineSteps.length > 0) return analysisTimelineSteps;
    return detailThoughtsSteps;
  }, [agentEventsSteps, agentEventsQuery.isFetching, agentEventsQuery.data, analysisTimelineSteps, detailThoughtsSteps]);
  const liveSentenceCitationMap = useStreamStore((s) => s.liveSentenceCitationMap);
  const pendingCitationJumpId = useStreamStore((s) => s.pendingCitationJumpId);
  const clearCitationJumpRequest = useStreamStore((s) => s.clearCitationJumpRequest);
  const firstClause = logicCheckpoints[0]?.clause?.trim();
  const contextSummary = firstClause || briefingInsight || title || t('workbench.detailHint');
  const decisionReason = (analysisData?.decisionReason ?? analysisData?.decision_reason ?? {}) as Record<string, unknown>;
  const caseDetailEvidenceMap = (caseDetailReasoning?.evidenceJson ?? caseDetailReasoning?.evidence_json) as
    | Record<string, unknown>
    | undefined;
  const caseDetailEvidenceMapJson = (caseDetailEvidenceMap?.evidenceMapJson ??
    caseDetailEvidenceMap?.evidence_map_json) as Record<string, unknown> | undefined;
  const qualityGateCodesRaw = useMemo(
    () =>
      [
        ...(Array.isArray(analysisData?.qualityGateCodes) ? analysisData.qualityGateCodes : []),
        ...(Array.isArray(analysisData?.quality_gate_codes) ? analysisData.quality_gate_codes : []),
        ...(Array.isArray(decisionReason.qualityGateCodes) ? (decisionReason.qualityGateCodes as string[]) : []),
        ...(Array.isArray(decisionReason.quality_gate_codes)
          ? (decisionReason.quality_gate_codes as string[])
          : []),
        ...(Array.isArray(caseDetailEvidenceMapJson?.qualityGateCodes)
          ? (caseDetailEvidenceMapJson.qualityGateCodes as string[])
          : []),
        ...(Array.isArray(caseDetailEvidenceMapJson?.quality_gate_codes)
          ? (caseDetailEvidenceMapJson.quality_gate_codes as string[])
          : []),
      ].filter((code): code is string => typeof code === 'string' && code.trim().length > 0),
    [
      analysisData?.qualityGateCodes,
      analysisData?.quality_gate_codes,
      decisionReason.qualityGateCodes,
      decisionReason.quality_gate_codes,
      caseDetailEvidenceMapJson?.qualityGateCodes,
      caseDetailEvidenceMapJson?.quality_gate_codes,
    ]
  );
  const qualityGateCodes = useMemo(() => normalizeAndSortSignals(qualityGateCodesRaw), [qualityGateCodesRaw]);
  const analysisQualitySignalsRaw = useMemo(
    () =>
      [
        ...(Array.isArray(analysisData?.analysisQualitySignals) ? analysisData.analysisQualitySignals : []),
        ...(Array.isArray(analysisData?.analysis_quality_signals) ? analysisData.analysis_quality_signals : []),
        ...(Array.isArray(decisionReason.analysisQualitySignals)
          ? (decisionReason.analysisQualitySignals as string[])
          : []),
        ...(Array.isArray(decisionReason.analysis_quality_signals)
          ? (decisionReason.analysis_quality_signals as string[])
          : []),
        ...(Array.isArray(caseDetailEvidenceMapJson?.analysisQualitySignals)
          ? (caseDetailEvidenceMapJson.analysisQualitySignals as string[])
          : []),
        ...(Array.isArray(caseDetailEvidenceMapJson?.analysis_quality_signals)
          ? (caseDetailEvidenceMapJson.analysis_quality_signals as string[])
          : []),
      ].filter((code): code is string => typeof code === 'string' && code.trim().length > 0),
    [
      analysisData?.analysisQualitySignals,
      analysisData?.analysis_quality_signals,
      decisionReason.analysisQualitySignals,
      decisionReason.analysis_quality_signals,
      caseDetailEvidenceMapJson?.analysisQualitySignals,
      caseDetailEvidenceMapJson?.analysis_quality_signals,
    ]
  );
  const analysisQualitySignals = useMemo(
    () => normalizeAndSortSignals(analysisQualitySignalsRaw),
    [analysisQualitySignalsRaw]
  );
  const displayedSignals = analysisQualitySignals.length > 0 ? analysisQualitySignals : qualityGateCodes;
  const evidenceUsageByRowIndex = useMemo((): Record<number, EvidenceUsageStatus> => {
    const map: Record<number, EvidenceUsageStatus> = {};
    evidenceLinks.forEach((link) => {
      if (link.usage) map[link.itemIdx] = link.usage;
    });
    return map;
  }, [evidenceLinks]);
  const sentenceCitationMap = useMemo(() => {
    const mapFromApi = [
      ...(Array.isArray(analysisData?.sentenceCitationMap) ? analysisData.sentenceCitationMap : []),
      ...(Array.isArray(analysisData?.sentence_citation_map) ? analysisData.sentence_citation_map : []),
      ...(Array.isArray(decisionReason.sentenceCitationMap)
        ? (decisionReason.sentenceCitationMap as SentenceCitationItem[])
        : []),
      ...(Array.isArray(decisionReason.sentence_citation_map)
        ? (decisionReason.sentence_citation_map as SentenceCitationItem[])
        : []),
      ...(Array.isArray(caseDetailEvidenceMapJson?.sentenceCitationMap)
        ? (caseDetailEvidenceMapJson.sentenceCitationMap as SentenceCitationItem[])
        : []),
      ...(Array.isArray(caseDetailEvidenceMapJson?.sentence_citation_map)
        ? (caseDetailEvidenceMapJson.sentence_citation_map as SentenceCitationItem[])
        : []),
    ];
    if (mapFromApi.length > 0) return mapFromApi as SentenceCitationItem[];
    return liveSentenceCitationMap as SentenceCitationItem[];
  }, [
    analysisData?.sentenceCitationMap,
    analysisData?.sentence_citation_map,
    decisionReason.sentenceCitationMap,
    decisionReason.sentence_citation_map,
    caseDetailEvidenceMapJson?.sentenceCitationMap,
    caseDetailEvidenceMapJson?.sentence_citation_map,
    liveSentenceCitationMap,
  ]);
  const citations = useMemo(() => {
    const fromAnalysis = Array.isArray(analysisData?.citations)
      ? analysisData.citations.filter((item): item is CitationItem => !!item && typeof item === 'object')
      : [];
    if (fromAnalysis.length > 0) return fromAnalysis as CitationItem[];
    const fromCaseDetail = caseDetailEvidenceMapJson?.citations as CitationItem[] | undefined;
    return Array.isArray(fromCaseDetail)
      ? fromCaseDetail.filter((item): item is CitationItem => !!item && typeof item === 'object')
      : [];
  }, [analysisData?.citations, caseDetailEvidenceMapJson?.citations]);
  const analysisScoreBreakdown = useMemo(
    () =>
      (analysisData?.analysisScoreBreakdown ??
        analysisData?.analysis_score_breakdown ??
        decisionReason.analysisScoreBreakdown ??
        decisionReason.analysis_score_breakdown ??
        caseDetailEvidenceMapJson?.analysisScoreBreakdown ??
        caseDetailEvidenceMapJson?.analysis_score_breakdown) as Record<string, unknown> | undefined,
    [
      analysisData?.analysisScoreBreakdown,
      analysisData?.analysis_score_breakdown,
      decisionReason.analysisScoreBreakdown,
      decisionReason.analysis_score_breakdown,
      caseDetailEvidenceMapJson?.analysisScoreBreakdown,
      caseDetailEvidenceMapJson?.analysis_score_breakdown,
    ]
  );
  const policyScore = Number(analysisScoreBreakdown?.policyScore ?? analysisScoreBreakdown?.policy_score);
  const evidenceScore = Number(analysisScoreBreakdown?.evidenceScore ?? analysisScoreBreakdown?.evidence_score);
  const finalScore = Number(analysisScoreBreakdown?.finalScore ?? analysisScoreBreakdown?.final_score);
  const holdReason =
    (analysisScoreBreakdown?.holdReason as string | undefined) ??
    (analysisScoreBreakdown?.hold_reason as string | undefined);
  const hasSignal = useCallback(
    (target: string) => displayedSignals.some((code) => normalizeQualityGateCode(code) === target),
    [displayedSignals]
  );
  const isHoldState = hasSignal('POLICY_CONFLICT') || hasSignal('POLICY_CONFLICT_DETECTED') || hasSignal('RAG_ZERO');
  const qualityReportRaw =
    (decisionReason.quality_report ?? decisionReason.qualityReport) ?? (analysisData as Record<string, unknown> | null)?.quality_report;
  const mismatchReasonsRaw =
    (decisionReason.mismatch_reasons ?? decisionReason.mismatchReasons) ??
    (analysisData as Record<string, unknown> | null)?.mismatch_reasons;
  const meQuery = useQuery({
    queryKey: ['auth', 'me', 'workbench-new-case-panel'],
    queryFn: async () => {
      const res = await getMe();
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        throw new Error(res.message || 'Failed to fetch me');
      }
      return res.data as { roles?: unknown };
    },
    enabled: isAuthenticated,
    retry: false,
  });
  const roles = Array.isArray(meQuery.data?.roles)
    ? meQuery.data.roles.filter((role): role is string => typeof role === 'string')
    : [];
  const canDebugPanel =
    roles.includes('ADMIN') || roles.includes('SYNAPSEX_ADMIN') || roles.includes('SYNAPSEX_OPERATOR');
  const handleCitationClick = useCallback(
    (citationId: string) => {
      setHighlightedCitationId(citationId);
      setHighlightedCitationIds([citationId]);
      const indices = sentenceCitationMap
        .map((item, idx) => (item.citation_ids ?? []).includes(citationId) ? idx : -1)
        .filter((i) => i >= 0);
      setHighlightedSentenceIndices(indices);
      const citationEl = document.getElementById(`workbench-citation-${citationId}`);
      if (citationEl) citationEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },
    [sentenceCitationMap]
  );
  const handleSentenceClick = useCallback(
    (sentenceIndex: number, citationIds: string[]) => {
      setHighlightedSentenceIndices([sentenceIndex]);
      setHighlightedCitationIds(citationIds);
      if (citationIds.length > 0) {
        setHighlightedCitationId(citationIds[0]);
        const citationEl = document.getElementById(`workbench-citation-${citationIds[0]}`);
        if (citationEl) citationEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        setHighlightedCitationId(null);
      }
    },
    []
  );
  const handleEvidenceRefClick = useCallback(
    (citationId: string) => {
      setTab('evidence');
      requestAnimationFrame(() => handleCitationClick(citationId));
    },
    [handleCitationClick]
  );

  useEffect(() => {
    if (!pendingCitationJumpId) return;
    handleCitationClick(pendingCitationJumpId);
    clearCitationJumpRequest();
  }, [pendingCitationJumpId, handleCitationClick, clearCitationJumpRequest]);

  const getRateValue = useCallback(
    (signalCode: string, candidates: string[]): number | null => {
      const extract = (obj: Record<string, unknown> | undefined): number | null => {
        if (!obj) return null;
        for (const key of candidates) {
          const value = obj[key];
          if (typeof value === 'number' && Number.isFinite(value)) return value <= 1 ? value * 100 : value;
        }
        return null;
      };
      const breakdown = analysisScoreBreakdown as Record<string, unknown> | undefined;
      const nested =
        (breakdown?.signalRates as Record<string, unknown> | undefined) ??
        (breakdown?.signal_rates as Record<string, unknown> | undefined) ??
        (breakdown?.qualitySignals as Record<string, unknown> | undefined) ??
        (breakdown?.quality_signals as Record<string, unknown> | undefined);
      const direct = extract(breakdown);
      const nestedVal = extract(nested);
      const found = direct ?? nestedVal;
      if (found != null) return found;
      return hasSignal(signalCode) ? 100 : 0;
    },
    [analysisScoreBreakdown, hasSignal]
  );
  const trustKpis = useMemo(
    () => [
      { key: 'rag_zero', label: '규정 검색 실패율', value: getRateValue('RAG_ZERO', ['ragZeroRate', 'rag_zero_rate']) },
      {
        key: 'coverage_low',
        label: '근거 부족률',
        value: getRateValue('EVIDENCE_COVERAGE_LOW', ['evidenceCoverageLowRate', 'evidence_coverage_low_rate']),
      },
      {
        key: 'sentence_missing',
        label: '문장 근거 미연결률',
        value: getRateValue('SENTENCE_CITATION_MISSING', ['sentenceCitationMissingRate', 'sentence_citation_missing_rate']),
      },
      {
        key: 'policy_reeval',
        label: '정책 재검토 적용률',
        value: getRateValue('POLICY_REEVAL_APPLIED', ['policyReevalAppliedRate', 'policy_reeval_applied_rate']),
      },
    ],
    [getRateValue]
  );

  if (!selectedCaseId) {
    return (
      <Box
        sx={{
          ...getGlassPanelSx(theme),
          minHeight: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          ...sx,
        }}
      >
        <PanelHeader title={t('workbench.detailTitle')} />
        <Stack
          alignItems="center"
          justifyContent="center"
          spacing={2}
          sx={{
            flex: 1,
            p: 3,
            bgcolor: varAlpha(theme.vars.palette.background.defaultChannel, 0.35),
          }}
        >
          <Iconify icon="solar:cursor-square-bold" width={52} sx={{ color: 'text.disabled' }} />
          <Typography variant="body2" color="text.secondary">
            {t('workbench.detailSelectCase')}
          </Typography>
        </Stack>
      </Box>
    );
  }

  const reportSummary = finalReport?.summary ?? finalReport?.verdict ?? '';

  return (
    <Box
      sx={{
        ...getGlassPanelSx(theme),
        minHeight: 0,
        height: '100%',
        width: '100%',
        maxWidth: '100%',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        ...sx,
      }}
    >
      <PanelHeader title={t('workbench.detailTitle')}>
        {caseStatus ? <StatusBadge status={caseStatus} size="sm" showIcon /> : null}
      </PanelHeader>

      <Box sx={{ px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="body2" noWrap>
          <Box component="span" sx={{ fontWeight: 700 }}>
            {caseNumber ?? selectedCaseId}
          </Box>
          <Box component="span" sx={{ color: 'text.secondary', mx: 1 }}>
            ·
          </Box>
          <Box component="span" sx={{ color: 'text.secondary' }}>
            {contextSummary}
          </Box>
        </Typography>
      </Box>

      <Tabs
        value={tab}
        onChange={(_, value: NewCaseTab) => setTab(value)}
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{
          width: '100%',
          maxWidth: '100%',
          overflow: 'hidden',
          minHeight: 44,
          borderBottom: 1,
          borderColor: 'divider',
          '& .MuiTabs-scroller': {
            overflowX: 'auto !important',
            overflowY: 'hidden !important',
          },
          '& .MuiTab-root': {
            minHeight: 44,
            minWidth: 108,
            fontSize: '0.8rem',
            textTransform: 'none',
            whiteSpace: 'nowrap',
          },
        }}
      >
        <Tab value="thought" label={t('workbench.rightTabThoughtProcess')} />
        <Tab value="evidence" label={t('workbench.rightTabEvidenceMap')} />
        <Tab value="review" label="판단 규정" />
        <Tab value="report" label={t('workbench.rightTabAnalysisReport')} />
      </Tabs>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 2 }}>
        {isLoading ? (
          <Typography variant="body2" color="text.secondary">
            {t('workbench.detailLoading', 'Loading AI thought chain for this case...')}
          </Typography>
        ) : null}

        {!isLoading && tab === 'thought' && (
          <Stack spacing={2}>
            {briefingInsight ? (
              <Alert severity="info">{briefingInsight}</Alert>
            ) : null}
            {displayedSignals.length > 0 && (
              <Card variant="outlined">
                <CardHeader
                  title={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Iconify icon="solar:shield-warning-bold-duotone" width={18} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        AI 분석 신뢰도 지표
                      </Typography>
                    </Stack>
                  }
                  sx={{ pb: 1, px: 2, pt: 1.5 }}
                />
                <CardContent sx={{ px: 2, pt: 0, pb: 1.5 }}>
                  <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap">
                    <Typography variant="caption" color="text.secondary">
                      분석 신뢰 신호
                    </Typography>
                    {displayedSignals.map((code) => {
                      const normalized = normalizeQualityGateCode(code);
                      const meta = QUALITY_GATE_META[normalized];
                      return (
                        <Chip
                          key={code}
                          size="small"
                          variant="outlined"
                          color={meta?.color ?? 'default'}
                          label={toFriendlyQualityGateLabel(code)}
                          title={meta?.description ?? code}
                        />
                      );
                    })}
                  </Stack>
                  <Grid container spacing={1} sx={{ mt: 1.5 }}>
                    {trustKpis.map((kpi) => {
                      const tooltipKeyMap: Record<string, string> = {
                        rag_zero: 'workbench.metricsTooltip.ragZero',
                        coverage_low: 'workbench.metricsTooltip.evidenceCoverageLow',
                        sentence_missing: 'workbench.metricsTooltip.sentenceCitationMissing',
                        policy_reeval: 'workbench.metricsTooltip.policyReevalApplied',
                      };
                      return (
                        <Grid key={kpi.key} size={{ xs: 12, sm: 6, md: 3 }}>
                          <Card variant="outlined" sx={{ height: '100%' }}>
                            <CardContent sx={{ p: 1.25 }}>
                              <Stack direction="row" alignItems="center" spacing={0.25}>
                                <Typography variant="caption" color="text.secondary">
                                  {kpi.label}
                                </Typography>
                                <Tooltip title={t(tooltipKeyMap[kpi.key] ?? '')} arrow placement="top">
                                  <IconButton size="small" sx={{ p: 0.25, color: 'text.secondary' }} aria-label="계산 기준">
                                    <Iconify icon="solar:info-circle-bold" width={14} />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                              <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 0.25 }}>
                                {kpi.value == null || !Number.isFinite(kpi.value)
                                  ? t('workbench.noData')
                                  : `${kpi.value.toFixed(1)}%`}
                              </Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                      );
                    })}
                  </Grid>
                  {isHoldState && (
                    <Alert severity="warning" sx={{ mt: 1.25 }}>
                      확정 판단이 보류되었습니다. 추가 근거 확보 후 재검토가 필요합니다.
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}

            {analysisScoreBreakdown && (
              <Card variant="outlined">
                <CardHeader
                  title={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Iconify icon="solar:chart-square-bold-duotone" width={18} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        리스크 점수 분해
                      </Typography>
                    </Stack>
                  }
                  sx={{ pb: 1, px: 2, pt: 1.5 }}
                />
                <CardContent sx={{ px: 2, pt: 0, pb: 1.5 }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap>
                    <Tooltip title={t('workbench.metricsTooltip.policyScore')} arrow>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`정책점수 ${Number.isFinite(policyScore) ? policyScore : t('workbench.noData')}`}
                      />
                    </Tooltip>
                    <Tooltip title={t('workbench.metricsTooltip.evidenceScore')} arrow>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`근거점수 ${Number.isFinite(evidenceScore) ? evidenceScore : t('workbench.noData')}`}
                      />
                    </Tooltip>
                    <Tooltip title={t('workbench.metricsTooltip.finalScore')} arrow>
                      <Chip
                        size="small"
                        color={Number.isFinite(finalScore) && finalScore >= 70 ? 'error' : 'default'}
                        variant="outlined"
                        label={`최종점수 ${Number.isFinite(finalScore) ? finalScore : t('workbench.noData')}`}
                      />
                    </Tooltip>
                  </Stack>
                  {(holdReason || isHoldState) && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                      보류 사유: {holdReason || 'POLICY_CONFLICT 또는 RAG_ZERO'}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            )}
            <Card variant="outlined">
              <CardHeader
                action={
                  canDebugPanel ? (
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={debugTimelineView}
                          onChange={(_, checked) => setDebugTimelineView(checked)}
                        />
                      }
                      label={t('workbench.timeline.debugToggle', { defaultValue: '디버그 보기' })}
                      sx={{ mr: 0 }}
                    />
                  ) : null
                }
                title={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Iconify icon="solar:clock-circle-bold-duotone" width={18} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      스트림 타임라인
                    </Typography>
                  </Stack>
                }
                sx={{ pb: 1, px: 2, pt: 1.5 }}
              />
              <CardContent sx={{ px: 2, pt: 0, pb: 1.5 }}>
                {effectiveTimelineSteps.length > 0 ? (
                  <EventStreamTimeline
                    steps={effectiveTimelineSteps}
                    view={debugTimelineView ? 'debug' : 'default'}
                  />
                ) : agentEventsStepsRaw.length > 0 && !debugTimelineView ? (
                  <Typography variant="body2" color="text.secondary">
                    {t('workbench.timeline.defaultEmpty', {
                      defaultValue: '표시할 핵심 이벤트가 없습니다. (디버그 보기에서 전체 이벤트 확인 가능)',
                    })}
                  </Typography>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {t('workbench.eventStreamEmpty', { defaultValue: '이벤트 데이터 없음' })}
                  </Typography>
                )}
                {canDebugPanel && (
                  <Box sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
                    <Typography variant="caption" component="div" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                      [디버그] runId: {runId ?? '-'} · API응답: {agentEventsQuery.data?.length ?? 0}건 · raw: {agentEventsStepsRaw.length}건 · default필터: {agentEventsSteps.length}건 · view: {debugTimelineView ? 'debug' : 'default'}
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>

          </Stack>
        )}

        {!isLoading && tab === 'review' && (
          <Stack spacing={1.25}>
            {logicCheckpoints.length === 0 ? (
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="body2" color="text.secondary">
                    판단 규정 정보가 없습니다.
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                    분석 결과를 생성한 뒤 확인할 수 있습니다.
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              logicCheckpoints.map((item, idx) => (
                <Card
                  key={item.ruleId ?? `${item.clause}-${idx}`}
                  variant="outlined"
                  sx={{ p: 1.5 }}
                >
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {composeRegulationPath(item)}
                    </Typography>
                    <Chip
                      size="small"
                      color={getRegulationStatusMeta(item.statusCode, item.status, isHoldState).color}
                      label={getRegulationStatusMeta(item.statusCode, item.status, isHoldState).label}
                    />
                  </Stack>
                  {item.title ? (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                      {item.title}
                    </Typography>
                  ) : null}
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                    {item.statusReason || item.description || t('workbench.noData')}
                  </Typography>
                  <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
                    {item.applied === false && <Chip size="small" variant="outlined" label="참고 규정" />}
                    {Array.isArray(item.qualitySignals) &&
                      item.qualitySignals.map((signal) => (
                        <Chip
                          key={`${idx}-signal-${signal}`}
                          size="small"
                          variant="outlined"
                          label={toFriendlyQualityGateLabel(signal)}
                        />
                      ))}
                  </Stack>
                  {Array.isArray(item.evidenceRefs) && item.evidenceRefs.length > 0 ? (
                    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                        근거:
                      </Typography>
                      {item.evidenceRefs.map((ref) => (
                        <Chip
                          key={`${idx}-ev-${ref}`}
                          size="small"
                          clickable
                          variant="outlined"
                          color={
                          highlightedCitationIds.includes(ref) || highlightedCitationId === ref
                            ? 'primary'
                            : 'default'
                        }
                          label={ref}
                          onClick={() => handleEvidenceRefClick(ref)}
                        />
                      ))}
                    </Stack>
                  ) : null}
                </Card>
              ))
            )}
          </Stack>
        )}

        {!isLoading && tab === 'evidence' && (
          <Stack spacing={2}>
            <Stack spacing={1}>
              {evidenceLinks.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {t('workbench.evidenceMapEmpty')}
                </Typography>
              ) : (
                evidenceLinks.map((link, idx) => {
                  const buzei = fiDocItems[link.itemIdx]?.buzei ?? String(link.itemIdx + 1).padStart(3, '0');
                  return (
                    <Card
                      key={`ev-${idx}`}
                      variant="outlined"
                      onClick={() => setScrollToBuzei(buzei)}
                      sx={{
                        p: 1.25,
                        cursor: 'pointer',
                        borderColor: 'error.main',
                        bgcolor: alpha(theme.palette.error.main, 0.05),
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        {t('workbench.itemDetail.buzei')}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {buzei}
                      </Typography>
                      {link.reason ? (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {link.reason}
                        </Typography>
                      ) : null}
                    </Card>
                  );
                })
              )}
            </Stack>
            <Divider />
            <Card variant="outlined">
              <CardHeader
                title={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Iconify icon="solar:danger-triangle-bold-duotone" width={18} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      위반전표아이템
                    </Typography>
                  </Stack>
                }
                sx={{ pb: 1, px: 2, pt: 1.5 }}
              />
              <CardContent sx={{ px: 2, pt: 0, pb: 1.5 }}>
                <WorkbenchItemDetailGrid
                  items={fiDocItems}
                  currency={itemsCurrency}
                  targetBuzei={targetBuzei}
                  scrollToBuzei={scrollToBuzei}
                  onClearScrollToBuzei={() => setScrollToBuzei(null)}
                  evidenceUsageByRowIndex={
                    Object.keys(evidenceUsageByRowIndex).length > 0 ? evidenceUsageByRowIndex : undefined
                  }
                />
              </CardContent>
            </Card>

            {sentenceCitationMap.length > 0 && (
              <Card variant="outlined">
                <CardHeader
                  title={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Iconify icon="solar:list-check-bold-duotone" width={18} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        문장별 근거 연결
                      </Typography>
                    </Stack>
                  }
                  sx={{ pb: 1, px: 2, pt: 1.5 }}
                />
                <CardContent sx={{ px: 2, pt: 0, pb: 1.5 }}>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ width: 60 }}>#</TableCell>
                          <TableCell>문장</TableCell>
                          <TableCell sx={{ width: 240 }}>근거(citation)</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {sentenceCitationMap.map((item, idx) => {
                          const ids = Array.isArray(item.citation_ids)
                            ? item.citation_ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
                            : [];
                          const grounded = typeof item.grounded === 'boolean' ? item.grounded : ids.length > 0;
                          const isSentenceHighlighted =
                            highlightedSentenceIndices.includes(idx) ||
                            (highlightedCitationId != null && ids.includes(highlightedCitationId));
                          const isChipHighlighted = (id: string) =>
                            highlightedCitationIds.includes(id) || highlightedCitationId === id;
                          return (
                            <TableRow
                              key={`scm-${idx}-${item.sentence_index ?? idx}`}
                              onClick={() => handleSentenceClick(idx, ids)}
                              sx={{
                                cursor: 'pointer',
                                bgcolor: !grounded
                                  ? alpha(theme.palette.warning.main, 0.08)
                                  : isSentenceHighlighted
                                    ? alpha(theme.palette.primary.main, 0.08)
                                    : undefined,
                                borderLeft: isSentenceHighlighted ? 3 : 0,
                                borderLeftColor: 'primary.main',
                              }}
                            >
                              <TableCell>{item.sentence_index ?? idx + 1}</TableCell>
                              <TableCell>
                                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                  {item.sentence ?? '데이터 없음'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                {ids.length > 0 ? (
                                  <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                                    {ids.map((id) => (
                                      <Chip
                                        key={`cid-${idx}-${id}`}
                                        size="small"
                                        clickable
                                        variant="outlined"
                                        color={isChipHighlighted(id) ? 'primary' : 'default'}
                                        label={id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCitationClick(id);
                                        }}
                                      />
                                    ))}
                                  </Stack>
                                ) : (
                                  <Stack direction="row" spacing={0.5} alignItems="center">
                                    <Iconify icon="solar:danger-triangle-bold-duotone" width={14} />
                                    <Typography variant="caption" color="warning.main">
                                      근거 미연결
                                    </Typography>
                                  </Stack>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            )}

            <Card variant="outlined">
              <CardHeader
                title={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Iconify icon="solar:document-text-bold-duotone" width={18} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Citation 근거 목록
                    </Typography>
                  </Stack>
                }
                sx={{ pb: 1, px: 2, pt: 1.5 }}
              />
              <CardContent sx={{ px: 2, pt: 0, pb: 1.5 }}>
                {citations.length > 0 ? (
                  <Stack spacing={1}>
                    {citations.map((item, idx) => {
                      const citationId = item.citation_id ?? `C${idx + 1}`;
                      const isHighlighted =
                        highlightedCitationIds.includes(citationId) || highlightedCitationId === citationId;
                      const sourceKey = item.sourceKey ?? item.source_key;
                      const chunkId = item.chunk_id;
                      const citationTargetBuzei = item.target_buzei;
                      const metaParts = [sourceKey, chunkId, citationTargetBuzei != null ? `장=${citationTargetBuzei}` : null]
                        .filter(Boolean)
                        .map(String);
                      return (
                        <Box
                          key={`${citationId}-${idx}`}
                          id={`workbench-citation-${citationId}`}
                          onClick={() => handleCitationClick(citationId)}
                          sx={{
                            p: 1.25,
                            borderRadius: 1,
                            border: 1,
                            cursor: 'pointer',
                            borderColor: isHighlighted ? theme.palette.primary.main : 'divider',
                            bgcolor: isHighlighted ? alpha(theme.palette.primary.main, 0.12) : 'background.paper',
                          }}
                        >
                          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" sx={{ mb: 0.5 }}>
                            <Chip size="small" label={citationId} />
                            {metaParts.length > 0 && (
                              <Typography variant="caption" color="text.secondary">
                                {metaParts.join(' · ')}
                              </Typography>
                            )}
                          </Stack>
                          <Typography variant="body2" color="text.secondary">
                            {item.excerpt || '데이터 없음'}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {t('workbench.noData')}
                  </Typography>
                )}
              </CardContent>
            </Card>

            {canDebugPanel && (
              <Accordion
                sx={{
                  bgcolor: alpha(theme.palette.info.main, 0.04),
                  border: 1,
                  borderColor: alpha(theme.palette.info.main, 0.25),
                  borderRadius: 1,
                  '&:before': { display: 'none' },
                  boxShadow: 'none',
                }}
              >
                <AccordionSummary expandIcon={<Iconify icon="solar:alt-arrow-down-bold" width={18} />}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Iconify icon="solar:bug-bold-duotone" width={16} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      운영자 디버그
                    </Typography>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 0 }}>
                  <Stack spacing={1.25}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        quality_report(raw)
                      </Typography>
                      <Box component="pre" sx={{ m: 0, mt: 0.5, p: 1, borderRadius: 1, bgcolor: alpha(theme.palette.common.black, 0.06), overflowX: 'auto' }}>
                        {JSON.stringify(qualityReportRaw ?? {}, null, 2)}
                      </Box>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        quality_gate_codes(raw)
                      </Typography>
                      <Box component="pre" sx={{ m: 0, mt: 0.5, p: 1, borderRadius: 1, bgcolor: alpha(theme.palette.common.black, 0.06), overflowX: 'auto' }}>
                        {JSON.stringify(qualityGateCodes, null, 2)}
                      </Box>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        analysis_quality_signals(raw)
                      </Typography>
                      <Box component="pre" sx={{ m: 0, mt: 0.5, p: 1, borderRadius: 1, bgcolor: alpha(theme.palette.common.black, 0.06), overflowX: 'auto' }}>
                        {JSON.stringify(analysisQualitySignalsRaw, null, 2)}
                      </Box>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        mismatch_reasons(raw)
                      </Typography>
                      <Box component="pre" sx={{ m: 0, mt: 0.5, p: 1, borderRadius: 1, bgcolor: alpha(theme.palette.common.black, 0.06), overflowX: 'auto' }}>
                        {JSON.stringify(mismatchReasonsRaw ?? [], null, 2)}
                      </Box>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        sentence_citation_map(raw)
                      </Typography>
                      <Box component="pre" sx={{ m: 0, mt: 0.5, p: 1, borderRadius: 1, bgcolor: alpha(theme.palette.common.black, 0.06), overflowX: 'auto' }}>
                        {JSON.stringify(sentenceCitationMap, null, 2)}
                      </Box>
                    </Box>
                  </Stack>
                </AccordionDetails>
              </Accordion>
            )}
          </Stack>
        )}

        {!isLoading && tab === 'report' && (
          <Stack spacing={2}>
            {reportSummary ? (
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                    {reportSummary}
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {t('workbench.detailLoading')}
              </Typography>
            )}

            <Button
              variant="outlined"
              size="small"
              startIcon={<Iconify icon="solar:letter-bold-duotone" width={18} />}
              disabled={!selectedCaseId || explanationLoading}
              onClick={onRequestExplanation}
            >
              {explanationLoading ? t('caseDetail.explanationRequestSending') : t('caseDetail.requestExplanation')}
            </Button>

            <Divider />
            <WorkbenchActionHistoryTimeline items={actionHistory} />
          </Stack>
        )}
      </Box>
    </Box>
  );
}
