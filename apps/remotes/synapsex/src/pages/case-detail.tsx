import { useMemo, useState } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { Link, useParams, useLocation, useNavigate } from 'react-router-dom';
import { is403Error, buildAuditUrl, useSynapseAgentStream } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import IconButton from '@mui/material/IconButton';
import CardContent from '@mui/material/CardContent';
import { alpha, useTheme } from '@mui/material/styles';
import FormControlLabel from '@mui/material/FormControlLabel';

import { SYNAPSE_ROUTES } from '../routes';
import { ErrorStateWithRetry } from '../components/ux';
import { useCaseHitl } from './cases/hooks/use-case-hitl';
import { CaseHitlDrawer } from './cases/components/case-hitl-drawer';
import { SeverityBadge } from '../components/finance/severity-badge';
import { CaseSimilarTab } from './cases/components/case-similar-tab';
import { useCaseSimulation } from './cases/hooks/use-case-simulation';
import { CaseAnalysisTab } from './cases/components/case-analysis-tab';
import { ConfidenceRing } from '../components/finance/confidence-meter';
import { CaseConfidenceTab } from './cases/components/case-confidence-tab';
import { StatusPill, type Status } from '../components/finance/status-pill';
import { CaseSimulationDiff } from './cases/components/case-simulation-diff';
import { CaseRagEvidenceTab } from './cases/components/case-rag-evidence-tab';
import { useCaseDetail, type AuditEvent } from './cases/hooks/use-case-detail';
import { CaseAgentStreamPanel } from './cases/components/case-agent-stream-panel';

import type { HitlStatus } from './cases/hooks/use-case-hitl';

