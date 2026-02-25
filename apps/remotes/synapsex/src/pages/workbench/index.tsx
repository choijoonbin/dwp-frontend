/**
 * 통합 워크벤치 — Master-Detail (상태 기반, 페이지 전환 없음)
 *
 * 레이아웃: 반응형 3열(Desktop 300 | flex | 350) / 단일열+탭(Tablet·Mobile).
 * 좌측 WorkbenchQueuePanel에서 케이스 클릭 시 setSelectedCaseId(id)만 호출하며,
 * 우측 WorkbenchDetailPanel이 같은 화면에서 상세 데이터를 표시(선택 전 Empty State).
 * URL: /synapse/workbench. Toolbar: [지식/정책 관리] → Dialog (페이지 이동 없음).
 * Theme: Glassmorphism (Light 0.7, Dark 0.8), 다크 모드 SK Red Glow.
 */

import type { Theme } from '@mui/material/styles';

import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { Iconify, varAlpha } from '@dwp-frontend/design-system';
import { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { useAuraStore } from '@dwp-frontend/shared-utils/aura/use-aura-store';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { showToast, useStreamStore, getErrorMessage, useAnalysisRunStream, useCaseAnalysisQuery, sendExplanationRequest, useWorkbenchReactiveStore, useCasesListQuery } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import useMediaQuery from '@mui/material/useMediaQuery';

import { RagPage } from '../rag';
import { PoliciesPage } from '../policies';
import { caseListDtoToUi } from '../cases/adapters/case-list-adapter';
import { useCaseDetail } from '../cases/hooks/use-case-detail';
import { WorkbenchKpiStrip } from './components/WorkbenchKpiStrip';
import { WorkbenchQueuePanel } from './components/WorkbenchQueuePanel';
import { WorkbenchRightPanel } from './components/WorkbenchRightPanel';
import { WorkbenchDetailPanel } from './components/WorkbenchDetailPanel';

// ----------------------------------------------------------------------
// Glass panel (Light: 0.7, Dark: 0.8 + SK Red Glow)
// ----------------------------------------------------------------------

/** theme.palette.mode 분기, 다크 모드에서 error.mainChannel(SK Red 계열) Glow */
const getGlassPanelSx = (theme: Theme): Record<string, unknown> => {
  const isDark = theme.palette.mode === 'dark';
  const alpha = isDark ? 0.8 : 0.7;
  return {
    backgroundColor: varAlpha(theme.vars.palette.background.paperChannel, alpha),
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    ...(isDark && {
      boxShadow: `0 0 24px ${varAlpha(theme.vars.palette.error.mainChannel, 0.15)}`,
    }),
  };
};

const COUNT_UP_DURATION_MS = 350;
const COUNT_UP_TICK_MS = 40;

/** 목표 값으로 부드럽게 카운팅 업 (스트림 라이브 시에만 애니메이션) */
const useCountUp = (target: number, active: boolean): number => {
  const [display, setDisplay] = useState(0);
  const currentRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) {
      currentRef.current = target;
      setDisplay(target);
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }
    const start = currentRef.current;
    const diff = target - start;
    if (diff === 0) return () => {};

    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / COUNT_UP_DURATION_MS);
      const eased = 1 - (1 - progress) * (1 - progress);
      const next = Math.round(start + diff * eased);
      const clamped = diff > 0 ? Math.min(next, target) : Math.max(next, target);
      currentRef.current = clamped;
      setDisplay(clamped);
      if (progress < 1) timerRef.current = setTimeout(tick, COUNT_UP_TICK_MS);
    };
    timerRef.current = setTimeout(tick, COUNT_UP_TICK_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [target, active]);

  return active ? display : target;
};

// ----------------------------------------------------------------------
// Workbench page
// ----------------------------------------------------------------------

type WorkbenchTab = 'queue' | 'detail' | 'stream';

