import { useTranslation } from 'react-i18next';
import { formatNumber, useDisplayDictionary } from '@dwp-frontend/shared-i18n';
import {
  Boxes,
  Columns3,
  Database,
  GitFork,
  HardDrive,
  KeyRound,
  ShieldCheck,
  Table2,
} from 'lucide-react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import type { LucideIcon } from 'lucide-react';
import type {
  ProviderDataAsset,
  ProviderDataGovernanceFinding,
  ProviderDatabaseAssetSummary,
} from '@dwp-frontend/shared-utils';

export const PROVIDER_DATABASE_COLOR: Record<string, string> = {
  auth: '#2f6feb',
  people: '#16866a',
  platform: '#b26a00',
  provider: '#7a4fb7',
};

export function formatProviderBytes(value: number): string {
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const order = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** order).toFixed(order > 1 ? 1 : 0)} ${units[order]}`;
}

export function ProviderGovernanceMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
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

export function ProviderDatabaseScope({
  database,
  selected,
  onSelect,
}: {
  database: ProviderDatabaseAssetSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation('provider');
  const color = PROVIDER_DATABASE_COLOR[database.databaseKey] ?? '#687386';
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

export function ProviderAssetInspector({ asset }: { asset?: ProviderDataAsset }) {
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
        <ProviderGovernanceMetric
          icon={Columns3}
          label={t('dataGovernance.asset.columns')}
          value={formatNumber(asset.columns.length)}
        />
        <ProviderGovernanceMetric
          icon={HardDrive}
          label={t('dataGovernance.asset.storage')}
          value={formatProviderBytes(asset.totalBytes)}
        />
        <ProviderGovernanceMetric
          icon={GitFork}
          label={t('dataGovernance.asset.relationships')}
          value={formatNumber(asset.inboundRelationships + asset.outboundRelationships)}
        />
        <ProviderGovernanceMetric
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

export function ProviderFindingInspector({ finding }: { finding?: ProviderDataGovernanceFinding }) {
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
