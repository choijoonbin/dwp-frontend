import { useMemo, useState } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { useEntityDetailQuery } from '@dwp-frontend/shared-utils';
import { Link, useParams, useLocation, useSearchParams } from 'react-router-dom';
import { formatDate , useTranslation, formatCurrency } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Tabs from '@mui/material/Tabs';
import Menu from '@mui/material/Menu';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import Checkbox from '@mui/material/Checkbox';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import DialogTitle from '@mui/material/DialogTitle';
import ListItemText from '@mui/material/ListItemText';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';

import { SYNAPSE_ROUTES } from '../routes';
import { PiiFieldDisplay } from '../components/pii';
import {
  mockCases,
  mockFiDocs,
  mockActions,
  mockEntities,
  mockOpenItems,
  mockEntityChangeLogs,
  type EntityChangeLog                          ,
 Entity } from '../data/mock-data';




























// ----------------------------------------------------------------------

/** BE Entity 360 API 응답: { base, exposureSummary, riskTrend, tabs } */
function toEntityFromApi(raw: Record<string, unknown> | null | undefined): Entity | null {
  if (!raw || typeof raw !== 'object') return null;

  const base = (raw.base as Record<string, unknown>) ?? raw;
  const exposureSummary = (raw.exposureSummary as Record<string, unknown>) ?? {};
  const tabs = (raw.tabs as Record<string, unknown>) ?? {};

  const partyId = base.partyId ?? base.id ?? raw.partyId ?? raw.id;
  if (partyId == null) return null;

  const typeStr = String(base.partyType ?? base.type ?? raw.partyType ?? raw.type ?? 'VENDOR').toUpperCase();
  const toNum = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  const linkedDocs = (tabs.linkedDocuments as Array<{ docKey?: string }>) ?? [];
  const linkedOis = (tabs.linkedOpenItems as Array<{ bukrs?: string; belnr?: string; gjahr?: string; buzei?: string }>) ?? [];
  const linkedCases = (tabs.linkedCases as Array<{ caseId?: string; id?: string }>) ?? [];

  const linkedDocIds = linkedDocs.map((d) => String(d.docKey ?? '')).filter(Boolean);
  const linkedOpenItemIds = linkedOis.map(
    (o) => `${o.bukrs ?? ''}-${o.belnr ?? ''}-${o.gjahr ?? ''}-${o.buzei ?? ''}`
  ).filter((s) => s !== '---');
  const linkedCaseIds = linkedCases.map((c) => String(c.caseId ?? c.id ?? '')).filter(Boolean);

  const totalOpen = toNum(exposureSummary.totalOpenAmount);
  const overdueTotal = toNum(exposureSummary.overdueAmount);

  return {
    address: base.address as string | undefined,
    bankAccount: base.bankAccount as string | undefined,
    bankName: base.bankName as string | undefined,
    code: String(base.partyCode ?? partyId),
    concentrationRisk: 'medium',
    contactEmail: base.contactEmail as string | undefined,
    contactName: base.contactName as string | undefined,
    contactPhone: base.contactPhone as string | undefined,
    country: String(base.country ?? ''),
    currency: String(base.currency ?? 'USD'),
    id: String(partyId),
    lastUpdated: String(base.lastChangeTs ?? base.lastChangedAt ?? ''),
    linkedCaseIds,
    linkedDocIds,
    linkedOpenItemIds,
    name: String(base.nameDisplay ?? base.name ?? ''),
    openItemsCount: linkedOis.length,
    openItemsTotal: totalOpen,
    overdueCount: 0,
    overdueTotal,
    paymentTerms: base.paymentTerms as string | undefined,
    recentAnomaliesCount: 0,
    riskScore: toNum(base.riskScore),
    riskTrend: 'stable',
    taxId: base.taxId as string | undefined,
    tenantId: toNum(base.tenantId) || 0,
    companyCode: String(base.companyCode ?? ''),
    type: typeStr === 'CUSTOMER' ? 'customer' : 'vendor',
  };
}

// ----------------------------------------------------------------------