export const WorkbenchPage = () => {
  const { t } = useTranslation('common');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [mobileTab, setMobileTab] = useState<WorkbenchTab>('detail');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [knowledgePolicyModalOpen, setKnowledgePolicyModalOpen] = useState(false);
  const [knowledgePolicyTab, setKnowledgePolicyTab] = useState<'rag' | 'policies'>('rag');

  const queryClient = useQueryClient();
  const { startStream } = useAnalysisRunStream();
  const pendingAutoStream = useWorkbenchReactiveStore((s) => s.pendingAutoStream);
  const setPendingAutoStream = useWorkbenchReactiveStore((s) => s.setPendingAutoStream);

  useEffect(() => {
    // 로컬·프로덕션 모두 기본 활성화. 비활성화 시에만 VITE_NOTIFICATION_WS_ENABLED=false
    const wsEnabled =
      typeof import.meta === 'undefined' ||
      (import.meta.env as { VITE_NOTIFICATION_WS_ENABLED?: string }).VITE_NOTIFICATION_WS_ENABLED !== 'false';
    console.log('[Workbench SSE] Workbench 페이지 마운트/경로 진입', {
      selectedCaseId,
      hasPendingAutoStream: pendingAutoStream != null,
      pendingCaseId: pendingAutoStream?.caseId,
    });
    console.log('[Workbench SSE] WebSocket 알림(ANALYSIS_STARTED 수신용)', {
      enabled: wsEnabled,
      hint: !wsEnabled
        ? '비활성화됨. 활성화하려면 VITE_NOTIFICATION_WS_ENABLED를 제거하거나 true로 설정하세요.'
        : undefined,
    });
  }, []);

  const streamStatus = useStreamStore((s) => s.status);
  const liveViolationCount = useStreamStore((s) => s.liveViolationBuzeiList.length);
  const liveRiskScore = useStreamStore((s) => s.liveRiskScore);
  const isStreamLive = streamStatus === 'CONNECTING' || streamStatus === 'STREAMING';
  const displayViolations = useCountUp(liveViolationCount, isStreamLive);
  const displayScore = useCountUp(liveRiskScore, isStreamLive);

  /** 통합 데이터 바인딩: useCaseDetail — BE 4개 필드(reasoningProcess, logicCheckpoints, evidenceLinks, finalReport) + briefingInsight 직접 사용 */
  const {
    caseData,
    briefingInsight,
    fiDocItems,
    targetBuzei,
    itemsCurrency,
    actionHistory,
    aiThoughts,
    isLoading: detailLoading,
    violationBuzeiList,
    reasoningProcess,
    logicCheckpoints,
    evidenceLinks,
    finalReport,
    summaryVerdict,
  } = useCaseDetail(selectedCaseId ?? undefined);

  const { data: analysisData } = useCaseAnalysisQuery(selectedCaseId ?? undefined, { enabled: Boolean(selectedCaseId) });
  const ragRefs = (analysisData?.ragRefs ?? []) as Array<{ refId?: string; sourceType?: string; sourceKey?: string; excerpt?: string; score?: number }>;
  const confidenceOverall = analysisData?.confidenceBreakdown?.overall;
  const analysisScore =
    analysisData?.score ?? (confidenceOverall != null ? Number(confidenceOverall) * 100 : undefined);

  /** 배치 모드 KPI: 케이스 미선택 시 오늘/전체 케이스 수 + 진입 시 최고 score 케이스 자동 선택용 */
  const casesListQuery = useCasesListQuery({ page: 0, size: 20 });
  const caseListItems = useMemo(() => {
    const raw = casesListQuery.data?.items ?? casesListQuery.data?.content ?? casesListQuery.data?.data ?? [];
    return Array.isArray(raw) ? raw.map(caseListDtoToUi) : [];
  }, [casesListQuery.data]);
  const batchTotalCases = casesListQuery.data?.total ?? casesListQuery.data?.totalElements ?? 0;

  /** 지능형 포커싱: 백엔드 알림(suggestedSelectCaseId / briefing_priority_case_id)이 있으면 로컬 score 정렬보다 최우선 적용 */
  const suggestedSelectCaseId = useWorkbenchReactiveStore((s) => s.suggestedSelectCaseId);
  useEffect(() => {
    if (suggestedSelectCaseId == null) return;
    setSelectedCaseId(suggestedSelectCaseId);
    useWorkbenchReactiveStore.getState().setSuggestedSelectCaseId(null);
  }, [suggestedSelectCaseId]);

  /** 워크벤치 진입 시 케이스 목록 로드 후, suggestedSelectCaseId가 없을 때만 score(confidence) 최고 케이스 자동 선택 */
  const didAutoSelectRef = useRef(false);
  useEffect(() => {
    if (suggestedSelectCaseId != null) return;
    if (selectedCaseId != null || caseListItems.length === 0 || casesListQuery.isLoading) return;
    if (didAutoSelectRef.current) return;
    const top = [...caseListItems].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
    if (top?.id) {
      didAutoSelectRef.current = true;
      setSelectedCaseId(top.id);
    }
  }, [caseListItems, selectedCaseId, casesListQuery.isLoading, suggestedSelectCaseId]);

  const [explanationLoading, setExplanationLoading] = useState(false);
  const [scrollToBuzei, setScrollToBuzei] = useState<string | null>(null);
  const handleEvidenceCardClick = useCallback((itemIdx: number) => {
    const buzei = fiDocItems[itemIdx]?.buzei ?? String(itemIdx + 1).padStart(3, '0');
    setScrollToBuzei(buzei);
  }, [fiDocItems]);
  const handleRequestExplanation = useCallback(async () => {
    if (!selectedCaseId) return;
    setExplanationLoading(true);
    try {
      await sendExplanationRequest({
        caseId: selectedCaseId,
        summary: finalReport?.summary ?? finalReport?.verdict ?? summaryVerdict ?? undefined,
        violationSummary: finalReport?.verdict ?? undefined,
      });
      showToast(t('caseDetail.explanationRequestSent'), 'success');
    } catch (err) {
      showToast(getErrorMessage(err) ?? t('caseDetail.explanationRequestFailed'), 'error');
    } finally {
      setExplanationLoading(false);
    }
  }, [selectedCaseId, finalReport, summaryVerdict, t]);

  /** 테스트 데이터 생성 후 워크벤치 진입 시: CASE_ACTION/ANALYSIS_STARTED로 제안된 케이스가 있으면 자동 선택 */
  useEffect(() => {
    if (suggestedSelectCaseId == null) return;
    console.log('[Workbench SSE] suggestedSelectCaseId로 케이스 자동 선택', suggestedSelectCaseId);
    setSelectedCaseId(suggestedSelectCaseId);
    useWorkbenchReactiveStore.getState().setSuggestedSelectCaseId(null);
  }, [suggestedSelectCaseId]);

  /** THOUGHT_STREAM WebSocket: 현재 상세 case와 일치할 때만 ThoughtChainUI에 스트리밍; 케이스 전환 시 컨텍스트·thought 초기화 */
  useEffect(() => {
    useWorkbenchReactiveStore.getState().setThoughtStreamContext(selectedCaseId ?? null, null);
    useAuraStore.getState().actions.clearThoughtChains();
    useStreamStore.getState().resetLiveKpi();
  }, [selectedCaseId]);

  /** ANALYSIS_STARTED 수신 시 stream_url 저장됨. 선택 케이스와 일치하면 지연 없이 SSE 자동 구독 (Aura 2초 대기 내 연결) */
  useEffect(() => {
    if (pendingAutoStream != null) {
      console.log('[Workbench SSE] 상태 (pendingAutoStream 있음)', {
        selectedCaseId,
        pendingCaseId: pendingAutoStream.caseId,
        match: pendingAutoStream.caseId === selectedCaseId,
      });
    }
    if (!pendingAutoStream) return;
    // 선택된 케이스가 없으면 pending 케이스로 먼저 선택 → 다음 렌더에서 startStream
    if (!selectedCaseId || selectedCaseId !== pendingAutoStream.caseId) {
      if (!selectedCaseId) {
        console.log('[Workbench SSE] pendingAutoStream으로 케이스 자동 선택 후 SSE 구독 예정', {
          pendingCaseId: pendingAutoStream.caseId,
        });
        setSelectedCaseId(pendingAutoStream.caseId);
      } else {
        console.log('[Workbench SSE] pendingAutoStream 미소비', {
          reason: 'caseId 불일치',
          selectedCaseId,
          pendingCaseId: pendingAutoStream.caseId,
        });
      }
      return;
    }
    const { caseId, streamUrl, runId } = pendingAutoStream;
    setPendingAutoStream(null);
    console.log('[Workbench SSE] ANALYSIS_STARTED → startStream() 호출됨', { caseId, runId, streamUrl: streamUrl.slice(0, 80) });
    startStream(caseId, {
      streamUrl,
      runId,
      isAutoStarted: true,
      onSuccess: (id) => {
        queryClient.invalidateQueries({ queryKey: ['synapse', 'cases'] });
        queryClient.invalidateQueries({ queryKey: ['synapse', 'cases', 'analysis'] });
        queryClient.invalidateQueries({ queryKey: ['synapse', 'cases', 'action-proposals'] });
        queryClient.invalidateQueries({ queryKey: ['synapse', 'cases', 'analysis-runs'] });
      },
    });
  }, [selectedCaseId, pendingAutoStream, setPendingAutoStream, startStream, queryClient]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* 상단: 타이틀 "통합 워크벤치" 한 번만 노출 + [지식/정책 관리] 버튼 */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={2}
        sx={{
          flexShrink: 0,
          px: 1.5,
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {t('menu.workbench')}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<Iconify icon="solar:book-2-bold" width={18} />}
          onClick={() => {
            setKnowledgePolicyTab('rag');
            setKnowledgePolicyModalOpen(true);
          }}
        >
          {t('workbench.tools.knowledgePolicy')}
        </Button>
      </Stack>

      {/* 스트림 라이브 시: 동적 요약 바 — 위반 건수·리스크 점수 실시간 카운팅 업 */}
      {isStreamLive && (
        <Stack
          direction="row"
          alignItems="center"
          spacing={3}
          sx={{
            flexShrink: 0,
            px: 2,
            py: 1.25,
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: (muiTheme) => varAlpha(muiTheme.vars.palette.primary.mainChannel, 0.06),
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <Iconify icon="solar:danger-triangle-bold-duotone" width={20} sx={{ color: 'error.main' }} />
            <Typography variant="caption" color="text.secondary">
              {t('workbench.liveSummaryViolations')}
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'error.main', minWidth: 28 }}>
              {displayViolations}
            </Typography>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Iconify icon="solar:graph-up-bold-duotone" width={20} sx={{ color: 'primary.main' }} />
            <Typography variant="caption" color="text.secondary">
              {t('workbench.liveSummaryRiskScore')}
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main', minWidth: 36 }}>
              {displayScore}%
            </Typography>
          </Stack>
        </Stack>
      )}

      {/* Tablet/Mobile: Tabs (375px 검증 — sx only) */}
      <Tabs
        value={mobileTab}
        onChange={(_, v: WorkbenchTab) => setMobileTab(v)}
        sx={{
          flexShrink: 0,
          minHeight: 40,
          borderBottom: 1,
          borderColor: 'divider',
          display: { xs: 'flex', md: 'none' },
          px: 1,
        }}
      >
        <Tab
          value="queue"
          icon={<Iconify width={18} icon="solar:clipboard-list-bold" />}
          iconPosition="start"
          label={t('workbench.tabQueue')}
        />
        <Tab
          value="detail"
          icon={<Iconify width={18} icon="solar:document-text-bold" />}
          iconPosition="start"
          label={t('workbench.tabDetail')}
        />
        <Tab
          value="stream"
          icon={<Iconify width={18} icon="solar:chat-round-dots-bold" />}
          iconPosition="start"
          label={t('workbench.tabStream')}
        />
      </Tabs>

      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: { xs: 'column', md: 'column' },
          minHeight: 0,
          overflow: 'hidden',
          '--workbench-panel-header-height': '56px',
        }}
      >
        {/* Global Row: KPI Strip — 좌/중/우 전체를 가로지르는 최상단 행. 케이스 자동 선택 시 batchMode→caseMode 전환(opacity/transform) 애니메이션 */}
        <Box
          sx={{
            flexShrink: 0,
            px: 2,
            py: 1.5,
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: 'action.hover',
            transition: 'opacity 0.35s ease, transform 0.35s ease',
            opacity: selectedCaseId ? 1 : 0.92,
            transform: selectedCaseId ? 'scale(1)' : 'scale(0.98)',
          }}
        >
          <WorkbenchKpiStrip
            batchMode={!selectedCaseId}
            totalVouchers={selectedCaseId ? fiDocItems.length : batchTotalCases}
            highRiskCount={selectedCaseId ? (liveViolationCount || violationBuzeiList.length) : 0}
            progressPercent={selectedCaseId ? (isStreamLive ? liveRiskScore : (analysisScore ?? 0)) : 0}
            savingsEstimate={null}
            currency={itemsCurrency ?? 'KRW'}
            animateCountUp={!!selectedCaseId}
          />
        </Box>

        {/* 좌측 패널 | PanelGroup(중앙+우측) */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
        {/* Left: 300px — Queue */}
        <Box
          sx={{
            width: 300,
            flexShrink: 0,
            minHeight: 0,
            display: { xs: mobileTab === 'queue' ? 'flex' : 'none', md: 'block' },
            flexDirection: 'column',
          }}
        >
          <WorkbenchQueuePanel
            selectedCaseId={selectedCaseId}
            onSelectCase={setSelectedCaseId}
            getGlassPanelSx={getGlassPanelSx}
            sx={{ flex: 1, minHeight: 0 }}
          />
        </Box>

        {/* Center + Right: Resizable — Detail | 4탭 우측 패널 */}
        <PanelGroup
          direction="horizontal"
          style={{ flex: 1, minWidth: 0, minHeight: 0 }}
          autoSaveId="workbench-right-panel"
        >
          <Panel defaultSize={70} minSize={30} order={1}>
            <Box
              sx={{
                height: '100%',
                display: { xs: mobileTab === 'detail' ? 'flex' : 'none', md: 'flex' },
                flexDirection: 'column',
                minHeight: 0,
                minWidth: 0,
              }}
            >
              <WorkbenchDetailPanel
                actionHistory={actionHistory}
                aiThoughts={aiThoughts}
                caseStatus={caseData?.status}
                fiDocItems={fiDocItems}
                getGlassPanelSx={getGlassPanelSx}
                isLoading={detailLoading}
                itemsCurrency={itemsCurrency}
                scrollToBuzei={scrollToBuzei}
                selectedCaseId={selectedCaseId}
                targetBuzei={targetBuzei}
                sx={{ flex: 1, minHeight: 0 }}
                onClearScrollToBuzei={() => setScrollToBuzei(null)}
              />
            </Box>
          </Panel>
          <Box
            sx={{
              width: 8,
              minWidth: 8,
              cursor: 'col-resize',
              position: 'relative',
              flexShrink: 0,
              bgcolor: 'action.hover',
              '&:hover .workbench-handle-bar': { bgcolor: 'primary.main' },
            }}
          >
            <Box
              className="workbench-handle-bar"
              sx={{
                position: 'absolute',
                left: 3,
                top: 56,
                bottom: 0,
                width: 2,
                bgcolor: 'transparent',
                transition: 'background-color 0.15s ease',
              }}
            />
            <PanelResizeHandle style={{ width: '100%', minWidth: 8, background: 'transparent', cursor: 'col-resize' }} />
          </Box>
          <Panel defaultSize={30} minSize={20} maxSize={50} order={2} collapsible>
            <Box
              sx={{
                height: '100%',
                minWidth: 0,
                display: { xs: mobileTab === 'stream' ? 'flex' : 'none', md: 'block' },
              }}
            >
              <WorkbenchRightPanel
                briefingInsight={briefingInsight}
                evidenceLinks={evidenceLinks}
                explanationLoading={explanationLoading}
                finalReport={finalReport}
                fiDocItems={fiDocItems}
                getGlassPanelSx={getGlassPanelSx}
                logicCheckpoints={logicCheckpoints}
                onEvidenceCardClickByItemIdx={handleEvidenceCardClick}
                onRequestExplanation={handleRequestExplanation}
                reasoningProcess={reasoningProcess}
                selectedCaseId={selectedCaseId}
                orbVariant={liveViolationCount > 0 || (liveRiskScore ?? 0) >= 70 ? 'risk' : 'thinking'}
                sx={{ height: '100%' }}
              />
            </Box>
          </Panel>
        </PanelGroup>
        </Box>
      </Box>

      {/* Functional Bridge: 지식/정책 관리 Dialog (RagView·PolicyView 탭, 페이지 이동 없음) */}
      <Dialog
        open={knowledgePolicyModalOpen}
        onClose={() => setKnowledgePolicyModalOpen(false)}
        fullScreen={isMobile}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {t('workbench.tools.knowledgePolicy')}
          <IconButton
            aria-label="close"
            onClick={() => setKnowledgePolicyModalOpen(false)}
            size="small"
          >
            <Iconify icon="solar:close-circle-bold" width={24} />
          </IconButton>
        </DialogTitle>
        <Tabs
          value={knowledgePolicyTab}
          onChange={(_, v: 'rag' | 'policies') => setKnowledgePolicyTab(v)}
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
        >
          <Tab value="rag" label={t('workbench.tools.rag')} />
          <Tab value="policies" label={t('workbench.tools.policies')} />
        </Tabs>
        <DialogContent dividers sx={{ p: 0, overflow: 'auto' }}>
          {knowledgePolicyTab === 'rag' && <RagPage />}
          {knowledgePolicyTab === 'policies' && <PoliciesPage />}
        </DialogContent>
      </Dialog>
    </Box>
  );
};
