import { useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  AppWindow,
  ArrowRight,
  Boxes,
  GitBranch,
  Link2,
  Network,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Unlink,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDisplayDictionary } from '@dwp-frontend/shared-i18n';
import {
  declareCatalogRelation,
  dispositionCatalogFinding,
  evaluateCatalogAssurance,
  getAppGovernanceDashboard,
  getTenantAppAdoptionProjection,
  listTenantAppAssignments,
  getCatalogAssurance,
  getCatalogGraph,
  getCatalogImpact,
  getCatalogOverview,
  retireCatalogRelation,
  usePermissions,
  useProductSurfaceAuthority,
  useToast,
} from '@dwp-frontend/shared-utils';
import { ActionButton, ActionIconButton, FormDialog, FormField } from '@dwp-frontend/design-system';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { CatalogGraphView } from './catalog-graph';
import { AssuranceWorkspace, FindingDispositionDialog } from './catalog-assurance-workspace';
import { CatalogMetric } from './catalog-metric';
import {
  APPLICATION_LIFECYCLE_OWNER_QUERY_KEYS,
  CATALOG_CRITICALITIES,
  CATALOG_RELATION_TYPES,
} from './catalog-explorer-options';
import { ApplicationLifecycleCatalog } from './application-lifecycle-catalog';
import { CatalogInventoryPanel } from './catalog-inventory-panel';
import {
  catalogCriticalityLabelKey,
  catalogKindLabelKey,
  catalogRelationTypeLabelKey,
  catalogScopeLabelKey,
} from './catalog-presentation';
import {
  buildAppLifecycleCatalog,
  buildAppLifecycleProvenance,
} from './app-catalog-lifecycle-model';
import { GOVERNED_PRODUCT_ENTRY_CATALOG } from '../../components/product-entry-point-catalog';
import type {
  CatalogAssuranceFinding,
  CatalogCriticality,
  CatalogEntity,
  CatalogEntityKind,
  CatalogImpact,
  CatalogRelation,
  CatalogRelationType,
} from '@dwp-frontend/shared-utils';
import type { FindingDecision } from './catalog-assurance-workspace';
type View = 'applications' | 'graph' | 'inventory' | 'assurance';
function RelationDialog({
  source,
  entities,
  busy,
  onClose,
  onSubmit,
}: {
  source: CatalogEntity;
  entities: CatalogEntity[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (value: {
    targetRef: string;
    relationType: CatalogRelationType;
    criticality: CatalogCriticality;
    evidenceRef: string;
  }) => void;
}) {
  const { t } = useTranslation('admin');
  const display = useDisplayDictionary();
  const targets = entities.filter((entity) => entity.ref !== source.ref);
  const [targetRef, setTargetRef] = useState(targets[0]?.ref ?? '');
  const [relationType, setRelationType] = useState<CatalogRelationType>('DEPENDS_ON');
  const [criticality, setCriticality] = useState<CatalogCriticality>('OPERATIONAL');
  const [evidenceRef, setEvidenceRef] = useState('');
  return (
    <FormDialog
      open
      title={t('catalog.relation.dialogTitle')}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t('catalog.relation.save')}
      submittingLabel={t('catalog.relation.save')}
      busy={busy}
      submitDisabled={!targetRef}
      onClose={onClose}
      onSubmit={() => onSubmit({ targetRef, relationType, criticality, evidenceRef })}
      maxWidth="sm"
    >
      <Box sx={{ display: 'grid', gap: 2 }}>
        <FormField
          label={t('catalog.relation.source')}
          value={`${source.name} · ${source.ref}`}
          size="small"
          disabled
        />
        <FormField
          select
          label={t('catalog.relation.target')}
          required
          value={targetRef}
          size="small"
          onChange={(event) => setTargetRef(event.target.value)}
        >
          {targets.map((entity) => (
            <MenuItem key={entity.ref} value={entity.ref}>
              {entity.name} · {display('entityKinds', entity.kind)}
            </MenuItem>
          ))}
        </FormField>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <FormField
            select
            label={t('catalog.relation.type')}
            required
            value={relationType}
            size="small"
            onChange={(event) => setRelationType(event.target.value as CatalogRelationType)}
          >
            {CATALOG_RELATION_TYPES.map((type) => (
              <MenuItem key={type} value={type}>
                {t(catalogRelationTypeLabelKey(type))}
              </MenuItem>
            ))}
          </FormField>
          <FormField
            select
            label={t('catalog.relation.criticality')}
            required
            value={criticality}
            size="small"
            onChange={(event) => setCriticality(event.target.value as CatalogCriticality)}
          >
            {CATALOG_CRITICALITIES.map((value) => (
              <MenuItem key={value} value={value}>
                {t(`catalog.criticality.${value}`)}
              </MenuItem>
            ))}
          </FormField>
        </Box>
        <FormField
          label={t('catalog.relation.evidence')}
          value={evidenceRef}
          size="small"
          placeholder={t('catalog.relation.evidencePlaceholder')}
          onChange={(event) => setEvidenceRef(event.target.value)}
        />
      </Box>
    </FormDialog>
  );
}
function ImpactPanel({ impact }: { impact: CatalogImpact }) {
  const { t } = useTranslation('admin');
  return (
    <Box sx={{ mt: 2.5 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Typography component="h3" variant="subtitle2">
          {t('catalog.impact.title')}
        </Typography>
        <Chip
          size="small"
          color={impact.blocked ? 'error' : 'success'}
          variant="outlined"
          label={impact.blocked ? t('catalog.impact.blocked') : t('catalog.impact.ready')}
        />
      </Stack>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
        {t('catalog.impact.rule', {
          key: impact.ruleKey,
          version: impact.ruleVersion,
        })}
      </Typography>
      <Box
        sx={{
          mt: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          borderTop: 1,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        {[
          [t('catalog.impact.risk'), impact.riskScore],
          [t('catalog.impact.direct'), impact.directDependentCount],
          [t('catalog.impact.transitive'), impact.transitiveDependentCount],
        ].map(([label, value]) => (
          <Box key={String(label)} sx={{ py: 1, px: 0.75, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary" display="block">
              {label}
            </Typography>
            <Typography variant="subtitle2">{value}</Typography>
          </Box>
        ))}
      </Box>
      {impact.impactedEntities.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          {t('catalog.impact.none')}
        </Typography>
      ) : (
        <Stack component="ol" sx={{ listStyle: 'none', p: 0, m: 0, mt: 1 }} divider={<Divider />}>
          {impact.impactedEntities.length > 8 && (
            <Typography component="li" variant="caption" color="text.secondary" sx={{ py: 1 }}>
              {t('catalog.impact.previewCoverage', {
                shown: 8,
                total: impact.impactedEntities.length,
              })}
            </Typography>
          )}
          {impact.impactedEntities.slice(0, 8).map((item) => (
            <Box component="li" key={item.entity.ref} sx={{ py: 1 }}>
              <Stack direction="row" alignItems="center" gap={1}>
                <ArrowRight size={14} aria-hidden="true" />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" fontWeight={650} noWrap>
                    {item.entity.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap display="block">
                    {t('catalog.impact.distance', { count: item.distance })} ·{' '}
                    {item.relationTypes
                      .map((relationType) => t(catalogRelationTypeLabelKey(relationType)))
                      .join(', ')}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  color={item.highestCriticality === 'CRITICAL' ? 'error' : 'default'}
                  variant="outlined"
                  label={t(catalogCriticalityLabelKey(item.highestCriticality))}
                />
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}
export function CatalogExplorer() {
  const { t } = useTranslation('admin');
  const display = useDisplayDictionary();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { hasPermission, isLoaded: permissionsLoaded } = usePermissions();
  const canManage = permissionsLoaded && hasPermission('ADMIN.PLATFORM_CATALOG', 'MANAGE');
  const surfaceAuthority = useProductSurfaceAuthority();
  const [view, setViewState] = useState<View>(() => {
    const requested = searchParams.get('view');
    return requested === 'graph' || requested === 'inventory' || requested === 'assurance'
      ? requested
      : 'applications';
  });
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [kind, setKind] = useState<CatalogEntityKind | 'ALL'>('ALL');
  const [selectedRef, setSelectedRef] = useState<string | null>(() => searchParams.get('focus'));
  const [depth, setDepth] = useState(2);
  const [operation, setOperation] = useState<CatalogImpact['operation']>('CHANGE');
  const [relationDialog, setRelationDialog] = useState(false);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(() =>
    searchParams.get('finding')
  );
  const [dispositionTarget, setDispositionTarget] = useState<CatalogAssuranceFinding | null>(null);
  const [busy, setBusy] = useState(false);
  const overviewQuery = useQuery({
    queryKey: ['admin', 'catalog', 'overview'],
    queryFn: () => getCatalogOverview(),
  });
  const graphQuery = useQuery({
    queryKey: ['admin', 'catalog', 'graph', selectedRef, depth],
    queryFn: () => getCatalogGraph(selectedRef, depth),
    enabled: view === 'graph',
  });
  const impactQuery = useQuery({
    queryKey: ['admin', 'catalog', 'impact', selectedRef, operation],
    queryFn: () => getCatalogImpact(selectedRef!, operation),
    enabled: Boolean(selectedRef),
  });
  const assuranceQuery = useQuery({
    queryKey: ['admin', 'catalog', 'assurance'],
    queryFn: getCatalogAssurance,
    enabled: view === 'assurance',
  });
  const appGovernanceQuery = useQuery({
    queryKey: ['admin', 'app-governance'],
    queryFn: getAppGovernanceDashboard,
    enabled: view === 'applications',
  });
  const appAdoptionQuery = useQuery({
    queryKey: ['admin', 'tenant-app-adoption', 'projection'],
    queryFn: getTenantAppAdoptionProjection,
    enabled: view === 'applications',
  });
  const appWorkforceAssignmentsQuery = useQuery({
    queryKey: ['admin', 'tenant-app-adoption', 'assignments'],
    queryFn: () => listTenantAppAssignments(),
    enabled: view === 'applications',
  });
  const updateLocationState = (nextView: View, findingId?: string | null) => {
    setViewState(nextView);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (nextView === 'applications') next.delete('view');
        else next.set('view', nextView);
        if (findingId) next.set('finding', findingId);
        else next.delete('finding');
        return next;
      },
      { replace: true }
    );
  };
  const setView = (nextView: View) => updateLocationState(nextView, selectedFindingId);
  const selectFinding = (findingId: string) => {
    setSelectedFindingId(findingId);
    updateLocationState('assurance', findingId);
  };
  const entities = useMemo(() => overviewQuery.data?.entities ?? [], [overviewQuery.data]);
  const applicationItems = useMemo(
    () =>
      buildAppLifecycleCatalog({
        catalogEntities: entities,
        catalogStatus: overviewQuery.isError
          ? 'unavailable'
          : overviewQuery.data
            ? 'ready'
            : 'loading',
        manifests: GOVERNED_PRODUCT_ENTRY_CATALOG,
        governance: appGovernanceQuery.data,
        governanceStatus: appGovernanceQuery.isError
          ? 'unavailable'
          : appGovernanceQuery.data
            ? 'ready'
            : 'loading',
        authority: surfaceAuthority.snapshot?.envelope,
        authorityStatus:
          surfaceAuthority.status === 'ready'
            ? 'ready'
            : surfaceAuthority.status === 'loading'
              ? 'loading'
              : 'unavailable',
        adoption: appAdoptionQuery.data,
        adoptionStatus: appAdoptionQuery.isError
          ? 'unavailable'
          : appAdoptionQuery.data
            ? 'ready'
            : 'loading',
        workforceAssignments: appWorkforceAssignmentsQuery.data,
        workforceAssignmentsStatus: appWorkforceAssignmentsQuery.isError
          ? 'unavailable'
          : appWorkforceAssignmentsQuery.data
            ? 'ready'
            : 'loading',
      }),
    [
      appAdoptionQuery.data,
      appAdoptionQuery.isError,
      appGovernanceQuery.data,
      appGovernanceQuery.isError,
      appWorkforceAssignmentsQuery.data,
      appWorkforceAssignmentsQuery.isError,
      entities,
      overviewQuery.data,
      overviewQuery.isError,
      surfaceAuthority.snapshot?.envelope,
      surfaceAuthority.status,
    ]
  );
  const applicationProvenance = useMemo(
    () =>
      buildAppLifecycleProvenance({
        authority: surfaceAuthority.snapshot?.envelope,
        authorityStatus:
          surfaceAuthority.status === 'ready'
            ? 'ready'
            : surfaceAuthority.status === 'loading'
              ? 'loading'
              : 'unavailable',
        adoption: appAdoptionQuery.data,
        adoptionStatus: appAdoptionQuery.isError
          ? 'unavailable'
          : appAdoptionQuery.data
            ? 'ready'
            : 'loading',
      }),
    [
      appAdoptionQuery.data,
      appAdoptionQuery.isError,
      surfaceAuthority.snapshot?.envelope,
      surfaceAuthority.status,
    ]
  );
  const selected = entities.find((entity) => entity.ref === selectedRef) ?? null;
  const filteredEntities = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase();
    return entities.filter((entity) => {
      if (kind !== 'ALL' && entity.kind !== kind) return false;
      return (
        !normalized ||
        entity.name.toLowerCase().includes(normalized) ||
        entity.ref.toLowerCase().includes(normalized) ||
        entity.ownerRef?.toLowerCase().includes(normalized)
      );
    });
  }, [deferredQuery, entities, kind]);
  const connectedRelations = useMemo(
    () =>
      (graphQuery.data?.relations ?? []).filter(
        (relation) => relation.sourceRef === selectedRef || relation.targetRef === selectedRef
      ),
    [graphQuery.data, selectedRef]
  );
  const refresh = async () => {
    const requests: Array<Promise<unknown>> = [
      queryClient.invalidateQueries({ queryKey: ['admin', 'catalog'] }),
    ];
    if (view === 'applications') {
      requests.push(
        ...APPLICATION_LIFECYCLE_OWNER_QUERY_KEYS.map((queryKey) =>
          queryClient.invalidateQueries({ queryKey })
        ),
        surfaceAuthority.revalidate()
      );
    }
    await Promise.all(requests);
  };
  const evaluateAssurance = async () => {
    if (!canManage) return;
    setBusy(true);
    try {
      const result = await evaluateCatalogAssurance();
      queryClient.setQueryData(['admin', 'catalog', 'assurance'], result);
      toast.success(t('catalog.assurance.toasts.evaluated'));
    } catch {
      toast.error(t('catalog.assurance.toasts.error'));
    } finally {
      setBusy(false);
    }
  };
  const dispositionFinding = async (value: {
    decision: FindingDecision;
    reason: string;
    evidenceRef: string;
  }) => {
    if (!canManage || !dispositionTarget) return;
    setBusy(true);
    try {
      await dispositionCatalogFinding(dispositionTarget.findingId, {
        decision: value.decision,
        reason: value.reason,
        evidenceRef: value.evidenceRef || undefined,
        version: dispositionTarget.version,
      });
      await assuranceQuery.refetch();
      setDispositionTarget(null);
      toast.success(t('catalog.assurance.toasts.dispositionSaved'));
    } catch {
      toast.error(t('catalog.assurance.toasts.error'));
    } finally {
      setBusy(false);
    }
  };
  const saveRelation = async (value: {
    targetRef: string;
    relationType: CatalogRelationType;
    criticality: CatalogCriticality;
    evidenceRef: string;
  }) => {
    if (!canManage || !selected) return;
    setBusy(true);
    try {
      await declareCatalogRelation({ sourceRef: selected.ref, ...value });
      await refresh();
      setRelationDialog(false);
      toast.success(t('catalog.toasts.saved'));
    } catch {
      toast.error(t('catalog.toasts.error'));
    } finally {
      setBusy(false);
    }
  };

  const retireRelation = async (relation: CatalogRelation) => {
    if (!canManage || !relation.relationId) return;
    setBusy(true);
    try {
      await retireCatalogRelation(relation.relationId, relation.version);
      await refresh();
      toast.success(t('catalog.toasts.retired'));
    } catch {
      toast.error(t('catalog.toasts.error'));
    } finally {
      setBusy(false);
    }
  };

  if (
    (view !== 'applications' && overviewQuery.isError) ||
    (view === 'graph' && graphQuery.isError)
  ) {
    return <Alert severity="error">{t('catalog.loadError')}</Alert>;
  }

  const overview = overviewQuery.data;
  return (
    <Box>
      {view !== 'applications' && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(5, minmax(0, 1fr))' },
            borderTop: 1,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <CatalogMetric
            label={t('catalog.metrics.assets')}
            value={overview?.entityCount ?? 0}
            detail={t('catalog.metrics.assetsDetail')}
          />
          <CatalogMetric
            label={t('catalog.metrics.relations')}
            value={overview?.relationCount ?? 0}
            detail={t('catalog.metrics.relationsDetail')}
          />
          <CatalogMetric
            label={t('catalog.metrics.declared')}
            value={overview?.declaredRelationCount ?? 0}
            detail={t('catalog.metrics.declaredDetail')}
          />
          <CatalogMetric
            label={t('catalog.metrics.critical')}
            value={overview?.criticalRelationCount ?? 0}
            detail={t('catalog.metrics.criticalDetail')}
          />
          <CatalogMetric
            label={t('catalog.metrics.orphans')}
            value={overview?.orphanCount ?? 0}
            detail={t('catalog.metrics.orphansDetail')}
          />
        </Box>
      )}

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'stretch', md: 'center' }}
        justifyContent="space-between"
        gap={1.5}
        sx={{ py: 2 }}
      >
        <Tabs
          value={view}
          onChange={(_, value: View) => setView(value)}
          aria-label={t('catalog.views.label')}
          variant="scrollable"
          allowScrollButtonsMobile
        >
          <Tab
            value="applications"
            icon={<AppWindow size={17} />}
            iconPosition="start"
            label={t('catalog.views.applications')}
          />
          <Tab
            value="graph"
            icon={<GitBranch size={17} />}
            iconPosition="start"
            label={t('catalog.views.graph')}
          />
          <Tab
            value="inventory"
            icon={<Boxes size={17} />}
            iconPosition="start"
            label={t('catalog.views.inventory')}
          />
          <Tab
            value="assurance"
            icon={<ShieldCheck size={17} />}
            iconPosition="start"
            label={t('catalog.views.assurance')}
          />
        </Tabs>
        <Stack direction="row" alignItems="center" justifyContent="flex-end" gap={0.75}>
          {selectedRef && (
            <ActionButton intent="quiet" onClick={() => setSelectedRef(null)}>
              {t('catalog.actions.clearFocus')}
            </ActionButton>
          )}
          <ActionIconButton label={t('catalog.actions.refresh')} onClick={() => void refresh()}>
            <RefreshCw size={18} />
          </ActionIconButton>
        </Stack>
      </Stack>

      {view === 'applications' && (
        <ApplicationLifecycleCatalog
          items={applicationItems}
          provenance={applicationProvenance}
          loading={
            overviewQuery.isLoading ||
            appGovernanceQuery.isLoading ||
            appAdoptionQuery.isLoading ||
            appWorkforceAssignmentsQuery.isLoading ||
            surfaceAuthority.status === 'loading'
          }
          partialFailure={
            overviewQuery.isError ||
            appGovernanceQuery.isError ||
            appAdoptionQuery.isError ||
            appWorkforceAssignmentsQuery.isError ||
            surfaceAuthority.status === 'authority-unavailable'
          }
        />
      )}

      {view === 'inventory' && (
        <CatalogInventoryPanel
          query={query}
          kind={kind}
          rows={filteredEntities}
          loading={overviewQuery.isLoading}
          onQueryChange={setQuery}
          onKindChange={setKind}
          onOpen={(row) => {
            setSelectedRef(row.ref);
            setView('graph');
          }}
        />
      )}

      {view === 'graph' && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) 360px' },
            gap: 2,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              gap={1}
              sx={{ mb: 1 }}
            >
              <Typography variant="body2" color="text.secondary">
                {selected
                  ? t('catalog.graph.focused', { name: selected.name })
                  : t('catalog.graph.all')}
              </Typography>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={depth}
                aria-label={t('catalog.graph.depth')}
                onChange={(_, value) => value && setDepth(value)}
              >
                {[1, 2, 3].map((value) => (
                  <ToggleButton key={value} value={value}>
                    {value}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Stack>
            {graphQuery.isLoading || !graphQuery.data ? (
              <Skeleton variant="rounded" height={680} />
            ) : (
              <>
                {graphQuery.data.truncated && (
                  <Alert severity="info" sx={{ mb: 1 }}>
                    {t('catalog.graph.truncated')}
                  </Alert>
                )}
                <CatalogGraphView
                  graph={graphQuery.data}
                  selectedRef={selectedRef}
                  onSelect={setSelectedRef}
                />
              </>
            )}
          </Box>

          <Box
            component="aside"
            aria-label={t('catalog.inspector.title')}
            sx={{ minWidth: 0, borderLeft: { xl: 1 }, borderColor: 'divider', pl: { xl: 2 } }}
          >
            {!selected ? (
              <Box sx={{ py: 8, textAlign: 'center', color: 'text.secondary' }}>
                <Network size={30} />
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {t('catalog.inspector.select')}
                </Typography>
              </Box>
            ) : (
              <>
                <Stack
                  direction="row"
                  alignItems="flex-start"
                  justifyContent="space-between"
                  gap={1}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={t(catalogKindLabelKey(selected.kind))}
                    />
                    <Typography
                      component="h2"
                      variant="h6"
                      sx={{ mt: 1 }}
                      noWrap
                      title={selected.name}
                    >
                      {selected.name}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ overflowWrap: 'anywhere' }}
                    >
                      {selected.ref}
                    </Typography>
                  </Box>
                  <ActionIconButton
                    label={t('catalog.actions.addRelation')}
                    disabled={!canManage}
                    onClick={() => setRelationDialog(true)}
                  >
                    <Plus size={18} />
                  </ActionIconButton>
                </Stack>
                {selected.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                    {selected.description}
                  </Typography>
                )}
                <Box
                  component="dl"
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '100px minmax(0, 1fr)',
                    gap: 1,
                    m: 0,
                    mt: 2,
                  }}
                >
                  {[
                    [t('catalog.columns.owner'), selected.ownerRef || '-'],
                    [t('catalog.columns.scope'), t(catalogScopeLabelKey(selected.scope))],
                    [t('catalog.columns.state'), display('states', selected.lifecycleState)],
                    [t('catalog.inspector.revision'), selected.revision],
                  ].map(([label, value]) => (
                    <Box key={String(label)} sx={{ display: 'contents' }}>
                      <Typography component="dt" variant="caption" color="text.secondary">
                        {label}
                      </Typography>
                      <Typography
                        component="dd"
                        variant="body2"
                        sx={{ m: 0, overflowWrap: 'anywhere' }}
                      >
                        {value}
                      </Typography>
                    </Box>
                  ))}
                </Box>

                <Divider sx={{ my: 2 }} />
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography component="h3" variant="subtitle2">
                    {t('catalog.relation.connected')}
                  </Typography>
                  <Chip size="small" label={connectedRelations.length} />
                </Stack>
                <Stack sx={{ mt: 0.75 }} divider={<Divider />}>
                  {connectedRelations.length > 8 && (
                    <Typography variant="caption" color="text.secondary" sx={{ py: 1 }}>
                      {t('catalog.relation.previewCoverage', {
                        shown: 8,
                        total: connectedRelations.length,
                      })}
                    </Typography>
                  )}
                  {connectedRelations.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                      {t('catalog.relation.none')}
                    </Typography>
                  ) : (
                    connectedRelations.slice(0, 8).map((relation, index) => (
                      <Stack
                        key={
                          relation.relationId ??
                          `${relation.sourceRef}-${relation.targetRef}-${index}`
                        }
                        direction="row"
                        alignItems="center"
                        gap={1}
                        sx={{ py: 1 }}
                      >
                        <Link2 size={14} aria-hidden="true" />
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="body2" fontWeight={650} noWrap>
                            {t(catalogRelationTypeLabelKey(relation.relationType))}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            noWrap
                            display="block"
                          >
                            {relation.sourceRef === selectedRef
                              ? relation.targetRef
                              : relation.sourceRef}
                          </Typography>
                        </Box>
                        {relation.relationId && (
                          <ActionIconButton
                            size="small"
                            label={t('catalog.actions.retireRelation')}
                            disabled={busy || !canManage}
                            onClick={() => void retireRelation(relation)}
                          >
                            <Unlink size={15} />
                          </ActionIconButton>
                        )}
                      </Stack>
                    ))
                  )}
                </Stack>

                <Divider sx={{ my: 2 }} />
                <Stack direction="row" alignItems="center" gap={1}>
                  {impactQuery.data?.blocked ? (
                    <ShieldAlert size={17} color="#DC2626" />
                  ) : (
                    <AlertTriangle size={17} />
                  )}
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={operation}
                    onChange={(_, value) => value && setOperation(value)}
                  >
                    {(['CHANGE', 'RETIRE', 'OUTAGE'] as const).map((value) => (
                      <ToggleButton key={value} value={value}>
                        {t(`catalog.impact.operations.${value}`)}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </Stack>
                {impactQuery.isLoading ? (
                  <Skeleton variant="rounded" height={220} sx={{ mt: 1.5 }} />
                ) : impactQuery.data ? (
                  <ImpactPanel impact={impactQuery.data} />
                ) : null}
              </>
            )}
          </Box>
        </Box>
      )}

      {view === 'assurance' && (
        <>
          {assuranceQuery.isError && (
            <Alert
              severity="warning"
              action={
                <ActionButton
                  intent="quiet"
                  size="small"
                  onClick={() => void assuranceQuery.refetch()}
                >
                  {t('common.actions.retry')}
                </ActionButton>
              }
              sx={{ mb: 2 }}
            >
              {t('catalog.assurance.partialFailure')}
            </Alert>
          )}
          <AssuranceWorkspace
            summary={assuranceQuery.data}
            loading={assuranceQuery.isLoading}
            evaluating={busy}
            canManage={canManage}
            selectedFindingId={selectedFindingId}
            onEvaluate={() => void evaluateAssurance()}
            onSelect={selectFinding}
            onReview={setDispositionTarget}
          />
        </>
      )}

      {canManage && relationDialog && selected && (
        <RelationDialog
          source={selected}
          entities={entities}
          busy={busy}
          onClose={() => setRelationDialog(false)}
          onSubmit={(value) => void saveRelation(value)}
        />
      )}
      {canManage && dispositionTarget && (
        <FindingDispositionDialog
          finding={dispositionTarget}
          busy={busy}
          onClose={() => setDispositionTarget(null)}
          onSubmit={dispositionFinding}
        />
      )}
    </Box>
  );
}
