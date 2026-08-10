import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  CircleMinus,
  Copy,
  Eye,
  GitPullRequest,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatNumber } from '@dwp-frontend/shared-i18n';
import {
  addOrganizationScenarioMove,
  cloneOrganizationScenario,
  createOrganizationScenario,
  decideOrganizationScenario,
  getOrganizationScenarioDecisionPack,
  getOrganizationScenarioDecisionHistory,
  listOrganizationScenarios,
  publishOrganizationScenario,
  removeOrganizationScenarioChange,
  submitOrganizationScenario,
  useToast,
  validateOrganizationScenarioDecisionPack,
} from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import type {
  OrganizationChart,
  OrganizationScenario,
  OrganizationScenarioChange,
} from '@dwp-frontend/shared-utils';

import { OrganizationScenarioComparison } from './organization-scenario-comparison';
import { OrganizationScenarioDecisionPackView } from './organization-scenario-decision-pack';
import { OrganizationScenarioPositionEditor } from './organization-scenario-position-editor';

type Props = {
  open: boolean;
  chart: OrganizationChart;
  currentUserId?: number;
  previewScenarioId?: string;
  onPreviewScenario: (scenarioId: string) => void;
  onScenarioChanged: () => void;
  onClose: () => void;
};

function plusDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function scenarioKey(): string {
  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);
  return `org-${timestamp}-${crypto.randomUUID().slice(0, 8)}`;
}

function statusColor(state: string): 'default' | 'info' | 'warning' | 'success' | 'error' {
  if (state === 'DRAFT') return 'default';
  if (state === 'IN_REVIEW') return 'warning';
  if (state === 'APPROVED' || state === 'PUBLISHED') return 'success';
  if (state === 'REJECTED' || state === 'STALE') return 'error';
  return 'info';
}

