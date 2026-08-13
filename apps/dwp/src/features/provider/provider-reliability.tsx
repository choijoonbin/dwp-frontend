import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDisplayDictionary } from '@dwp-frontend/shared-i18n';
import { Link as RouterLink } from 'react-router-dom';
import { CalendarClock, ListChecks, Plus } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createProviderMaintenanceWindow,
  getProviderReliabilityControl,
  useToast,
} from '@dwp-frontend/shared-utils';
import { ActionButton, foundationTokens } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import type {
  ProviderCellPosture,
  ProviderServicePosture,
  ProviderTenant,
} from '@dwp-frontend/shared-utils';

import {
  formatProviderDate,
  ProviderError,
  ProviderLoading,
  ProviderSectionHeading,
  ProviderStatusChip,
  providerError,
} from './provider-ui';

type ReliabilityView = 'SLO' | 'DRIFT' | 'MAINTENANCE';

type MaintenanceDraft = {
  trackingKey: string;
  title: string;
  summary: string;
  scopeType: 'GLOBAL' | 'SERVICE' | 'REGION' | 'CELL' | 'TENANT';
  target: string;
  impactType:
    | 'NO_IMPACT'
    | 'BRIEF_INTERRUPTION'
    | 'DEGRADED_PERFORMANCE'
    | 'SERVICE_UNAVAILABLE'
    | 'FAILOVER'
    | 'OTHER';
  expectedImpactSeconds: number;
  startsAt: string;
  endsAt: string;
  customerNoticeAt: string;
  minimumNoticeHours: number;
};

