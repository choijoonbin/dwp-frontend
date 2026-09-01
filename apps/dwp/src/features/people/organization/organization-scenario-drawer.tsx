import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
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
import { useDisplayDictionary } from '@dwp-frontend/shared-i18n';
import {
  addOrganizationScenarioMove,
  cancelOrganizationScenario,
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
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import type { OrganizationChart, OrganizationScenario } from '@dwp-frontend/shared-utils';

import { OrganizationScenarioComparison } from './organization-scenario-comparison';
import { OrganizationScenarioDecisionPackView } from './organization-scenario-decision-pack';
import {
  changeSnapshot,
  plusDays,
  scenarioKey,
  scenarioStatusColor,
} from './organization-scenario-drawer-model';
import { OrganizationScenarioListSection } from './organization-scenario-list-section';
import { OrganizationScenarioPositionEditor } from './organization-scenario-position-editor';
import { organizationScenarioQueryKeys } from './organization-scenario-query-keys';
import { ChangeTypeIcon, WorkflowAction, signed } from './organization-scenario-support';
import {
  ProductSurfaceHighRiskCommandDialog,
  productSurfaceHighRiskCommand,
  useProductSurfaceHighRiskCommand,
} from '../../../components/product-surface-high-risk-command';
import { useProductActionMutation } from '../../../components/use-product-action-mutation';
import { useProductSurfaceRequestScope } from '../../../components/use-product-surface-request-scope';

type Props = {
  open: boolean;
  chart: OrganizationChart;
  capabilities: Readonly<{
    create: boolean;
    update: boolean;
    approve: boolean;
    publish: boolean;
  }>;
  currentUserId?: number;
  previewScenarioId?: string;
  onPreviewScenario: (scenarioId: string) => void;
  onScenarioChanged: () => void;
  onClose: () => void;
};

export function OrganizationScenarioDrawer({
  open,
  chart,
  capabilities,
  currentUserId,
  previewScenarioId,
  onPreviewScenario,
  onScenarioChanged,
  onClose,
}: Props) {
  const { t } = useTranslation('workforce');
  const display = useDisplayDictionary();
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
  const createScenario = useProductActionMutation('route.hcm.management.org-create.action');
  const cloneScenario = useProductActionMutation('route.hcm.management.org-clone.action');
  const updateScenario = useProductActionMutation('route.hcm.management.org-update.action');
  const approveScenario = useProductActionMutation('route.hcm.management.org-approval.action');
  const requestScope = useProductSurfaceRequestScope({
    productKey: 'hcm',
    surfaceKey: 'hcm.management',
  });
  const keys = organizationScenarioQueryKeys(requestScope.cacheKey);
  const scenariosQuery = useQuery({
    queryKey: keys.listKey,
    queryFn: ({ signal }) => listOrganizationScenarios(requestScope.contextScopeKey, signal),
    enabled: open && requestScope.ready,
    meta: requestScope.queryMeta,
  });
  const scenarios = useMemo(() => scenariosQuery.data ?? [], [scenariosQuery.data]);
  const selected = scenarios.find((scenario) => scenario.scenarioId === selectedId) ?? scenarios[0];
  const decisionQuery = useQuery({
    queryKey: keys.detailKey(selected?.scenarioId, 'decision-pack'),
    queryFn: ({ signal }) =>
      getOrganizationScenarioDecisionPack(
        selected?.scenarioId as string,
        requestScope.contextScopeKey,
        signal
      ),
    enabled: open && requestScope.ready && Boolean(selected?.scenarioId),
    meta: requestScope.queryMeta,
  });
  const decisionHistoryQuery = useQuery({
    queryKey: keys.detailKey(selected?.scenarioId, 'decision-history'),
    queryFn: ({ signal }) =>
      getOrganizationScenarioDecisionHistory(
        selected?.scenarioId as string,
        requestScope.contextScopeKey,
        signal
      ),
    enabled: open && requestScope.ready && Boolean(selected?.scenarioId),
    meta: requestScope.queryMeta,
  });
  const comparisonScenario = scenarios.find(
    (scenario) => scenario.scenarioId === comparisonScenarioId
  );
  const comparisonDecisionQuery = useQuery({
    queryKey: keys.detailKey(comparisonScenario?.scenarioId, 'decision-pack'),
    queryFn: ({ signal }) =>
      getOrganizationScenarioDecisionPack(
        comparisonScenario?.scenarioId as string,
        requestScope.contextScopeKey,
        signal
      ),
    enabled: open && requestScope.ready && Boolean(comparisonScenario?.scenarioId),
    meta: requestScope.queryMeta,
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
    queryClient.setQueryData<OrganizationScenario[]>(keys.listKey, (current = []) => {
      const found = current.some((item) => item.scenarioId === next.scenarioId);
      return found
        ? current.map((item) => (item.scenarioId === next.scenarioId ? next : item))
        : [next, ...current];
    });
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
        queryKey: ['workforce', 'organization-scenarios', next.scenarioId, 'decision-pack'],
      });
      await queryClient.invalidateQueries({
        queryKey: ['workforce', 'organization-scenarios', next.scenarioId, 'decision-history'],
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
  const publishScenario = useProductSurfaceHighRiskCommand({
    operation: 'HCM_ORG_PUBLISH',
    execute: (command, authority) =>
      publishOrganizationScenario(command.targetId, command.expectedObjectVersion, authority),
    onSuccess: async (next) => {
      replaceScenario(next);
      onScenarioChanged();
      await queryClient.invalidateQueries({
        queryKey: ['workforce', 'organization-scenarios', next.scenarioId, 'decision-pack'],
      });
      await queryClient.invalidateQueries({
        queryKey: ['workforce', 'organization-scenarios', next.scenarioId, 'decision-history'],
      });
      toast.success(t('orgChart.scenarios.messages.published'));
    },
  });

  const handleCreate = async () => {
    if (!capabilities.create || !name.trim()) return;
    const next = await execute(
      () => {
        const common = {
          scenarioKey: scenarioKey(),
          name: name.trim(),
          description: description.trim() || undefined,
          effectiveDate,
        };
        return cloneSourceId
          ? cloneScenario((authority) =>
              cloneOrganizationScenario(cloneSourceId, common, authority)
            )
          : createScenario((authority) =>
              createOrganizationScenario({ ...common, baselineDate }, authority)
            );
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
    if (!capabilities.update || !selected || !organizationId || !newParentId) return;
    const next = await execute(
      () =>
        updateScenario((authority) =>
          addOrganizationScenarioMove(selected, organizationId, newParentId, authority)
        ),
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
    if (!capabilities.update || !selected) return;
    setBusy(true);
    setError(undefined);
    try {
      const decision = await updateScenario((authority) =>
        validateOrganizationScenarioDecisionPack(selected, authority)
      );
      queryClient.setQueryData(keys.detailKey(selected.scenarioId, 'decision-pack'), decision);
      await queryClient.invalidateQueries({
        queryKey: ['workforce', 'organization-scenarios', selected.scenarioId, 'decision-history'],
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
        <OrganizationScenarioListSection
          scenarios={scenarios}
          selectedScenarioId={selected?.scenarioId}
          loading={scenariosQuery.isLoading}
          canCreate={capabilities.create}
          onCreate={() => {
            setCloneSourceId(undefined);
            setName('');
            setDescription('');
            setBaselineDate(chart.asOf);
            setEffectiveDate(plusDays(chart.asOf, 30));
            setCreating(true);
          }}
          onSelect={(scenarioId) => {
            setSelectedId(scenarioId);
            setCreating(false);
            setCloneSourceId(undefined);
            setError(undefined);
          }}
        />

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
                    busy ? (
                      <CircularProgress size={14} color="inherit" aria-hidden="true" />
                    ) : (
                      <Plus size={15} />
                    )
                  }
                  disabled={!capabilities.create || busy || !name.trim()}
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
                      color={scenarioStatusColor(selected.lifecycleState)}
                      label={display('states', selected.lifecycleState)}
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
                canValidate={capabilities.update}
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
                        !capabilities.create ||
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

              {selected.lifecycleState === 'DRAFT' && capabilities.update && (
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
                          {selected.lifecycleState === 'DRAFT' && capabilities.update && (
                            <Tooltip title={t('orgChart.scenarios.removeChange')}>
                              <IconButton
                                size="small"
                                aria-label={t('orgChart.scenarios.removeChange')}
                                disabled={busy}
                                onClick={() =>
                                  void execute(
                                    () =>
                                      updateScenario((authority) =>
                                        removeOrganizationScenarioChange(
                                          selected,
                                          change.changeId,
                                          authority
                                        )
                                      ),
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

              {selected.lifecycleState === 'DRAFT' && capabilities.update && (
                <WorkflowAction
                  title={t('orgChart.scenarios.submit.title')}
                  help={t('orgChart.scenarios.submit.help')}
                  reason={reason}
                  setReason={setReason}
                  busy={busy}
                  disabled={!selected.changes.length}
                  icon={<Send size={15} />}
                  actionLabel={t('orgChart.scenarios.submit.action')}
                  secondaryLabel={t('orgChart.scenarios.cancel.action')}
                  onAction={async () => {
                    const next = await execute(
                      () =>
                        updateScenario((authority) =>
                          submitOrganizationScenario(selected, reason.trim(), authority)
                        ),
                      t('orgChart.scenarios.messages.submitted')
                    );
                    if (next) setReason('');
                  }}
                  onSecondary={async () => {
                    const next = await execute(
                      () =>
                        updateScenario((authority) =>
                          cancelOrganizationScenario(selected, reason.trim(), authority)
                        ),
                      t('orgChart.scenarios.messages.cancelled')
                    );
                    if (next) setReason('');
                  }}
                />
              )}

              {selected.lifecycleState === 'IN_REVIEW' &&
                (currentUserId === selected.ownerUserId ? (
                  capabilities.update ? (
                    <Stack gap={1}>
                      <Alert severity="warning">
                        {t('orgChart.scenarios.approval.separation')}
                      </Alert>
                      <WorkflowAction
                        title={t('orgChart.scenarios.cancel.title')}
                        help={t('orgChart.scenarios.cancel.help')}
                        reason={reason}
                        setReason={setReason}
                        busy={busy}
                        icon={<CircleMinus size={15} />}
                        actionLabel={t('orgChart.scenarios.cancel.action')}
                        actionColor="error"
                        onAction={async () => {
                          const next = await execute(
                            () =>
                              updateScenario((authority) =>
                                cancelOrganizationScenario(selected, reason.trim(), authority)
                              ),
                            t('orgChart.scenarios.messages.cancelled')
                          );
                          if (next) setReason('');
                        }}
                      />
                    </Stack>
                  ) : null
                ) : capabilities.approve ? (
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
                        () =>
                          approveScenario((authority) =>
                            decideOrganizationScenario(
                              selected,
                              'APPROVED',
                              reason.trim(),
                              authority
                            )
                          ),
                        t('orgChart.scenarios.messages.approved')
                      );
                      if (next) setReason('');
                    }}
                    onSecondary={async () => {
                      const next = await execute(
                        () =>
                          approveScenario((authority) =>
                            decideOrganizationScenario(
                              selected,
                              'REJECTED',
                              reason.trim(),
                              authority
                            )
                          ),
                        t('orgChart.scenarios.messages.rejected')
                      );
                      if (next) setReason('');
                    }}
                  />
                ) : null)}

              {selected.lifecycleState === 'APPROVED' && capabilities.publish && (
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
                      busy ? (
                        <CircularProgress size={14} color="inherit" aria-hidden="true" />
                      ) : (
                        <Check size={15} />
                      )
                    }
                    disabled={!capabilities.publish || busy}
                    onClick={() =>
                      void publishScenario.begin(
                        productSurfaceHighRiskCommand({
                          operation: 'HCM_ORG_PUBLISH',
                          commandMethod: 'POST',
                          commandPath: `/api/people/v1/workforce/organization/scenarios/${encodeURIComponent(selected.scenarioId)}/publish`,
                          targetType: 'ORG_SCENARIO',
                          targetId: selected.scenarioId,
                          expectedObjectVersion: selected.version,
                          payload: { version: selected.version },
                        })
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
      <ProductSurfaceHighRiskCommandDialog controller={publishScenario.controller} />
    </Drawer>
  );
}
