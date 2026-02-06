import { useState } from 'react';
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
import { RagCitationList } from '../components/evidence';
import { useCaseHitl } from './cases/hooks/use-case-hitl';
import { CaseHitlDrawer } from './cases/components/case-hitl-drawer';
import { SeverityBadge } from '../components/finance/severity-badge';
import { useCaseSimulation } from './cases/hooks/use-case-simulation';
import { ConfidenceRing } from '../components/finance/confidence-meter';
import { StatusPill, type Status } from '../components/finance/status-pill';
import { CaseSimulationDiff } from './cases/components/case-simulation-diff';
import { useCaseDetail, type AuditEvent } from './cases/hooks/use-case-detail';
import { CaseAgentStreamPanel } from './cases/components/case-agent-stream-panel';

import type { RagCitation } from '../components/evidence';
import type { HitlStatus } from './cases/hooks/use-case-hitl';

// ----------------------------------------------------------------------

// Extended mock comments with types
interface Comment {
  id: string;
  caseId: string;
  author: string;
  authorType: 'user' | 'system' | 'ai';
  content: string;
  createdAt: string;
}

const extendedComments: Comment[] = [
  {
    id: 'cmt-001',
    caseId: 'case-001',
    author: 'John Smith',
    authorType: 'user',
    content: 'Reviewing vendor history before approval',
    createdAt: '2026-01-28T15:30:00Z',
  },
  {
    id: 'cmt-sys-001',
    caseId: 'case-001',
    author: 'System',
    authorType: 'system',
    content: 'Case escalated to Senior Analyst level',
    createdAt: '2026-01-28T16:00:00Z',
  },
  {
    id: 'cmt-sys-002',
    caseId: 'case-001',
    author: 'AI Agent',
    authorType: 'ai',
    content: 'Simulation completed. Reversal action ready for approval.',
    createdAt: '2026-01-28T16:15:00Z',
  },
];

// Mock confidence factors
interface ConfidenceFactor {
  id: string;
  label: string;
  score: number;
  weight: number;
  description: string;
  icon: 'amount' | 'history' | 'policy' | 'timing' | 'pattern';
}

const mockConfidenceFactors: ConfidenceFactor[] = [
  {
    id: 'cf-1',
    label: 'Amount Match',
    score: 95,
    weight: 30,
    description: 'Invoice amount matches previous payment within tolerance',
    icon: 'amount',
  },
  {
    id: 'cf-2',
    label: 'Vendor History',
    score: 20,
    weight: 20,
    description: 'Vendor has limited transaction history for pattern analysis',
    icon: 'history',
  },
  {
    id: 'cf-3',
    label: 'Policy Violation',
    score: 100,
    weight: 25,
    description: 'Clear violation of duplicate invoice policy detected',
    icon: 'policy',
  },
  {
    id: 'cf-4',
    label: 'Timing Pattern',
    score: 85,
    weight: 15,
    description: 'Invoice submitted within 30-day window of similar payment',
    icon: 'timing',
  },
  {
    id: 'cf-5',
    label: 'Data Pattern',
    score: 92,
    weight: 10,
    description: 'Reference number pattern matches previous invoice',
    icon: 'pattern',
  },
];

// Mock SAP field changes for simulation
interface FieldChange {
  id: string;
  field: string;
  table: string;
  system: string;
  currentValue: string;
  newValue: string;
  changeType: 'update' | 'create' | 'delete';
  riskLevel: 'safe' | 'warning' | 'critical';
}

const mockFieldChanges: FieldChange[] = [
  {
    id: 'fc-1',
    field: 'Payment Block',
    table: 'BSEG',
    system: 'SAP FI',
    currentValue: 'None',
    newValue: 'A - Locked for Payment',
    changeType: 'update',
    riskLevel: 'safe',
  },
  {
    id: 'fc-2',
    field: 'Document Status',
    table: 'BKPF',
    system: 'SAP FI',
    currentValue: 'Posted',
    newValue: 'Blocked',
    changeType: 'update',
    riskLevel: 'warning',
  },
  {
    id: 'fc-3',
    field: 'Clearing Document',
    table: 'BSAK',
    system: 'SAP FI',
    currentValue: '',
    newValue: '4900001234',
    changeType: 'create',
    riskLevel: 'safe',
  },
  {
    id: 'fc-4',
    field: 'Vendor Balance',
    table: 'LFC1',
    system: 'SAP FI',
    currentValue: '$125,000.00',
    newValue: '$0.00',
    changeType: 'update',
    riskLevel: 'warning',
  },
];

