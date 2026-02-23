/**
 * Case Detail Page — 오케스트레이션 전용 (헤더/좌·중앙·우 패널 조립)
 * @see docs/job/PROMPT_B_Frontend_MenuByMenu_Cases_First.txt
 * @see docs/job/PROMPT_B_Frontend_Cases_TabsBind_P1_v2.txt
 * @see docs/job/PROMPT_FE_CaseDetail_StatusAndActionButtons_WireUp_P0.txt
 */

import { useMemo, useState, useEffect } from 'react';

const IS_DEV = import.meta.env.DEV;

import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  is403Error,
  useStreamStore,
  useCaseAuditEventsQuery,
  useRejectActionMutation,
  useApproveActionMutation,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';

import { SYNAPSE_ROUTES } from '../routes';
import { ErrorStateWithRetry } from '../components/ux';
import { useCaseHitl } from './cases/hooks/use-case-hitl';
import { useCaseDetail } from './cases/hooks/use-case-detail';
import { CaseHitlDrawer } from './cases/components/case-hitl-drawer';
import { useCaseSimulation } from './cases/hooks/use-case-simulation';
import { CaseDetailHeader } from './cases/components/case-detail-header';
import { useCaseStatusSelect } from './cases/hooks/use-case-status-select';
import { CaseDetailLeftPanel } from './cases/components/case-detail-left-panel';
import { CaseTabsDebugDrawer } from './cases/components/case-tabs-debug-drawer';
import { CaseTabsDebugProvider } from './cases/context/case-tabs-debug-context';
import { CaseDetailRightPanel } from './cases/components/case-detail-right-panel';
import { useCaseAnalysisRunState } from './cases/hooks/use-case-analysis-run-state';
import { CaseDetailCenterPanel } from './cases/components/case-detail-center-panel';

import type { HitlStatus } from './cases/hooks/use-case-hitl';

