import type { Theme } from '@mui/material/styles';

import { keyframes } from '@emotion/react';
import { useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import {
  useStreamStore,
  useCasesListQuery,
  useAnalysisRunStream,
  useCaseAnalysisQuery,
  useWorkbenchReactiveStore,
  useRequestCaseExplanationMutation,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';

import { useCaseDetail } from '../cases/hooks/use-case-detail';
import { WorkbenchKpiStrip } from '../workbench/components/WorkbenchKpiStrip';
import { WorkbenchNewCasePanel } from './components/workbench-new-case-panel';
import { WorkbenchNewQueuePanel } from './components/workbench-new-queue-panel';
import { WorkbenchStreamPanel } from '../workbench/components/WorkbenchStreamPanel';

type MobileTab = 'queue' | 'workspace' | 'stream';
const SELECTED_CASE_STORAGE_KEY = 'synapse.workbenchNew.selectedCaseId';

const getGlassPanelSx = (theme: Theme): Record<string, unknown> => ({
  backgroundColor: theme.vars.palette.background.paper,
});

const fadeInUp = keyframes`
  0% { opacity: 0; transform: translateY(8px); }
  100% { opacity: 1; transform: translateY(0); }
`;
const livePulse = keyframes`
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.72; transform: scale(0.96); }
`;

export const WorkbenchNewPage = () => {
  const { t } = useTranslation('common');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileTab, setMobileTab] = useState<MobileTab>('workspace');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage.getItem(SELECTED_CASE_STORAGE_KEY);
  });
  const [isStreamPanelOpen, setIsStreamPanelOpen] = useState(true);

  const queryClient = useQueryClient();
  const { startStream } = useAnalysisRunStream();
  const pendingAutoStream = useWorkbenchReactiveStore((s) => s.pendingAutoStream);
  const setPendingAutoStream = useWorkbenchReactiveStore((s) => s.setPendingAutoStream);
  const suggestedSelectCaseId = useWorkbenchReactiveStore((s) => s.suggestedSelectCaseId);

  const streamStatus = useStreamStore((s) => s.status);
  const liveViolationCount = useStreamStore((s) => s.liveViolationBuzeiList.length);
  const liveRiskScore = useStreamStore((s) => s.liveRiskScore);

  const detail = useCaseDetail(selectedCaseId ?? undefined);
  const analysisQuery = useCaseAnalysisQuery(selectedCaseId ?? undefined, { enabled: Boolean(selectedCaseId) });
  const requestExplanationMutation = useRequestCaseExplanationMutation();

  const casesListQuery = useCasesListQuery({ page: 0, size: 20 });
  const batchTotalCases = casesListQuery.data?.total ?? casesListQuery.data?.totalElements ?? 0;

  /** 테스트 데이터 생성 후: suggestedSelectCaseId(새 케이스)가 있으면 해당 케이스 선택. 일반 진입: 자동 선택 없음(사용자가 직접 선택) */
  useEffect(() => {
    if (suggestedSelectCaseId != null) {
      setSelectedCaseId(suggestedSelectCaseId);
      useWorkbenchReactiveStore.getState().setSuggestedSelectCaseId(null);
    }
  }, [suggestedSelectCaseId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (selectedCaseId) {
      window.sessionStorage.setItem(SELECTED_CASE_STORAGE_KEY, selectedCaseId);
      return;
    }
    window.sessionStorage.removeItem(SELECTED_CASE_STORAGE_KEY);
  }, [selectedCaseId]);

  useEffect(() => {
    useWorkbenchReactiveStore.getState().setThoughtStreamContext(selectedCaseId ?? null, null);
  }, [selectedCaseId]);

  useEffect(() => {
    if (!pendingAutoStream) return;
    if (!selectedCaseId || selectedCaseId !== pendingAutoStream.caseId) {
      if (!selectedCaseId) setSelectedCaseId(pendingAutoStream.caseId);
      return;
    }
    const { caseId, streamUrl, runId } = pendingAutoStream;
    setPendingAutoStream(null);
    startStream(caseId, {
      streamUrl,
      runId,
      isAutoStarted: true,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['synapse', 'cases'] });
        queryClient.invalidateQueries({ queryKey: ['synapse', 'cases', 'analysis'] });
      },
    });
  }, [selectedCaseId, pendingAutoStream, setPendingAutoStream, startStream, queryClient]);

  const analysisScore = analysisQuery.data?.score ?? 0;
  const isStreamLive = streamStatus === 'CONNECTING' || streamStatus === 'STREAMING';
  const handleRequestExplanation = useCallback(async () => {
    if (!selectedCaseId) return;
    await requestExplanationMutation.mutateAsync({ caseId: selectedCaseId });
  }, [selectedCaseId, requestExplanationMutation]);

  /** 통합워크벤치 New 타이틀 영역 클릭 시 선택 해제 → 배치 모드 전환 */
  const handleDeselectCase = useCallback(() => {
    if (selectedCaseId) setSelectedCaseId(null);
  }, [selectedCaseId]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        height: '100%',
        overflow: 'hidden',
        overflowX: 'hidden',
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}
      >
        <Box
          onClick={handleDeselectCase}
          sx={{ cursor: selectedCaseId ? 'pointer' : 'default' }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {t('menu.workbench')} New
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Queue + Detail + Live Stream
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography
            variant="caption"
            sx={{
              px: 1,
              py: 0.375,
              borderRadius: 999,
              border: 1,
              borderColor: isStreamLive ? 'success.main' : 'divider',
              color: isStreamLive ? 'success.main' : 'text.secondary',
              animation: isStreamLive ? `${livePulse} 1.8s ease-in-out infinite` : 'none',
            }}
          >
            {isStreamLive ? 'LIVE STREAM ON' : 'STREAM IDLE'}
          </Typography>
          <Button size="small" variant="outlined" href="/synapse/rag">
            {t('workbench.tools.rag')}
          </Button>
          <Button size="small" variant="outlined" href="/synapse/policies">
            {t('workbench.tools.policies')}
          </Button>
        </Stack>
      </Stack>

      {isMobile ? (
        <Tabs
          value={mobileTab}
          onChange={(_, value: MobileTab) => setMobileTab(value)}
          variant="fullWidth"
          sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}
        >
          <Tab value="queue" label={t('workbench.tabQueue')} />
          <Tab value="workspace" label={t('workbench.tabDetail')} />
          <Tab value="stream" label={t('workbench.streamTitle')} />
        </Tabs>
      ) : null}

      <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
        <WorkbenchKpiStrip
          batchMode={!selectedCaseId}
          totalVouchers={selectedCaseId ? detail.fiDocItems.length : batchTotalCases}
          highRiskCount={selectedCaseId ? (liveViolationCount || detail.violationBuzeiList.length) : 0}
          progressPercent={selectedCaseId ? (isStreamLive ? liveRiskScore : analysisScore) : 0}
          savingsEstimate={null}
          currency={detail.itemsCurrency ?? 'KRW'}
          animateCountUp
        />
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          overflow: 'hidden',
          overflowX: 'hidden',
          isolation: 'isolate',
          width: '100%',
          maxWidth: '100%',
        }}
      >
        <Box
          sx={{
            width: { xs: '100%', md: 'clamp(300px, 32vw, 380px)' },
            minWidth: { md: 'clamp(300px, 32vw, 380px)' },
            maxWidth: { md: 'clamp(300px, 32vw, 380px)' },
            flexShrink: 0,
            display: { xs: mobileTab === 'queue' ? 'flex' : 'none', md: 'flex' },
            minHeight: 0,
            position: 'relative',
            zIndex: 1,
            animation: `${fadeInUp} 260ms ease-out`,
          }}
        >
          <WorkbenchNewQueuePanel
            selectedCaseId={selectedCaseId}
            onSelectCase={setSelectedCaseId}
            getGlassPanelSx={getGlassPanelSx}
            sx={{ flex: 1, minHeight: 0 }}
          />
        </Box>

        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            width: 0,
            maxWidth: '100%',
            display: { xs: mobileTab === 'workspace' ? 'flex' : 'none', md: 'flex' },
            minHeight: 0,
            borderLeft: 1,
            borderColor: 'divider',
            position: 'relative',
            zIndex: 2,
            bgcolor: 'background.paper',
            animation: `${fadeInUp} 320ms ease-out`,
          }}
        >
          <WorkbenchNewCasePanel
            selectedCaseId={selectedCaseId}
            title={detail.caseData?.title}
            caseNumber={detail.caseData?.caseNumber}
            caseStatus={detail.caseData?.status}
            briefingInsight={detail.briefingInsight}
            reasoningProcess={detail.reasoningProcess}
            logicCheckpoints={detail.logicCheckpoints}
            evidenceLinks={detail.evidenceLinks}
            finalReport={detail.finalReport}
            aiThoughts={detail.aiThoughts}
            actionHistory={detail.actionHistory}
            fiDocItems={detail.fiDocItems}
            targetBuzei={detail.targetBuzei}
            itemsCurrency={detail.itemsCurrency}
            isLoading={detail.isLoading}
            explanationLoading={requestExplanationMutation.isPending}
            onRequestExplanation={handleRequestExplanation}
            analysisData={analysisQuery.data ?? null}
            caseDetailReasoning={detail.reasoning}
            getGlassPanelSx={getGlassPanelSx}
            sx={{ flex: 1, minHeight: 0 }}
          />
          {!isMobile && (
            <IconButton
              size="small"
              onClick={() => setIsStreamPanelOpen((prev) => !prev)}
              sx={{
                position: 'absolute',
                top: '50%',
                right: isStreamPanelOpen ? -14 : 8,
                transform: 'translateY(-50%)',
                zIndex: 5,
                width: 28,
                height: 48,
                borderRadius: '12px',
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                boxShadow: 2,
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Box component="span" sx={{ fontSize: 14, fontWeight: 700, lineHeight: 1 }}>
                {isStreamPanelOpen ? '>' : '<'}
              </Box>
            </IconButton>
          )}
        </Box>

        {(isMobile || isStreamPanelOpen) && (
          <Box
            sx={{
              width: { xs: '100%', md: 'clamp(280px, 24vw, 360px)' },
              minWidth: { md: 'clamp(280px, 24vw, 360px)' },
              maxWidth: { md: 'clamp(280px, 24vw, 360px)' },
              flexShrink: 0,
              display: { xs: mobileTab === 'stream' ? 'flex' : 'none', md: 'flex' },
              minHeight: 0,
              borderLeft: 1,
              borderColor: 'divider',
              position: 'relative',
              zIndex: 1,
              animation: `${fadeInUp} 380ms ease-out`,
            }}
          >
            <WorkbenchStreamPanel
              getGlassPanelSx={getGlassPanelSx}
              selectedCaseId={null}
              orbVariant={liveRiskScore >= 70 ? 'risk' : 'thinking'}
              sx={{ flex: 1, minHeight: 0 }}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
};
