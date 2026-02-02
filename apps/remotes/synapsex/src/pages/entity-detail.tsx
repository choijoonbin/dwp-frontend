import { useMemo, useState } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { Link, useParams, useSearchParams } from 'react-router-dom';

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
import {
  mockCases,
  mockFiDocs,
  mockActions,
  mockEntities,
  mockOpenItems,
  mockEntityChangeLogs,
  type EntityChangeLog,
} from '../data/mock-data';

// ----------------------------------------------------------------------

// Masked Field Component
const MaskedField = ({
  label,
  value,
  isMasked,
  onRequestAccess,
}: {
  label: string;
  value?: string;
  isMasked: boolean;
  onRequestAccess: () => void;
}) => {
  if (!value) return null;

  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 1 }}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      {isMasked ? (
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {'*'.repeat(10)}
          </Typography>
          <Button variant="text" size="small" onClick={onRequestAccess} sx={{ minWidth: 'auto', px: 1, height: 24 }}>
            <Iconify icon="solar:lock-password-bold" width={14} sx={{ mr: 0.5 }} />
            <Typography variant="caption">Request</Typography>
          </Button>
        </Stack>
      ) : (
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {value}
        </Typography>
      )}
    </Stack>
  );
};

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
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'overview';

  const [activeTab, setActiveTab] = useState(initialTab === 'overview' ? 0 : initialTab === 'changelog' ? 1 : initialTab === 'related' ? 2 : 3);
  const [piiMasked, setPiiMasked] = useState(true);
  const [accessRequestOpen, setAccessRequestOpen] = useState(false);
  const [accessReason, setAccessReason] = useState('');
  const [accessPending, setAccessPending] = useState(false);
  const [changeLogFilterAnchor, setChangeLogFilterAnchor] = useState<null | HTMLElement>(null);
  const [changeLogFilter, setChangeLogFilter] = useState<string[]>([]);

  // Find entity
  const entity = mockEntities.find((e) => e.id === id);

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

  if (!entity) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Card variant="outlined">
          <CardContent sx={{ p: 12, textAlign: 'center' }}>
            <Iconify icon="solar:danger-triangle-bold-duotone" width={48} sx={{ color: 'warning.main', mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              Entity Not Found
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
              The entity with ID {id} could not be found.
            </Typography>
            <Button component={Link} to={SYNAPSE_ROUTES.ENTITIES}>
              Return to Entity Hub
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  const formatCurrency = (amount: number, currency: string) => new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

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
                  <Chip label={entity.type} variant="outlined" size="small" sx={{ fontSize: '0.75rem' }} />
                </Stack>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                  {entity.code}
                </Typography>
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mt: 1 }}>
                  <RiskScoreBadge score={entity.riskScore} trend={entity.riskTrend} size="large" />
                  <Chip
                    label={`${entity.concentrationRisk.charAt(0).toUpperCase() + entity.concentrationRisk.slice(1)} Concentration`}
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
              Open in SAP
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Iconify icon="solar:download-minimalistic-bold" width={18} />}
              sx={{ bgcolor: 'transparent' }}
            >
              Export
            </Button>
          </Stack>
        </Stack>

        {/* Tabs */}
        <Box>
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
            <Tab
              icon={<Iconify icon="solar:graph-up-bold" width={18} />}
              iconPosition="start"
              label="Overview"
              sx={{ minHeight: 48 }}
            />
            <Tab
              icon={<Iconify icon="solar:clock-circle-bold" width={18} />}
              iconPosition="start"
              label="Change Log"
              sx={{ minHeight: 48 }}
            />
            <Tab
              icon={<Iconify icon="solar:document-text-bold" width={18} />}
              iconPosition="start"
              label="Related"
              sx={{ minHeight: 48 }}
            />
            <Tab
              icon={<Iconify icon="solar:shield-check-bold" width={18} />}
              iconPosition="start"
              label="Access Control"
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
                            Open Items
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 700 }}>
                            {formatCurrency(entity.openItemsTotal, entity.currency)}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {entity.openItemsCount} items
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
                            Overdue
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 700, color: entity.overdueTotal > 0 ? 'error.main' : undefined }}>
                            {formatCurrency(entity.overdueTotal, entity.currency)}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {entity.overdueCount} items
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
                            Recent Anomalies
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 700 }}>
                            {entity.recentAnomaliesCount}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            Last 30 days
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
                            Action Success
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 700 }}>
                            {entityKPIs.actionSuccessRate}%
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            Resolution rate
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
                          <Typography variant="subtitle2">FI Documents</Typography>
                        </Stack>
                      }
                      sx={{ pb: 1 }}
                    />
                    <CardContent>
                      <Typography variant="h4" sx={{ fontWeight: 700 }}>
                        {relatedDocs.length}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1.5, display: 'block' }}>
                        Linked documents
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
                        View Documents
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
                          <Typography variant="subtitle2">Open Items</Typography>
                        </Stack>
                      }
                      sx={{ pb: 1 }}
                    />
                    <CardContent>
                      <Typography variant="h4" sx={{ fontWeight: 700 }}>
                        {relatedOpenItems.length}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1.5, display: 'block' }}>
                        Outstanding items
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
                        View Open Items
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
                          <Typography variant="subtitle2">Cases</Typography>
                        </Stack>
                      }
                      sx={{ pb: 1 }}
                    />
                    <CardContent>
                      <Typography variant="h4" sx={{ fontWeight: 700 }}>
                        {relatedCases.length}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1.5, display: 'block' }}>
                        Active cases
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
                        View Cases
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
                          <Typography variant="subtitle2">Actions</Typography>
                        </Stack>
                      }
                      sx={{ pb: 1 }}
                    />
                    <CardContent>
                      <Typography variant="h4" sx={{ fontWeight: 700 }}>
                        {relatedActions.length}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1.5, display: 'block' }}>
                        Related actions
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
                        View Actions
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
                <Typography variant="h6">Audit Change Log</Typography>
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Iconify icon="solar:filter-bold" width={18} />}
                    onClick={(e) => setChangeLogFilterAnchor(e.currentTarget)}
                    sx={{ bgcolor: 'transparent' }}
                  >
                    Filter
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
                    Export
                  </Button>
                </Stack>
              </Stack>

              <Card variant="outlined">
                <CardContent sx={{ p: 3 }}>
                  {changeLogs.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                      <Iconify icon="solar:clock-circle-bold-duotone" width={48} sx={{ opacity: 0.5, mb: 2 }} />
                      <Typography variant="body2">No change history found for this entity.</Typography>
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
                      <Typography variant="subtitle1">Related FI Documents</Typography>
                      <Button component={Link} to={`${SYNAPSE_ROUTES.DOCUMENTS}?entityId=${entity.id}`} variant="text" size="small">
                        View All
                      </Button>
                    </Stack>
                  }
                />
                <CardContent>
                  {relatedDocs.length === 0 ? (
                    <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}>
                      No related documents
                    </Typography>
                  ) : (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Doc Number</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell>Date</TableCell>
                            <TableCell align="right">Amount</TableCell>
                            <TableCell>Status</TableCell>
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
                      <Typography variant="subtitle1">Related Open Items</Typography>
                      <Button component={Link} to={`${SYNAPSE_ROUTES.OPEN_ITEMS}?entityId=${entity.id}`} variant="text" size="small">
                        View All
                      </Button>
                    </Stack>
                  }
                />
                <CardContent>
                  {relatedOpenItems.length === 0 ? (
                    <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}>
                      No open items
                    </Typography>
                  ) : (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Item</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell>Due</TableCell>
                            <TableCell align="right">Amount</TableCell>
                            <TableCell>Status</TableCell>
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
                                    <Chip label="Dispute" color="warning" variant="outlined" size="small" sx={{ fontSize: '0.75rem' }} />
                                  )}
                                  {oi.paymentBlock && (
                                    <Chip label="Blocked" color="error" variant="outlined" size="small" sx={{ fontSize: '0.75rem' }} />
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
                      <Typography variant="subtitle1">Related Cases</Typography>
                      <Button component={Link} to={`${SYNAPSE_ROUTES.CASES}?entityId=${entity.id}`} variant="text" size="small">
                        View All
                      </Button>
                    </Stack>
                  }
                />
                <CardContent>
                  {relatedCases.length === 0 ? (
                    <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}>
                      No related cases
                    </Typography>
                  ) : (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Case</TableCell>
                            <TableCell>Title</TableCell>
                            <TableCell>Severity</TableCell>
                            <TableCell>Status</TableCell>
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
                  title="PII Access Control"
                  subheader="Sensitive entity data is protected. Request access or use demo mode to view masked fields."
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
                              {piiMasked ? 'Sensitive Fields Masked' : 'Full Access Granted'}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {piiMasked
                                ? 'Bank account, contact info, and tax ID are hidden'
                                : 'All sensitive fields are visible'}
                            </Typography>
                          </Box>
                        </Stack>
                        {accessPending ? (
                          <Chip
                            icon={<Iconify icon="solar:clock-circle-bold" width={14} />}
                            label="Pending Approval"
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
                            {piiMasked ? 'Request Access' : 'Revoke Access'}
                          </Button>
                        )}
                      </Stack>
                    </Box>

                    {/* Demo Mode Toggle */}
                    <Box sx={{ p: 2, border: '1px dashed', borderColor: 'divider', borderRadius: 1.5 }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Box>
                          <Typography variant="subtitle2">Demo Mode (Admin Simulation)</Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            Bypass access controls for demonstration purposes
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
                          Grant Access
                        </Button>
                      </Stack>
                    </Box>

                    <Divider />

                    {/* Sensitive Fields Display */}
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                        Sensitive Fields
                      </Typography>
                      <Stack spacing={0} divider={<Divider />}>
                        <MaskedField label="Bank Account" value={entity.bankAccount} isMasked={piiMasked} onRequestAccess={handleRequestAccess} />
                        <MaskedField label="Bank Name" value={entity.bankName} isMasked={piiMasked} onRequestAccess={handleRequestAccess} />
                        <MaskedField label="Tax ID" value={entity.taxId} isMasked={piiMasked} onRequestAccess={handleRequestAccess} />
                        <MaskedField label="Contact Name" value={entity.contactName} isMasked={piiMasked} onRequestAccess={handleRequestAccess} />
                        <MaskedField label="Contact Email" value={entity.contactEmail} isMasked={piiMasked} onRequestAccess={handleRequestAccess} />
                        <MaskedField label="Contact Phone" value={entity.contactPhone} isMasked={piiMasked} onRequestAccess={handleRequestAccess} />
                        <MaskedField label="Address" value={entity.address} isMasked={piiMasked} onRequestAccess={handleRequestAccess} />
                      </Stack>
                    </Box>

                    {/* Non-sensitive fields always visible */}
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                        General Information
                      </Typography>
                      <Stack spacing={0} divider={<Divider />}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 1 }}>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            Company Code
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {entity.companyCode}
                          </Typography>
                        </Stack>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 1 }}>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            Currency
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {entity.currency}
                          </Typography>
                        </Stack>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 1 }}>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            Payment Terms
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {entity.paymentTerms}
                          </Typography>
                        </Stack>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 1 }}>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            Last Updated
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
        <DialogTitle>Request PII Access</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Explain why you need access to sensitive data for {entity.name}. This request will be logged and requires approval.
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Reason for Access"
            placeholder="e.g., Investigating bank account change anomaly for case CS-2026-0001"
            value={accessReason}
            onChange={(e) => setAccessReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAccessRequestOpen(false)} variant="outlined" sx={{ bgcolor: 'transparent' }}>
            Cancel
          </Button>
          <Button onClick={handleSubmitAccessRequest} variant="contained" disabled={!accessReason.trim()}>
            Submit Request
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