function localDateTime(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function initialMaintenance(): MaintenanceDraft {
  const start = new Date(Date.now() + 7 * 24 * 60 * 60_000);
  const end = new Date(start.getTime() + 2 * 60 * 60_000);
  const currentLocalDate = localDateTime(new Date()).slice(0, 10).replace(/-/g, '');
  return {
    trackingKey: `MW-${currentLocalDate}`,
    title: '',
    summary: '',
    scopeType: 'SERVICE',
    target: '',
    impactType: 'NO_IMPACT',
    expectedImpactSeconds: 0,
    startsAt: localDateTime(start),
    endsAt: localDateTime(end),
    customerNoticeAt: localDateTime(new Date()),
    minimumNoticeHours: 120,
  };
}

function MaintenanceDialog({
  services,
  cells,
  tenants,
  busy,
  onClose,
  onCreate,
}: {
  services: ProviderServicePosture[];
  cells: ProviderCellPosture[];
  tenants: ProviderTenant[];
  busy: boolean;
  onClose: () => void;
  onCreate: (draft: MaintenanceDraft) => Promise<void>;
}) {
  const { t } = useTranslation('provider');
  const [draft, setDraft] = useState(initialMaintenance);
  const regions = useMemo(() => [...new Set(cells.map((cell) => cell.regionKey))].sort(), [cells]);
  const targets =
    draft.scopeType === 'SERVICE'
      ? services.map((service) => ({ value: service.serviceKey, label: service.displayName }))
      : draft.scopeType === 'REGION'
        ? regions.map((region) => ({ value: region, label: region }))
        : draft.scopeType === 'CELL'
          ? cells.map((cell) => ({ value: cell.deploymentCellId, label: cell.displayName }))
          : draft.scopeType === 'TENANT'
            ? tenants.map((tenant) => ({ value: tenant.tenantId, label: tenant.displayName }))
            : [];
  const valid =
    draft.trackingKey.trim() &&
    draft.title.trim() &&
    draft.summary.trim() &&
    draft.startsAt &&
    draft.endsAt &&
    (draft.scopeType === 'GLOBAL' || draft.target);

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{t('reliability.maintenance.dialog.title')}</DialogTitle>
      <DialogContent dividers>
        <Stack gap={2}>
          <Alert severity="info">{t('reliability.maintenance.dialog.notice')}</Alert>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
            <TextField
              required
              fullWidth
              label={t('reliability.maintenance.fields.trackingKey')}
              value={draft.trackingKey}
              onChange={(event) =>
                setDraft((value) => ({ ...value, trackingKey: event.target.value.toUpperCase() }))
              }
            />
            <TextField
              required
              fullWidth
              label={t('reliability.maintenance.fields.title')}
              value={draft.title}
              onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))}
            />
          </Stack>
          <TextField
            required
            multiline
            minRows={2}
            label={t('reliability.maintenance.fields.summary')}
            value={draft.summary}
            onChange={(event) => setDraft((value) => ({ ...value, summary: event.target.value }))}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
            <TextField
              select
              fullWidth
              label={t('reliability.maintenance.fields.scope')}
              value={draft.scopeType}
              onChange={(event) =>
                setDraft((value) => ({
                  ...value,
                  scopeType: event.target.value as MaintenanceDraft['scopeType'],
                  target: '',
                }))
              }
            >
              {['GLOBAL', 'SERVICE', 'REGION', 'CELL', 'TENANT'].map((scope) => (
                <MenuItem key={scope} value={scope}>
                  {t(`health.scopes.${scope}`)}
                </MenuItem>
              ))}
            </TextField>
            {draft.scopeType !== 'GLOBAL' && (
              <TextField
                select
                required
                fullWidth
                label={t('reliability.maintenance.fields.target')}
                value={draft.target}
                onChange={(event) =>
                  setDraft((value) => ({ ...value, target: event.target.value }))
                }
              >
                {targets.map((target) => (
                  <MenuItem key={target.value} value={target.value}>
                    {target.label}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
            <TextField
              select
              fullWidth
              label={t('reliability.maintenance.fields.impactType')}
              value={draft.impactType}
              onChange={(event) =>
                setDraft((value) => ({
                  ...value,
                  impactType: event.target.value as MaintenanceDraft['impactType'],
                }))
              }
            >
              {[
                'NO_IMPACT',
                'BRIEF_INTERRUPTION',
                'DEGRADED_PERFORMANCE',
                'SERVICE_UNAVAILABLE',
                'FAILOVER',
                'OTHER',
              ].map((impact) => (
                <MenuItem key={impact} value={impact}>
                  {t(`reliability.maintenance.impact.${impact}`)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              type="number"
              fullWidth
              label={t('reliability.maintenance.fields.impactSeconds')}
              value={draft.expectedImpactSeconds}
              inputProps={{ min: 0, max: 86400 }}
              onChange={(event) =>
                setDraft((value) => ({
                  ...value,
                  expectedImpactSeconds: Number(event.target.value),
                }))
              }
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
            <TextField
              type="datetime-local"
              fullWidth
              label={t('reliability.maintenance.fields.startsAt')}
              value={draft.startsAt}
              InputLabelProps={{ shrink: true }}
              onChange={(event) =>
                setDraft((value) => ({ ...value, startsAt: event.target.value }))
              }
            />
            <TextField
              type="datetime-local"
              fullWidth
              label={t('reliability.maintenance.fields.endsAt')}
              value={draft.endsAt}
              InputLabelProps={{ shrink: true }}
              onChange={(event) => setDraft((value) => ({ ...value, endsAt: event.target.value }))}
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
            <TextField
              type="datetime-local"
              fullWidth
              label={t('reliability.maintenance.fields.noticeAt')}
              value={draft.customerNoticeAt}
              InputLabelProps={{ shrink: true }}
              onChange={(event) =>
                setDraft((value) => ({ ...value, customerNoticeAt: event.target.value }))
              }
            />
            <TextField
              type="number"
              fullWidth
              label={t('reliability.maintenance.fields.minimumNotice')}
              value={draft.minimumNoticeHours}
              inputProps={{ min: 0, max: 720 }}
              onChange={(event) =>
                setDraft((value) => ({ ...value, minimumNoticeHours: Number(event.target.value) }))
              }
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {t('actions.cancel')}
        </Button>
        <Button
          variant="contained"
          startIcon={<CalendarClock size={17} />}
          disabled={busy || !valid}
          onClick={() => void onCreate(draft)}
        >
          {t('reliability.maintenance.actions.schedule')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function ProviderReliability({
  services,
  cells,
  tenants,
  canSchedule,
}: {
  services: ProviderServicePosture[];
  cells: ProviderCellPosture[];
  tenants: ProviderTenant[];
  canSchedule: boolean;
}) {
  const { t } = useTranslation('provider');
  const display = useDisplayDictionary();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [view, setView] = useState<ReliabilityView>('SLO');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const reliability = useQuery({
    queryKey: ['provider', 'reliability-control'],
    queryFn: getProviderReliabilityControl,
    refetchInterval: 60_000,
  });

  if (reliability.isLoading) return <ProviderLoading />;
  if (reliability.isError || !reliability.data) return <ProviderError error={reliability.error} />;

  const createMaintenance = async (draft: MaintenanceDraft) => {
    setBusy(true);
    try {
      await createProviderMaintenanceWindow({
        trackingKey: draft.trackingKey.trim(),
        title: draft.title.trim(),
        summary: draft.summary.trim(),
        scopeType: draft.scopeType,
        serviceKey: draft.scopeType === 'SERVICE' ? draft.target : null,
        regionKey: draft.scopeType === 'REGION' ? draft.target : null,
        deploymentCellId: draft.scopeType === 'CELL' ? draft.target : null,
        tenantId: draft.scopeType === 'TENANT' ? draft.target : null,
        impactType: draft.impactType,
        expectedImpactSeconds: draft.expectedImpactSeconds,
        startsAt: new Date(draft.startsAt).toISOString(),
        endsAt: new Date(draft.endsAt).toISOString(),
        customerNoticeAt: new Date(draft.customerNoticeAt).toISOString(),
        minimumNoticeHours: draft.minimumNoticeHours,
      });
      setDialogOpen(false);
      toast.success(t('reliability.maintenance.reviewRequested'));
      await queryClient.invalidateQueries({ queryKey: ['provider'] });
    } catch (error) {
      toast.error(providerError(error, t('errors.operation')));
    } finally {
      setBusy(false);
    }
  };

  const riskObjectives = reliability.data.atRiskObjectives + reliability.data.exhaustedObjectives;

  return (
    <Paper component="section" variant="outlined" sx={{ minWidth: 0, p: 2 }}>
      <ProviderSectionHeading
        title={t('reliability.title')}
        description={t('reliability.description')}
      />

      <Stack direction="row" alignItems="center" flexWrap="wrap" gap={0.75} sx={{ mt: 1.5 }}>
        <Chip
          size="small"
          variant="outlined"
          color="success"
          label={`${t('reliability.metrics.healthyObjectives')} ${reliability.data.healthyObjectives}`}
        />
        <Chip
          size="small"
          variant="outlined"
          color={riskObjectives ? 'warning' : 'default'}
          label={`${t('reliability.metrics.atRiskObjectives')} ${riskObjectives}`}
        />
        <Chip
          size="small"
          variant="outlined"
          color={reliability.data.openDriftFindings ? 'error' : 'default'}
          label={`${t('reliability.metrics.drift')} ${reliability.data.openDriftFindings}`}
        />
        <Chip
          size="small"
          variant="outlined"
          color={reliability.data.upcomingMaintenance ? 'info' : 'default'}
          label={`${t('reliability.metrics.maintenance')} ${reliability.data.upcomingMaintenance}`}
        />
        <Typography variant="caption" color="text.secondary" sx={{ ml: { sm: 'auto' } }}>
          {t('health.lastUpdated', { value: formatProviderDate(reliability.data.generatedAt) })}
        </Typography>
      </Stack>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        gap={1}
        sx={{ mt: 1.25, pt: 1.25, borderTop: 1, borderColor: 'divider' }}
      >
        <ToggleButtonGroup
          exclusive
          size="small"
          value={view}
          onChange={(_event, value: ReliabilityView | null) => value && setView(value)}
          aria-label={t('reliability.viewLabel')}
        >
          <ToggleButton value="SLO">{t('reliability.views.SLO')}</ToggleButton>
          <ToggleButton value="DRIFT">{t('reliability.views.DRIFT')}</ToggleButton>
          <ToggleButton value="MAINTENANCE">{t('reliability.views.MAINTENANCE')}</ToggleButton>
        </ToggleButtonGroup>
        {view === 'MAINTENANCE' && canSchedule && (
          <ActionButton
            intent="primary"
            size="small"
            startIcon={<Plus size={16} />}
            onClick={() => setDialogOpen(true)}
          >
            {t('reliability.maintenance.actions.create')}
          </ActionButton>
        )}
      </Stack>

      {view === 'SLO' && (
        <Stack divider={<Divider flexItem />} sx={{ mt: 1 }}>
          {reliability.data.objectives.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              {t('reliability.slo.empty')}
            </Typography>
          ) : (
            reliability.data.objectives.map((objective) => {
              const budget = Math.max(0, Math.min(100, objective.errorBudgetRemainingPct ?? 0));
              const budgetColor =
                objective.complianceState === 'EXHAUSTED'
                  ? foundationTokens.color.data.coral
                  : objective.complianceState === 'AT_RISK'
                    ? foundationTokens.color.data.saffron
                    : foundationTokens.color.data.teal;
              return (
                <Box key={objective.objectiveId} sx={{ py: 1.35 }}>
                  <Stack
                    direction="row"
                    alignItems="flex-start"
                    justifyContent="space-between"
                    gap={1.5}
                  >
                    <Box minWidth={0}>
                      <Typography variant="body2" fontWeight={750}>
                        {objective.serviceName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('reliability.slo.target', {
                          target: objective.targetPct,
                          days: objective.complianceWindowDays,
                          scope: objective.scopeLabel,
                        })}
                      </Typography>
                    </Box>
                    <ProviderStatusChip state={objective.complianceState} />
                  </Stack>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    alignItems={{ sm: 'center' }}
                    gap={1}
                    sx={{ mt: 0.9 }}
                  >
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Stack direction="row" justifyContent="space-between" gap={1}>
                        <Typography variant="caption" color="text.secondary">
                          {t('reliability.slo.errorBudget')}
                        </Typography>
                        <Typography variant="caption" fontWeight={750}>
                          {objective.errorBudgetRemainingPct == null
                            ? t('reliability.slo.noData')
                            : `${objective.errorBudgetRemainingPct.toFixed(1)}%`}
                        </Typography>
                      </Stack>
                      <Box
                        role="meter"
                        aria-label={t('reliability.slo.budgetLabel', {
                          name: objective.displayName,
                        })}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(budget)}
                        sx={{
                          mt: 0.45,
                          height: 6,
                          overflow: 'hidden',
                          borderRadius: 0.5,
                          bgcolor: 'action.hover',
                        }}
                      >
                        <Box sx={{ width: `${budget}%`, height: 1, bgcolor: budgetColor }} />
                      </Box>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 148 }}>
                      {t('reliability.slo.achieved', {
                        value:
                          objective.achievedPct == null
                            ? t('reliability.slo.noData')
                            : `${objective.achievedPct.toFixed(3)}%`,
                      })}
                    </Typography>
                  </Stack>
                </Box>
              );
            })
          )}
        </Stack>
      )}

      {view === 'DRIFT' && (
        <Stack divider={<Divider flexItem />} sx={{ mt: 1 }}>
          {reliability.data.driftFindings.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2.5 }}>
              {t('reliability.drift.empty')}
            </Typography>
          ) : (
            reliability.data.driftFindings.map((finding) => (
              <Stack
                key={finding.evaluationId}
                direction={{ xs: 'column', md: 'row' }}
                alignItems={{ xs: 'stretch', md: 'center' }}
                gap={{ xs: 1, md: 2 }}
                sx={{ py: 1.4 }}
              >
                <Chip
                  size="small"
                  variant="outlined"
                  label={display('riskTiers', finding.riskTier)}
                />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" fontWeight={750} noWrap>
                    {finding.controlName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap display="block">
                    {finding.tenantName || finding.targetType} · {finding.controlBehavior} ·{' '}
                    {finding.guidanceLevel}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {finding.remediationOperationType || t('reliability.drift.manualReview')}
                </Typography>
                <ProviderStatusChip state={finding.evaluationResult} />
              </Stack>
            ))
          )}
        </Stack>
      )}

      {view === 'MAINTENANCE' && (
        <Stack divider={<Divider flexItem />} sx={{ mt: 1 }}>
          {reliability.data.maintenanceWindows.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2.5 }}>
              {t('reliability.maintenance.empty')}
            </Typography>
          ) : (
            reliability.data.maintenanceWindows.map((maintenance) => (
              <Stack
                key={maintenance.maintenanceWindowId}
                direction={{ xs: 'column', md: 'row' }}
                alignItems={{ xs: 'stretch', md: 'center' }}
                gap={{ xs: 1, md: 2 }}
                sx={{ py: 1.4 }}
              >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" fontWeight={750} noWrap>
                    {maintenance.trackingKey} · {maintenance.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap display="block">
                    {maintenance.scopeLabel} ·{' '}
                    {t(`reliability.maintenance.impact.${maintenance.impactType}`)}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {formatProviderDate(maintenance.startsAt)}
                </Typography>
                <Chip
                  size="small"
                  color={maintenance.noticeCompliant ? 'success' : 'warning'}
                  variant="outlined"
                  label={
                    maintenance.noticeCompliant
                      ? t('reliability.maintenance.noticeCompliant')
                      : t('reliability.maintenance.noticeRisk')
                  }
                />
                <ProviderStatusChip state={maintenance.lifecycleState} />
                {maintenance.lifecycleState === 'DRAFT' && (
                  <ActionButton
                    intent="quiet"
                    component={RouterLink}
                    to="/provider/operations"
                    size="small"
                    startIcon={<ListChecks size={16} />}
                    sx={{ alignSelf: { xs: 'flex-start', md: 'center' } }}
                  >
                    {t('reliability.maintenance.actions.reviewChange')}
                  </ActionButton>
                )}
              </Stack>
            ))
          )}
        </Stack>
      )}

      {dialogOpen && (
        <MaintenanceDialog
          services={services}
          cells={cells}
          tenants={tenants}
          busy={busy}
          onClose={() => setDialogOpen(false)}
          onCreate={createMaintenance}
        />
      )}
    </Paper>
  );
}
