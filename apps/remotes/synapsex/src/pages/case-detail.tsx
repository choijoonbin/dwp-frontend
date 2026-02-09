import { useEffect, useMemo, useState } from 'react';

const IS_DEV = import.meta.env.DEV;
import { Iconify } from '@dwp-frontend/design-system';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { Link, useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  buildAuditUrl,
  is403Error,
  useAnalysisRunStream,
  useCaseAnalysisRunsQuery,
  useCaseAuditEventsQuery,
  useCodesByGroupQuery,
  useApproveActionMutation,
  useRejectActionMutation,
  useUpdateCaseStatusMutation,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import Switch from '@mui/material/Switch';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import IconButton from '@mui/material/IconButton';
import FormControl from '@mui/material/FormControl';
import CardContent from '@mui/material/CardContent';
import { alpha, useTheme } from '@mui/material/styles';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';

import { SYNAPSE_ROUTES } from '../routes';
import { ErrorStateWithRetry } from '../components/ux';
import { useCaseHitl } from './cases/hooks/use-case-hitl';
import { useCaseDetail } from './cases/hooks/use-case-detail';
import { CaseHitlDrawer } from './cases/components/case-hitl-drawer';
import { SeverityBadge } from '../components/finance/severity-badge';
import { CaseSimilarTab } from './cases/components/case-similar-tab';
import { useCaseSimulation } from './cases/hooks/use-case-simulation';
import { CaseAnalysisTab } from './cases/components/case-analysis-tab';
import { ConfidenceRing } from '../components/finance/confidence-meter';
import { CaseConfidenceTab } from './cases/components/case-confidence-tab';
import { StatusPill, type Status } from '../components/finance/status-pill';
import { CaseLineItemsCard } from './cases/components/case-line-items-card';
import { CaseSimulationDiff } from './cases/components/case-simulation-diff';
import { CaseRagEvidenceTab } from './cases/components/case-rag-evidence-tab';
import { CaseTabsDebugDrawer } from './cases/components/case-tabs-debug-drawer';
import { CaseTabsDebugProvider } from './cases/context/case-tabs-debug-context';
import { CaseAgentStreamPanel } from './cases/components/case-agent-stream-panel';
import { CaseActionProposalsTab } from './cases/components/case-action-proposals-tab';

import type { HitlStatus } from './cases/hooks/use-case-hitl';

// ----------------------------------------------------------------------
// @see docs/job/PROMPT_B_Frontend_MenuByMenu_Cases_First.txt
// @see docs/job/PROMPT_B_Frontend_Cases_TabsBind_P1_v2.txt
// @see docs/job/PROMPT_FE_CaseDetail_StatusAndActionButtons_WireUp_P0.txt
// ----------------------------------------------------------------------

const ALLOWED_CASE_STATUSES = ['OPEN', 'TRIAGED', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED'] as const;
type CaseStatusApi = (typeof ALLOWED_CASE_STATUSES)[number];

const displayStatusToApi = (s: string): CaseStatusApi => {
  const lower = (s ?? '').toLowerCase();
  if (lower === 'open') return 'OPEN';
  if (lower === 'triage' || lower === 'triaged') return 'TRIAGED';
  if (lower === 'in_progress') return 'IN_PROGRESS';
  if (lower === 'resolved') return 'RESOLVED';
  if (lower === 'dismissed') return 'DISMISSED';
  return 'TRIAGED';
};

/** 케이스 상세 페이지 */
export const CaseDetailPage = () => {
  const { t } = useTranslation('common');
  const theme = useTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const idFromParams = useParams<{ id: string }>().id;
  // pathname-to-page 렌더 시 Route :id 없음 → pathname에서 추출
  const idFromPath = pathname.match(/\/cases\/([^/]+)/)?.[1];
  const id = idFromParams ?? idFromPath ?? undefined;

  const { caseData, evidence, fiDoc, fiDocItems, targetBuzei, lineCount, relatedActions, isLoading, error, refetch } =
    useCaseDetail(id);
  const queryClient = useQueryClient();
  const updateStatusMutation = useUpdateCaseStatusMutation();
  const approveActionMutation = useApproveActionMutation();
  const rejectActionMutation = useRejectActionMutation();
  const { data: caseStatusCodes } = useCodesByGroupQuery('CASE_STATUS');

  const currentStatusApi = displayStatusToApi(caseData?.status ?? '');
  const isStatusMutating = updateStatusMutation.isPending;

  /** TRIAGED는 검색/필터 옵션에서 제외 (현재 상태가 TRIAGED일 때는 표시용으로만 포함) */
  const statusOptions = useMemo(() => {
    if (!caseStatusCodes) return [];
    const allowed = new Set(ALLOWED_CASE_STATUSES);
    const excludeTriaged = currentStatusApi !== 'TRIAGED';
    return caseStatusCodes
      .filter((c) => {
        const code = (c.codeKey ?? (c as { code?: string }).code ?? '').toUpperCase() as CaseStatusApi;
        return allowed.has(code) && (!excludeTriaged || code !== 'TRIAGED');
      })
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((c) => ({
        value: (c.codeKey ?? (c as { code?: string }).code ?? '').toUpperCase() as CaseStatusApi,
        label: (c.codeName ?? (c as { name?: string }).name ?? '').trim() || c.codeKey,
      }));
  }, [caseStatusCodes, currentStatusApi]);

  const handleStatusChange = (newStatus: CaseStatusApi) => {
    if (!id || newStatus === currentStatusApi) return;
    updateStatusMutation.mutate({ caseId: id, status: newStatus });
  };

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
        status: 'posted' as const,
      },
    ];
  }, [fiDoc]);

  const [simulationMode, setSimulationMode] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<'actions' | 'audit'>('actions');
  const [centerTab, setCenterTab] = useState('analysis');
  const { data: caseAuditApiData } = useCaseAuditEventsQuery(
    id,
    { page: 0, size: 10 },
    { enabled: rightPanelTab === 'audit' && Boolean(id) }
  );
  const caseAuditEvents = useMemo(() => {
    if (!caseAuditApiData?.items?.length) return [];
    return caseAuditApiData.items.map((item) => ({
      actor: item.actorDisplayName ?? 'System',
      description: [item.eventCategory, item.eventType, item.resourceType].filter(Boolean).join(' · ') || 'Audit event',
      timestamp: item.createdAt,
    }));
  }, [caseAuditApiData]);
  const [debugDrawerOpen, setDebugDrawerOpen] = useState(false);

  // HITL state
  const [hitlOpen, setHitlOpen] = useState(false);
  const [hitlRequestId, setHitlRequestId] = useState<string | null>(null);
  const [hitlDescription] = useState<string | undefined>();
  const [hitlStatus, setHitlStatus] = useState<HitlStatus>('pending_approval');

  // Phase2 Analysis Run Stream — latestRunId 기반, 재시도 시 replace(누적 X)
  const [latestRunId, setLatestRunId] = useState<string | null>(null);
  const {
    startStream,
    cancel,
    status: streamStatus,
    stepProgress,
  } = useAnalysisRunStream();

  const { data: analysisRunsData } = useCaseAnalysisRunsQuery(id, {
    enabled: Boolean(id),
    latest: true,
  });

  useEffect(() => {
    if (!id) return;
    setLatestRunId(null);
  }, [id]);

  useEffect(() => {
    if (analysisRunsData?.runId) {
      setLatestRunId(analysisRunsData.runId);
    }
  }, [analysisRunsData?.runId]);

  const handleStartAnalysis = () => {
    if (id) {
      startStream(id, {
        onSuccess: (runId) => {
          setLatestRunId(runId);
          queryClient.invalidateQueries({ queryKey: ['synapse', 'cases'] });
          queryClient.invalidateQueries({ queryKey: ['synapse', 'cases', 'analysis'] });
          queryClient.invalidateQueries({ queryKey: ['synapse', 'cases', 'action-proposals'] });
          queryClient.invalidateQueries({ queryKey: ['synapse', 'cases', 'analysis-runs'] });
        },
        payload: evidence
          ? { evidenceSnapshot: evidence as Record<string, unknown> }
          : undefined,
      });
    }
  };

  const handleRetryStream = () => handleStartAnalysis();

  // HITL
  const { approve, reject, isApproving, isRejecting } = useCaseHitl({
    onApproved: () => {
      setHitlStatus('approved');
    },
    onRejected: () => {
      setHitlStatus('rejected');
    },
  });

  const handleHitlApprove = (requestId: string) => {
    approve(requestId);
  };

  const handleHitlReject = (requestId: string, reason?: string) => {
    reject({ requestId, reason });
  };

  // Simulation
  const { runSimulation, result: simulationResult, isLoading: simulationLoading } = useCaseSimulation(id);

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

  return (
    <CaseTabsDebugProvider activeTab={centerTab} onActiveTabChange={setCenterTab}>
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 3.5rem)' }}>
      {/* Case Header — 모바일: Card 형태로 통합, 데스크톱: 기존 레이아웃 */}
      <Card
        variant="outlined"
        sx={{
          mx: { xs: 1.5, sm: 0 },
          mt: { xs: 1, sm: 0 },
          mb: 0,
          borderRadius: { xs: 1.5, sm: 0 },
          borderWidth: { xs: 1, sm: 0 },
          borderBottom: { sm: 1 },
          borderColor: 'divider',
          bgcolor: 'background.paper',
          boxShadow: 'none',
          overflow: 'visible',
        }}
      >
        <CardContent sx={{ px: { xs: 1.5, sm: 3 }, pt: { xs: 1.5, sm: 2 }, pb: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
            <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ minWidth: 0, flex: 1 }}>
              <IconButton
                onClick={() => navigate(SYNAPSE_ROUTES.CASES)}
                sx={{ flexShrink: 0, bgcolor: 'transparent' }}
              >
                <Iconify icon="solar:arrow-left-bold-duotone" width={20} />
              </IconButton>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  flexWrap="wrap"
                  sx={{ mb: 1, gap: 1 }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 600, flex: 1, minWidth: 0 }}>
                    {caseData.title}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ gap: 1 }}>
                    <SeverityBadge severity={caseData.severity} />
                    <StatusPill status={caseData.status as Status} />
                    <FormControl size="small" sx={{ minWidth: { xs: 120, sm: 140 } }}>
                      <InputLabel id="case-status-select-label">{t('caseDetail.status')}</InputLabel>
                      <Select
                        labelId="case-status-select-label"
                        label={t('caseDetail.status')}
                        value={currentStatusApi}
                        onChange={(e) => handleStatusChange(e.target.value as CaseStatusApi)}
                        disabled={isStatusMutating}
                      >
                        {statusOptions.map((opt) => (
                          <MenuItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Stack>
                </Stack>
                <Stack
                  direction="row"
                  spacing={{ xs: 1.5, sm: 2 }}
                  flexWrap="wrap"
                  alignItems="center"
                  sx={{ gap: 1 }}
                >
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Iconify icon="solar:hash-bold-duotone" width={14} />
                    <Typography variant="caption" color="text.secondary">
                      {caseData.caseNumber}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Iconify icon="solar:calendar-bold-duotone" width={14} />
                    <Typography variant="caption" color="text.secondary">
                      {new Date(caseData.detectedAt).toLocaleDateString()}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Iconify icon="solar:buildings-bold-duotone" width={14} />
                    <Typography variant="caption" color="text.secondary">
                      {caseData.companyCode}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Iconify icon="solar:dollar-minimalistic-bold-duotone" width={14} />
                    <Typography variant="caption" color="text.secondary">
                      {caseData.amount.toLocaleString()} {caseData.currency}
                    </Typography>
                  </Stack>
                  <Box sx={{ flex: 1, minWidth: 0 }} />
                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
                    <ConfidenceRing value={caseData.confidence} size={48} />
                    {IS_DEV && (
                      <Tooltip title="Tab Debug (DEV)">
                        <IconButton size="small" sx={{ bgcolor: 'transparent', p: 0.5 }} onClick={() => setDebugDrawerOpen(true)}>
                          <Iconify icon="solar:code-square-bold-duotone" width={16} />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title={t('caseDetail.copyCaseId')}>
                      <IconButton size="small" sx={{ bgcolor: 'transparent', p: 0.5 }}>
                        <Iconify icon="solar:copy-bold-duotone" width={16} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('caseDetail.openInSap')}>
                      <IconButton size="small" sx={{ bgcolor: 'transparent', p: 0.5 }}>
                        <Iconify icon="solar:external-link-bold-duotone" width={16} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>
              </Box>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* 3-Panel Layout */}
      <Box
        sx={{
          display: 'flex',
          flex: 1,
          overflow: { xs: 'auto', lg: 'hidden' },
          flexDirection: { xs: 'column', lg: 'row' },
          minHeight: 0,
        }}
      >
        {/* Left Panel - Source Evidence — 모바일: 폭 최대화 */}
        <Box
          sx={{
            width: { xs: '100%', lg: 360 },
            minWidth: 0,
            flexShrink: 0,
            borderRight: { lg: 1 },
            borderBottom: { xs: 1, lg: 0 },
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              px: { xs: 1, sm: 2 },
              py: 1.5,
              borderBottom: 1,
              borderColor: 'divider',
              bgcolor: alpha(theme.palette.primary.main, 0.04),
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Iconify icon="solar:document-text-bold-duotone" width={18} />
              <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>
                {t('caseDetail.sourceEvidence')}
              </Typography>
            </Stack>
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 1, sm: 2 }, minWidth: 0 }}>
            <Stack spacing={2}>
              {/* Document Relationship Graph - Placeholder */}
              <Card sx={{ width: '100%' }}>
                <CardContent sx={{ px: { xs: 1.5, sm: 2 }, py: { xs: 1.5, sm: 2 } }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    {t('caseDetail.documentRelationship')}
                  </Typography>
              <Stack spacing={1}>
                {documentRelationshipFromFiDoc.map((doc) => (
                  <Box
                    key={doc.id}
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: alpha(theme.palette.primary.main, doc.type === 'original' ? 0.08 : 0.04),
                      border: 1,
                      borderColor: doc.type === 'original' ? 'primary.main' : 'divider',
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                      <Chip
                        label={doc.type === 'original' ? t('caseDetail.original') : t('caseDetail.reversal')}
                        size="small"
                        color={doc.type === 'original' ? 'primary' : 'default'}
                      />
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        {doc.number}
                      </Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {doc.date} • {doc.amount.toLocaleString()} {doc.currency} • {doc.status}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>

              {/* FI Document Card — deep-link to document detail (div + onClick to avoid nested <a> with vendor Link) */}
              <Card
                {...(fiDoc &&
                  fiDoc.bukrs &&
                  fiDoc.belnr &&
                  fiDoc.gjahr && {
                    component: 'div',
                    role: 'button',
                    tabIndex: 0,
                    onClick: () =>
                      navigate(`${SYNAPSE_ROUTES.DOCUMENTS}/${fiDoc.bukrs}/${fiDoc.belnr}/${fiDoc.gjahr}`),
                    onKeyDown: (e: React.KeyboardEvent) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`${SYNAPSE_ROUTES.DOCUMENTS}/${fiDoc.bukrs}/${fiDoc.belnr}/${fiDoc.gjahr}`);
                      }
                    },
                    sx: {
                      cursor: 'pointer',
                      '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                      transition: 'background-color 0.2s',
                    },
                  })}
              >
                <CardHeader
                  title={
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                      <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>
                        {t('caseDetail.fiDocument')}
                      </Typography>
                      <Chip label="KR" size="small" variant="outlined" />
                    </Stack>
                  }
                  sx={{ pb: 1, px: 2, pt: 2 }}
                />
                <CardContent sx={{ px: 2, pt: 0, pb: 2 }}>
                  <Stack spacing={1.5}>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                        gap: 1,
                      }}
                    >
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          {t('caseDetail.docNumber')}
                        </Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 500 }}>
                          {fiDoc?.belnr || 'N/A'}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          {t('caseDetail.date')}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {fiDoc?.budat || 'N/A'}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          {t('caseDetail.amount')}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {fiDoc?.wrbtr?.toLocaleString() || '0'} {fiDoc?.waers || 'USD'}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          {t('caseDetail.vendor')}
                        </Typography>
                        {(() => {
                          const display =
                            fiDoc?.counterpartyDisplay ??
                            (fiDoc as { counterpartyId?: string })?.counterpartyId;
                          const entityId = fiDoc?.counterpartyId;
                          return entityId ? (
                            <Typography
                              component={Link}
                              to={`${SYNAPSE_ROUTES.ENTITIES}/${entityId}`}
                              variant="body2"
                              onClick={(e) => e.stopPropagation()}
                              sx={{
                                fontWeight: 500,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                color: 'primary.main',
                                '&:hover': { textDecoration: 'underline' },
                              }}
                            >
                              {display || t('caseDetail.viewEntity')}
                            </Typography>
                          ) : (
                            <Typography variant="body2" sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {display || 'N/A'}
                            </Typography>
                          );
                        })()}
                      </Box>
                    </Box>
                    <Divider />
                    <CaseLineItemsCard items={fiDocItems} lineCount={lineCount} targetBuzei={targetBuzei} />
                  </Stack>
                </CardContent>
              </Card>

              {/* Open Items Summary — deep-link with related filter (caseId, bukrs/belnr/gjahr) */}
              <Card
                component={Link}
                to={(() => {
                  const params = new URLSearchParams();
                  params.set('related', 'true');
                  params.set('caseId', caseData.id);
                  if (fiDoc?.bukrs) params.set('bukrs', fiDoc.bukrs);
                  if (fiDoc?.belnr) params.set('belnr', fiDoc.belnr);
                  if (fiDoc?.gjahr) params.set('gjahr', fiDoc.gjahr);
                  return `${SYNAPSE_ROUTES.OPEN_ITEMS}?${params.toString()}`;
                })()}
                sx={{
                  textDecoration: 'none',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                  transition: 'background-color 0.2s',
                }}
              >
                <CardHeader
                  title={
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                      <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>
                        {t('caseDetail.relatedOpenItems')}
                      </Typography>
                      <Iconify icon="solar:alt-arrow-right-bold-duotone" width={16} />
                    </Stack>
                  }
                  sx={{ pb: 1, px: 2, pt: 2 }}
                />
                <CardContent sx={{ px: 2, pt: 0, pb: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    {t('caseDetail.relatedOpenItemsDesc')}
                  </Typography>
                </CardContent>
              </Card>

              {/* Data Lineage Link — caseId + docKey 전달 */}
              <Card
                component={Link}
                to={(() => {
                  const params = new URLSearchParams();
                  params.set('caseId', caseData.id);
                  if (fiDoc?.bukrs && fiDoc?.belnr && fiDoc?.gjahr) {
                    params.set('docKey', `${fiDoc.bukrs}-${fiDoc.belnr}-${fiDoc.gjahr}`);
                  }
                  return `${SYNAPSE_ROUTES.LINEAGE}?${params.toString()}`;
                })()}
                sx={{
                  textDecoration: 'none',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                  transition: 'background-color 0.2s',
                }}
              >
                <CardContent sx={{ p: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Iconify icon="solar:history-bold-duotone" width={18} />
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {t('caseDetail.viewDataLineage')}
                      </Typography>
                    </Stack>
                    <Iconify icon="solar:alt-arrow-right-bold-duotone" width={18} />
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          </Box>
        </Box>

        {/* Center Panel - AI Analysis */}
        <Box
          sx={{
            flex: 1,
            flexShrink: { xs: 0, lg: 1 },
            minHeight: { xs: 320, lg: 0 },
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
            <Tabs
              value={centerTab}
              onChange={(_, v) => setCenterTab(v)}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              sx={{ minHeight: { xs: 40, lg: 48 } }}
            >
              <Tab
                icon={<Iconify icon="solar:brain-bold-duotone" width={18} />}
                iconPosition="start"
                label={t('caseDetail.aiAnalysis')}
                value="analysis"
              />
              <Tab
                icon={<Iconify icon="solar:play-circle-bold-duotone" width={18} />}
                iconPosition="start"
                label={t('caseDetail.agentStream')}
                value="agent-stream"
              />
              <Tab
                icon={<Iconify icon="solar:graph-up-bold-duotone" width={18} />}
                iconPosition="start"
                label={t('caseDetail.confidence')}
                value="confidence"
              />
              <Tab
                icon={<Iconify icon="solar:link-bold-duotone" width={18} />}
                iconPosition="start"
                label={t('caseDetail.similar')}
                value="similar"
              />
              <Tab
                icon={<Iconify icon="solar:shield-check-bold-duotone" width={18} />}
                iconPosition="start"
                label={t('caseDetail.rag')}
                value="policies"
              />
              <Tab
                icon={<Iconify icon="solar:shield-user-bold-duotone" width={18} />}
                iconPosition="start"
                label={t('caseDetail.actionProposals')}
                value="action-proposals"
              />
            </Tabs>
          </Box>

          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {centerTab === 'agent-stream' && id && (
              <CaseAgentStreamPanel
                caseId={id}
                events={[]}
                streamingText={stepProgress?.detail ?? ''}
                isThinking={streamStatus === 'connecting' || streamStatus === 'streaming'}
                isReconnecting={false}
                stepProgress={stepProgress}
                onStartAnalysis={handleStartAnalysis}
                onRetry={handleRetryStream}
                onCancel={cancel}
              />
            )}

            {centerTab === 'analysis' && (
              <CaseAnalysisTab
                caseId={id}
                runId={latestRunId}
                enabled={centerTab === 'analysis'}
                tabKey="analysis"
                fallbackConfidence={caseData?.confidence}
                fallbackTitle={caseData?.title}
                fallbackAnomalyType={caseData?.anomalyType}
                fallbackSeverity={caseData?.severity}
              />
            )}

            {centerTab === 'confidence' && (
              <CaseConfidenceTab
                caseId={id}
                enabled={centerTab === 'confidence'}
                tabKey="confidence"
              />
            )}

            {centerTab === 'similar' && (
              <CaseSimilarTab
                caseId={id}
                enabled={centerTab === 'similar'}
                tabKey="similar"
              />
            )}

            {centerTab === 'policies' && (
              <CaseRagEvidenceTab
                caseId={id}
                enabled={centerTab === 'policies'}
                tabKey="policies"
              />
            )}

            {centerTab === 'action-proposals' && (
              <CaseActionProposalsTab
                caseId={id}
                runId={latestRunId}
                enabled={centerTab === 'action-proposals'}
                tabKey="action-proposals"
              />
            )}
          </Box>
        </Box>

        {/* Right Panel - Actions & Audit — 모바일: flexShrink 방지로 시뮬레이션 모드 가시성 확보 */}
        <Box
          sx={{
            width: { xs: '100%', lg: 400 },
            flexShrink: 0,
            minHeight: { xs: 200, lg: 0 },
            borderLeft: { lg: 1 },
            borderTop: { xs: 1, lg: 0 },
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Simulation Mode Toggle */}
          <Box
            sx={{
              px: { xs: 1.5, sm: 2 },
              py: 1.5,
              borderBottom: 1,
              borderColor: 'divider',
              bgcolor: alpha(theme.palette.primary.main, 0.04),
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
              <Stack direction="row" spacing={1} alignItems="center">
                <Iconify icon="solar:play-bold-duotone" width={18} />
                <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>
                  {t('caseDetail.simulationMode')}
                </Typography>
              </Stack>
              <FormControlLabel
                control={
                  <Switch
                    checked={simulationMode}
                    onChange={(e) => setSimulationMode(e.target.checked)}
                    size="small"
                  />
                }
                label={simulationMode ? t('caseDetail.on') : t('caseDetail.off')}
                sx={{ m: 0 }}
              />
            </Stack>
          </Box>

          {/* Simulation Diff (API 연동, mock 제거) */}
          {simulationMode && (
            <CaseSimulationDiff
              result={simulationResult}
              isLoading={simulationLoading}
              onRunSimulation={runSimulation}
            />
          )}

          {/* Tab Switcher for Actions/Audit */}
          <Box
            sx={{
              px: { xs: 1.5, sm: 2 },
              py: 1,
              borderBottom: 1,
              borderColor: 'divider',
              bgcolor: alpha(theme.palette.primary.main, 0.04),
            }}
          >
            <Tabs
              value={rightPanelTab}
              onChange={(_, v) => setRightPanelTab(v)}
              sx={{ minHeight: 'auto' }}
            >
              <Tab
                icon={<Iconify icon="solar:bolt-bold-duotone" width={18} />}
                iconPosition="start"
                label={t('caseDetail.actions')}
                value="actions"
                sx={{ minHeight: 'auto', py: 0.5 }}
              />
              <Tab
                icon={<Iconify icon="solar:history-bold-duotone" width={18} />}
                iconPosition="start"
                label={t('caseDetail.auditStream')}
                value="audit"
                sx={{ minHeight: 'auto', py: 0.5 }}
              />
            </Tabs>
          </Box>

          {/* Actions Panel */}
          {rightPanelTab === 'actions' && (
            <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 1.5, sm: 2 } }}>
              <Stack spacing={2}>
                {/* Primary CTA Stack */}
                <Stack spacing={1}>
                  <Button
                    variant="contained"
                    fullWidth
                    disabled={isStatusMutating}
                    startIcon={isStatusMutating ? <CircularProgress size={16} color="inherit" /> : <Iconify icon="solar:check-circle-bold-duotone" width={20} />}
                    onClick={() => handleStatusChange('RESOLVED')}
                  >
                    {t('caseDetail.approveAction')}
                  </Button>
                  <Button
                    variant="outlined"
                    fullWidth
                    disabled={isStatusMutating}
                    startIcon={<Iconify icon="solar:close-circle-bold-duotone" width={20} />}
                    onClick={() => handleStatusChange('DISMISSED')}
                  >
                    {t('caseDetail.reject')}
                  </Button>
                  <Button
                    variant="outlined"
                    fullWidth
                    disabled={isStatusMutating}
                    startIcon={<Iconify icon="solar:info-circle-bold-duotone" width={20} />}
                    onClick={() => handleStatusChange('TRIAGED')}
                  >
                    {t('caseDetail.requestInfo')}
                  </Button>
                  <Tooltip title={t('caseDetail.comingInPhaseB')}>
                    <span>
                      <Button
                        variant="outlined"
                        fullWidth
                        disabled
                        startIcon={<Iconify icon="solar:forbidden-circle-bold-duotone" width={20} />}
                      >
                        {t('caseDetail.setPaymentBlock')}
                      </Button>
                    </span>
                  </Tooltip>
                  <Tooltip title={t('caseDetail.comingInPhaseB')}>
                    <span>
                      <Button
                        variant="outlined"
                        fullWidth
                        disabled
                        startIcon={<Iconify icon="solar:refresh-bold-duotone" width={20} />}
                      >
                        {t('caseDetail.postReversal')}
                      </Button>
                    </span>
                  </Tooltip>
                </Stack>

                <Divider />

                {/* Go to Action Center */}
                <Button
                  variant="outlined"
                  fullWidth
                  component={Link}
                  to={`${SYNAPSE_ROUTES.ACTIONS}?caseId=${caseData.id}`}
                  endIcon={<Iconify icon="solar:alt-arrow-right-bold-duotone" width={20} />}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Iconify icon="solar:bolt-bold-duotone" width={20} />
                    <Typography>{t('caseDetail.goToActionCenter')}</Typography>
                  </Stack>
                </Button>

                <Divider />

                {/* Action Proposals (권고 조치) — proposal 단위 승인/거절 */}
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 500, mb: 1.5 }}>
                    {t('caseDetail.pendingActions')} ({relatedActions.filter((a) => a.status === 'pending').length})
                  </Typography>
                  <Stack spacing={1}>
                    {relatedActions.map((action) => {
                      const isPending = (action as { status: string }).status === 'pending';
                      const isActionApproving = approveActionMutation.isPending && approveActionMutation.variables === action.id;
                      const isActionRejecting = rejectActionMutation.isPending && rejectActionMutation.variables === action.id;
                      return (
                        <Card key={action.id} sx={{ bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
                          <CardContent sx={{ p: 1.5 }}>
                            <Stack spacing={1}>
                              <Stack direction="row" spacing={1} alignItems="flex-start" justifyContent="space-between">
                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 500, textTransform: 'capitalize' }}>
                                    {action.actionType.replace(/_/g, ' ')}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, display: 'block' }}>
                                    {action.description}
                                  </Typography>
                                </Box>
                                <StatusPill status={(action as { status: string }).status as Status} size="sm" />
                              </Stack>
                              <Stack direction="row" spacing={1} alignItems="center">
                                {action.riskLevel && (
                                  <SeverityBadge
                                    severity={action.riskLevel as 'critical' | 'high' | 'medium' | 'low'}
                                    size="sm"
                                    showIcon={false}
                                  />
                                )}
                                {action.targetSystem && (
                                  <Typography variant="caption" color="text.secondary">
                                    {action.targetSystem}
                                  </Typography>
                                )}
                              </Stack>
                              {isPending && (
                                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                                  <Button
                                    variant="contained"
                                    size="small"
                                    disabled={approveActionMutation.isPending || rejectActionMutation.isPending}
                                    startIcon={isActionApproving ? <CircularProgress size={12} color="inherit" /> : <Iconify icon="solar:check-circle-bold-duotone" width={14} />}
                                    onClick={() => approveActionMutation.mutate(action.id)}
                                  >
                                    {t('actions.buttons.approve')}
                                  </Button>
                                  <Button
                                    variant="outlined"
                                    size="small"
                                    disabled={approveActionMutation.isPending || rejectActionMutation.isPending}
                                    startIcon={isActionRejecting ? <CircularProgress size={12} color="inherit" /> : <Iconify icon="solar:close-circle-bold-duotone" width={14} />}
                                    onClick={() => rejectActionMutation.mutate(action.id)}
                                  >
                                    {t('actions.buttons.reject')}
                                  </Button>
                                </Stack>
                              )}
                            </Stack>
                          </CardContent>
                        </Card>
                      );
                    })}
                    {relatedActions.length === 0 && (
                      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                        {t('caseDetail.noActionsPhaseB')}
                      </Typography>
                    )}
                  </Stack>
                </Box>
              </Stack>
            </Box>
          )}

          {/* Audit Stream Panel — Option 2: Timeline (최근 N건) + 전체 감사 로그 보기 링크 */}
          {rightPanelTab === 'audit' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 1.5, sm: 2 } }}>
                <Stack spacing={2}>
                  {caseAuditEvents
                    .map((e, i) => ({
                      type: 'event' as const,
                      author: e.actor,
                      content: e.description,
                      createdAt: e.timestamp,
                      key: i,
                    }))
                    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
                    .map((item) => (
                      <Stack key={item.key} direction="row" spacing={1.5}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: 'action.hover' }}>
                          <Iconify icon="solar:clock-circle-bold-duotone" width={16} />
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.25 }}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {item.author}
                            </Typography>
                            <Chip label={t('caseDetail.system')} size="small" variant="outlined" />
                          </Stack>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            {new Date(item.createdAt ?? '').toLocaleString()}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {item.content}
                          </Typography>
                        </Box>
                      </Stack>
                    ))}
                </Stack>
              </Box>

              {/* 전체 감사 로그 보기 링크 */}
              <Box sx={{ p: { xs: 1.5, sm: 2 }, borderTop: 1, borderColor: 'divider' }}>
                <Button
                  component={Link}
                  to={
                    id
                      ? buildAuditUrl({
                          resourceId: id,
                          range: '24h',
                          eventCategory: 'CASE',
                          resourceType: 'AGENT_CASE',
                        })
                      : SYNAPSE_ROUTES.AUDIT
                  }
                  size="small"
                  fullWidth
                  endIcon={<Iconify icon="solar:alt-arrow-right-bold-duotone" width={16} />}
                  sx={{ textTransform: 'none' }}
                >
                  {t('caseDetail.viewFullAuditLog')}
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      {/* Debug Drawer (DEV only) */}
      {IS_DEV && (
        <CaseTabsDebugDrawer
          open={debugDrawerOpen}
          onClose={() => setDebugDrawerOpen(false)}
          caseId={id}
        />
      )}

      {/* HITL Approval Drawer */}
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
