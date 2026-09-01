import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
  XCircle,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  activateAccessReviewCampaign,
  completeAccessReviewCampaign,
  createAccessReviewCampaign,
  decideAccessReviewItem,
  getAccessReviewCampaign,
  listAccessReviewCampaigns,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';
import { formatDate, useRoleDisplay } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  ActionIconButton,
  EnterpriseDataGrid,
  FormDialog,
  FormField,
  ProgressMeter,
} from '@dwp-frontend/design-system';

import { alpha, useTheme } from '@mui/material/styles';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';

import {
  ManagementPanelError,
  ManagementPanelLoading,
} from '../../components/management-panel-state';
import { localizedRoleIdentityColumn } from './localized-role-column';
import { AccessReviewCampaignDialog } from './access-review-campaign-dialog';
import { hasFullTenantAdminRole } from '@dwp-frontend/shared-utils/auth/control-plane-access';

import type { GridColDef } from '@mui/x-data-grid';
import type {
  AccessReviewCampaign,
  AccessReviewDecision,
  AccessReviewItem,
  CreateAccessReviewCampaignRequest,
} from '@dwp-frontend/shared-utils';

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function statusColor(state: AccessReviewCampaign['lifecycleState']) {
  if (state === 'ACTIVE') return 'warning' as const;
  if (state === 'COMPLETED') return 'success' as const;
  return 'default' as const;
}

function decisionColor(decision: AccessReviewDecision) {
  if (decision === 'APPROVE') return 'success' as const;
  if (decision === 'REVOKE') return 'error' as const;
  return 'warning' as const;
}

