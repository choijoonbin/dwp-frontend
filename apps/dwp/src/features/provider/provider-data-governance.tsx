import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { formatNumber, useDisplayDictionary } from '@dwp-frontend/shared-i18n';
import {
  BookOpenCheck,
  Boxes,
  CircleAlert,
  Columns3,
  Database,
  FilterX,
  GitFork,
  HardDrive,
  KeyRound,
  RefreshCw,
  ScrollText,
  Search,
  ShieldCheck,
  Table2,
  Workflow,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getProviderDataGovernance,
  refreshProviderDataGovernance,
  useToast,
} from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import ListItemButton from '@mui/material/ListItemButton';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';

import { ActionButton } from '@dwp-frontend/design-system/components/actions/action-button';
import { FormField } from '@dwp-frontend/design-system/components/forms/form-field';

import { ProviderDataGovernanceGraph } from './provider-data-governance-graph';
import { ProviderDataPolicyStudio } from './provider-data-policy-studio';
import { ProviderError, ProviderLoading, formatProviderDate } from './provider-ui';

import type { LucideIcon } from 'lucide-react';
import type {
  ProviderDataAsset,
  ProviderDataGovernanceFinding,
  ProviderDatabaseAssetSummary,
} from '@dwp-frontend/shared-utils';

const ALL = 'ALL';
type GovernanceTab = 'catalog' | 'relationships' | 'lineage' | 'quality' | 'policies';

const databaseColor: Record<string, string> = {
  auth: '#2f6feb',
  people: '#16866a',
  platform: '#b26a00',
  provider: '#7a4fb7',
};