/** 케이스 상세 페이지 */
export const CaseDetailPage = () => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const idFromParams = useParams<{ id: string }>().id;
  const idFromPath = pathname.match(/\/cases\/([^/]+)/)?.[1];
  const id = idFromParams ?? idFromPath ?? undefined;

  const { caseData, evidence, fiDoc, fiDocItems, targetBuzei, violationBuzeiList, highlightChunkIds, lineCount, relatedActions, aiThoughts, isLoading, error, refetch } =
    useCaseDetail(id);
  const approveActionMutation = useApproveActionMutation();
  const rejectActionMutation = useRejectActionMutation();

  const { statusOptions, currentStatusApi, handleStatusChange, isStatusMutating } = useCaseStatusSelect(id, caseData?.status);

  const {
    latestRunId,
    handleStartAnalysis,
    handleRetryStream,
    streamStatus,
    stepProgress,
    cancel,
  } = useCaseAnalysisRunState(id, evidence);

  const liveTargetBuzei = useStreamStore((s) => s.liveTargetBuzei);
  const liveViolationBuzeiList = useStreamStore((s) => s.liveViolationBuzeiList);

  const effectiveTargetBuzei = liveTargetBuzei ?? targetBuzei;
  const effectiveViolationBuzeiList = useMemo(
    () => Array.from(new Set([...(violationBuzeiList ?? []), ...(liveViolationBuzeiList ?? [])])),
    [violationBuzeiList, liveViolationBuzeiList]
  );

  useEffect(() => {
    if (streamStatus === 'completed') {
      setCenterTab('analysis');
    }
  }, [streamStatus]);

  const documentRelationshipFromFiDoc = useMemo(() => {
    if (!fiDoc) return [];
    return [
      {
        id: fiDoc.id,
        type: 'original' as const,
        number: fiDoc.belnr,
        date: fiDoc.budat ?? '',
        amount: fiDoc.wrbtr ?? 0,
        currency: fiDoc.waers ?? 'USD',
        status: 'posted',
      },
    ];
  }, [fiDoc]);

  const [simulationMode, setSimulationMode] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<'actions' | 'audit'>('actions');
  const [centerTab, setCenterTab] = useState('analysis');
  const { data: caseAuditApiData } = useCaseAuditEventsQuery(id, { page: 0, size: 10 }, { enabled: rightPanelTab === 'audit' && Boolean(id) });
  const caseAuditEvents = useMemo(() => {
    if (!caseAuditApiData?.items?.length) return [];
    return caseAuditApiData.items.map((item) => ({
      actor:
        item.actorDisplayName ??
        item.actorName ??
        (item.actor_id != null ? String(item.actor_id) : undefined) ??
        'System',
      description: [item.eventCategory, item.eventType, item.resourceType].filter(Boolean).join(' · ') || 'Audit event',
      timestamp: item.createdAt,
    }));
  }, [caseAuditApiData]);
  const [debugDrawerOpen, setDebugDrawerOpen] = useState(false);

  const [hitlOpen, setHitlOpen] = useState(false);
  const [hitlRequestId, setHitlRequestId] = useState<string | null>(null);
  const [hitlDescription] = useState<string | undefined>();
  const [hitlStatus, setHitlStatus] = useState<HitlStatus>('pending_approval');

  const { approve, reject, isApproving, isRejecting } = useCaseHitl({
    onApproved: () => setHitlStatus('approved'),
    onRejected: () => setHitlStatus('rejected'),
  });
  const handleHitlApprove = (requestId: string, comment?: string) =>
    approve({ requestId, caseId: id, comment });
  const handleHitlReject = (requestId: string, reason?: string) => reject({ requestId, reason });

  const simulationActionType = useMemo(() => {
    const pending = relatedActions?.find((a) => (a as { status: string }).status === 'pending');
    return (pending?.actionType ?? relatedActions?.[0]?.actionType ?? 'PAYMENT_BLOCK').toUpperCase();
  }, [relatedActions]);

  const { runSimulation, result: simulationResult, isLoading: simulationLoading } = useCaseSimulation(id, {
    actionType: simulationActionType,
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <Typography variant="body2" color="text.secondary">
          {t('caseDetail.loading')}
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <ErrorStateWithRetry
        title={is403Error(error) ? undefined : t('error.errorState.failedToLoadCase')}
        message={error instanceof Error ? error.message : undefined}
        onRetry={() => refetch()}
        is403={is403Error(error)}
      />
    );
  }

  if (!caseData) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          {t('notFound.case')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('caseDetail.notFoundDesc')}
        </Typography>
        <Button
          variant="outlined"
          startIcon={<Iconify icon="solar:arrow-left-linear" width={18} />}
          onClick={() => navigate(SYNAPSE_ROUTES.CASES)}
        >
          {t('caseDetail.backToCases')}
        </Button>
      </Box>
    );
  }

  const isAgentWorking = streamStatus === 'connecting' || streamStatus === 'streaming';

  return (
    <CaseTabsDebugProvider activeTab={centerTab} onActiveTabChange={setCenterTab}>
      <Box
        sx={(theme) => ({
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - 3.5rem)',
          position: 'relative',
          ...(isAgentWorking && {
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background: `radial-gradient(ellipse 80% 50% at 50% 50%, ${alpha(theme.palette.primary.main, 0.06)} 0%, transparent 70%)`,
              animation: 'caseDetailWave 3s ease-in-out infinite',
            },
            '@keyframes caseDetailWave': {
              '0%, 100%': { opacity: 0.5 },
              '50%': { opacity: 1 },
            },
          }),
        })}
      >
        <CaseDetailHeader
          caseData={caseData}
          statusOptions={statusOptions}
          currentStatusApi={currentStatusApi}
          onStatusChange={handleStatusChange}
          isStatusMutating={isStatusMutating}
          onBack={() => navigate(SYNAPSE_ROUTES.CASES)}
          onOpenDebug={IS_DEV ? () => setDebugDrawerOpen(true) : undefined}
          isDev={IS_DEV}
        />

        <Box
          sx={{
            display: 'flex',
            flex: 1,
            overflow: { xs: 'auto', lg: 'hidden' },
            flexDirection: { xs: 'column', lg: 'row' },
            minHeight: 0,
          }}
        >
          <CaseDetailLeftPanel
            caseData={caseData}
            fiDoc={fiDoc}
            fiDocItems={fiDocItems}
            lineCount={lineCount}
            targetBuzei={effectiveTargetBuzei}
            documentRelationship={documentRelationshipFromFiDoc}
          />

          <CaseDetailCenterPanel
            caseId={id}
            caseData={caseData}
            centerTab={centerTab}
            onCenterTabChange={setCenterTab}
            latestRunId={latestRunId}
            streamStatus={streamStatus}
            stepProgress={stepProgress}
            onStartAnalysis={handleStartAnalysis}
            onRetryStream={handleRetryStream}
            onCancel={cancel}
            fiDocItems={fiDocItems}
            targetBuzei={effectiveTargetBuzei}
            violationBuzeiList={effectiveViolationBuzeiList}
            highlightChunkIds={highlightChunkIds}
            aiThoughts={aiThoughts}
          />

          <CaseDetailRightPanel
            caseData={caseData}
            caseId={id}
            rightPanelTab={rightPanelTab}
            onRightPanelTabChange={setRightPanelTab}
            simulationMode={simulationMode}
            onSimulationModeChange={setSimulationMode}
            simulationResult={simulationResult ?? null}
            simulationLoading={simulationLoading}
            onRunSimulation={runSimulation}
            relatedActions={relatedActions}
            caseAuditEvents={caseAuditEvents}
            onStatusChange={handleStatusChange}
            isStatusMutating={isStatusMutating}
            approveActionMutation={approveActionMutation}
            rejectActionMutation={rejectActionMutation}
          />
        </Box>

        {IS_DEV && (
          <CaseTabsDebugDrawer open={debugDrawerOpen} onClose={() => setDebugDrawerOpen(false)} caseId={id} />
        )}

        <CaseHitlDrawer
          open={hitlOpen}
          onClose={() => {
            setHitlOpen(false);
            setHitlRequestId(null);
          }}
          requestId={hitlRequestId}
          description={hitlDescription}
          status={hitlStatus}
          onApprove={handleHitlApprove}
          onReject={handleHitlReject}
          isApproving={isApproving}
          isRejecting={isRejecting}
        />
      </Box>
    </CaseTabsDebugProvider>
  );
};