function RecommendationChip({ item }: { item: AccessReviewItem }) {
  const { t } = useTranslation('admin');
  const recommendation = item.recommendation ?? 'UNAVAILABLE';
  return (
    <Chip
      size="small"
      color={
        recommendation === 'REVIEW' ? 'warning' : recommendation === 'KEEP' ? 'success' : 'default'
      }
      variant="outlined"
      label={t(`accessReviews.recommendations.${recommendation}`)}
    />
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof ClipboardCheck;
  label: string;
  value: number;
  tone: 'primary' | 'warning' | 'success' | 'error';
}) {
  return (
    <Box
      sx={{
        minWidth: 0,
        px: 2,
        py: 1.5,
        borderRight: { md: 1 },
        borderColor: 'divider',
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Typography variant="caption" color="text.secondary" fontWeight={700}>
          {label}
        </Typography>
        <Icon size={16} aria-hidden="true" />
      </Stack>
      <Typography
        component="p"
        variant="h5"
        color={`${tone}.main`}
        sx={{ mt: 0.5, fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function DecisionDialog({
  item,
  busy,
  onClose,
  onDecide,
}: {
  item: AccessReviewItem | null;
  busy: boolean;
  onClose: () => void;
  onDecide: (decision: 'APPROVE' | 'REVOKE', reason: string) => Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const displayRole = useRoleDisplay();
  const [decision, setDecision] = useState<'APPROVE' | 'REVOKE'>('APPROVE');
  const [reason, setReason] = useState('');
  const formatEvidenceDate = (value?: string | null) =>
    value
      ? formatDate(value, { dateStyle: 'medium', timeStyle: 'short' })
      : t('accessReviews.notAvailable');

  return (
    <FormDialog
      open={Boolean(item)}
      title={t('accessReviews.decision.title')}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t('accessReviews.decision.submit')}
      busy={busy}
      submitDisabled={reason.trim().length < 10}
      submitIntent={decision === 'REVOKE' ? 'danger' : 'primary'}
      onClose={onClose}
      onSubmit={() => onDecide(decision, reason.trim())}
    >
      {item && (
        <Stack gap={2}>
          <Box sx={{ p: 1.5, borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2">{item.subjectDisplayName}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {displayRole(item.roleCode, item.roleName).name} ({item.roleCode})
                </Typography>
              </Box>
              <Stack direction="row" gap={0.5} flexWrap="wrap" justifyContent="flex-end">
                <RecommendationChip item={item} />
                {item.privileged && (
                  <Chip
                    size="small"
                    color="warning"
                    variant="outlined"
                    label={t('accessReviews.evidence.privileged')}
                  />
                )}
              </Stack>
            </Stack>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                gap: 1,
                mt: 1.5,
              }}
            >
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">
                  {t('accessReviews.evidence.source')}
                </Typography>
                <Typography variant="body2">
                  {item.sourceDisplayName || t(`accessReviews.sources.${item.accessSourceType}`)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">
                  {t('accessReviews.evidence.assignedAt')}
                </Typography>
                <Typography variant="body2">
                  {formatEvidenceDate(item.assignmentCreatedAt)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">
                  {t('accessReviews.evidence.lastSignIn')}
                </Typography>
                <Typography variant="body2">
                  {formatEvidenceDate(item.subjectLastSignInAt)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">
                  {t('accessReviews.evidence.reason')}
                </Typography>
                <Typography variant="body2">
                  {t(
                    `accessReviews.recommendationReasons.${item.recommendationReason ?? 'EVIDENCE_UNAVAILABLE'}`
                  )}
                </Typography>
              </Box>
            </Box>
          </Box>
          <ToggleButtonGroup
            exclusive
            fullWidth
            value={decision}
            onChange={(_, value: 'APPROVE' | 'REVOKE' | null) => value && setDecision(value)}
            aria-label={t('accessReviews.decision.choiceLabel')}
          >
            <ToggleButton value="APPROVE">
              <CheckCircle2 size={17} /> {t('accessReviews.decisions.APPROVE')}
            </ToggleButton>
            <ToggleButton value="REVOKE">
              <XCircle size={17} /> {t('accessReviews.decisions.REVOKE')}
            </ToggleButton>
          </ToggleButtonGroup>
          <FormField
            autoFocus
            required
            multiline
            minRows={3}
            label={t('accessReviews.fields.reason')}
            value={reason}
            inputProps={{ minLength: 10, maxLength: 1000 }}
            supportingText={t('accessReviews.decision.reasonHelp')}
            onChange={(event) => setReason(event.target.value)}
          />
          {decision === 'REVOKE' && item.accessSourceType === 'GROUP' && (
            <Box sx={{ p: 1.5, bgcolor: 'warning.light', borderRadius: 1 }}>
              <Typography variant="body2" color="warning.contrastText">
                {t('accessReviews.decision.groupRemediation')}
              </Typography>
            </Box>
          )}
        </Stack>
      )}
    </FormDialog>
  );
}

export function AccessReviewManager() {
  const { t } = useTranslation('admin');
  const displayRole = useRoleDisplay();
  const auth = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const canManage = hasFullTenantAdminRole(auth.user?.roles ?? []);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [decisionItem, setDecisionItem] = useState<AccessReviewItem | null>(null);
  const [busy, setBusy] = useState(false);

  const campaignsQuery = useQuery({
    queryKey: ['admin', 'access-reviews'],
    queryFn: listAccessReviewCampaigns,
  });
  const campaigns = useMemo(() => campaignsQuery.data ?? [], [campaignsQuery.data]);

  useEffect(() => {
    if (!campaigns.length) {
      setSelectedCampaignId(null);
      return;
    }
    if (!selectedCampaignId || !campaigns.some((item) => item.campaignId === selectedCampaignId)) {
      setSelectedCampaignId(campaigns[0].campaignId);
    }
  }, [campaigns, selectedCampaignId]);

  const detailQuery = useQuery({
    queryKey: ['admin', 'access-reviews', selectedCampaignId],
    queryFn: () => getAccessReviewCampaign(selectedCampaignId!),
    enabled: Boolean(selectedCampaignId),
  });
  const selectedCampaign = detailQuery.data?.campaign;
  const items = detailQuery.data?.items ?? [];
  const pendingCampaigns = campaigns.filter((item) => item.lifecycleState === 'ACTIVE').length;
  const pendingItems = campaigns.reduce((sum, item) => sum + item.pendingItems, 0);
  const manualItems = campaigns.reduce((sum, item) => sum + item.manualRemediationItems, 0);
  const completedCampaigns = campaigns.filter((item) => item.lifecycleState === 'COMPLETED').length;

  const formatDateTime = (value?: string | null) =>
    value
      ? formatDate(value, {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : t('accessReviews.notAvailable');

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin', 'access-reviews'] });
  };

  const createCampaign = async (request: CreateAccessReviewCampaignRequest) => {
    setBusy(true);
    try {
      const created = await createAccessReviewCampaign(request);
      await invalidate();
      setSelectedCampaignId(created.campaignId);
      setCreateOpen(false);
      toast.success(t('accessReviews.toasts.created'));
    } catch (error) {
      toast.error(errorMessage(error, t('common.operationError')));
    } finally {
      setBusy(false);
    }
  };

  const activate = async () => {
    if (!selectedCampaign) return;
    setBusy(true);
    try {
      await activateAccessReviewCampaign(selectedCampaign);
      await invalidate();
      toast.success(t('accessReviews.toasts.activated'));
    } catch (error) {
      toast.error(errorMessage(error, t('common.operationError')));
    } finally {
      setBusy(false);
    }
  };

  const decide = async (decision: 'APPROVE' | 'REVOKE', reason: string) => {
    if (!selectedCampaign || !decisionItem) return;
    setBusy(true);
    try {
      await decideAccessReviewItem(selectedCampaign.campaignId, decisionItem, decision, reason);
      await invalidate();
      setDecisionItem(null);
      toast.success(t('accessReviews.toasts.decided'));
    } catch (error) {
      toast.error(errorMessage(error, t('common.operationError')));
    } finally {
      setBusy(false);
    }
  };

  const complete = async () => {
    if (!selectedCampaign) return;
    setBusy(true);
    try {
      await completeAccessReviewCampaign(selectedCampaign);
      await invalidate();
      toast.success(t('accessReviews.toasts.completed'));
    } catch (error) {
      toast.error(errorMessage(error, t('common.operationError')));
    } finally {
      setBusy(false);
    }
  };

  const columns = useMemo<GridColDef<AccessReviewItem>[]>(
    () => [
      {
        field: 'subjectDisplayName',
        headerName: t('accessReviews.columns.subject'),
        minWidth: 220,
        flex: 1.1,
        renderCell: ({ row }) => (
          <Stack direction="row" alignItems="center" gap={1.25} sx={{ minWidth: 0 }}>
            <Avatar sx={{ width: 32, height: 32, fontSize: 11, bgcolor: 'primary.main' }}>
              {initials(row.subjectDisplayName)}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={700} noWrap>
                {row.subjectDisplayName}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap display="block">
                {row.subjectEmail || `#${row.subjectUserId}`}
              </Typography>
            </Box>
          </Stack>
        ),
      },
      localizedRoleIdentityColumn(t('accessReviews.columns.access'), displayRole, 190, 0.9),
      {
        field: 'accessSourceType',
        headerName: t('accessReviews.columns.source'),
        minWidth: 170,
        flex: 0.75,
        renderCell: ({ row }) => (
          <Box sx={{ minWidth: 0 }}>
            <Chip
              size="small"
              variant="outlined"
              label={t(`accessReviews.sources.${row.accessSourceType}`)}
            />
            {row.sourceDisplayName && (
              <Typography variant="caption" color="text.secondary" noWrap display="block">
                {row.sourceDisplayName}
              </Typography>
            )}
          </Box>
        ),
      },
      {
        field: 'recommendation',
        headerName: t('accessReviews.columns.evidence'),
        minWidth: 176,
        flex: 0.7,
        renderCell: ({ row }) => (
          <Box sx={{ minWidth: 0 }}>
            <RecommendationChip item={row} />
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {t(
                `accessReviews.recommendationReasons.${row.recommendationReason ?? 'EVIDENCE_UNAVAILABLE'}`
              )}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'decision',
        headerName: t('accessReviews.columns.decision'),
        width: 118,
        renderCell: ({ row }) => (
          <Chip
            size="small"
            color={decisionColor(row.decision)}
            variant={row.decision === 'PENDING' ? 'outlined' : 'filled'}
            label={t(`accessReviews.decisions.${row.decision}`)}
          />
        ),
      },
      {
        field: 'remediationState',
        headerName: t('accessReviews.columns.remediation'),
        width: 148,
        renderCell: ({ row }) => (
          <Typography variant="caption" fontWeight={650}>
            {t(`accessReviews.remediation.${row.remediationState}`)}
          </Typography>
        ),
      },
      {
        field: 'actions',
        headerName: '',
        width: 76,
        sortable: false,
        filterable: false,
        align: 'right',
        renderCell: ({ row }) =>
          row.decision === 'PENDING' && selectedCampaign?.lifecycleState === 'ACTIVE' ? (
            <ActionIconButton
              size="small"
              label={t('accessReviews.actions.reviewFor', {
                name: row.subjectDisplayName,
              })}
              tooltip={t('accessReviews.actions.review')}
              onClick={() => setDecisionItem(row)}
            >
              <ClipboardCheck size={17} />
            </ActionIconButton>
          ) : null,
      },
    ],
    [displayRole, selectedCampaign?.lifecycleState, t]
  );

  if (campaignsQuery.isLoading) {
    return <ManagementPanelLoading label={t('accessReviews.loading')} />;
  }
  if (campaignsQuery.isError) {
    return (
      <ManagementPanelError
        message={errorMessage(campaignsQuery.error, t('common.operationError'))}
      />
    );
  }

  return (
    <>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, 1fr)' },
          borderTop: 1,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Metric
          icon={ShieldCheck}
          label={t('accessReviews.metrics.activeCampaigns')}
          value={pendingCampaigns}
          tone="primary"
        />
        <Metric
          icon={Clock3}
          label={t('accessReviews.metrics.pendingDecisions')}
          value={pendingItems}
          tone="warning"
        />
        <Metric
          icon={UserRoundCheck}
          label={t('accessReviews.metrics.completedCampaigns')}
          value={completedCampaigns}
          tone="success"
        />
        <Metric
          icon={UsersRound}
          label={t('accessReviews.metrics.manualRemediation')}
          value={manualItems}
          tone="error"
        />
      </Box>

      <Box
        sx={{
          mt: 2,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '320px minmax(0, 1fr)' },
          minHeight: 520,
          borderTop: 1,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ borderRight: { lg: 1 }, borderColor: 'divider', minWidth: 0 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" gap={1}>
              <ClipboardCheck size={18} />
              <Typography component="h2" variant="subtitle1">
                {t('accessReviews.campaigns')}
              </Typography>
              <Chip size="small" variant="outlined" label={campaigns.length} />
            </Stack>
            {canManage && (
              <ActionIconButton
                size="small"
                label={t('accessReviews.actions.new')}
                onClick={() => setCreateOpen(true)}
              >
                <Plus size={18} />
              </ActionIconButton>
            )}
          </Stack>
          <Divider />
          <List disablePadding aria-label={t('accessReviews.campaignListLabel')}>
            {campaigns.map((campaign) => {
              const selected = campaign.campaignId === selectedCampaignId;
              const progress = campaign.totalItems
                ? ((campaign.totalItems - campaign.pendingItems) / campaign.totalItems) * 100
                : 0;
              return (
                <ListItem key={campaign.campaignId} disablePadding>
                  <ListItemButton
                    selected={selected}
                    onClick={() => setSelectedCampaignId(campaign.campaignId)}
                    sx={{
                      display: 'block',
                      px: 2,
                      py: 1.5,
                      borderBottom: 1,
                      borderColor: 'divider',
                      '&.Mui-selected': {
                        bgcolor: alpha(theme.palette.primary.main, 0.08),
                        boxShadow: `inset 3px 0 ${theme.palette.primary.main}`,
                      },
                    }}
                  >
                    <Stack
                      direction="row"
                      alignItems="flex-start"
                      justifyContent="space-between"
                      gap={1}
                    >
                      <Typography variant="subtitle2" sx={{ minWidth: 0 }}>
                        {campaign.name}
                      </Typography>
                      <Chip
                        size="small"
                        color={statusColor(campaign.lifecycleState)}
                        variant="outlined"
                        label={t(`accessReviews.states.${campaign.lifecycleState}`)}
                      />
                    </Stack>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                      sx={{ mt: 0.5 }}
                    >
                      {t(`accessReviews.scopes.${campaign.scopeType}`)} ·{' '}
                      {formatDateTime(campaign.dueAt)}
                    </Typography>
                    <ProgressMeter
                      label={t('accessReviews.progress', {
                        completed: campaign.totalItems - campaign.pendingItems,
                        total: campaign.totalItems,
                      })}
                      value={progress}
                      tone={campaign.lifecycleState === 'COMPLETED' ? 'success' : 'primary'}
                      size="compact"
                      sx={{ mt: 1.25 }}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
          {!campaigns.length && (
            <Box sx={{ px: 3, py: 8, textAlign: 'center' }}>
              <ClipboardCheck size={28} color={theme.palette.text.disabled} />
              <Typography variant="subtitle2" sx={{ mt: 1 }}>
                {t(canManage ? 'accessReviews.emptyAdmin' : 'accessReviews.emptyReviewer')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {t(
                  canManage
                    ? 'accessReviews.emptyAdminDescription'
                    : 'accessReviews.emptyReviewerDescription'
                )}
              </Typography>
            </Box>
          )}
        </Box>

        <Box sx={{ minWidth: 0 }}>
          {selectedCampaign ? (
            <>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ xs: 'stretch', sm: 'center' }}
                justifyContent="space-between"
                gap={1.5}
                sx={{ p: 2 }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                    <Typography component="h2" variant="h6">
                      {selectedCampaign.name}
                    </Typography>
                    <Chip
                      size="small"
                      color={statusColor(selectedCampaign.lifecycleState)}
                      label={t(`accessReviews.states.${selectedCampaign.lifecycleState}`)}
                    />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                    {selectedCampaign.description || t('accessReviews.noDescription')}
                  </Typography>
                  <Stack direction="row" gap={1.5} flexWrap="wrap" sx={{ mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      {t('accessReviews.summary.scope', {
                        scope: t(`accessReviews.scopes.${selectedCampaign.scopeType}`),
                      })}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('accessReviews.summary.due', {
                        value: formatDateTime(selectedCampaign.dueAt),
                      })}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('accessReviews.summary.reviewer', {
                        value: t(
                          `accessReviews.reviewerStrategies.${selectedCampaign.reviewerStrategy}`
                        ),
                      })}
                    </Typography>
                  </Stack>
                </Box>
                <Stack direction="row" alignItems="center" justifyContent="flex-end" gap={0.75}>
                  <ActionIconButton
                    label={t('common.actions.refresh')}
                    onClick={() =>
                      void Promise.all([campaignsQuery.refetch(), detailQuery.refetch()])
                    }
                  >
                    <RefreshCw size={18} />
                  </ActionIconButton>
                  {canManage && selectedCampaign.lifecycleState === 'DRAFT' && (
                    <ActionButton
                      intent="primary"
                      startIcon={<Play size={17} />}
                      disabled={busy}
                      onClick={() => void activate()}
                    >
                      {t('accessReviews.actions.activate')}
                    </ActionButton>
                  )}
                  {canManage && selectedCampaign.lifecycleState === 'ACTIVE' && (
                    <ActionButton
                      intent="primary"
                      startIcon={<CheckCircle2 size={17} />}
                      disabled={busy || selectedCampaign.pendingItems > 0}
                      onClick={() => void complete()}
                    >
                      {t('accessReviews.actions.complete')}
                    </ActionButton>
                  )}
                </Stack>
              </Stack>
              <Divider />
              {detailQuery.isLoading ? (
                <ManagementPanelLoading label={t('accessReviews.loadingItems')} />
              ) : detailQuery.isError ? (
                <ManagementPanelError
                  message={errorMessage(detailQuery.error, t('common.operationError'))}
                />
              ) : desktop ? (
                <EnterpriseDataGrid
                  ariaLabel={t('accessReviews.itemListLabel')}
                  rows={items}
                  columns={columns}
                  getRowId={(row) => row.itemId}
                  hideFooter={items.length <= 25}
                  minVisibleRows={5}
                  maxVisibleRows={9}
                  initialState={{ pagination: { paginationModel: { page: 0, pageSize: 25 } } }}
                  sx={{ border: 0, borderRadius: 0 }}
                  slots={{
                    noRowsOverlay: () => (
                      <Box sx={{ height: 1, display: 'grid', placeItems: 'center' }}>
                        <Typography variant="body2" color="text.secondary">
                          {t(
                            selectedCampaign.lifecycleState === 'DRAFT'
                              ? 'accessReviews.noItemsDraft'
                              : 'accessReviews.noItems'
                          )}
                        </Typography>
                      </Box>
                    ),
                  }}
                />
              ) : (
                <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
                  {items.map((item) => (
                    <Box
                      component="li"
                      key={item.itemId}
                      sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}
                    >
                      <Stack
                        direction="row"
                        alignItems="flex-start"
                        justifyContent="space-between"
                        gap={1}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="subtitle2">{item.subjectDisplayName}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {displayRole(item.roleCode, item.roleName).name} ·{' '}
                            {item.sourceDisplayName ||
                              t(`accessReviews.sources.${item.accessSourceType}`)}
                          </Typography>
                          <Stack direction="row" gap={0.5} sx={{ mt: 0.75 }}>
                            <RecommendationChip item={item} />
                            {item.privileged && (
                              <Chip
                                size="small"
                                color="warning"
                                variant="outlined"
                                label={t('accessReviews.evidence.privileged')}
                              />
                            )}
                          </Stack>
                        </Box>
                        <Chip
                          size="small"
                          color={decisionColor(item.decision)}
                          label={t(`accessReviews.decisions.${item.decision}`)}
                        />
                      </Stack>
                      {item.decision === 'PENDING' &&
                        selectedCampaign.lifecycleState === 'ACTIVE' && (
                          <ActionButton
                            size="small"
                            intent="quiet"
                            sx={{ mt: 1 }}
                            onClick={() => setDecisionItem(item)}
                          >
                            {t('accessReviews.actions.review')}
                          </ActionButton>
                        )}
                    </Box>
                  ))}
                </Box>
              )}
            </>
          ) : (
            <Box
              sx={{
                minHeight: 480,
                display: 'grid',
                placeItems: 'center',
                textAlign: 'center',
                p: 3,
              }}
            >
              <Box>
                <CalendarClock size={30} color={theme.palette.text.disabled} />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {t('accessReviews.selectCampaign')}
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      <AccessReviewCampaignDialog
        key={createOpen ? 'campaign-open' : 'campaign-closed'}
        open={createOpen}
        busy={busy}
        onClose={() => setCreateOpen(false)}
        onCreate={createCampaign}
      />
      <DecisionDialog
        key={decisionItem ? `decision-${decisionItem.itemId}` : 'decision-closed'}
        item={decisionItem}
        busy={busy}
        onClose={() => setDecisionItem(null)}
        onDecide={decide}
      />
    </>
  );
}