// Mock document relationship
interface DocumentRelationship {
  id: string;
  type: 'original' | 'reversal';
  number: string;
  date: string;
  amount: number;
  currency: string;
  status: 'posted' | 'pending';
}

const mockDocumentRelationship: DocumentRelationship[] = [
  {
    id: 'DOC-1001',
    type: 'original',
    number: '1900001234',
    date: '2026-01-10',
    amount: 125000,
    currency: 'USD',
    status: 'posted',
  },
  {
    id: 'DOC-2001',
    type: 'reversal',
    number: '1900001235',
    date: '2026-01-28',
    amount: 125000,
    currency: 'USD',
    status: 'pending',
  },
];

// RAG citations from API reasoning.ragRefsJson or empty
const emptyRagCitations: RagCitation[] = [];

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
  const caseComments = extendedComments.filter((c) => c.caseId === (caseData?.id ?? ''));
  const caseAuditEvents = auditEvents;
  const ragCitations = emptyRagCitations;

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

  const similarCases: Array<{
    id: string;
    caseNumber: string;
    title: string;
    similarity: number;
    status: Status;
    severity?: string;
    counterparty?: string;
    currency?: string;
    amount?: number;
  }> = [];

  // Fallback mock simulation for UI when API not yet returns (backward compat)
  const mockSimulationResult = {
    before: { vendorBalance: 125000, glBalance: 450000, openItems: 5 },
    after: { vendorBalance: 0, glBalance: 325000, openItems: 4 },
    outcome: 'success' as const,
    message: 'Reversal will successfully clear the duplicate payment and restore correct balances.',
  };

  const displaySimulationAfter = (simulationResult ?? mockSimulationResult).after as {
    vendorBalance?: number;
    glBalance?: number;
    openItems?: number;
  };

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

  // Helper to get icon for confidence factor
  const getConfidenceFactorIcon = (icon: ConfidenceFactor['icon']) => {
    const iconMap: Record<ConfidenceFactor['icon'], string> = {
      amount: 'solar:dollar-minimalistic-bold-duotone',
      history: 'solar:history-bold-duotone',
      policy: 'solar:shield-check-bold-duotone',
      timing: 'solar:clock-circle-bold-duotone',
      pattern: 'solar:graph-up-bold-duotone',
    };
    return iconMap[icon] || 'solar:info-circle-bold-duotone';
  };

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
                {mockDocumentRelationship.map((doc) => (
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

              {/* Open Items Summary — deep-link to open-items filtered by case */}
              <Card
                component={Link}
                to={`${SYNAPSE_ROUTES.OPEN_ITEMS}?caseId=${caseData.id}`}
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
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 1 }}>
                    <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                      <Typography variant="caption" color="text.secondary">
                        {t('caseDetail.receivables')}
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        3
                      </Typography>
                    </Box>
                    <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                      <Typography variant="caption" color="text.secondary">
                        {t('caseDetail.payables')}
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        2
                      </Typography>
                    </Box>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {t('caseDetail.totalOldest', { total: '$245,000', days: 45 })}
                  </Typography>
                </CardContent>
              </Card>

              {/* Data Lineage Link */}
              <Card
                component={Link}
                to={`${SYNAPSE_ROUTES.LINEAGE}?caseId=${caseData.id}`}
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
              <Box sx={{ p: 2 }}>
                <Stack spacing={2}>
                  {/* Anomaly Score */}
                  <Card
                    sx={{
                      bgcolor: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
                      border: 1,
                      borderColor: alpha(theme.palette.primary.main, 0.2),
                    }}
                  >
                    <CardContent sx={{ p: 2 }}>
                      <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                        <Box>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                            {t('caseDetail.anomalyConfidenceScore')}
                          </Typography>
                          <Typography variant="h3" sx={{ fontWeight: 700, color: 'primary.main' }}>
                            {caseData.confidence}%
                          </Typography>
                        </Box>
                        <ConfidenceRing value={caseData.confidence} size={80} />
                      </Stack>
                      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                        <Chip
                          label={caseData.anomalyType.replace(/_/g, ' ')}
                          size="small"
                          variant="outlined"
                          sx={{ textTransform: 'capitalize' }}
                        />
                        <Chip label={t('caseDetail.severityLabel', { severity: caseData.severity })} size="small" variant="outlined" />
                      </Stack>
                    </CardContent>
                  </Card>

                  {/* AI Reasoning */}
                  <Card sx={{ bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
                    <CardHeader
                      title={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Iconify icon="solar:brain-bold-duotone" width={18} />
                          <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>
                            {t('caseDetail.aiReasoning')}
                          </Typography>
                        </Stack>
                      }
                      sx={{ pb: 1, px: 2, pt: 2 }}
                    />
                    <CardContent sx={{ px: 2, pt: 0, pb: 2 }}>
                      <Typography variant="body2" sx={{ mb: 2, lineHeight: 1.75 }}>
                        {caseData.title}
                      </Typography>
                      <Divider sx={{ my: 1.5 }} />
                      <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.secondary', mb: 1, display: 'block' }}>
                        {t('caseDetail.keyFactors')}
                      </Typography>
                      <Stack spacing={1}>
                        <Stack direction="row" spacing={1} alignItems="flex-start">
                          <Iconify icon="solar:check-circle-bold-duotone" width={16} sx={{ color: 'primary.main', mt: 0.25 }} />
                          <Typography variant="caption">
                            Amount matches previous payment within 30-day window
                          </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="flex-start">
                          <Iconify icon="solar:check-circle-bold-duotone" width={16} sx={{ color: 'primary.main', mt: 0.25 }} />
                          <Typography variant="caption">
                            Same vendor and invoice reference pattern detected
                          </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="flex-start">
                          <Iconify icon="solar:danger-triangle-bold-duotone" width={16} sx={{ color: 'warning.main', mt: 0.25 }} />
                          <Typography variant="caption">
                            Vendor bank account changed 48 hours prior
                          </Typography>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                </Stack>
              </Box>
            )}

            {centerTab === 'confidence' && (
              <Box sx={{ p: 2 }}>
                <Stack spacing={2}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {t('caseDetail.confidenceBreakdown')}
                  </Typography>
                  {mockConfidenceFactors.map((factor) => (
                    <Card key={factor.id}>
                      <CardContent sx={{ p: 2 }}>
                        <Stack spacing={1.5}>
                          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Iconify icon={getConfidenceFactorIcon(factor.icon)} width={20} />
                              <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>
                                {factor.label}
                              </Typography>
                            </Stack>
                            <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                              {factor.score}%
                            </Typography>
                          </Stack>
                          <Box sx={{ position: 'relative', height: 8, borderRadius: 1, bgcolor: 'action.hover', overflow: 'hidden' }}>
                            <Box
                              sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                height: '100%',
                                width: `${factor.score}%`,
                                bgcolor: factor.score >= 90 ? 'success.main' : factor.score >= 70 ? 'warning.main' : 'error.main',
                              }}
                            />
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {t('caseDetail.weight')}: {factor.weight}% • {factor.description}
                          </Typography>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              </Box>
            )}

            {centerTab === 'similar' && (
              <Box sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {t('caseDetail.similarCasesDesc')}
                </Typography>
                <Stack spacing={1.5}>
                  {similarCases.map((c) => (
                    <Card
                      key={c.id}
                      component={Link}
                      to={`/cases/${c.id}`}
                      sx={{
                        textDecoration: 'none',
                        cursor: 'pointer',
                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                        transition: 'background-color 0.2s',
                      }}
                    >
                      <CardContent sx={{ p: 2 }}>
                        <Stack direction="row" spacing={2} alignItems="flex-start" justifyContent="space-between">
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                              <Typography variant="body2" sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {c.title}
                              </Typography>
                              {c.severity && (
                                <SeverityBadge
                                  severity={c.severity as 'critical' | 'high' | 'medium' | 'low'}
                                  size="sm"
                                />
                              )}
                            </Stack>
                            <Typography variant="caption" color="text.secondary">
                              {c.caseNumber}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                              {[c.counterparty, c.currency, c.amount != null ? c.amount.toLocaleString() : null]
                                .filter(Boolean)
                                .join(' | ') || '—'}
                            </Typography>
                          </Box>
                          <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                            <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                              {c.similarity}%
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {t('caseDetail.similarLabel')}
                            </Typography>
                            <Box sx={{ mt: 0.5 }}>
                              <StatusPill status={c.status as Status} size="sm" />
                            </Box>
                          </Box>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                  {similarCases.length === 0 && (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Iconify icon="solar:link-bold-duotone" width={32} sx={{ opacity: 0.5, mb: 1 }} />
                      <Typography variant="body2" color="text.secondary">
                        {t('caseDetail.noSimilarCases')}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </Box>
            )}

            {centerTab === 'policies' && (
              <Box sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {t('caseDetail.policyClickHint')}
                </Typography>
                <RagCitationList
                  citations={ragCitations}
                  title=""
                  maxItems={0}
                  onOpenSource={(source) => {
                     
                    console.log('Open policy source:', source);
                  }}
                />
              </Box>
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

          {/* Simulation Diff (API 연동) */}
          {simulationMode && (
            <CaseSimulationDiff
              result={simulationResult}
              isLoading={simulationLoading}
              onRunSimulation={runSimulation}
            />
          )}

          {/* Simulation Preview (mock fallback - API 미연동 시) */}
          {simulationMode && !simulationResult && (
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Stack spacing={1.5}>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                  <Card>
                    <CardContent sx={{ p: 1.5 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                        {t('caseDetail.beforeMock')}
                      </Typography>
                      <Stack spacing={0.5}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="caption" color="text.secondary">
                            {t('caseDetail.vendorBal')}
                          </Typography>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                            ${mockSimulationResult.before.vendorBalance.toLocaleString()}
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="caption" color="text.secondary">
                            {t('caseDetail.glBalance')}
                          </Typography>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                            ${mockSimulationResult.before.glBalance.toLocaleString()}
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="caption" color="text.secondary">
                            {t('caseDetail.openItems')}
                          </Typography>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                            {mockSimulationResult.before.openItems}
                          </Typography>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent sx={{ p: 1.5 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                        {t('caseDetail.after')}
                      </Typography>
                      <Stack spacing={0.5}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="caption" color="text.secondary">
                            {t('caseDetail.vendorBal')}
                          </Typography>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'success.main' }}>
                            ${(displaySimulationAfter.vendorBalance ?? 0).toLocaleString()}
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="caption" color="text.secondary">
                            {t('caseDetail.glBalance')}
                          </Typography>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                            ${(displaySimulationAfter.glBalance ?? 0).toLocaleString()}
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="caption" color="text.secondary">
                            {t('caseDetail.openItems')}
                          </Typography>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                            {displaySimulationAfter.openItems ?? 0}
                          </Typography>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                </Box>

                {/* Field Change Highlights */}
                <Card>
                  <CardContent sx={{ p: 1.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 500, mb: 1, display: 'block' }}>
                      {t('caseDetail.fieldChanges')}
                    </Typography>
                    <Stack spacing={1}>
                      {mockFieldChanges.map((change) => (
                        <Box
                          key={change.id}
                          sx={{
                            p: 1,
                            borderRadius: 0.5,
                            bgcolor: alpha(
                              change.riskLevel === 'safe'
                                ? theme.palette.success.main
                                : change.riskLevel === 'warning'
                                  ? theme.palette.warning.main
                                  : theme.palette.error.main,
                              0.08,
                            ),
                            border: 1,
                            borderColor: alpha(
                              change.riskLevel === 'safe'
                                ? theme.palette.success.main
                                : change.riskLevel === 'warning'
                                  ? theme.palette.warning.main
                                  : theme.palette.error.main,
                              0.2,
                            ),
                          }}
                        >
                          <Typography variant="caption" sx={{ fontWeight: 500 }}>
                            {change.field}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {change.currentValue} → {change.newValue}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>

                {/* Result */}
                <Box
                  sx={{
                    p: 1,
                    borderRadius: 1,
                    bgcolor: alpha(theme.palette.success.main, 0.1),
                    color: 'success.main',
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Iconify icon="solar:check-circle-bold-duotone" width={18} />
                    <Typography variant="caption">{mockSimulationResult.message}</Typography>
                  </Stack>
                </Box>
              </Stack>
            </Box>
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
                  {[...caseComments.map((c) => ({ ...c, type: 'comment' as const })),
                    ...(caseAuditEvents as AuditEvent[]).slice(0, 5).map((e) => ({
                      ...e,
                      type: 'event' as const,
                      author: e.actor,
                      content: e.description,
                      createdAt: e.timestamp,
                    }))]
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
