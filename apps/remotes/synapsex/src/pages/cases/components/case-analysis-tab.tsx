/**
 * Case Analysis Tab — 디지털 감사 보고서(Digital Audit Report)
 * 확정된 분석 결과(Result) 전용. 스트림 패널은 '지금 AI가 하는 생각(Process)' 전용.
 * @see docs/job/PROMPT_B_Frontend_Cases_TabsBind_P1_v2.txt
 */

import type { StreamingThought } from '@dwp-frontend/shared-utils';

import { keyframes } from '@emotion/react';
import { Iconify } from '@dwp-frontend/design-system';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import {
  showToast,
  getErrorMessage,
  useCaseAnalysisQuery,
  sendExplanationRequest,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Accordion from '@mui/material/Accordion';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import { alpha, useTheme } from '@mui/material/styles';
import TableContainer from '@mui/material/TableContainer';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';

import { ReasoningTimeline } from './reasoning-timeline';
import { useCaseTabsDebug } from '../context/case-tabs-debug-context';
import { TabEmptyState, CaseTabQueryBoundary } from '../../../components/ux';
import { ConfidenceRing } from '../../../components/finance/confidence-meter';

import type { FiDocItem, AiThought } from '../hooks/use-case-detail';

type CaseAnalysisTabProps = {
  caseId: string | undefined;
  runId?: string | null;
  enabled: boolean;
  tabKey?: string;
  fallbackConfidence?: number;
  fallbackTitle?: string;
  fallbackAnomalyType?: string;
  fallbackSeverity?: string;
  fiDocItems?: FiDocItem[];
  targetBuzei?: string;
  /** evidenceMapJson 기반 위반 행 buzei 목록 — 전표 테이블에서 해당 행 글로우 강조 */
  violationBuzeiList?: string[];
  /** evidenceMapJson 기반 chunkId — 우측 규정집에서 해당 근거 문구 하이라이트 */
  highlightChunkIds?: string[];
  /** evidenceMapJson.summary_verdict — 종합 판정 (보고서 탭) */
  summaryVerdict?: string;
  /** evidenceMapJson.key_grounds — 핵심 근거 (보고서 탭) */
  keyGrounds?: string[];
  aiThoughts?: AiThought[];
  /** thought_pending 시 스켈레톤, AGENT_STREAM 도착 시 실제 텍스트 */
  pendingThought?: StreamingThought | null;
};

/** 좌측 보더 흐르는 Glow — AI 스캔 중임을 시각화 */
const flowGlow = keyframes`
  0% { transform: translateY(-100%); opacity: 0.6; }
  50% { opacity: 1; }
  100% { transform: translateY(100%); opacity: 0.6; }
`;

/** 위반/이상 행 여부: evidenceMapJson(violationBuzeiList) 또는 targetBuzei, isTarget 기반 */
const isViolationRow = (
  item: FiDocItem,
  targetBuzei?: string,
  violationBuzeiList?: string[]
): boolean => {
  if (item.isTarget) return true;
  const buzeiNorm = item.buzei ? String(item.buzei).padStart(3, '0') : '';
  if (targetBuzei && buzeiNorm === targetBuzei) return true;
  if (Array.isArray(violationBuzeiList) && violationBuzeiList.length > 0 && buzeiNorm) {
    return violationBuzeiList.some((b) => String(b).padStart(3, '0') === buzeiNorm);
  }
  return false;
};

export const CaseAnalysisTab = ({
  caseId,
  runId,
  enabled,
  tabKey = 'analysis',
  fallbackConfidence = 0,
  fallbackTitle = '',
  fallbackAnomalyType = '',
  fallbackSeverity = '',
  fiDocItems = [],
  targetBuzei,
  violationBuzeiList = [],
  highlightChunkIds = [],
  summaryVerdict,
  keyGrounds,
  aiThoughts = [],
  pendingThought,
}: CaseAnalysisTabProps) => {
  const { t } = useTranslation('common');
  const theme = useTheme();
  const debugCtx = useCaseTabsDebug();
  const [highlightedChunkId, setHighlightedChunkId] = useState<string | null>(null);
  const [explanationRequestLoading, setExplanationRequestLoading] = useState(false);
  const { data, isLoading, isError, error, refetch } = useCaseAnalysisQuery(caseId, { enabled, runId });

  const handleThoughtClick = useCallback((thought: { chunkId?: string }) => {
    const id = thought.chunkId;
    if (!id) return;
    setHighlightedChunkId(id);
    const el = document.getElementById(`chunk-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  const setPayload = debugCtx?.setPayload;
  useEffect(() => {
    if (!enabled || !setPayload) return;
    if (isError && error) {
      setPayload(tabKey, {
        status: 'error',
        payload: { message: getErrorMessage(error) ?? String(error) },
        error: getErrorMessage(error) ?? String(error),
      });
    } else if (!isLoading && data !== undefined) {
      setPayload(tabKey, { status: 'success', payload: data });
    }
  }, [enabled, setPayload, isLoading, isError, error, data, tabKey]);

  const scoreRaw =
    data?.score ??
    (data?.confidenceBreakdown?.overall != null ? Number(data.confidenceBreakdown.overall) * 100 : undefined) ??
    fallbackConfidence;
  const score = typeof scoreRaw === 'number' ? scoreRaw : Number(scoreRaw) || 0;
  const scoreDisplay = `${Number(score.toFixed(2))}%`;
  const reasonText = data?.reasonText ?? fallbackTitle;
  /** 종합 판정: evidenceMapJson.summary_verdict 우선, 없으면 analysis reasonText */
  const reportSummary = summaryVerdict ?? reasonText;
  const anomalyType = data?.anomalyType ?? fallbackAnomalyType;
  const severity = data?.severity ?? fallbackSeverity;
  const keyFactors = data?.keyFactors ?? [];
  /** 핵심 근거: evidenceMapJson.key_grounds 우선, 없으면 analysis keyFactors(description) */
  const reportKeyGrounds =
    keyGrounds && keyGrounds.length > 0
      ? keyGrounds
      : keyFactors.map((f) => (f.description ?? f.label ?? '') as string).filter(Boolean);

  const handleRequestExplanation = useCallback(async () => {
    if (!caseId) return;
    setExplanationRequestLoading(true);
    try {
      await sendExplanationRequest({
        caseId,
        summary: reportSummary ?? undefined,
        violationSummary: reportKeyGrounds?.slice(0, 3).join(' / ') ?? undefined,
      });
      showToast(t('caseDetail.explanationRequestSent'), 'success');
    } catch (err) {
      showToast(getErrorMessage(err) ?? t('caseDetail.explanationRequestFailed'), 'error');
    } finally {
      setExplanationRequestLoading(false);
    }
  }, [caseId, reportSummary, reportKeyGrounds, t]);

  const evidence = (data?.evidence ?? []) as Array<{ key?: string }>;
  const ragRefs = (data?.ragRefs ?? []) as Array<{ refId?: string; sourceType?: string; sourceKey?: string; excerpt?: string; score?: number }>;
  const isEmpty =
    !data ||
    (!reportSummary &&
      reportKeyGrounds.length === 0 &&
      evidence.length === 0 &&
      ragRefs.length === 0 &&
      fiDocItems.length === 0 &&
      aiThoughts.length === 0);

  return (
    <CaseTabQueryBoundary
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={() => refetch()}
      errorTitle={t('cases.tabs.analysis.error.title')}
      skeletonCards={2}
      empty={isEmpty}
      emptyContent={
        <Box sx={{ p: 2 }}>
          <TabEmptyState
            icon="solar:brain-bold-duotone"
            title={t('cases.tabs.analysis.empty.title')}
            description={t('cases.tabs.analysis.empty.description')}
            reason={t('cases.tabs.analysis.empty.reason.summaryRecommendationsZero')}
          />
        </Box>
      }
    >
    <Box sx={{ p: 2 }}>
      <Stack spacing={2}>
        {/* 디지털 감사 보고서 — 상단: 종합 결론 (summary_verdict + 게이지) 대형 카드 */}
        <Card
          sx={{
            bgcolor: alpha(theme.palette.primary.main, 0.06),
            border: 1,
            borderColor: alpha(theme.palette.primary.main, 0.25),
          }}
        >
          <CardHeader
            title={
              <Stack direction="row" spacing={1} alignItems="center">
                <Iconify icon="solar:document-text-bold-duotone" width={22} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {t('caseDetail.auditReportConclusion')}
                </Typography>
              </Stack>
            }
            sx={{ pb: 0, px: 2, pt: 2 }}
          />
          <CardContent sx={{ px: 2, pt: 0, pb: 2 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
              <Stack direction="row" spacing={2} alignItems="center" flexShrink={0}>
                <ConfidenceRing value={score} size={64} showScore={false} />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    {t('caseDetail.anomalyConfidenceScore')}
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
                    {scoreDisplay}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 0.5 }}>
                    {anomalyType && (
                      <Chip
                        label={String(anomalyType).replace(/_/g, ' ')}
                        size="small"
                        variant="outlined"
                        sx={{ textTransform: 'capitalize' }}
                      />
                    )}
                    {severity && (
                      <Chip
                        label={t('caseDetail.severityLabel', { severity })}
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Stack>
                </Box>
              </Stack>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                {reportSummary && (
                  <Typography variant="body1" sx={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                    {reportSummary}
                  </Typography>
                )}
              </Box>
            </Stack>
            <Box sx={{ mt: 2 }}>
              <Button
                variant="outlined"
                size="small"
                disabled={explanationRequestLoading || !caseId}
                onClick={handleRequestExplanation}
                startIcon={<Iconify icon="solar:letter-bold-duotone" width={18} />}
              >
                {explanationRequestLoading
                  ? t('caseDetail.explanationRequestSending')
                  : t('caseDetail.requestExplanation')}
              </Button>
            </Box>
          </CardContent>
        </Card>

        {/* 인사이트 카드 — 발견된 리스크 테마별 (단순 로그 나열 금지) */}
        {reportKeyGrounds.length > 0 && (
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, px: 0.5 }}>
              {t('caseDetail.keyFactors')}
            </Typography>
            <Stack spacing={1.5} direction="row" flexWrap="wrap" useFlexGap>
              {reportKeyGrounds.map((text, i) => (
                <Card
                  key={i}
                  sx={{
                    minWidth: { xs: '100%', sm: 280 },
                    maxWidth: 400,
                    bgcolor: alpha(theme.palette.primary.main, 0.04),
                    border: 1,
                    borderColor: alpha(theme.palette.primary.main, 0.15),
                    borderRadius: 2,
                  }}
                >
                  <CardContent sx={{ py: 1.5, px: 2 }}>
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      <Iconify
                        icon="solar:check-circle-bold-duotone"
                        width={18}
                        sx={{ color: 'primary.main', mt: 0.25, flexShrink: 0 }}
                      />
                      <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                        {text}
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Box>
        )}

        {/* Evidence Gallery — Fact | Link | Rule */}
        {(fiDocItems.length > 0 || ragRefs.length > 0) && (
          <Card sx={{ overflow: 'hidden' }}>
            <CardHeader
              title={
                <Stack direction="row" spacing={1} alignItems="center">
                  <Iconify icon="solar:gallery-bold-duotone" width={20} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {t('caseDetail.evidenceGallery.title')}
                  </Typography>
                </Stack>
              }
              sx={{ pb: 1, px: 2, pt: 2 }}
            />
            <CardContent sx={{ px: 2, pt: 0, pb: 2 }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: '1fr auto 1fr' },
                  gap: 2,
                  alignItems: 'stretch',
                  minHeight: 200,
                }}
              >
                {/* Left: Fact (전표 라인, 이상 필드 글로우) */}
                <Box
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 2,
                    overflow: 'hidden',
                    bgcolor: alpha(theme.palette.primary.main, 0.02),
                  }}
                >
                  <Box sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider', bgcolor: alpha(theme.palette.primary.main, 0.06) }}>
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>{t('caseDetail.evidenceGallery.fact')}</Typography>
                  </Box>
                  <TableContainer sx={{ maxHeight: 280 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>#</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{t('caseDetail.amount')}</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{t('caseDetail.vendor')}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {fiDocItems.slice(0, 10).map((item) => {
                          const target = isViolationRow(item, targetBuzei, violationBuzeiList);
                          return (
                            <TableRow
                              key={item.id}
                              sx={{
                                position: 'relative',
                                overflow: 'hidden',
                                bgcolor: target ? alpha(theme.palette.error.main, 0.12) : undefined,
                                boxShadow: target ? `inset 0 0 0 2px ${alpha(theme.palette.error.main, 0.5)}` : undefined,
                                ...(target && {
                                  '&::before': {
                                    content: '""',
                                    position: 'absolute',
                                    left: 0,
                                    top: 0,
                                    bottom: 0,
                                    width: 4,
                                    background: `linear-gradient(to bottom, transparent 0%, ${theme.palette.error.main} 35%, ${theme.palette.error.main} 65%, transparent 100%)`,
                                    animation: `${flowGlow} 1.8s linear infinite`,
                                    boxShadow: `0 0 12px ${alpha(theme.palette.error.main, 0.8)}`,
                                  },
                                }),
                              }}
                            >
                              <TableCell>{item.buzei ?? item.id}</TableCell>
                              <TableCell sx={{ fontWeight: target ? 700 : undefined }}>
                                {item.wrbtr != null ? item.wrbtr.toLocaleString() : item.dmbtr != null ? item.dmbtr.toLocaleString() : '-'} {item.waers ?? ''}
                              </TableCell>
                              <TableCell>{item.partner ?? '-'}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {fiDocItems.length === 0 && (
                    <Box sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="caption" color="text.secondary">{t('caseDetail.noLineItems')}</Typography>
                    </Box>
                  )}
                </Box>

                {/* Center: Link (시각적 연결) */}
                <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', justifyContent: 'center', px: 0 }}>
                  <Box
                    sx={{
                      width: 2,
                      height: '100%',
                      minHeight: 120,
                      bgcolor: alpha(theme.palette.primary.main, 0.3),
                      borderRadius: 1,
                      position: 'relative',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        bgcolor: 'primary.main',
                        border: 2,
                        borderColor: 'background.paper',
                      },
                    }}
                  />
                </Box>

                {/* Right: Rule (규정/청크) */}
                <Box
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 2,
                    overflow: 'auto',
                    bgcolor: alpha(theme.palette.primary.main, 0.02),
                  }}
                >
                  <Box sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider', bgcolor: alpha(theme.palette.primary.main, 0.06) }}>
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>{t('caseDetail.evidenceGallery.rule')}</Typography>
                  </Box>
                  <Stack spacing={1} sx={{ p: 1.5 }}>
                    {ragRefs.length > 0 ? (
                      ragRefs.map((r, i) => {
                        const refId = r.refId != null ? String(r.refId) : '';
                        const sourceKey = r.sourceKey != null ? String(r.sourceKey) : '';
                        const chunkId = refId || sourceKey || `fallback-${i}`;
                        const isHighlight =
                          highlightedChunkId === chunkId ||
                          (highlightChunkIds.length > 0 &&
                            (highlightChunkIds.includes(refId) || highlightChunkIds.includes(sourceKey)));
                        return (
                        <Box
                          key={r.refId ?? i}
                          id={`chunk-${chunkId}`}
                          sx={{
                            p: 1.5,
                            borderRadius: 1,
                            bgcolor: isHighlight ? alpha(theme.palette.primary.main, 0.14) : alpha(theme.palette.primary.main, 0.06),
                            border: 1,
                            borderColor: isHighlight ? theme.palette.primary.main : alpha(theme.palette.primary.main, 0.15),
                            boxShadow: isHighlight ? `0 0 12px ${alpha(theme.palette.primary.main, 0.35)}` : undefined,
                          }}
                        >
                          {(r.sourceKey ?? r.sourceType) && (
                            <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600, display: 'block', mb: 0.5 }}>
                              {r.sourceKey ?? r.sourceType}
                            </Typography>
                          )}
                          {r.excerpt != null && r.excerpt !== '' && (
                            <Typography variant="body2" sx={{ lineHeight: 1.6 }} color="text.secondary">
                              {r.excerpt}
                            </Typography>
                          )}
                          {typeof r.score === 'number' && (
                            <Chip size="small" label={t('caseDetail.scoreShort', { value: Number((r.score as number).toFixed(2)) })} sx={{ mt: 0.5 }} />
                          )}
                        </Box>
                        );
                      })
                    ) : (
                      <Typography variant="caption" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                        {t('caseDetail.ragRefs')} — {t('caseDetail.reasoningPathEmpty')}
                      </Typography>
                    )}
                  </Stack>
                </Box>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* 상세 분석 로그 — 스트림 추론 과정은 아코디언 안에, 필요 시 펼쳐서 확인 */}
        <Accordion
          defaultExpanded={false}
          sx={{
            bgcolor: alpha(theme.palette.grey[500], 0.06),
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            '&:before': { display: 'none' },
            boxShadow: 'none',
          }}
        >
          <AccordionSummary
            expandIcon={<Iconify icon="solar:alt-arrow-down-bold" width={20} />}
            sx={{ px: 2, py: 0 }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Iconify icon="solar:route-bold-duotone" width={20} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {t('caseDetail.detailedAnalysisLog')}
              </Typography>
              {(aiThoughts.length > 0 || pendingThought != null) && (
                <Chip
                  label={aiThoughts.length + (pendingThought != null ? 1 : 0)}
                  size="small"
                  variant="outlined"
                  sx={{ height: 20 }}
                />
              )}
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 2, pt: 0, pb: 2 }}>
            {(aiThoughts.length > 0 || pendingThought != null) ? (
              <ReasoningTimeline
                thoughts={aiThoughts}
                pendingThought={pendingThought}
                onThoughtClick={handleThoughtClick}
              />
            ) : (
              <Typography variant="body2" color="text.secondary">
                {t('caseDetail.reasoningPathEmpty')}
              </Typography>
            )}
          </AccordionDetails>
        </Accordion>
      </Stack>
    </Box>
    </CaseTabQueryBoundary>
  );
};
