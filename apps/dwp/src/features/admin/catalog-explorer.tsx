import { useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  GitBranch,
  Link2,
  Network,
  Plus,
  RefreshCw,
  Search,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  Unlink,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDate, useDisplayDictionary } from '@dwp-frontend/shared-i18n';
import {
  declareCatalogRelation,
  dispositionCatalogFinding,
  evaluateCatalogAssurance,
  getCatalogAssurance,
  getCatalogGraph,
  getCatalogImpact,
  getCatalogOverview,
  retireCatalogRelation,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
  EnterpriseDataGrid,
  FormDialog,
  FormField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import { CatalogGraphView } from './catalog-graph';

import type { GridColDef } from '@mui/x-data-grid';
import type {
  CatalogAssuranceFinding,
  CatalogAssuranceFindingState,
  CatalogAssuranceSummary,
  CatalogCriticality,
  CatalogEntity,
  CatalogEntityKind,
  CatalogImpact,
  CatalogRelation,
  CatalogRelationType,
} from '@dwp-frontend/shared-utils';

type View = 'graph' | 'inventory' | 'assurance';

const KINDS: Array<CatalogEntityKind | 'ALL'> = [
  'ALL',
  'APP',
  'CONNECTOR',
  'API',
  'DATA_PRODUCT',
  'REFERENCE_SET',
  'CODE_SET',
  'NAVIGATION',
  'PERMISSION',
  'SERVICE',
  'AGENT',
  'TOOL',
  'POLICY',
  'CONNECTOR_INSTANCE',
];

const RELATION_TYPES: CatalogRelationType[] = [
  'DEPENDS_ON',
  'CONSUMES',
  'PRODUCES',
  'EXPOSES',
  'GOVERNS',
  'NAVIGATES_TO',
  'REQUIRES_PERMISSION',
  'SYNCHRONIZES',
];

const CRITICALITIES: CatalogCriticality[] = ['INFORMATIONAL', 'OPERATIONAL', 'CRITICAL'];

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <Box sx={{ minWidth: 0, px: 2, py: 1.6, borderLeft: { xs: 0, sm: 1 }, borderColor: 'divider' }}>
      <Typography variant="caption" color="text.secondary" fontWeight={700}>
        {label}
      </Typography>
      <Typography component="p" variant="h6" fontWeight={760} sx={{ mt: 0.25 }}>
        {value.toLocaleString()}
      </Typography>
      <Typography variant="caption" color="text.secondary" noWrap display="block">
        {detail}
      </Typography>
    </Box>
  );
}

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
            {RELATION_TYPES.map((type) => (
              <MenuItem key={type} value={type}>
                {t(`catalog.relation.types.${type}`)}
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
            {CRITICALITIES.map((value) => (
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
                    {item.relationTypes.join(', ')}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  color={item.highestCriticality === 'CRITICAL' ? 'error' : 'default'}
                  variant="outlined"
                  label={t(`catalog.criticality.${item.highestCriticality}`)}
                />
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}

type FindingDecision = Exclude<CatalogAssuranceFindingState, 'OPEN'>;

function FindingDispositionDialog({
  finding,
  busy,
  onClose,
  onSubmit,
}: {
  finding: CatalogAssuranceFinding;
  busy: boolean;
  onClose: () => void;
  onSubmit: (value: {
    decision: FindingDecision;
    reason: string;
    evidenceRef: string;
  }) => Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const [decision, setDecision] = useState<FindingDecision>('ACKNOWLEDGED');
  const [reason, setReason] = useState('');
  const [evidenceRef, setEvidenceRef] = useState('');
  return (
    <FormDialog
      open
      title={t('catalog.assurance.disposition.title')}
      description={t('catalog.assurance.disposition.description', {
        entity: finding.entityRef,
      })}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t('catalog.assurance.disposition.submit')}
      submittingLabel={t('catalog.assurance.disposition.submitting')}
      submitIntent={decision === 'FALSE_POSITIVE' ? 'secondary' : 'primary'}
      submitDisabled={reason.trim().length < 10}
      busy={busy}
      onClose={onClose}
      onSubmit={() =>
        onSubmit({ decision, reason: reason.trim(), evidenceRef: evidenceRef.trim() })
      }
    >
      <Stack gap={2}>
        <Alert severity={decision === 'ACCEPTED_RISK' ? 'warning' : 'info'}>
          {t(`catalog.assurance.disposition.guidance.${decision}`)}
        </Alert>
        <FormField
          select
          required
          label={t('catalog.assurance.disposition.decision')}
          value={decision}
          onChange={(event) => setDecision(event.target.value as FindingDecision)}
        >
          {(
            ['ACKNOWLEDGED', 'FALSE_POSITIVE', 'ACCEPTED_RISK', 'RESOLVED'] as FindingDecision[]
          ).map((value) => (
            <MenuItem key={value} value={value}>
              {t(`catalog.assurance.states.${value}`)}
            </MenuItem>
          ))}
        </FormField>
        <FormField
          required
          multiline
          minRows={3}
          label={t('catalog.assurance.disposition.reason')}
          value={reason}
          inputProps={{ maxLength: 1000 }}
          supportingText={t('catalog.assurance.disposition.reasonHelp')}
          onChange={(event) => setReason(event.target.value)}
        />
        <FormField
          label={t('catalog.assurance.disposition.evidence')}
          value={evidenceRef}
          inputProps={{ maxLength: 500 }}
          supportingText={t('catalog.assurance.disposition.evidenceHelp')}
          onChange={(event) => setEvidenceRef(event.target.value)}
        />
      </Stack>
    </FormDialog>
  );
}

function AssuranceWorkspace({
  summary,
  loading,
  evaluating,
  selectedFindingId,
  onEvaluate,
  onSelect,
  onReview,
}: {
  summary?: CatalogAssuranceSummary;
  loading: boolean;
  evaluating: boolean;
  selectedFindingId: string | null;
  onEvaluate: () => void;
  onSelect: (findingId: string) => void;
  onReview: (finding: CatalogAssuranceFinding) => void;
}) {
  const { t } = useTranslation('admin');
  const display = useDisplayDictionary();
  const findings = summary?.findings ?? [];
  const selected = findings.find((finding) => finding.findingId === selectedFindingId) ?? null;
  const columns = useMemo<GridColDef<CatalogAssuranceFinding>[]>(
    () => [
      {
        field: 'entityRef',
        headerName: t('catalog.assurance.columns.asset'),
        minWidth: 250,
        flex: 1,
        renderCell: ({ row }) => (
          <Box sx={{ minWidth: 0, py: 0.5 }}>
            <Typography variant="body2" fontWeight={700} noWrap>
              {row.entityRef}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t(`catalog.assurance.findings.${row.findingCode}`)}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'severity',
        headerName: t('catalog.assurance.columns.severity'),
        width: 112,
        renderCell: ({ value }) => (
          <Chip
            size="small"
            variant="outlined"
            color={value === 'CRITICAL' || value === 'HIGH' ? 'error' : 'default'}
            label={display('severities', String(value))}
          />
        ),
      },
      {
        field: 'lifecycleState',
        headerName: t('catalog.assurance.columns.state'),
        width: 140,
        renderCell: ({ value }) => (
          <Chip
            size="small"
            label={t(`catalog.assurance.states.${String(value)}`, {
              defaultValue: display('states', String(value)),
            })}
          />
        ),
      },
      {
        field: 'lastDetectedAt',
        headerName: t('catalog.assurance.columns.detected'),
        width: 176,
        valueFormatter: (value?: string) =>
          value ? formatDate(value, { dateStyle: 'medium', timeStyle: 'short' }) : '-',
      },
      {
        field: 'actions',
        headerName: '',
        width: 104,
        sortable: false,
        filterable: false,
        renderCell: ({ row }) => (
          <ActionButton
            intent="quiet"
            size="small"
            disabled={!['OPEN', 'ACKNOWLEDGED'].includes(row.lifecycleState)}
            onClick={(event) => {
              event.stopPropagation();
              onReview(row);
            }}
          >
            {t('catalog.assurance.actions.review')}
          </ActionButton>
        ),
      },
    ],
    [display, onReview, t]
  );

  return (
    <Stack gap={2}>
      <Box
        component="section"
        aria-label={t('catalog.assurance.contextLabel')}
        sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider' }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'stretch', md: 'center' }}
          justifyContent="space-between"
          gap={1.5}
          sx={{ px: 2, py: 1.5 }}
        >
          <Box minWidth={0}>
            <Stack direction="row" alignItems="center" gap={1}>
              <ShieldCheck size={18} />
              <Typography component="h2" variant="subtitle1">
                {t('catalog.assurance.title')}
              </Typography>
              {summary && (
                <Chip
                  size="small"
                  variant="outlined"
                  label={t('catalog.assurance.ruleVersion', {
                    key: summary.activeRule.ruleKey,
                    version: summary.activeRule.ruleVersion,
                  })}
                />
              )}
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {t('catalog.assurance.description')}
            </Typography>
          </Box>
          <ActionButton
            intent="primary"
            startIcon={<ScanSearch size={17} />}
            loading={evaluating}
            loadingLabel={t('catalog.assurance.actions.evaluating')}
            onClick={onEvaluate}
          >
            {t('catalog.assurance.actions.evaluate')}
          </ActionButton>
        </Stack>
        <Box
          aria-label={t('catalog.assurance.metrics.label')}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, minmax(0, 1fr))' },
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <Metric
            label={t('catalog.assurance.metrics.open')}
            value={summary?.openCount ?? 0}
            detail={t('catalog.assurance.metrics.openDetail')}
          />
          <Metric
            label={t('catalog.assurance.metrics.critical')}
            value={summary?.criticalCount ?? 0}
            detail={t('catalog.assurance.metrics.criticalDetail')}
          />
          <Metric
            label={t('catalog.assurance.metrics.owner')}
            value={summary?.ownerMissingCount ?? 0}
            detail={t('catalog.assurance.metrics.ownerDetail')}
          />
          <Metric
            label={t('catalog.assurance.metrics.deprecation')}
            value={summary?.deprecationImpactCount ?? 0}
            detail={t('catalog.assurance.metrics.deprecationDetail')}
          />
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) 360px' },
          gap: 2,
          minWidth: 0,
        }}
      >
        <EnterpriseDataGrid
          ariaLabel={t('catalog.assurance.queueLabel')}
          rows={findings}
          columns={columns}
          getRowId={(row) => row.findingId}
          loading={loading}
          hideFooter={findings.length <= 20}
          initialState={{ pagination: { paginationModel: { page: 0, pageSize: 20 } } }}
          onRowClick={({ row }) => onSelect(row.findingId)}
        />
        <Box
          component="aside"
          aria-label={t('catalog.assurance.inspector.title')}
          sx={{ minWidth: 0, borderLeft: { xl: 1 }, borderColor: 'divider', pl: { xl: 2 } }}
        >
          {!selected ? (
            <Box sx={{ py: 7, textAlign: 'center', color: 'text.secondary' }}>
              <ScanSearch size={28} />
              <Typography variant="body2" sx={{ mt: 1 }}>
                {t('catalog.assurance.inspector.select')}
              </Typography>
            </Box>
          ) : (
            <Stack gap={1.5}>
              <Box>
                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                  <Chip
                    size="small"
                    variant="outlined"
                    color={selected.severity === 'CRITICAL' ? 'error' : 'default'}
                    label={display('severities', selected.severity)}
                  />
                  <Chip
                    size="small"
                    label={t(`catalog.assurance.states.${selected.lifecycleState}`)}
                  />
                </Stack>
                <Typography component="h3" variant="subtitle1" sx={{ mt: 1.25 }}>
                  {t(`catalog.assurance.findings.${selected.findingCode}`)}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ overflowWrap: 'anywhere' }}
                >
                  {selected.entityRef}
                </Typography>
              </Box>
              <Divider />
              <Box component="dl" sx={{ m: 0, display: 'grid', gap: 1 }}>
                {Object.entries(selected.evidence).map(([key, value]) => (
                  <Box key={key} sx={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 1 }}>
                    <Typography component="dt" variant="caption" color="text.secondary">
                      {key}
                    </Typography>
                    <Typography
                      component="dd"
                      variant="body2"
                      sx={{ m: 0, overflowWrap: 'anywhere' }}
                    >
                      {value === null ? '-' : String(value)}
                    </Typography>
                  </Box>
                ))}
              </Box>
              <Divider />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ overflowWrap: 'anywhere' }}
              >
                {t('catalog.assurance.inspector.hash', {
                  hash: selected.evidenceSha256,
                })}
              </Typography>
              {selected.dispositionReason && (
                <Alert severity="info">
                  {t('catalog.assurance.inspector.disposition', {
                    reason: selected.dispositionReason,
                  })}
                </Alert>
              )}
              {['OPEN', 'ACKNOWLEDGED'].includes(selected.lifecycleState) && (
                <ActionButton intent="secondary" onClick={() => onReview(selected)}>
                  {t('catalog.assurance.actions.recordDisposition')}
                </ActionButton>
              )}
            </Stack>
          )}
        </Box>
      </Box>
    </Stack>
  );
}