function changeSnapshot(change: OrganizationScenarioChange): Record<string, unknown> {
  try {
    return JSON.parse(change.afterSnapshot) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function OrganizationScenarioDrawer({
  open,
  chart,
  currentUserId,
  previewScenarioId,
  onPreviewScenario,
  onScenarioChanged,
  onClose,
}: Props) {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [cloneSourceId, setCloneSourceId] = useState<string>();
  const [comparisonScenarioId, setComparisonScenarioId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [baselineDate, setBaselineDate] = useState(chart.asOf);
  const [effectiveDate, setEffectiveDate] = useState(plusDays(chart.asOf, 30));
  const [organizationId, setOrganizationId] = useState('');
  const [newParentId, setNewParentId] = useState('');
  const [moveKind, setMoveKind] = useState<'organization' | 'position'>('organization');
  const [reason, setReason] = useState('');

  const scenariosQuery = useQuery({
    queryKey: ['admin', 'organization-scenarios'],
    queryFn: listOrganizationScenarios,
    enabled: open,
  });
  const scenarios = useMemo(() => scenariosQuery.data ?? [], [scenariosQuery.data]);
  const selected = scenarios.find((scenario) => scenario.scenarioId === selectedId) ?? scenarios[0];
  const decisionQuery = useQuery({
    queryKey: ['admin', 'organization-scenarios', selected?.scenarioId, 'decision-pack'],
    queryFn: () => getOrganizationScenarioDecisionPack(selected?.scenarioId as string),
    enabled: open && Boolean(selected?.scenarioId),
  });
  const decisionHistoryQuery = useQuery({
    queryKey: ['admin', 'organization-scenarios', selected?.scenarioId, 'decision-history'],
    queryFn: () => getOrganizationScenarioDecisionHistory(selected?.scenarioId as string),
    enabled: open && Boolean(selected?.scenarioId),
  });
  const comparisonScenario = scenarios.find(
    (scenario) => scenario.scenarioId === comparisonScenarioId
  );
  const comparisonDecisionQuery = useQuery({
    queryKey: ['admin', 'organization-scenarios', comparisonScenario?.scenarioId, 'decision-pack'],
    queryFn: () => getOrganizationScenarioDecisionPack(comparisonScenario?.scenarioId as string),
    enabled: open && Boolean(comparisonScenario?.scenarioId),
  });
  const organizationsById = useMemo(
    () =>
      new Map(
        chart.organizations.map((organization) => [organization.organizationId, organization])
      ),
    [chart.organizations]
  );
  const positionsById = useMemo(
    () => new Map(chart.positions.map((position) => [position.positionId, position])),
    [chart.positions]
  );

  useEffect(() => {
    if (selectedId || !scenarios.length) return;
    setSelectedId(scenarios[0]?.scenarioId);
  }, [scenarios, selectedId]);

  useEffect(() => {
    if (!open) return;
    setBaselineDate(chart.asOf);
    setEffectiveDate(plusDays(chart.asOf, 30));
  }, [chart.asOf, open]);

  useEffect(() => {
    if (!comparisonScenarioId) return;
    if (
      comparisonScenarioId === selected?.scenarioId ||
      !scenarios.some((scenario) => scenario.scenarioId === comparisonScenarioId)
    ) {
      setComparisonScenarioId('');
    }
  }, [comparisonScenarioId, scenarios, selected?.scenarioId]);

  const replaceScenario = (next: OrganizationScenario) => {
    queryClient.setQueryData<OrganizationScenario[]>(
      ['admin', 'organization-scenarios'],
      (current = []) => {
        const found = current.some((item) => item.scenarioId === next.scenarioId);
        return found
          ? current.map((item) => (item.scenarioId === next.scenarioId ? next : item))
          : [next, ...current];
      }
    );
    setSelectedId(next.scenarioId);
  };

  const execute = async (
    operation: () => Promise<OrganizationScenario>,
    successMessage: string
  ) => {
    setBusy(true);
    setError(undefined);
    try {
      const next = await operation();
      replaceScenario(next);
      onScenarioChanged();
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'organization-scenarios', next.scenarioId, 'decision-pack'],
      });
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'organization-scenarios', next.scenarioId, 'decision-history'],
      });
      toast.success(successMessage);
      return next;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : t('common.operationError');
      setError(message);
      toast.error(message);
      return undefined;
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    const next = await execute(
      () => {
        const common = {
          scenarioKey: scenarioKey(),
          name: name.trim(),
          description: description.trim() || undefined,
          effectiveDate,
        };
        return cloneSourceId
          ? cloneOrganizationScenario(cloneSourceId, common)
          : createOrganizationScenario({ ...common, baselineDate });
      },
      t(
        cloneSourceId ? 'orgChart.scenarios.messages.cloned' : 'orgChart.scenarios.messages.created'
      )
    );
    if (!next) return;
    setCreating(false);
    setCloneSourceId(undefined);
    setName('');
    setDescription('');
  };

  const handleMove = async () => {
    if (!selected || !organizationId || !newParentId) return;
    const next = await execute(
      () => addOrganizationScenarioMove(selected, organizationId, newParentId),
      t('orgChart.scenarios.messages.moveAdded')
    );
    if (!next) return;
    setOrganizationId('');
    setNewParentId('');
  };

  const selectedOrganization = organizationsById.get(organizationId);
  const disallowedParentIds = useMemo(() => {
    if (!organizationId) return new Set<string>();
    const children = new Map<string, string[]>();
    chart.organizations.forEach((organization) => {
      if (!organization.parentOrganizationId) return;
      children.set(organization.parentOrganizationId, [
        ...(children.get(organization.parentOrganizationId) ?? []),
        organization.organizationId,
      ]);
    });
    const result = new Set<string>();
    const queue = [organizationId];
    while (queue.length) {
      const current = queue.shift();
      if (!current || result.has(current)) continue;
      result.add(current);
      queue.push(...(children.get(current) ?? []));
    }
    return result;
  }, [chart.organizations, organizationId]);
  const moveCandidates = chart.organizations.filter(
    (organization) => !disallowedParentIds.has(organization.organizationId)
  );
  const handleValidate = async () => {
    if (!selected) return;
    setBusy(true);
    setError(undefined);
    try {
      const decision = await validateOrganizationScenarioDecisionPack(selected);
      queryClient.setQueryData(
        ['admin', 'organization-scenarios', selected.scenarioId, 'decision-pack'],
        decision
      );
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'organization-scenarios', selected.scenarioId, 'decision-history'],
      });
      toast.success(t('orgChart.scenarios.decision.messages.validated'));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : t('common.operationError');
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      anchor="right"
      PaperProps={{
        'aria-label': t('orgChart.scenarios.panelLabel'),
        sx: { width: { xs: '100%', md: 800 }, maxWidth: '100vw' },
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2 }}>
        <Stack direction="row" alignItems="center" gap={1}>
          <GitPullRequest size={20} strokeWidth={1.8} />
          <Box>
            <Typography variant="h6" fontSize={18} fontWeight={750}>
              {t('orgChart.scenarios.title')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('orgChart.scenarios.subtitle')}
            </Typography>
          </Box>
        </Stack>
        <Tooltip title={t('common.actions.close')}>
          <IconButton onClick={onClose} aria-label={t('common.actions.close')}>
            <X size={18} />
          </IconButton>
        </Tooltip>
      </Stack>
      <Divider />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '230px minmax(0, 1fr)' },
          minHeight: 0,
          flex: 1,
        }}
      >
        <Box
          sx={{ borderRight: { md: 1 }, borderBottom: { xs: 1, md: 0 }, borderColor: 'divider' }}
        >
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ px: 1.5, py: 1.25 }}
          >
            <Typography variant="subtitle2">{t('orgChart.scenarios.list')}</Typography>
            <Tooltip title={t('orgChart.scenarios.create')}>
              <IconButton
                size="small"
                onClick={() => {
                  setCloneSourceId(undefined);
                  setName('');
                  setDescription('');
                  setBaselineDate(chart.asOf);
                  setEffectiveDate(plusDays(chart.asOf, 30));
                  setCreating(true);
                }}
                aria-label={t('orgChart.scenarios.create')}
              >
                <Plus size={17} />
              </IconButton>
            </Tooltip>
          </Stack>
          <Divider />
          {scenariosQuery.isLoading ? (
            <Stack alignItems="center" sx={{ py: 4 }}>
              <CircularProgress size={22} />
            </Stack>
          ) : (
            <List
              dense
              disablePadding
              sx={{ maxHeight: { xs: 180, md: 'calc(100vh - 150px)' }, overflow: 'auto' }}
            >
              {scenarios.map((scenario) => (
                <ListItemButton
                  key={scenario.scenarioId}
                  selected={scenario.scenarioId === selected?.scenarioId}
                  onClick={() => {
                    setSelectedId(scenario.scenarioId);
                    setCreating(false);
                    setCloneSourceId(undefined);
                    setError(undefined);
                  }}
                  sx={{ alignItems: 'flex-start', py: 1.25 }}
                >
                  <ListItemText
                    primary={scenario.name}
                    secondary={t('orgChart.scenarios.listItem', {
                      date: scenario.effectiveDate,
                      count: scenario.changes.length,
                    })}
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 650 }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                  <Chip
                    size="small"
                    variant="outlined"
                    color={statusColor(scenario.lifecycleState)}
                    label={t(`orgChart.scenarios.states.${scenario.lifecycleState}`, {
                      defaultValue: scenario.lifecycleState,
                    })}
                    sx={{ ml: 0.5 }}
                  />
                </ListItemButton>
              ))}
              {!scenarios.length && (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                  {t('orgChart.scenarios.empty')}
                </Typography>
              )}
            </List>
          )}
        </Box>

        <Box sx={{ minWidth: 0, overflow: 'auto', maxHeight: 'calc(100vh - 82px)' }}>
          {error && (
            <Alert severity="error" sx={{ m: 2, mb: 0 }}>
              {error}
            </Alert>
          )}
          {creating ? (
            <Stack gap={2} sx={{ p: 2.5 }}>
              <Box>
                <Typography variant="subtitle1" fontWeight={750}>
                  {t(
                    cloneSourceId ? 'orgChart.scenarios.clone.title' : 'orgChart.scenarios.create'
                  )}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t(
                    cloneSourceId
                      ? 'orgChart.scenarios.clone.help'
                      : 'orgChart.scenarios.createHelp'
                  )}
                </Typography>
              </Box>
              <TextField
                required
                size="small"
                label={t('orgChart.scenarios.fields.name')}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <TextField
                multiline
                minRows={3}
                size="small"
                label={t('orgChart.scenarios.fields.description')}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5}>
                <TextField
                  fullWidth
                  type="date"
                  size="small"
                  label={t('orgChart.scenarios.fields.baselineDate')}
                  value={baselineDate}
                  onChange={(event) => setBaselineDate(event.target.value)}
                  disabled={Boolean(cloneSourceId)}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  fullWidth
                  type="date"
                  size="small"
                  label={t('orgChart.scenarios.fields.effectiveDate')}
                  value={effectiveDate}
                  onChange={(event) => setEffectiveDate(event.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Stack>
              <Stack direction="row" justifyContent="flex-end" gap={1}>
                <Button
                  onClick={() => {
                    setCreating(false);
                    setCloneSourceId(undefined);
                  }}
                >
                  {t('common.actions.cancel')}
                </Button>
                <Button
                  variant="contained"
                  startIcon={
                    busy ? <CircularProgress size={14} color="inherit" /> : <Plus size={15} />
                  }
                  disabled={busy || !name.trim()}
                  onClick={() => void handleCreate()}
                >
                  {t(
                    cloneSourceId ? 'orgChart.scenarios.clone.action' : 'orgChart.scenarios.create'
                  )}
                </Button>
              </Stack>
            </Stack>
          ) : selected ? (
            <Stack gap={2.25} sx={{ p: 2.5 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
                <Box>
                  <Stack direction="row" alignItems="center" gap={1}>
                    <Typography variant="h6" fontSize={18} fontWeight={750}>
                      {selected.name}
                    </Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={statusColor(selected.lifecycleState)}
                      label={t(`orgChart.scenarios.states.${selected.lifecycleState}`, {
                        defaultValue: selected.lifecycleState,
                      })}
                    />
                    {(selected.approval || selected.lifecycleState === 'PUBLISHED') && (
                      <Chip
                        size="small"
                        variant="outlined"
                        icon={<ShieldCheck size={14} />}
                        color={
                          (selected.lifecycleState === 'PUBLISHED'
                            ? selected.publicationEvidenceState
                            : selected.approval?.evidenceBindingState) === 'BOUND'
                            ? 'success'
                            : 'warning'
                        }
                        label={
                          (selected.lifecycleState === 'PUBLISHED'
                            ? selected.publicationEvidenceState
                            : selected.approval?.evidenceBindingState) === 'BOUND'
                            ? t('orgChart.scenarios.evidenceBound')
                            : t('orgChart.scenarios.legacyEvidence')
                        }
                      />
                    )}
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {selected.description || t('orgChart.scenarios.noDescription')}
                  </Typography>
                  {selected.sourceScenarioId && (
                    <Stack direction="row" alignItems="center" gap={0.5} sx={{ mt: 0.5 }}>
                      <Copy size={13} />
                      <Typography variant="caption" color="text.secondary">
                        {t('orgChart.scenarios.clone.source', {
                          name:
                            scenarios.find(
                              (scenario) => scenario.scenarioId === selected.sourceScenarioId
                            )?.name || selected.sourceScenarioId,
                        })}
                      </Typography>
                    </Stack>
                  )}
                </Box>
                <Stack direction="row" alignItems="center" gap={0.75} color="text.secondary">
                  <CalendarClock size={16} />
                  <Typography variant="caption" sx={{ whiteSpace: 'nowrap' }}>
                    {selected.baselineDate}{' '}
                    <ArrowRight size={12} style={{ verticalAlign: 'middle' }} />{' '}
                    {selected.effectiveDate}
                  </Typography>
                </Stack>
              </Stack>

              <OrganizationScenarioDecisionPackView
                decision={decisionQuery.data}
                history={decisionHistoryQuery.data ?? []}
                loading={decisionQuery.isLoading}
                validating={busy}
                onValidate={() => void handleValidate()}
              />

              <OrganizationScenarioComparison
                scenarios={scenarios}
                selected={selected}
                selectedDecision={decisionQuery.data}
                comparisonScenario={comparisonScenario}
                comparisonDecision={comparisonDecisionQuery.data}
                comparisonScenarioId={comparisonScenarioId}
                loading={comparisonDecisionQuery.isLoading}
                onComparisonChange={setComparisonScenarioId}
              />

              <Alert severity="info" icon={<ShieldCheck size={18} />}>
                {t('orgChart.scenarios.governanceNotice')}
              </Alert>

              <Stack direction="row" justifyContent="flex-end" gap={0.75}>
                <Tooltip title={t('orgChart.scenarios.clone.action')}>
                  <span>
                    <IconButton
                      size="small"
                      aria-label={t('orgChart.scenarios.clone.action')}
                      disabled={
                        !['DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED'].includes(
                          selected.lifecycleState
                        )
                      }
                      onClick={() => {
                        setCloneSourceId(selected.scenarioId);
                        setName(t('orgChart.scenarios.clone.defaultName', { name: selected.name }));
                        setDescription(selected.description || '');
                        setBaselineDate(selected.baselineDate);
                        setEffectiveDate(
                          selected.effectiveDate < chart.asOf ? chart.asOf : selected.effectiveDate
                        );
                        setCreating(true);
                      }}
                    >
                      <Copy size={16} />
                    </IconButton>
                  </span>
                </Tooltip>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Eye size={15} />}
                  disabled={!selected.changes.length || previewScenarioId === selected.scenarioId}
                  onClick={() => onPreviewScenario(selected.scenarioId)}
                >
                  {previewScenarioId === selected.scenarioId
                    ? t('orgChart.scenarios.previewActive')
                    : t('orgChart.scenarios.preview')}
                </Button>
              </Stack>

              {selected.lifecycleState === 'DRAFT' && (
                <Stack gap={1.25}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                    <Typography variant="subtitle2">
                      {t('orgChart.scenarios.move.title')}
                    </Typography>
                    <ToggleButtonGroup
                      exclusive
                      size="small"
                      value={moveKind}
                      aria-label={t('orgChart.scenarios.move.kindLabel')}
                      onChange={(_event, value: 'organization' | 'position' | null) =>
                        value && setMoveKind(value)
                      }
                    >
                      <ToggleButton value="organization">
                        {t('orgChart.scenarios.move.organizationKind')}
                      </ToggleButton>
                      <ToggleButton value="position">
                        {t('orgChart.scenarios.move.positionKind')}
                      </ToggleButton>
                    </ToggleButtonGroup>
                  </Stack>
                  {moveKind === 'organization' ? (
                    <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        label={t('orgChart.scenarios.move.organization')}
                        value={organizationId}
                        onChange={(event) => setOrganizationId(event.target.value)}
                      >
                        {chart.organizations
                          .filter((organization) => Boolean(organization.parentOrganizationId))
                          .map((organization) => (
                            <MenuItem
                              key={organization.organizationId}
                              value={organization.organizationId}
                            >
                              {organization.name}
                            </MenuItem>
                          ))}
                      </TextField>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        disabled={!selectedOrganization}
                        label={t('orgChart.scenarios.move.newParent')}
                        value={newParentId}
                        onChange={(event) => setNewParentId(event.target.value)}
                      >
                        {moveCandidates.map((organization) => (
                          <MenuItem
                            key={organization.organizationId}
                            value={organization.organizationId}
                          >
                            {organization.name}
                          </MenuItem>
                        ))}
                      </TextField>
                      <Button
                        variant="outlined"
                        disabled={busy || !organizationId || !newParentId}
                        onClick={() => void handleMove()}
                        sx={{ minWidth: 92 }}
                      >
                        {t('orgChart.scenarios.move.add')}
                      </Button>
                    </Stack>
                  ) : (
                    <OrganizationScenarioPositionEditor
                      chart={chart}
                      scenario={selected}
                      busy={busy}
                      execute={execute}
                    />
                  )}
                </Stack>
              )}

              <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
                  {t('orgChart.scenarios.changes', { count: selected.changes.length })}
                </Typography>
                <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
                  {selected.changes.map((change) => {
                    const snapshot = changeSnapshot(change);
                    const targetLabel =
                      change.targetKind === 'POSITION'
                        ? positionsById.get(change.targetReference)?.title ||
                          String(snapshot.title || change.targetReference)
                        : organizationsById.get(change.targetReference)?.name ||
                          change.targetReference;
                    const changeSummary =
                      change.changeType === 'CREATE_POSITION'
                        ? t('orgChart.scenarios.move.positionCreateSummary', {
                            fte: signed(change.estimatedFteDelta, 1),
                          })
                        : change.changeType === 'CLOSE_POSITION'
                          ? t('orgChart.scenarios.move.positionCloseSummary', {
                              fte: signed(change.estimatedFteDelta, 1),
                            })
                          : change.targetKind === 'POSITION'
                            ? t('orgChart.scenarios.move.positionSummary', {
                                parent:
                                  positionsById.get(change.relatedReference || '')?.title ||
                                  change.relatedReference,
                              })
                            : t('orgChart.scenarios.move.summary', {
                                parent:
                                  organizationsById.get(change.relatedReference || '')?.name ||
                                  change.relatedReference,
                              });
                    return (
                      <Stack
                        key={change.changeId}
                        direction="row"
                        alignItems="center"
                        gap={1}
                        sx={{ py: 1.25, borderBottom: 1, borderColor: 'divider' }}
                      >
                        <ChangeTypeIcon
                          targetKind={change.targetKind}
                          changeType={change.changeType}
                        />
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="body2" fontWeight={650}>
                            {targetLabel}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {changeSummary}
                          </Typography>
                        </Box>
                        <Stack direction="row" alignItems="center" gap={0.5}>
                          <Chip
                            size="small"
                            variant="outlined"
                            color={
                              change.validationState === 'VALID'
                                ? 'success'
                                : change.validationState === 'WARNING'
                                  ? 'warning'
                                  : 'error'
                            }
                            label={t(`orgChart.scenarios.validation.${change.validationState}`, {
                              defaultValue: change.validationState,
                            })}
                          />
                          {selected.lifecycleState === 'DRAFT' && (
                            <Tooltip title={t('orgChart.scenarios.removeChange')}>
                              <IconButton
                                size="small"
                                aria-label={t('orgChart.scenarios.removeChange')}
                                disabled={busy}
                                onClick={() =>
                                  void execute(
                                    () =>
                                      removeOrganizationScenarioChange(selected, change.changeId),
                                    t('orgChart.scenarios.messages.changeRemoved')
                                  )
                                }
                              >
                                <Trash2 size={15} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      </Stack>
                    );
                  })}
                  {!selected.changes.length && (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                      {t('orgChart.scenarios.noChanges')}
                    </Typography>
                  )}
                </Box>
              </Box>

              {selected.lifecycleState === 'DRAFT' && (
                <WorkflowAction
                  title={t('orgChart.scenarios.submit.title')}
                  help={t('orgChart.scenarios.submit.help')}
                  reason={reason}
                  setReason={setReason}
                  busy={busy}
                  disabled={!selected.changes.length}
                  icon={<Send size={15} />}
                  actionLabel={t('orgChart.scenarios.submit.action')}
                  onAction={async () => {
                    const next = await execute(
                      () => submitOrganizationScenario(selected, reason.trim()),
                      t('orgChart.scenarios.messages.submitted')
                    );
                    if (next) setReason('');
                  }}
                />
              )}

              {selected.lifecycleState === 'IN_REVIEW' &&
                (currentUserId === selected.ownerUserId ? (
                  <Alert severity="warning">{t('orgChart.scenarios.approval.separation')}</Alert>
                ) : (
                  <WorkflowAction
                    title={t('orgChart.scenarios.approval.title')}
                    help={t('orgChart.scenarios.approval.help')}
                    reason={reason}
                    setReason={setReason}
                    busy={busy}
                    icon={<ShieldCheck size={15} />}
                    actionLabel={t('orgChart.scenarios.approval.approve')}
                    secondaryLabel={t('orgChart.scenarios.approval.reject')}
                    onAction={async () => {
                      const next = await execute(
                        () => decideOrganizationScenario(selected, 'APPROVED', reason.trim()),
                        t('orgChart.scenarios.messages.approved')
                      );
                      if (next) setReason('');
                    }}
                    onSecondary={async () => {
                      const next = await execute(
                        () => decideOrganizationScenario(selected, 'REJECTED', reason.trim()),
                        t('orgChart.scenarios.messages.rejected')
                      );
                      if (next) setReason('');
                    }}
                  />
                ))}

              {selected.lifecycleState === 'APPROVED' && (
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  alignItems={{ sm: 'center' }}
                  justifyContent="space-between"
                  gap={1}
                  sx={{ pt: 1 }}
                >
                  <Box>
                    <Typography variant="subtitle2">
                      {t('orgChart.scenarios.publish.title')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('orgChart.scenarios.publish.help', { date: selected.effectiveDate })}
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    startIcon={
                      busy ? <CircularProgress size={14} color="inherit" /> : <Check size={15} />
                    }
                    disabled={busy}
                    onClick={() =>
                      void execute(
                        () => publishOrganizationScenario(selected),
                        t('orgChart.scenarios.messages.published')
                      )
                    }
                  >
                    {t('orgChart.scenarios.publish.action')}
                  </Button>
                </Stack>
              )}
            </Stack>
          ) : (
            <Stack
              alignItems="center"
              justifyContent="center"
              gap={1}
              sx={{ minHeight: 320, p: 3 }}
            >
              <GitPullRequest size={28} color="#64748B" />
              <Typography variant="body2" color="text.secondary">
                {t('orgChart.scenarios.empty')}
              </Typography>
              <Button
                variant="outlined"
                startIcon={<Plus size={15} />}
                onClick={() => setCreating(true)}
              >
                {t('orgChart.scenarios.create')}
              </Button>
            </Stack>
          )}
        </Box>
      </Box>
    </Drawer>
  );
}

function signed(value: number, fractionDigits = 0): string {
  return formatNumber(value, {
    signDisplay: 'always',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function ChangeTypeIcon({ targetKind, changeType }: { targetKind: string; changeType: string }) {
  return (
    <Box
      sx={{
        width: 30,
        height: 30,
        display: 'grid',
        placeItems: 'center',
        bgcolor: 'action.hover',
        borderRadius: 1,
      }}
    >
      {changeType === 'CREATE_POSITION' ? (
        <Plus size={16} />
      ) : changeType === 'CLOSE_POSITION' ? (
        <CircleMinus size={16} />
      ) : targetKind === 'POSITION' ? (
        <BriefcaseBusiness size={16} />
      ) : (
        <GitPullRequest size={16} />
      )}
    </Box>
  );
}

function WorkflowAction({
  title,
  help,
  reason,
  setReason,
  busy,
  disabled,
  icon,
  actionLabel,
  secondaryLabel,
  onAction,
  onSecondary,
}: {
  title: string;
  help: string;
  reason: string;
  setReason: (value: string) => void;
  busy: boolean;
  disabled?: boolean;
  icon: ReactNode;
  actionLabel: string;
  secondaryLabel?: string;
  onAction: () => Promise<void>;
  onSecondary?: () => Promise<void>;
}) {
  const { t } = useTranslation('admin');
  return (
    <Stack gap={1} sx={{ pt: 1 }}>
      <Box>
        <Typography variant="subtitle2">{title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {help}
        </Typography>
      </Box>
      <TextField
        multiline
        minRows={2}
        size="small"
        label={t('orgChart.scenarios.fields.reason')}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      <Stack direction="row" justifyContent="flex-end" gap={1}>
        {secondaryLabel && onSecondary && (
          <Button
            color="error"
            variant="outlined"
            disabled={busy || !reason.trim()}
            onClick={() => void onSecondary()}
          >
            {secondaryLabel}
          </Button>
        )}
        <Button
          variant="contained"
          startIcon={busy ? <CircularProgress size={14} color="inherit" /> : icon}
          disabled={busy || disabled || !reason.trim()}
          onClick={() => void onAction()}
        >
          {actionLabel}
        </Button>
      </Stack>
    </Stack>
  );
}