// ----------------------------------------------------------------------
// @see docs/job/PROMPT_B_Frontend_MenuByMenu_Cases_First.txt
// @see docs/job/PROMPT_B_Frontend_Cases_TabsBind_P1_v2.txt
// ----------------------------------------------------------------------

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

  const { caseData, evidence, fiDoc, fiDocItems, relatedActions, auditEvents, isLoading, error, refetch } = useCaseDetail(id);

  const caseAuditEvents = auditEvents;

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

  const [newComment, setNewComment] = useState('');
  const [simulationMode, setSimulationMode] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<'actions' | 'audit'>('actions');
  const [centerTab, setCenterTab] = useState('analysis');

  // HITL state
  const [hitlOpen, setHitlOpen] = useState(false);
  const [hitlRequestId, setHitlRequestId] = useState<string | null>(null);
  const [hitlDescription, setHitlDescription] = useState<string | undefined>();
  const [hitlStatus, setHitlStatus] = useState<HitlStatus>('pending_approval');

  // Agent Stream
  const {
    startStream,
    cancel,
    events: streamEvents,
    streamingText,
    isThinking,
    isReconnecting,
  } = useSynapseAgentStream();

  const handleStartAnalysis = () => {
    if (id) startStream(id, {
      onHitlRequest: (requestId, payload) => {
        setHitlRequestId(requestId);
        setHitlDescription(payload?.message ?? (payload?.context ? JSON.stringify(payload.context) : undefined));
        setHitlStatus('pending_approval');
        setHitlOpen(true);
      },
    });
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
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 3.5rem)' }}>
      {/* Case Header */}
      <Box
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          px: { xs: 2, sm: 3 },
          py: 2,
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
          <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ minWidth: 0, flex: 1 }}>
            <IconButton
              onClick={() => navigate(SYNAPSE_ROUTES.CASES)}
              sx={{ flexShrink: 0, bgcolor: 'transparent' }}
            >
              <Iconify icon="solar:arrow-left-bold-duotone" width={20} />
            </IconButton>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mb: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, flex: 1, minWidth: 0 }}>
                  {caseData.title}
                </Typography>
                <SeverityBadge severity={caseData.severity} />
                <StatusPill status={caseData.status as Status} />
              </Stack>
              <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ gap: 1 }}>
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
              </Stack>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
            <ConfidenceRing value={caseData.confidence} size={48} />
            <Tooltip title={t('caseDetail.copyCaseId')}>
              <IconButton size="small" sx={{ bgcolor: 'transparent' }}>
                <Iconify icon="solar:copy-bold-duotone" width={16} />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('caseDetail.openInSap')}>
              <IconButton size="small" sx={{ bgcolor: 'transparent' }}>
                <Iconify icon="solar:external-link-bold-duotone" width={16} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Box>

      {/* 3-Panel Layout */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', flexDirection: { xs: 'column', lg: 'row' } }}>
        {/* Left Panel - Source Evidence */}
        <Box
          sx={{
            width: { xs: '100%', lg: 360 },
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
              px: 2,
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
          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
            <Stack spacing={2}>
              {/* Document Relationship Graph - Placeholder */}
              <Card>
                <CardContent>
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

              {/* FI Document Card — deep-link to document detail */}
              <Card
                {...(fiDoc &&
                  fiDoc.bukrs &&
                  fiDoc.belnr &&
                  fiDoc.gjahr && {
                    component: Link,
                    to: `${SYNAPSE_ROUTES.DOCUMENTS}/${fiDoc.bukrs}/${fiDoc.belnr}/${fiDoc.gjahr}`,
                    sx: {
                      textDecoration: 'none',
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
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
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
                          const doc = evidence?.documentOrOpenItem as { partyId?: string | number; counterpartyId?: string } | undefined;
                          const partyId = doc?.partyId != null ? String(doc.partyId) : null;
                          return partyId ? (
                            <Typography
                              component={Link}
                              to={`${SYNAPSE_ROUTES.ENTITIES}/${partyId}`}
                              variant="body2"
                              sx={{
                                fontWeight: 500,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                color: 'primary.main',
                                '&:hover': { textDecoration: 'underline' },
                              }}
                            >
                              {doc?.counterpartyId || t('caseDetail.viewEntity')}
                            </Typography>
                          ) : (
                            <Typography variant="body2" sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {(fiDoc as { counterpartyId?: string })?.counterpartyId || 'N/A'}
                            </Typography>
                          );
                        })()}
                      </Box>
                    </Box>
                    <Divider />
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                        {t('caseDetail.lineItems')} ({fiDocItems.length})
                      </Typography>
                      <Stack spacing={0.5}>
                        {fiDocItems.slice(0, 2).map((item) => (
                          <Box
                            key={item.id}
                            sx={{
                              p: 0.75,
                              borderRadius: 0.5,
                              bgcolor: alpha(theme.palette.primary.main, 0.04),
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                              {item.hkont ?? '—'}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{
                                fontWeight: 500,
                                color: item.shkzg === 'S' ? 'error.main' : 'success.main',
                              }}
                            >
                              {item.shkzg === 'S' ? '-' : '+'}
                              {(item.wrbtr ?? 0).toLocaleString()}
                            </Typography>
                          </Box>
                        ))}
                        {fiDocItems.length > 2 && (
                          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                            {t('caseDetail.moreItems', { count: fiDocItems.length - 2 })}
                          </Typography>
                        )}
                      </Stack>
                    </Box>
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
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
            <Tabs value={centerTab} onChange={(_, v) => setCenterTab(v)}>
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
            </Tabs>
          </Box>

          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {centerTab === 'agent-stream' && id && (
              <CaseAgentStreamPanel
                caseId={id}
                events={streamEvents}
                streamingText={streamingText}
                isThinking={isThinking}
                isReconnecting={isReconnecting}
                onStartAnalysis={handleStartAnalysis}
                onRetry={handleRetryStream}
                onCancel={cancel}
              />
            )}

            {centerTab === 'analysis' && (
              <CaseAnalysisTab
                caseId={id}
                enabled={centerTab === 'analysis'}
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
              />
            )}

            {centerTab === 'similar' && (
              <CaseSimilarTab
                caseId={id}
                enabled={centerTab === 'similar'}
              />
            )}

            {centerTab === 'policies' && (
              <CaseRagEvidenceTab
                caseId={id}
                enabled={centerTab === 'policies'}
              />
            )}
          </Box>
        </Box>

        {/* Right Panel - Actions & Audit */}
        <Box
          sx={{
            width: { xs: '100%', lg: 400 },
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
              px: 2,
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
              px: 2,
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
            <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
              <Stack spacing={2}>
                {/* Primary CTA Stack */}
                <Stack spacing={1}>
                  <Button variant="contained" fullWidth startIcon={<Iconify icon="solar:check-circle-bold-duotone" width={20} />}>
                    {t('caseDetail.approveAction')}
                  </Button>
                  <Button variant="outlined" fullWidth startIcon={<Iconify icon="solar:close-circle-bold-duotone" width={20} />}>
                    {t('caseDetail.reject')}
                  </Button>
                  <Button variant="outlined" fullWidth startIcon={<Iconify icon="solar:info-circle-bold-duotone" width={20} />}>
                    {t('caseDetail.requestInfo')}
                  </Button>
                  <Button variant="outlined" fullWidth startIcon={<Iconify icon="solar:forbidden-circle-bold-duotone" width={20} />}>
                    {t('caseDetail.setPaymentBlock')}
                  </Button>
                  <Button variant="outlined" fullWidth startIcon={<Iconify icon="solar:refresh-bold-duotone" width={20} />}>
                    {t('caseDetail.postReversal')}
                  </Button>
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

                {/* Pending Actions */}
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 500, mb: 1.5 }}>
                    {t('caseDetail.pendingActions')} ({relatedActions.filter((a) => a.status === 'pending').length})
                  </Typography>
                  <Stack spacing={1}>
                    {relatedActions.map((action) => (
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
                          </Stack>
                        </CardContent>
                      </Card>
                    ))}
                    {relatedActions.length === 0 && (
                      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                        {t('caseDetail.noActionsYet')}
                      </Typography>
                    )}
                  </Stack>
                </Box>
              </Stack>
            </Box>
          )}

          {/* Audit Stream Panel */}
          {rightPanelTab === 'audit' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
                <Button
                  component={Link}
                  to={id ? buildAuditUrl({ resourceId: id, range: '24h' }) : SYNAPSE_ROUTES.AUDIT}
                  size="small"
                  startIcon={<Iconify icon="solar:clipboard-list-bold-duotone" width={16} />}
                  sx={{ textTransform: 'none' }}
                >
                  {t('caseDetail.viewAudit')}
                </Button>
              </Box>
              <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                <Stack spacing={2}>
                  {(caseAuditEvents as AuditEvent[])
                    .slice(0, 5)
                    .map((e) => ({
                      ...e,
                      type: 'event' as const,
                      author: e.actor,
                      content: e.description,
                      createdAt: e.timestamp,
                    }))
                    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
                    .map((item, i) => (
                      <Stack key={i} direction="row" spacing={1.5}>
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            bgcolor:
                              item.type === 'event'
                                ? 'action.hover'
                                : 'authorType' in item && item.authorType === 'ai'
                                  ? alpha(theme.palette.primary.main, 0.2)
                                  : 'action.hover',
                          }}
                        >
                          {item.type === 'event' ? (
                            <Iconify icon="solar:clock-circle-bold-duotone" width={16} />
                          ) : 'authorType' in item && item.authorType === 'ai' ? (
                            <Iconify icon="solar:robot-bold-duotone" width={16} sx={{ color: 'primary.main' }} />
                          ) : (
                            <Iconify icon="solar:user-bold-duotone" width={16} />
                          )}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.25 }}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {item.author}
                            </Typography>
                            <Chip label={item.type === 'event' ? t('caseDetail.system') : t('caseDetail.comment')} size="small" variant="outlined" />
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

              {/* Comment Input */}
              <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
                <Stack direction="row" spacing={1}>
                  <TextField
                    placeholder={t('caseDetail.addAuditNote')}
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    size="small"
                    fullWidth
                  />
                  <IconButton size="small">
                    <Iconify icon="solar:paperclip-bold-duotone" width={20} />
                  </IconButton>
                  <IconButton size="small" color="primary">
                    <Iconify icon="solar:plain-2-bold-duotone" width={20} />
                  </IconButton>
                </Stack>
              </Box>
            </Box>
          )}
        </Box>
      </Box>

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
  );
};