function formatBytes(value: number): string {
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const order = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** order).toFixed(order > 1 ? 1 : 0)} ${units[order]}`;
}

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      gap={1}
      sx={{ minWidth: 0, px: { xs: 1.5, md: 2.25 }, py: 1.4 }}
    >
      <Box sx={{ display: 'grid', placeItems: 'center', color: 'text.secondary' }}>
        <Icon size={18} strokeWidth={1.8} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" noWrap display="block">
          {label}
        </Typography>
        <Typography variant="subtitle1" fontWeight={750} noWrap>
          {value}
        </Typography>
      </Box>
    </Stack>
  );
}

function DatabaseScope({
  database,
  selected,
  onSelect,
}: {
  database: ProviderDatabaseAssetSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation('provider');
  const color = databaseColor[database.databaseKey] ?? '#687386';
  const documentation = database.totalAssets
    ? Math.round((database.documentedAssets / database.totalAssets) * 100)
    : 0;
  return (
    <ButtonBase
      onClick={onSelect}
      aria-pressed={selected}
      sx={{
        minWidth: 230,
        px: 2,
        py: 1.5,
        textAlign: 'left',
        justifyContent: 'flex-start',
        borderLeft: 3,
        borderLeftColor: selected ? color : 'transparent',
        bgcolor: selected ? alpha(color, 0.07) : 'transparent',
        '&:hover': { bgcolor: alpha(color, 0.05) },
      }}
    >
      <Stack gap={0.55} sx={{ width: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" gap={0.75}>
          <Database size={16} color={color} />
          <Typography variant="subtitle2" fontWeight={750} noWrap sx={{ flex: 1 }}>
            {database.databaseName}
          </Typography>
          <Chip
            size="small"
            variant="outlined"
            color={database.status === 'AVAILABLE' ? 'success' : 'error'}
            label={t(`dataGovernance.status.${database.status}`)}
          />
        </Stack>
        <Typography variant="caption" color="text.secondary" noWrap>
          {database.displayName} · {database.ownerService}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('dataGovernance.databaseSummary', {
            tables: database.logicalTables,
            columns: database.columns,
            documentation,
          })}
        </Typography>
      </Stack>
    </ButtonBase>
  );
}

function AssetInspector({ asset }: { asset?: ProviderDataAsset }) {
  const { t } = useTranslation('provider');
  const display = useDisplayDictionary();
  if (!asset) {
    return (
      <Box sx={{ minHeight: 320, display: 'grid', placeItems: 'center', px: 3 }}>
        <Stack alignItems="center" gap={1} color="text.secondary">
          <Table2 size={26} />
          <Typography variant="body2" textAlign="center">
            {t('dataGovernance.asset.selectPrompt')}
          </Typography>
        </Stack>
      </Box>
    );
  }
  return (
    <Stack gap={2} sx={{ minWidth: 0 }}>
      <Box>
        <Typography variant="overline" color="text.secondary">
          {asset.databaseName} / {asset.schemaName}
        </Typography>
        <Typography component="h3" variant="h6" sx={{ overflowWrap: 'anywhere' }}>
          {asset.objectName}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {asset.description || t('dataGovernance.asset.noDescription')}
        </Typography>
      </Box>
      <Stack direction="row" gap={0.75} flexWrap="wrap" useFlexGap>
        <Chip size="small" variant="outlined" label={asset.businessDomain} />
        <Chip size="small" variant="outlined" label={display('objectTypes', asset.objectType)} />
        <Chip
          size="small"
          variant="outlined"
          color={asset.dataClassification === 'RESTRICTED' ? 'error' : 'default'}
          label={t(`dataGovernance.classification.${asset.dataClassification}`)}
        />
        {asset.tenantScoped && (
          <Chip
            size="small"
            variant="outlined"
            color="info"
            icon={<ShieldCheck size={13} />}
            label={t('dataGovernance.asset.tenantScoped')}
          />
        )}
      </Stack>
      {asset.reviewState === 'REVIEW_REQUIRED' && (
        <Alert severity="warning">
          <Typography variant="subtitle2">{t('dataGovernance.asset.reviewRequired')}</Typography>
          <Typography variant="body2">{asset.reviewNote}</Typography>
        </Alert>
      )}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          borderBlock: 1,
          borderColor: 'divider',
        }}
      >
        <Metric
          icon={Columns3}
          label={t('dataGovernance.asset.columns')}
          value={formatNumber(asset.columns.length)}
        />
        <Metric
          icon={HardDrive}
          label={t('dataGovernance.asset.storage')}
          value={formatBytes(asset.totalBytes)}
        />
        <Metric
          icon={GitFork}
          label={t('dataGovernance.asset.relationships')}
          value={formatNumber(asset.inboundRelationships + asset.outboundRelationships)}
        />
        <Metric
          icon={Boxes}
          label={t('dataGovernance.asset.estimatedRows')}
          value={formatNumber(asset.estimatedRows)}
        />
      </Box>
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {t('dataGovernance.asset.columnContract')}
        </Typography>
        <TableContainer sx={{ maxHeight: 420, border: 1, borderColor: 'divider' }}>
          <Table size="small" stickyHeader aria-label={t('dataGovernance.asset.columnContract')}>
            <TableHead>
              <TableRow>
                <TableCell>{t('dataGovernance.columns.name')}</TableCell>
                <TableCell>{t('dataGovernance.columns.type')}</TableCell>
                <TableCell>{t('dataGovernance.columns.controls')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {asset.columns.map((column) => (
                <TableRow key={column.name} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={column.primaryKey ? 750 : 500} noWrap>
                      {column.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {column.dataType}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" gap={0.4}>
                      {column.primaryKey && (
                        <Tooltip title={t('dataGovernance.columns.primaryKey')}>
                          <KeyRound size={14} />
                        </Tooltip>
                      )}
                      {column.foreignKey && (
                        <Tooltip title={t('dataGovernance.columns.foreignKey')}>
                          <GitFork size={14} />
                        </Tooltip>
                      )}
                      {column.classification !== 'INTERNAL' && (
                        <Tooltip
                          title={t(`dataGovernance.classification.${column.classification}`)}
                        >
                          <ShieldCheck size={14} />
                        </Tooltip>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Stack>
  );
}

function FindingInspector({ finding }: { finding?: ProviderDataGovernanceFinding }) {
  const { t } = useTranslation('provider');
  if (!finding) {
    return (
      <Box sx={{ minHeight: 260, display: 'grid', placeItems: 'center', px: 3 }}>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          {t('dataGovernance.quality.selectPrompt')}
        </Typography>
      </Box>
    );
  }
  const target = finding.assetKey?.split('.').at(-1) ?? finding.databaseKey;
  const localizedTitle = `${t(`dataGovernance.categories.${finding.category}`)} · ${target}`;
  return (
    <Stack gap={2}>
      <Box>
        <Stack direction="row" gap={0.75} sx={{ mb: 1 }}>
          <Chip
            size="small"
            variant="outlined"
            color={
              finding.severity === 'CRITICAL' || finding.severity === 'HIGH' ? 'error' : 'warning'
            }
            label={t(`dataGovernance.severity.${finding.severity}`)}
          />
          <Chip
            size="small"
            variant="outlined"
            label={t(`dataGovernance.categories.${finding.category}`)}
          />
        </Stack>
        <Typography component="h3" variant="h6">
          {localizedTitle}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
          {t(`dataGovernance.findings.${finding.category}.description`, {
            defaultValue: finding.detail,
          })}
        </Typography>
      </Box>
      <Divider />
      <Box>
        <Typography variant="subtitle2">{t('dataGovernance.quality.recommendation')}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {t(`dataGovernance.findings.${finding.category}.recommendation`, {
            defaultValue: finding.recommendation,
          })}
        </Typography>
      </Box>
      <Box>
        <Typography variant="subtitle2">{t('dataGovernance.quality.evidence')}</Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.5, overflowWrap: 'anywhere' }}
        >
          {finding.detail}
        </Typography>
        {finding.evidence && (
          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            sx={{ mt: 0.5, overflowWrap: 'anywhere' }}
          >
            {finding.evidence}
          </Typography>
        )}
      </Box>
    </Stack>
  );
}

export function ProviderDataGovernance() {
  const { t } = useTranslation('provider');
  const [searchParams, setSearchParams] = useSearchParams();
  const theme = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const requestedTab = searchParams.get('tab');
  const requestedAssetKey = searchParams.get('asset') ?? undefined;
  const initialTab: GovernanceTab = [
    'catalog',
    'relationships',
    'lineage',
    'quality',
    'policies',
  ].includes(requestedTab ?? '')
    ? (requestedTab as GovernanceTab)
    : 'catalog';
  const [tab, setTab] = useState<GovernanceTab>(initialTab);
  const [database, setDatabase] = useState(ALL);
  const [domain, setDomain] = useState(ALL);
  const [query, setQuery] = useState('');
  const [includePartitions, setIncludePartitions] = useState(
    () => searchParams.get('partitions') === 'true'
  );
  const [selectedAssetKey, setSelectedAssetKey] = useState<string | undefined>(requestedAssetKey);
  const [selectedFindingId, setSelectedFindingId] = useState<string>();
  const [severity, setSeverity] = useState(ALL);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const governanceQuery = useQuery({
    queryKey: ['provider', 'data-governance'],
    queryFn: getProviderDataGovernance,
  });
  const refreshMutation = useMutation({
    mutationFn: refreshProviderDataGovernance,
    onSuccess: (data) => {
      queryClient.setQueryData(['provider', 'data-governance'], data);
      toast.success(t('dataGovernance.refreshCompleted'));
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t('errors.load')),
  });
  const snapshot = governanceQuery.data;
  const selectedDatabase = database === ALL ? undefined : database;
  const domains = useMemo(
    () =>
      [
        ...new Set(
          (snapshot?.assets ?? [])
            .filter((asset) => !selectedDatabase || asset.databaseKey === selectedDatabase)
            .map((asset) => asset.businessDomain)
        ),
      ].sort(),
    [selectedDatabase, snapshot?.assets]
  );
  const filteredAssets = useMemo(
    () =>
      (snapshot?.assets ?? []).filter((asset) => {
        const searchable = [
          asset.objectName,
          asset.schemaName,
          asset.databaseName,
          asset.businessDomain,
          asset.ownerService,
          asset.description,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return (
          (!selectedDatabase || asset.databaseKey === selectedDatabase) &&
          (domain === ALL || asset.businessDomain === domain) &&
          (includePartitions || asset.objectType !== 'PARTITION') &&
          (!deferredQuery || searchable.includes(deferredQuery))
        );
      }),
    [deferredQuery, domain, includePartitions, selectedDatabase, snapshot?.assets]
  );
  const selectedAsset = snapshot?.assets.find((asset) => asset.assetKey === selectedAssetKey);
  const requestedAssetMissing = Boolean(
    requestedAssetKey &&
    snapshot &&
    !snapshot.assets.some((asset) => asset.assetKey === requestedAssetKey)
  );

  useEffect(() => {
    const nextTab = searchParams.get('tab');
    if (
      nextTab &&
      ['catalog', 'relationships', 'lineage', 'quality', 'policies'].includes(nextTab) &&
      nextTab !== tab
    ) {
      setTab(nextTab as GovernanceTab);
    }
    const nextAsset = searchParams.get('asset') ?? undefined;
    if (nextAsset && nextAsset !== selectedAssetKey) setSelectedAssetKey(nextAsset);
  }, [searchParams, selectedAssetKey, tab]);

  useEffect(() => {
    if (tab !== 'catalog') return;
    if (!filteredAssets.length) {
      setSelectedAssetKey(undefined);
      return;
    }
    if (!selectedAssetKey || !filteredAssets.some((asset) => asset.assetKey === selectedAssetKey)) {
      setSelectedAssetKey(filteredAssets[0].assetKey);
    }
  }, [filteredAssets, selectedAssetKey, tab]);

  useEffect(() => {
    if (domain !== ALL && !domains.includes(domain)) setDomain(ALL);
  }, [domain, domains]);

  if (governanceQuery.isLoading) return <ProviderLoading />;
  if (governanceQuery.isError || !snapshot) return <ProviderError error={governanceQuery.error} />;

  const relationshipDatabase =
    database === ALL
      ? snapshot.databases.find((item) => item.status === 'AVAILABLE')?.databaseKey
      : database;
  const relationshipDatabaseAssets = snapshot.assets.filter(
    (asset) =>
      asset.databaseKey === relationshipDatabase &&
      asset.objectType !== 'PARTITION' &&
      asset.objectType !== 'SYSTEM_TABLE'
  );
  const relationshipDatabaseKeys = new Set(
    relationshipDatabaseAssets.map((asset) => asset.assetKey)
  );
  const matchesAssetQuery = (asset: ProviderDataAsset) =>
    !deferredQuery ||
    [
      asset.objectName,
      asset.schemaName,
      asset.databaseName,
      asset.businessDomain,
      asset.ownerService,
      asset.description,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(deferredQuery);
  const relationshipSeedKeys = new Set(
    relationshipDatabaseAssets
      .filter(
        (asset) => (domain === ALL || asset.businessDomain === domain) && matchesAssetQuery(asset)
      )
      .map((asset) => asset.assetKey)
  );
  const relationshipEdges = snapshot.relationships.filter(
    (edge) =>
      relationshipDatabaseKeys.has(edge.sourceAssetKey) &&
      relationshipDatabaseKeys.has(edge.targetAssetKey) &&
      ((domain === ALL && !deferredQuery) ||
        relationshipSeedKeys.has(edge.sourceAssetKey) ||
        relationshipSeedKeys.has(edge.targetAssetKey))
  );
  const connectedKeys = new Set([
    ...relationshipSeedKeys,
    ...relationshipEdges.flatMap((edge) => [edge.sourceAssetKey, edge.targetAssetKey]),
  ]);
  const connectedAssets = relationshipDatabaseAssets.filter((asset) =>
    connectedKeys.has(asset.assetKey)
  );
  const relationshipSelectedAsset =
    connectedAssets.find((asset) => asset.assetKey === selectedAssetKey) ?? connectedAssets[0];

  const lineageAssetMatches = new Set(
    snapshot.assets.filter(matchesAssetQuery).map((asset) => asset.assetKey)
  );
  const lineageEdges = snapshot.lineage.filter((edge) => {
    const inDatabaseScope =
      database === ALL ||
      edge.sourceAssetKey.startsWith(`${database}.`) ||
      edge.targetAssetKey.startsWith(`${database}.`);
    if (!inDatabaseScope) return false;
    if (!deferredQuery) return true;
    const edgeText = [edge.processKey, edge.description, edge.evidence, edge.edgeType]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return (
      edgeText.includes(deferredQuery) ||
      lineageAssetMatches.has(edge.sourceAssetKey) ||
      lineageAssetMatches.has(edge.targetAssetKey)
    );
  });
  const lineageKeys = new Set(
    lineageEdges.flatMap((edge) => [edge.sourceAssetKey, edge.targetAssetKey])
  );
  const lineageAssets = snapshot.assets.filter((asset) => lineageKeys.has(asset.assetKey));
  const lineageSelectedAsset =
    lineageAssets.find((asset) => asset.assetKey === selectedAssetKey) ?? lineageAssets[0];
  const categories = [...new Set(snapshot.findings.map((finding) => finding.category))].sort();
  const qualityFindings = snapshot.findings.filter((finding) => {
    const searchable = [finding.title, finding.detail, finding.assetKey, finding.category]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return (
      (!selectedDatabase || finding.databaseKey === selectedDatabase) &&
      (severity === ALL || finding.severity === severity) &&
      (!deferredQuery || searchable.includes(deferredQuery))
    );
  });
  const selectedFinding =
    qualityFindings.find((finding) => finding.findingId === selectedFindingId) ??
    qualityFindings[0];

  const suggestedRelationshipDomain = (databaseKey: string, preferredAssetKey?: string) => {
    const databaseAssets = snapshot.assets.filter(
      (asset) =>
        asset.databaseKey === databaseKey &&
        asset.objectType !== 'PARTITION' &&
        asset.objectType !== 'SYSTEM_TABLE'
    );
    const participation = new Map<string, number>();
    snapshot.relationships
      .filter((edge) => edge.databaseKey === databaseKey)
      .forEach((edge) => {
        participation.set(edge.sourceAssetKey, (participation.get(edge.sourceAssetKey) ?? 0) + 1);
        participation.set(edge.targetAssetKey, (participation.get(edge.targetAssetKey) ?? 0) + 1);
      });
    const preferred = databaseAssets.find(
      (asset) => asset.assetKey === preferredAssetKey && participation.has(asset.assetKey)
    );
    if (preferred) return preferred.businessDomain;

    const domainWeight = new Map<string, number>();
    databaseAssets.forEach((asset) => {
      domainWeight.set(
        asset.businessDomain,
        (domainWeight.get(asset.businessDomain) ?? 0) + (participation.get(asset.assetKey) ?? 0)
      );
    });
    return (
      [...domainWeight.entries()].sort(
        ([leftDomain, leftWeight], [rightDomain, rightWeight]) =>
          rightWeight - leftWeight || leftDomain.localeCompare(rightDomain)
      )[0]?.[0] ?? ALL
    );
  };

  const selectDatabaseScope = (nextDatabase: string) => {
    if (tab !== 'relationships') {
      setDatabase(nextDatabase);
      return;
    }
    const relationshipScope =
      nextDatabase === ALL
        ? snapshot.databases.find((item) => item.status === 'AVAILABLE')?.databaseKey
        : nextDatabase;
    if (!relationshipScope) return;
    setDatabase(relationshipScope);
    setDomain(suggestedRelationshipDomain(relationshipScope, selectedAssetKey));
  };

  const setTabAndScope = (next: GovernanceTab) => {
    setTab(next);
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    if (next !== 'catalog' && next !== 'lineage' && next !== 'quality') params.delete('asset');
    setSearchParams(params);
    setQuery('');
    if (next === 'lineage') {
      setDatabase(ALL);
      setDomain(ALL);
      const firstLineageAsset = snapshot.lineage[0]?.sourceAssetKey;
      if (firstLineageAsset) setSelectedAssetKey(firstLineageAsset);
    }
    if (next === 'quality') {
      setDomain(ALL);
      const firstFinding = snapshot.findings.find(
        (finding) => database === ALL || finding.databaseKey === database
      );
      if (firstFinding) {
        setSelectedFindingId(firstFinding.findingId);
        if (firstFinding.assetKey) setSelectedAssetKey(firstFinding.assetKey);
      }
    }
    if (next === 'relationships' && relationshipDatabase) {
      setDatabase(relationshipDatabase);
      setDomain(suggestedRelationshipDomain(relationshipDatabase, selectedAssetKey));
    }
  };

  return (
    <Stack gap={2.5}>
      {requestedAssetMissing && (
        <Alert severity="warning">
          {t('dataGovernance.asset.deepLinkNotFound', { id: requestedAssetKey })}
        </Alert>
      )}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(5, minmax(0, 1fr))' },
          borderBlock: 1,
          borderColor: 'divider',
          '& > *:not(:last-child)': { borderRight: { md: 1 }, borderColor: 'divider' },
        }}
      >
        <Metric
          icon={Database}
          label={t('dataGovernance.metrics.databases')}
          value={`${snapshot.summary.availableDatabases}/${snapshot.summary.databases}`}
        />
        <Metric
          icon={Table2}
          label={t('dataGovernance.metrics.tables')}
          value={formatNumber(snapshot.summary.logicalTables)}
        />
        <Metric
          icon={Columns3}
          label={t('dataGovernance.metrics.columns')}
          value={formatNumber(snapshot.summary.columns)}
        />
        <Metric
          icon={GitFork}
          label={t('dataGovernance.metrics.relationships')}
          value={formatNumber(snapshot.summary.foreignKeys)}
        />
        <Metric
          icon={HardDrive}
          label={t('dataGovernance.metrics.storage')}
          value={formatBytes(snapshot.summary.totalBytes)}
        />
      </Box>

      <Box>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          gap={1}
          sx={{ mb: 1 }}
        >
          <Box>
            <Typography component="h2" variant="h6">
              {t('dataGovernance.databaseTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('dataGovernance.databaseDescription')}
            </Typography>
          </Box>
          <ActionButton
            intent="secondary"
            startIcon={<RefreshCw size={16} />}
            loading={refreshMutation.isPending}
            loadingLabel={t('dataGovernance.refresh')}
            onClick={() => refreshMutation.mutate()}
          >
            {t('dataGovernance.refresh')}
          </ActionButton>
        </Stack>
        <Box sx={{ display: 'flex', overflowX: 'auto', borderBlock: 1, borderColor: 'divider' }}>
          <DatabaseScope
            database={{
              databaseKey: ALL,
              databaseName: t('dataGovernance.allDatabases'),
              displayName: t('dataGovernance.globalScope'),
              ownerService: t('dataGovernance.providerOwned'),
              status:
                snapshot.summary.availableDatabases === snapshot.summary.databases
                  ? 'AVAILABLE'
                  : 'UNAVAILABLE',
              logicalTables: snapshot.summary.logicalTables,
              partitions: snapshot.summary.partitions,
              views: snapshot.databases.reduce((sum, item) => sum + item.views, 0),
              columns: snapshot.summary.columns,
              foreignKeys: snapshot.summary.foreignKeys,
              documentedAssets: snapshot.summary.documentedAssets,
              totalAssets: snapshot.assets.length,
              totalBytes: snapshot.summary.totalBytes,
              businessDomains: [],
            }}
            selected={database === ALL}
            onSelect={() => selectDatabaseScope(ALL)}
          />
          {snapshot.databases.map((item) => (
            <DatabaseScope
              key={item.databaseKey}
              database={item}
              selected={database === item.databaseKey}
              onSelect={() => selectDatabaseScope(item.databaseKey)}
            />
          ))}
        </Box>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={tab}
          onChange={(_event, value: GovernanceTab) => setTabAndScope(value)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab
            icon={<BookOpenCheck size={17} />}
            iconPosition="start"
            value="catalog"
            label={t('dataGovernance.tabs.catalog')}
          />
          <Tab
            icon={<GitFork size={17} />}
            iconPosition="start"
            value="relationships"
            label={t('dataGovernance.tabs.relationships')}
          />
          <Tab
            icon={<Workflow size={17} />}
            iconPosition="start"
            value="lineage"
            label={t('dataGovernance.tabs.lineage')}
          />
          <Tab
            icon={<CircleAlert size={17} />}
            iconPosition="start"
            value="quality"
            label={`${t('dataGovernance.tabs.quality')} (${snapshot.findings.length})`}
          />
          <Tab
            icon={<ScrollText size={17} />}
            iconPosition="start"
            value="policies"
            label={t('dataGovernance.tabs.policies')}
          />
        </Tabs>
      </Box>

      {tab !== 'policies' && (
        <Stack direction={{ xs: 'column', md: 'row' }} gap={1.25} alignItems={{ md: 'center' }}>
          <FormField
            fullWidth={false}
            size="small"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('dataGovernance.searchPlaceholder')}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={17} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ minWidth: { md: 330 } }}
          />
          {(tab === 'catalog' || tab === 'relationships') && (
            <FormControl size="small" sx={{ minWidth: 210 }}>
              <InputLabel id="data-governance-domain-label">
                {t('dataGovernance.filters.domain')}
              </InputLabel>
              <Select
                labelId="data-governance-domain-label"
                value={domain}
                label={t('dataGovernance.filters.domain')}
                onChange={(event) => setDomain(event.target.value)}
              >
                <MenuItem value={ALL}>{t('dataGovernance.filters.allDomains')}</MenuItem>
                {domains.map((item) => (
                  <MenuItem key={item} value={item}>
                    {item}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {tab === 'catalog' && (
            <Stack direction="row" alignItems="center" gap={0.5}>
              <Switch
                size="small"
                checked={includePartitions}
                onChange={(event) => setIncludePartitions(event.target.checked)}
              />
              <Typography variant="body2">{t('dataGovernance.filters.partitions')}</Typography>
            </Stack>
          )}
          {tab === 'quality' && (
            <FormControl size="small" sx={{ minWidth: 170 }}>
              <InputLabel id="data-governance-severity-label">
                {t('dataGovernance.filters.severity')}
              </InputLabel>
              <Select
                labelId="data-governance-severity-label"
                value={severity}
                label={t('dataGovernance.filters.severity')}
                onChange={(event) => setSeverity(event.target.value)}
              >
                <MenuItem value={ALL}>{t('dataGovernance.filters.allSeverities')}</MenuItem>
                {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((item) => (
                  <MenuItem key={item} value={item}>
                    {t(`dataGovernance.severity.${item}`)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {(query ||
            ((tab === 'catalog' || tab === 'relationships') && domain !== ALL) ||
            (tab === 'quality' && severity !== ALL) ||
            (tab === 'catalog' && includePartitions)) && (
            <ActionButton
              intent="quiet"
              startIcon={<FilterX size={16} />}
              onClick={() => {
                setQuery('');
                setDomain(ALL);
                setSeverity(ALL);
                setIncludePartitions(false);
              }}
            >
              {t('dataGovernance.filters.reset')}
            </ActionButton>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ ml: { md: 'auto' } }}>
            {t('dataGovernance.generatedAt', { value: formatProviderDate(snapshot.generatedAt) })}
          </Typography>
        </Stack>
      )}

      {tab === 'policies' && (
        <ProviderDataPolicyStudio assets={snapshot.assets} databases={snapshot.databases} />
      )}

      {tab === 'catalog' && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: '390px minmax(0, 1fr)' },
            border: 1,
            borderColor: 'divider',
            minHeight: 620,
          }}
        >
          <Box
            sx={{
              borderRight: { lg: 1 },
              borderBottom: { xs: 1, lg: 0 },
              borderColor: 'divider',
              maxHeight: { lg: 680 },
              overflowY: 'auto',
            }}
          >
            <Box sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary">
                {t('dataGovernance.assetCount', { count: filteredAssets.length })}
              </Typography>
            </Box>
            {filteredAssets.map((asset) => (
              <ListItemButton
                key={asset.assetKey}
                selected={asset.assetKey === selectedAssetKey}
                onClick={() => {
                  setSelectedAssetKey(asset.assetKey);
                  const params = new URLSearchParams(searchParams);
                  params.set('tab', 'catalog');
                  params.set('asset', asset.assetKey);
                  setSearchParams(params);
                }}
                sx={{
                  alignItems: 'flex-start',
                  px: 1.75,
                  py: 1.2,
                  borderBottom: 1,
                  borderColor: 'divider',
                }}
              >
                <Stack gap={0.35} sx={{ minWidth: 0, width: 1 }}>
                  <Stack direction="row" alignItems="center" gap={0.75}>
                    <Table2 size={15} color={databaseColor[asset.databaseKey]} />
                    <Typography variant="subtitle2" fontWeight={700} noWrap sx={{ flex: 1 }}>
                      {asset.objectName}
                    </Typography>
                    {asset.reviewState === 'REVIEW_REQUIRED' && (
                      <CircleAlert size={15} color={theme.palette.warning.main} />
                    )}
                  </Stack>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {asset.databaseName} · {asset.businessDomain}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('dataGovernance.asset.listMeta', {
                      columns: asset.columns.length,
                      rows: formatNumber(asset.estimatedRows),
                    })}
                  </Typography>
                </Stack>
              </ListItemButton>
            ))}
          </Box>
          <Box sx={{ p: { xs: 2, md: 2.5 }, minWidth: 0 }}>
            <AssetInspector asset={selectedAsset} />
          </Box>
        </Box>
      )}

      {tab === 'relationships' && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', xl: 'minmax(0, 1fr) 390px' },
            gap: 2,
          }}
        >
          <Box>
            <Alert severity="info" sx={{ mb: 1.5 }}>
              {t('dataGovernance.relationships.guidance', { database: relationshipDatabase })}
            </Alert>
            <ProviderDataGovernanceGraph
              assets={connectedAssets}
              relationships={relationshipEdges}
              selectedAssetKey={relationshipSelectedAsset?.assetKey}
              onSelectAsset={setSelectedAssetKey}
            />
          </Box>
          <Box sx={{ borderLeft: { xl: 1 }, borderColor: 'divider', pl: { xl: 2.5 }, minWidth: 0 }}>
            <AssetInspector asset={relationshipSelectedAsset} />
          </Box>
        </Box>
      )}

      {tab === 'lineage' && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', xl: 'minmax(0, 1fr) 390px' },
            gap: 2,
          }}
        >
          <Box>
            <Alert severity="info" sx={{ mb: 1.5 }}>
              {t('dataGovernance.lineage.guidance')}
            </Alert>
            <ProviderDataGovernanceGraph
              assets={lineageAssets}
              lineage={lineageEdges}
              selectedAssetKey={lineageSelectedAsset?.assetKey}
              onSelectAsset={setSelectedAssetKey}
            />
          </Box>
          <Stack
            gap={2}
            sx={{ borderLeft: { xl: 1 }, borderColor: 'divider', pl: { xl: 2.5 }, minWidth: 0 }}
          >
            <AssetInspector asset={lineageSelectedAsset} />
            {lineageSelectedAsset && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  {t('dataGovernance.lineage.processes')}
                </Typography>
                {lineageEdges
                  .filter(
                    (edge) =>
                      edge.sourceAssetKey === lineageSelectedAsset.assetKey ||
                      edge.targetAssetKey === lineageSelectedAsset.assetKey
                  )
                  .map((edge) => (
                    <Box key={edge.edgeId} sx={{ py: 1, borderTop: 1, borderColor: 'divider' }}>
                      <Typography variant="subtitle2">{edge.processKey}</Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {edge.description}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                        sx={{ mt: 0.35 }}
                      >
                        {edge.evidence}
                      </Typography>
                    </Box>
                  ))}
              </Box>
            )}
          </Stack>
        </Box>
      )}

      {tab === 'quality' && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 390px' },
            border: 1,
            borderColor: 'divider',
            minHeight: 600,
          }}
        >
          <Box
            sx={{
              maxHeight: 680,
              overflowY: 'auto',
              borderRight: { lg: 1 },
              borderColor: 'divider',
            }}
          >
            <Box sx={{ px: 1.75, py: 1, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary">
                {t('dataGovernance.quality.count', {
                  count: qualityFindings.length,
                  categories: categories.length,
                })}
              </Typography>
            </Box>
            {qualityFindings.map((finding) => (
              <ListItemButton
                key={finding.findingId}
                selected={finding.findingId === selectedFinding?.findingId}
                onClick={() => {
                  setSelectedFindingId(finding.findingId);
                  if (finding.assetKey) setSelectedAssetKey(finding.assetKey);
                }}
                sx={{
                  alignItems: 'flex-start',
                  px: 1.75,
                  py: 1.25,
                  borderBottom: 1,
                  borderColor: 'divider',
                }}
              >
                <Stack direction="row" gap={1} sx={{ width: 1, minWidth: 0 }}>
                  <CircleAlert
                    size={17}
                    color={
                      finding.severity === 'HIGH' || finding.severity === 'CRITICAL'
                        ? theme.palette.error.main
                        : theme.palette.warning.main
                    }
                  />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2" fontWeight={700}>
                      {t(`dataGovernance.categories.${finding.category}`)} ·{' '}
                      {finding.assetKey?.split('.').at(-1) ?? finding.databaseKey}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" noWrap>
                      {finding.assetKey || finding.databaseKey}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" noWrap>
                      {t(`dataGovernance.categories.${finding.category}`)}
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    variant="outlined"
                    label={t(`dataGovernance.severity.${finding.severity}`)}
                  />
                </Stack>
              </ListItemButton>
            ))}
          </Box>
          <Box sx={{ p: { xs: 2, md: 2.5 } }}>
            <FindingInspector finding={selectedFinding} />
          </Box>
        </Box>
      )}
    </Stack>
  );
}