export function CatalogExplorer() {
  const { t } = useTranslation('admin');
  const display = useDisplayDictionary();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [view, setViewState] = useState<View>(() => {
    const requested = searchParams.get('view');
    return requested === 'inventory' || requested === 'assurance' ? requested : 'graph';
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
  });
  const impactQuery = useQuery({
    queryKey: ['admin', 'catalog', 'impact', selectedRef, operation],
    queryFn: () => getCatalogImpact(selectedRef!, operation),
    enabled: Boolean(selectedRef),
  });
  const assuranceQuery = useQuery({
    queryKey: ['admin', 'catalog', 'assurance'],
    queryFn: getCatalogAssurance,
  });

  const updateLocationState = (nextView: View, findingId?: string | null) => {
    setViewState(nextView);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (nextView === 'graph') next.delete('view');
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
    await queryClient.invalidateQueries({ queryKey: ['admin', 'catalog'] });
  };

  const evaluateAssurance = async () => {
    setBusy(true);
    try {
      const result = await evaluateCatalogAssurance();
      queryClient.setQueryData(['admin', 'catalog', 'assurance'], result);
      toast.success(t('catalog.assurance.toasts.evaluated'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('catalog.assurance.toasts.error'));
    } finally {
      setBusy(false);
    }
  };

  const dispositionFinding = async (value: {
    decision: FindingDecision;
    reason: string;
    evidenceRef: string;
  }) => {
    if (!dispositionTarget) return;
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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('catalog.assurance.toasts.error'));
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
    if (!selected) return;
    setBusy(true);
    try {
      await declareCatalogRelation({ sourceRef: selected.ref, ...value });
      await refresh();
      setRelationDialog(false);
      toast.success(t('catalog.toasts.saved'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('catalog.toasts.error'));
    } finally {
      setBusy(false);
    }
  };

  const retireRelation = async (relation: CatalogRelation) => {
    if (!relation.relationId) return;
    setBusy(true);
    try {
      await retireCatalogRelation(relation.relationId, relation.version);
      await refresh();
      toast.success(t('catalog.toasts.retired'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('catalog.toasts.error'));
    } finally {
      setBusy(false);
    }
  };

  const columns = useMemo<GridColDef<CatalogEntity>[]>(
    () => [
      {
        field: 'name',
        headerName: t('catalog.columns.asset'),
        minWidth: 240,
        flex: 1,
        renderCell: ({ row }) => (
          <Box sx={{ minWidth: 0, py: 0.75 }}>
            <Typography variant="body2" fontWeight={700} noWrap>
              {row.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {row.ref}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'kind',
        headerName: t('catalog.columns.kind'),
        width: 156,
        renderCell: ({ row }) => (
          <Chip size="small" variant="outlined" label={t(`catalog.kinds.${row.kind}`)} />
        ),
      },
      { field: 'ownerRef', headerName: t('catalog.columns.owner'), minWidth: 170, flex: 0.7 },
      {
        field: 'scope',
        headerName: t('catalog.columns.scope'),
        width: 130,
        renderCell: ({ row }) => t(`catalog.scopes.${row.scope}`),
      },
      {
        field: 'lifecycleState',
        headerName: t('catalog.columns.state'),
        width: 110,
        renderCell: ({ row }) => (
          <Chip size="small" label={display('states', row.lifecycleState)} />
        ),
      },
    ],
    [display, t]
  );

  if (overviewQuery.isError || graphQuery.isError) {
    return <Alert severity="error">{t('catalog.loadError')}</Alert>;
  }

  const overview = overviewQuery.data;
  return (
    <Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(5, minmax(0, 1fr))' },
          borderTop: 1,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Metric
          label={t('catalog.metrics.assets')}
          value={overview?.entityCount ?? 0}
          detail={t('catalog.metrics.assetsDetail')}
        />
        <Metric
          label={t('catalog.metrics.relations')}
          value={overview?.relationCount ?? 0}
          detail={t('catalog.metrics.relationsDetail')}
        />
        <Metric
          label={t('catalog.metrics.declared')}
          value={overview?.declaredRelationCount ?? 0}
          detail={t('catalog.metrics.declaredDetail')}
        />
        <Metric
          label={t('catalog.metrics.critical')}
          value={overview?.criticalRelationCount ?? 0}
          detail={t('catalog.metrics.criticalDetail')}
        />
        <Metric
          label={t('catalog.metrics.orphans')}
          value={overview?.orphanCount ?? 0}
          detail={t('catalog.metrics.orphansDetail')}
        />
      </Box>

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
        >
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

      {view === 'inventory' && (
        <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'minmax(260px, 1fr) 210px' },
              gap: 1.5,
              p: 2,
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <FormField
              size="small"
              label={t('catalog.search')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={17} />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <FormField
              select
              size="small"
              label={t('catalog.columns.kind')}
              value={kind}
              onChange={(event) => setKind(event.target.value as CatalogEntityKind | 'ALL')}
            >
              {KINDS.map((value) => (
                <MenuItem key={value} value={value}>
                  {value === 'ALL' ? t('catalog.allKinds') : t(`catalog.kinds.${value}`)}
                </MenuItem>
              ))}
            </FormField>
          </Box>
          <EnterpriseDataGrid
            ariaLabel={t('catalog.views.inventory')}
            rows={filteredEntities}
            columns={columns}
            getRowId={(row) => row.ref}
            loading={overviewQuery.isLoading}
            hideFooter={filteredEntities.length <= 25}
            initialState={{ pagination: { paginationModel: { pageSize: 25, page: 0 } } }}
            onRowClick={({ row }) => {
              setSelectedRef(row.ref);
              setView('graph');
            }}
            sx={{ border: 0, borderRadius: 0 }}
          />
        </Box>
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
                      label={t(`catalog.kinds.${selected.kind}`)}
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
                    [t('catalog.columns.scope'), t(`catalog.scopes.${selected.scope}`)],
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
                            {t(`catalog.relation.types.${relation.relationType}`)}
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
                            disabled={busy}
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
            selectedFindingId={selectedFindingId}
            onEvaluate={() => void evaluateAssurance()}
            onSelect={selectFinding}
            onReview={setDispositionTarget}
          />
        </>
      )}

      {relationDialog && selected && (
        <RelationDialog
          source={selected}
          entities={entities}
          busy={busy}
          onClose={() => setRelationDialog(false)}
          onSubmit={(value) => void saveRelation(value)}
        />
      )}
      {dispositionTarget && (
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