// Risk Score Badge
const RiskScoreBadge = ({
  score,
  trend,
  size = 'default',
}: {
  score: number;
  trend: 'up' | 'down' | 'stable';
  size?: 'default' | 'large';
}) => {
  const getColor = (s: number): 'success' | 'info' | 'warning' | 'error' => {
    if (s >= 80) return 'error';
    if (s >= 60) return 'warning';
    if (s >= 40) return 'info';
    return 'success';
  };

  const trendIcon =
    trend === 'up' ? 'solar:arrow-up-bold' : trend === 'down' ? 'solar:arrow-down-bold' : 'solar:minus-bold';

  if (size === 'large') {
    return (
      <Chip
        icon={<Iconify icon={trendIcon} width={20} />}
        label={score}
        color={getColor(score)}
        variant="outlined"
        sx={{ fontSize: '1.5rem', fontWeight: 700, px: 1.5, py: 0.75 }}
      />
    );
  }

  return (
    <Chip
      icon={<Iconify icon={trendIcon} width={14} />}
      label={score}
      color={getColor(score)}
      variant="outlined"
      size="small"
      sx={{ fontSize: '0.75rem', fontWeight: 600 }}
    />
  );
};

// Change Log Timeline Item
const ChangeLogItem = ({ log, showMasked }: { log: EntityChangeLog; showMasked: boolean }) => {
  const getSeverityColor = (severity: string): 'error' | 'warning' | 'default' => {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'warn':
        return 'warning';
      default:
        return 'default';
    }
  };

  const formatValue = (value: string) => {
    if (!showMasked && (log.fieldName === 'bankAccount' || log.fieldName === 'taxId')) {
      return '****';
    }
    return value;
  };

  return (
    <Stack direction="row" spacing={2} sx={{ pb: 3, '&:last-child': { pb: 0 } }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Box
          sx={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            bgcolor: `${getSeverityColor(log.severity)}.main`,
          }}
        />
        <Box sx={{ width: 1, flex: 1, bgcolor: 'divider', mt: 1 }} />
      </Box>
      <Box sx={{ flex: 1, mt: -0.5 }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {log.fieldName}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.25 }}>
              {new Date(log.timestamp).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Typography>
          </Box>
          <Chip
            label={log.actorType === 'system' ? 'System' : log.actorType === 'agent' ? 'AI' : 'User'}
            variant="outlined"
            size="small"
            sx={{ fontSize: '0.75rem' }}
          />
        </Stack>
        <Box sx={{ mt: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="body2" sx={{ color: 'text.secondary', textDecoration: 'line-through' }}>
              {formatValue(log.beforeValue)}
            </Typography>
            <Iconify icon="solar:alt-arrow-right-linear" width={14} sx={{ color: 'text.secondary' }} />
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {formatValue(log.afterValue)}
            </Typography>
          </Stack>
          <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
            by {log.actor} via {log.source}
          </Typography>
        </Box>
      </Box>
    </Stack>
  );
};

// ----------------------------------------------------------------------

/** 거래처 상세 페이지 (Entity Profile) */
export const EntityDetailPage = () => {
  const { t } = useTranslation('common');
  const { pathname } = useLocation();
  const idFromParams = useParams<{ id: string }>().id;
  // pathname-to-page 렌더 시 Route :id 없음 → pathname에서 추출 (synapse/entities/2501, entities/2501 등)
  const idFromPath = pathname.match(/\/entities\/([^/?#]+)/)?.[1];
  const id = idFromParams ?? idFromPath ?? undefined;

  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'overview';

  const [activeTab, setActiveTab] = useState(initialTab === 'overview' ? 0 : initialTab === 'changelog' ? 1 : initialTab === 'related' ? 2 : 3);
  const [piiMasked, setPiiMasked] = useState(true);
  const [accessRequestOpen, setAccessRequestOpen] = useState(false);
  const [accessReason, setAccessReason] = useState('');
  const [accessPending, setAccessPending] = useState(false);
  const [changeLogFilterAnchor, setChangeLogFilterAnchor] = useState<null | HTMLElement>(null);
  const [changeLogFilter, setChangeLogFilter] = useState<string[]>([]);

  const { data: apiData, isLoading, error } = useEntityDetailQuery(id);
  const entityFromApi = useMemo(
    () => toEntityFromApi(apiData as Record<string, unknown> | undefined),
    [apiData]
  );
  const entityFromMock = mockEntities.find((e) => e.id === id);
  const entity = entityFromApi ?? entityFromMock ?? undefined;

  // Get related data
  const changeLogs = useMemo(() => {
    let logs = mockEntityChangeLogs.filter((log) => log.entityId === id);
    if (changeLogFilter.length > 0) {
      logs = logs.filter((log) => changeLogFilter.includes(log.severity));
    }
    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [id, changeLogFilter]);

  const relatedDocs = useMemo(() => {
    if (!entity) return [];
    return mockFiDocs.filter((doc) => entity.linkedDocIds.includes(doc.id));
  }, [entity]);

  const relatedOpenItems = useMemo(() => {
    if (!entity) return [];
    return mockOpenItems.filter((oi) => oi.entityId === id);
  }, [entity, id]);

  const relatedCases = useMemo(() => {
    if (!entity) return [];
    return mockCases.filter((c) => entity.linkedCaseIds.includes(c.id));
  }, [entity]);

  const relatedActions = useMemo(() => {
    const caseIds = relatedCases.map((c) => c.id);
    return mockActions.filter((a) => caseIds.includes(a.caseId));
  }, [relatedCases]);

  if (isLoading && !entity) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 }, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <Typography variant="body2" color="text.secondary">
          {t('entityDetail.loading')}
        </Typography>
      </Box>
    );
  }

  if (!entity) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Card variant="outlined">
          <CardContent sx={{ p: 12, textAlign: 'center' }}>
            <Iconify icon="solar:danger-triangle-bold-duotone" width={48} sx={{ color: 'warning.main', mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              {t('notFound.entity')}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
              {t('entityDetail.entityNotFoundDesc', { id: id ?? '—' })}
            </Typography>
            <Button component={Link} to={SYNAPSE_ROUTES.ENTITIES}>
              {t('entityDetail.returnToEntityHub')}
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  const handleRequestAccess = () => {
    setAccessRequestOpen(true);
  };

  const handleSubmitAccessRequest = () => {
    setAccessPending(true);
    setAccessRequestOpen(false);
    setAccessReason('');
  };

  const handleGrantAccess = () => {
    setPiiMasked(false);
    setAccessPending(false);
  };

  // Mock KPIs for this entity
  const entityKPIs = {
    actionSuccessRate: 85,
    avgResolutionDays: 3.2,
    totalTransactions: 45,
    yoyGrowth: 12.5,
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, width: '100%' }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'flex-start' }} justifyContent="space-between" spacing={2}>
          <Stack direction="row" alignItems="flex-start" spacing={2}>
            <IconButton component={Link} to={SYNAPSE_ROUTES.ENTITIES} sx={{ mt: 0.5 }}>
              <Iconify icon="solar:arrow-left-linear" width={20} />
            </IconButton>
            <Stack direction="row" alignItems="flex-start" spacing={2}>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: entity.type === 'vendor' ? 'primary.lighter' : 'info.lighter',
                }}
              >
                {entity.type === 'vendor' ? (
                  <Iconify icon="solar:buildings-bold-duotone" width={28} sx={{ color: 'primary.main' }} />
                ) : (
                  <Iconify icon="solar:users-group-two-rounded-bold-duotone" width={28} sx={{ color: 'info.main' }} />
                )}
              </Box>
              <Box>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    {entity.name}
                  </Typography>
                  <Chip
                    label={entity.type === 'vendor' ? t('entityDetail.typeVendor') : t('entityDetail.typeCustomer')}
                    variant="outlined"
                    size="small"
                    sx={{ fontSize: '0.75rem' }}
                  />
                </Stack>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                  {entity.code}
                </Typography>
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mt: 1 }}>
                  <RiskScoreBadge score={entity.riskScore} trend={entity.riskTrend} size="large" />
                  <Chip
                    label={t('entityDetail.concentrationRisk', {
                      level: entity.concentrationRisk.charAt(0).toUpperCase() + entity.concentrationRisk.slice(1),
                    })}
                    color={
                      entity.concentrationRisk === 'high'
                        ? 'error'
                        : entity.concentrationRisk === 'medium'
                          ? 'warning'
                          : 'success'
                    }
                    variant="outlined"
                    size="small"
                    sx={{ fontSize: '0.75rem' }}
                  />
                </Stack>
              </Box>
            </Stack>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ ml: { xs: 0, sm: 12 } }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Iconify icon="solar:external-link-bold" width={18} />}
              sx={{ bgcolor: 'transparent' }}
            >
              {t('entityDetail.openInSap')}
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Iconify icon="solar:download-minimalistic-bold" width={18} />}
              sx={{ bgcolor: 'transparent' }}
            >
              {t('entityDetail.export')}
            </Button>
          </Stack>
        </Stack>

        {/* Tabs */}
        <Box>
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
            <Tab
              icon={<Iconify icon="solar:graph-up-bold" width={18} />}
              iconPosition="start"
              label={t('entityDetail.tabs.overview')}
              sx={{ minHeight: 48 }}
            />
            <Tab
              icon={<Iconify icon="solar:clock-circle-bold" width={18} />}
              iconPosition="start"
              label={t('entityDetail.tabs.changeLog')}
              sx={{ minHeight: 48 }}
            />
            <Tab
              icon={<Iconify icon="solar:document-text-bold" width={18} />}
              iconPosition="start"
              label={t('entityDetail.tabs.related')}
              sx={{ minHeight: 48 }}
            />
            <Tab
              icon={<Iconify icon="solar:shield-check-bold" width={18} />}
              iconPosition="start"
              label={t('entityDetail.tabs.accessControl')}
              sx={{ minHeight: 48 }}
            />
          </Tabs>

          {/* Overview Tab */}
          {activeTab === 0 && (
            <Stack spacing={3} sx={{ mt: 3 }}>
              {/* KPI Cards */}
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <Card variant="outlined">
                    <CardContent sx={{ p: 2 }}>
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 1.5,
                            bgcolor: 'info.lighter',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Iconify icon="solar:wallet-money-bold-duotone" width={20} sx={{ color: 'info.main' }} />
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {t('entityDetail.kpis.openItems')}
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 700 }}>
                            {formatCurrency(entity.openItemsTotal, entity.currency)}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {t('entityDetail.kpis.itemsCount', { count: entity.openItemsCount })}
                          </Typography>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <Card variant="outlined">
                    <CardContent sx={{ p: 2 }}>
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 1.5,
                            bgcolor: 'error.lighter',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Iconify icon="solar:danger-triangle-bold-duotone" width={20} sx={{ color: 'error.main' }} />
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {t('entityDetail.kpis.overdue')}
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 700, color: entity.overdueTotal > 0 ? 'error.main' : undefined }}>
                            {formatCurrency(entity.overdueTotal, entity.currency)}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {t('entityDetail.kpis.itemsCount', { count: entity.overdueCount })}
                          </Typography>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <Card variant="outlined">
                    <CardContent sx={{ p: 2 }}>
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 1.5,
                            bgcolor: 'warning.lighter',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Iconify icon="solar:danger-triangle-bold-duotone" width={20} sx={{ color: 'warning.main' }} />
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {t('entityDetail.kpis.recentAnomalies')}
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 700 }}>
                            {entity.recentAnomaliesCount}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {t('entityDetail.kpis.last30Days')}
                          </Typography>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <Card variant="outlined">
                    <CardContent sx={{ p: 2 }}>
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 1.5,
                            bgcolor: 'success.lighter',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Iconify icon="solar:graph-up-bold-duotone" width={20} sx={{ color: 'success.main' }} />
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {t('entityDetail.kpis.actionSuccess')}
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 700 }}>
                            {entityKPIs.actionSuccessRate}%
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {t('entityDetail.kpis.resolutionRate')}
                          </Typography>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Related Snapshot Cards */}
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Card variant="outlined" sx={{ transition: 'all 0.2s', '&:hover': { borderColor: 'primary.main' } }}>
                    <CardHeader
                      title={
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Iconify icon="solar:document-text-bold" width={18} />
                          <Typography variant="subtitle2">{t('entityDetail.snapshot.fiDocuments')}</Typography>
                        </Stack>
                      }
                      sx={{ pb: 1 }}
                    />
                    <CardContent>
                      <Typography variant="h4" sx={{ fontWeight: 700 }}>
                        {relatedDocs.length}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1.5, display: 'block' }}>
                        {t('entityDetail.snapshot.linkedDocuments')}
                      </Typography>
                      <Button
                        component={Link}
                        to={`${SYNAPSE_ROUTES.DOCUMENTS}?entityId=${entity.id}`}
                        variant="outlined"
                        size="small"
                        fullWidth
                        endIcon={<Iconify icon="solar:alt-arrow-right-linear" width={18} />}
                        sx={{ bgcolor: 'transparent' }}
                      >
                        {t('entityDetail.snapshot.viewDocuments')}
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Card variant="outlined" sx={{ transition: 'all 0.2s', '&:hover': { borderColor: 'primary.main' } }}>
                    <CardHeader
                      title={
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Iconify icon="solar:wallet-money-bold" width={18} />
                          <Typography variant="subtitle2">{t('entityDetail.snapshot.openItems')}</Typography>
                        </Stack>
                      }
                      sx={{ pb: 1 }}
                    />
                    <CardContent>
                      <Typography variant="h4" sx={{ fontWeight: 700 }}>
                        {relatedOpenItems.length}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1.5, display: 'block' }}>
                        {t('entityDetail.snapshot.outstandingItems')}
                      </Typography>
                      <Button
                        component={Link}
                        to={`${SYNAPSE_ROUTES.OPEN_ITEMS}?entityId=${entity.id}`}
                        variant="outlined"
                        size="small"
                        fullWidth
                        endIcon={<Iconify icon="solar:alt-arrow-right-linear" width={18} />}
                        sx={{ bgcolor: 'transparent' }}
                      >
                        {t('entityDetail.snapshot.viewOpenItems')}
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Card variant="outlined" sx={{ transition: 'all 0.2s', '&:hover': { borderColor: 'primary.main' } }}>
                    <CardHeader
                      title={
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Iconify icon="solar:danger-triangle-bold" width={18} />
                          <Typography variant="subtitle2">{t('entityDetail.snapshot.cases')}</Typography>
                        </Stack>
                      }
                      sx={{ pb: 1 }}
                    />
                    <CardContent>
                      <Typography variant="h4" sx={{ fontWeight: 700 }}>
                        {relatedCases.length}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1.5, display: 'block' }}>
                        {t('entityDetail.snapshot.activeCases')}
                      </Typography>
                      <Button
                        component={Link}
                        to={`${SYNAPSE_ROUTES.CASES}?entityId=${entity.id}`}
                        variant="outlined"
                        size="small"
                        fullWidth
                        endIcon={<Iconify icon="solar:alt-arrow-right-linear" width={18} />}
                        sx={{ bgcolor: 'transparent' }}
                      >
                        {t('entityDetail.snapshot.viewCases')}
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Card variant="outlined" sx={{ transition: 'all 0.2s', '&:hover': { borderColor: 'primary.main' } }}>
                    <CardHeader
                      title={
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Iconify icon="solar:graph-up-bold" width={18} />
                          <Typography variant="subtitle2">{t('entityDetail.snapshot.actions')}</Typography>
                        </Stack>
                      }
                      sx={{ pb: 1 }}
                    />
                    <CardContent>
                      <Typography variant="h4" sx={{ fontWeight: 700 }}>
                        {relatedActions.length}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1.5, display: 'block' }}>
                        {t('entityDetail.snapshot.relatedActions')}
                      </Typography>
                      <Button
                        component={Link}
                        to={`${SYNAPSE_ROUTES.ACTIONS}?entityId=${entity.id}`}
                        variant="outlined"
                        size="small"
                        fullWidth
                        endIcon={<Iconify icon="solar:alt-arrow-right-linear" width={18} />}
                        sx={{ bgcolor: 'transparent' }}
                      >
                        {t('entityDetail.snapshot.viewActions')}
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Stack>
          )}

          {/* Change Log Tab */}
          {activeTab === 1 && (
            <Stack spacing={2} sx={{ mt: 3 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="h6">{t('entityDetail.auditChangeLog')}</Typography>
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Iconify icon="solar:filter-bold" width={18} />}
                    onClick={(e) => setChangeLogFilterAnchor(e.currentTarget)}
                    sx={{ bgcolor: 'transparent' }}
                  >
                    {t('entityDetail.filter')}
                    {changeLogFilter.length > 0 && (
                      <Chip label={changeLogFilter.length} size="small" color="secondary" sx={{ ml: 1, height: 20, fontSize: '0.75rem' }} />
                    )}
                  </Button>
                  <Menu
                    anchorEl={changeLogFilterAnchor}
                    open={Boolean(changeLogFilterAnchor)}
                    onClose={() => setChangeLogFilterAnchor(null)}
                  >
                    {['critical', 'warn', 'info'].map((severity) => (
                      <MenuItem
                        key={severity}
                        onClick={() => {
                          if (changeLogFilter.includes(severity)) {
                            setChangeLogFilter(changeLogFilter.filter((f) => f !== severity));
                          } else {
                            setChangeLogFilter([...changeLogFilter, severity]);
                          }
                        }}
                      >
                        <Checkbox checked={changeLogFilter.includes(severity)} />
                        <ListItemText primary={severity.charAt(0).toUpperCase() + severity.slice(1)} />
                      </MenuItem>
                    ))}
                  </Menu>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Iconify icon="solar:download-minimalistic-bold" width={18} />}
                    sx={{ bgcolor: 'transparent' }}
                  >
                    {t('entityDetail.export')}
                  </Button>
                </Stack>
              </Stack>

              <Card variant="outlined">
                <CardContent sx={{ p: 3 }}>
                  {changeLogs.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                      <Iconify icon="solar:clock-circle-bold-duotone" width={48} sx={{ opacity: 0.5, mb: 2 }} />
                      <Typography variant="body2">{t('entityDetail.noChangeHistory')}</Typography>
                    </Box>
                  ) : (
                    <Stack spacing={0}>
                      {changeLogs.map((log) => (
                        <ChangeLogItem key={log.id} log={log} showMasked={!piiMasked} />
                      ))}
                    </Stack>
                  )}
                </CardContent>
              </Card>
            </Stack>
          )}

          {/* Related Tab */}
          {activeTab === 2 && (
            <Stack spacing={3} sx={{ mt: 3 }}>
              {/* Related Documents */}
              <Card variant="outlined">
                <CardHeader
                  title={
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Typography variant="subtitle1">{t('entityDetail.related.fiDocuments')}</Typography>
                      <Button component={Link} to={`${SYNAPSE_ROUTES.DOCUMENTS}?entityId=${entity.id}`} variant="text" size="small">
                        {t('entityDetail.related.viewAll')}
                      </Button>
                    </Stack>
                  }
                />
                <CardContent>
                  {relatedDocs.length === 0 ? (
                    <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}>
                      {t('entityDetail.related.noRelatedDocuments')}
                    </Typography>
                  ) : (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>{t('entityDetail.table.docNumber')}</TableCell>
                            <TableCell>{t('entityDetail.table.type')}</TableCell>
                            <TableCell>{t('entityDetail.table.date')}</TableCell>
                            <TableCell align="right">{t('entityDetail.table.amount')}</TableCell>
                            <TableCell>{t('entityDetail.table.status')}</TableCell>
                            <TableCell />
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {relatedDocs.slice(0, 5).map((doc) => (
                            <TableRow key={doc.id} hover>
                              <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{doc.belnr}</TableCell>
                              <TableCell>{doc.blart}</TableCell>
                              <TableCell>{formatDate(doc.budat)}</TableCell>
                              <TableCell align="right">{formatCurrency(doc.wrbtr, doc.waers)}</TableCell>
                              <TableCell>
                                <Chip
                                  label={doc.integrityStatus}
                                  color={
                                    doc.integrityStatus === 'pass'
                                      ? 'success'
                                      : doc.integrityStatus === 'warn'
                                        ? 'warning'
                                        : 'error'
                                  }
                                  variant="outlined"
                                  size="small"
                                  sx={{ fontSize: '0.75rem' }}
                                />
                              </TableCell>
                              <TableCell>
                                <IconButton component={Link} to={`${SYNAPSE_ROUTES.DOCUMENTS}/${doc.id}`} size="small">
                                  <Iconify icon="solar:alt-arrow-right-linear" width={18} />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </CardContent>
              </Card>

              {/* Related Open Items */}
              <Card variant="outlined">
                <CardHeader
                  title={
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Typography variant="subtitle1">{t('entityDetail.related.openItems')}</Typography>
                      <Button component={Link} to={`${SYNAPSE_ROUTES.OPEN_ITEMS}?entityId=${entity.id}`} variant="text" size="small">
                        {t('entityDetail.related.viewAll')}
                      </Button>
                    </Stack>
                  }
                />
                <CardContent>
                  {relatedOpenItems.length === 0 ? (
                    <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}>
                      {t('entityDetail.related.noOpenItems')}
                    </Typography>
                  ) : (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>{t('entityDetail.table.item')}</TableCell>
                            <TableCell>{t('entityDetail.table.type')}</TableCell>
                            <TableCell>{t('entityDetail.table.due')}</TableCell>
                            <TableCell align="right">{t('entityDetail.table.amount')}</TableCell>
                            <TableCell>{t('entityDetail.table.status')}</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {relatedOpenItems.slice(0, 5).map((oi) => (
                            <TableRow key={oi.id} hover>
                              <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{oi.docNumber}</TableCell>
                              <TableCell>
                                <Chip
                                  label={oi.type}
                                  color={oi.type === 'AR' ? 'info' : 'primary'}
                                  variant="outlined"
                                  size="small"
                                  sx={{ fontSize: '0.75rem' }}
                                />
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" sx={{ color: oi.daysPastDue > 0 ? 'error.main' : undefined }}>
                                  {formatDate(oi.dueDate)}
                                  {oi.daysPastDue > 0 && ` (+${oi.daysPastDue}d)`}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">{formatCurrency(oi.amount, oi.currency)}</TableCell>
                              <TableCell>
                                <Stack direction="row" spacing={0.5}>
                                  {oi.disputeFlag && (
                                    <Chip label={t('entityDetail.dispute')} color="warning" variant="outlined" size="small" sx={{ fontSize: '0.75rem' }} />
                                  )}
                                  {oi.paymentBlock && (
                                    <Chip label={t('entityDetail.blocked')} color="error" variant="outlined" size="small" sx={{ fontSize: '0.75rem' }} />
                                  )}
                                  {!oi.disputeFlag && !oi.paymentBlock && (
                                    <Chip label={oi.status} variant="outlined" size="small" sx={{ fontSize: '0.75rem' }} />
                                  )}
                                </Stack>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </CardContent>
              </Card>

              {/* Related Cases */}
              <Card variant="outlined">
                <CardHeader
                  title={
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Typography variant="subtitle1">{t('entityDetail.related.cases')}</Typography>
                      <Button component={Link} to={`${SYNAPSE_ROUTES.CASES}?entityId=${entity.id}`} variant="text" size="small">
                        {t('entityDetail.related.viewAll')}
                      </Button>
                    </Stack>
                  }
                />
                <CardContent>
                  {relatedCases.length === 0 ? (
                    <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}>
                      {t('entityDetail.related.noRelatedCases')}
                    </Typography>
                  ) : (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>{t('entityDetail.table.case')}</TableCell>
                            <TableCell>{t('entityDetail.table.title')}</TableCell>
                            <TableCell>{t('entityDetail.table.severity')}</TableCell>
                            <TableCell>{t('entityDetail.table.status')}</TableCell>
                            <TableCell />
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {relatedCases.map((c) => (
                            <TableRow key={c.id} hover>
                              <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{c.caseNumber}</TableCell>
                              <TableCell>{c.title}</TableCell>
                              <TableCell>
                                <Chip
                                  label={c.severity}
                                  color={
                                    c.severity === 'critical'
                                      ? 'error'
                                      : c.severity === 'high'
                                        ? 'warning'
                                        : c.severity === 'medium'
                                          ? 'info'
                                          : 'default'
                                  }
                                  variant="outlined"
                                  size="small"
                                  sx={{ fontSize: '0.75rem' }}
                                />
                              </TableCell>
                              <TableCell>{c.status.replace('_', ' ')}</TableCell>
                              <TableCell>
                                <IconButton component={Link} to={`${SYNAPSE_ROUTES.CASES}/${c.id}`} size="small">
                                  <Iconify icon="solar:alt-arrow-right-linear" width={18} />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </CardContent>
              </Card>
            </Stack>
          )}

          {/* Access Control Tab */}
          {activeTab === 3 && (
            <Stack spacing={3} sx={{ mt: 3 }}>
              <Card variant="outlined">
                <CardHeader
                  title={t('entityDetail.piiAccessControl')}
                  subheader={t('entityDetail.piiAccessSubheader')}
                />
                <CardContent>
                  <Stack spacing={2}>
                    <Box sx={{ p: 2, bgcolor: 'background.neutral', borderRadius: 1.5 }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                          {piiMasked ? (
                            <Iconify icon="solar:eye-closed-bold" width={20} sx={{ color: 'text.secondary' }} />
                          ) : (
                            <Iconify icon="solar:eye-bold" width={20} sx={{ color: 'success.main' }} />
                          )}
                          <Box>
                            <Typography variant="subtitle2">
                              {piiMasked ? t('entityDetail.sensitiveFieldsMasked') : t('entityDetail.fullAccessGranted')}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {piiMasked
                                ? t('entityDetail.sensitiveFieldsMaskedDesc')
                                : t('entityDetail.allSensitiveVisible')}
                            </Typography>
                          </Box>
                        </Stack>
                        {accessPending ? (
                          <Chip
                            icon={<Iconify icon="solar:clock-circle-bold" width={14} />}
                            label={t('entityDetail.pendingApproval')}
                            color="warning"
                            variant="outlined"
                          />
                        ) : (
                          <Button
                            variant={piiMasked ? 'contained' : 'outlined'}
                            size="small"
                            onClick={piiMasked ? handleRequestAccess : () => setPiiMasked(true)}
                            startIcon={<Iconify icon={piiMasked ? 'solar:lock-password-bold' : 'solar:unlock-bold'} width={18} />}
                            sx={!piiMasked ? { bgcolor: 'transparent' } : {}}
                          >
                            {piiMasked ? t('entityDetail.requestAccess') : t('entityDetail.revokeAccess')}
                          </Button>
                        )}
                      </Stack>
                    </Box>

                    {/* Demo Mode Toggle */}
                    <Box sx={{ p: 2, border: '1px dashed', borderColor: 'divider', borderRadius: 1.5 }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Box>
                          <Typography variant="subtitle2">{t('entityDetail.demoMode')}</Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {t('entityDetail.demoModeDesc')}
                          </Typography>
                        </Box>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={handleGrantAccess}
                          disabled={!piiMasked}
                          startIcon={<Iconify icon="solar:unlock-bold" width={18} />}
                          sx={{ bgcolor: 'transparent' }}
                        >
                          {t('entityDetail.grantAccess')}
                        </Button>
                      </Stack>
                    </Box>

                    <Divider />

                    {/* Sensitive Fields Display — PII handling=MASK/HASH_ONLY/ENCRYPT/FORBID */}
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                        {t('entityDetail.sensitiveFields')}
                      </Typography>
                      <Stack spacing={0} divider={<Divider />}>
                        <PiiFieldDisplay
                          label={t('entityDetail.bankAccount')}
                          value={piiMasked ? undefined : entity.bankAccount}
                          handling={piiMasked ? 'MASK' : 'ALLOW'}
                          onRequestAccess={handleRequestAccess}
                        />
                        <PiiFieldDisplay
                          label={t('entityDetail.bankName')}
                          value={piiMasked ? undefined : entity.bankName}
                          handling={piiMasked ? 'MASK' : 'ALLOW'}
                          onRequestAccess={handleRequestAccess}
                        />
                        <PiiFieldDisplay
                          label={t('entityDetail.taxId')}
                          value={piiMasked ? undefined : entity.taxId}
                          handling={piiMasked ? 'MASK' : 'ALLOW'}
                          onRequestAccess={handleRequestAccess}
                        />
                        <PiiFieldDisplay
                          label={t('entityDetail.contactName')}
                          value={piiMasked ? undefined : entity.contactName}
                          handling={piiMasked ? 'MASK' : 'ALLOW'}
                          onRequestAccess={handleRequestAccess}
                        />
                        <PiiFieldDisplay
                          label={t('entityDetail.contactEmail')}
                          value={piiMasked ? undefined : entity.contactEmail}
                          handling={piiMasked ? 'MASK' : 'ALLOW'}
                          onRequestAccess={handleRequestAccess}
                        />
                        <PiiFieldDisplay
                          label={t('entityDetail.contactPhone')}
                          value={piiMasked ? undefined : entity.contactPhone}
                          handling={piiMasked ? 'MASK' : 'ALLOW'}
                          onRequestAccess={handleRequestAccess}
                        />
                        <PiiFieldDisplay
                          label={t('entityDetail.address')}
                          value={piiMasked ? undefined : entity.address}
                          handling={piiMasked ? 'MASK' : 'ALLOW'}
                          onRequestAccess={handleRequestAccess}
                        />
                      </Stack>
                    </Box>

                    {/* Non-sensitive fields always visible */}
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                        {t('entityDetail.generalInformation')}
                      </Typography>
                      <Stack spacing={0} divider={<Divider />}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 1 }}>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {t('entityDetail.companyCode')}
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {entity.companyCode}
                          </Typography>
                        </Stack>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 1 }}>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {t('entityDetail.currency')}
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {entity.currency}
                          </Typography>
                        </Stack>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 1 }}>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {t('entityDetail.paymentTerms')}
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {entity.paymentTerms}
                          </Typography>
                        </Stack>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 1 }}>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {t('entityDetail.lastUpdated')}
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {formatDate(entity.lastUpdated)}
                          </Typography>
                        </Stack>
                      </Stack>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          )}
        </Box>
      </Stack>

      {/* Access Request Dialog */}
      <Dialog open={accessRequestOpen} onClose={() => setAccessRequestOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('entityDetail.requestPiiAccess')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            {t('entityDetail.requestPiiAccessDesc', { name: entity.name })}
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            label={t('entityDetail.reasonForAccess')}
            placeholder={t('entityDetail.reasonPlaceholder')}
            value={accessReason}
            onChange={(e) => setAccessReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAccessRequestOpen(false)} variant="outlined" sx={{ bgcolor: 'transparent' }}>
            {t('entityDetail.cancel')}
          </Button>
          <Button onClick={handleSubmitAccessRequest} variant="contained" disabled={!accessReason.trim()}>
            {t('entityDetail.submitRequest')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
