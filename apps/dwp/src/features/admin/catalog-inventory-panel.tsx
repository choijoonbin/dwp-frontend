import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Search } from 'lucide-react';
import { useDisplayDictionary } from '@dwp-frontend/shared-i18n';
import { ActionIconButton, EnterpriseDataGrid, FormField } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';

import { CATALOG_KINDS } from './catalog-explorer-options';
import { catalogKindLabelKey, catalogScopeLabelKey } from './catalog-presentation';

import type { GridColDef } from '@mui/x-data-grid';
import type { CatalogEntity, CatalogEntityKind } from '@dwp-frontend/shared-utils';

export function CatalogInventoryPanel({
  query,
  kind,
  rows,
  loading,
  onQueryChange,
  onKindChange,
  onOpen,
}: {
  query: string;
  kind: CatalogEntityKind | 'ALL';
  rows: CatalogEntity[];
  loading: boolean;
  onQueryChange: (value: string) => void;
  onKindChange: (value: CatalogEntityKind | 'ALL') => void;
  onOpen: (entity: CatalogEntity) => void;
}) {
  const { t } = useTranslation('admin');
  const display = useDisplayDictionary();
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
              {t(catalogKindLabelKey(row.kind))}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'kind',
        headerName: t('catalog.columns.kind'),
        width: 156,
        renderCell: ({ row }) => (
          <Chip size="small" variant="outlined" label={t(catalogKindLabelKey(row.kind))} />
        ),
      },
      {
        field: 'ownerRef',
        headerName: t('catalog.columns.owner'),
        minWidth: 170,
        flex: 0.7,
        renderCell: ({ row }) =>
          row.ownerRef ? t('catalog.ownerManaged') : t('catalog.ownerUnavailable'),
      },
      {
        field: 'scope',
        headerName: t('catalog.columns.scope'),
        width: 130,
        renderCell: ({ row }) => t(catalogScopeLabelKey(row.scope)),
      },
      {
        field: 'lifecycleState',
        headerName: t('catalog.columns.state'),
        width: 110,
        renderCell: ({ row }) => (
          <Chip size="small" label={display('states', row.lifecycleState)} />
        ),
      },
      {
        field: 'actions',
        headerName: '',
        width: 64,
        sortable: false,
        filterable: false,
        renderCell: ({ row }) => (
          <ActionIconButton
            label={t('catalog.openGraphFor', { name: row.name })}
            onClick={() => onOpen(row)}
          >
            <ArrowRight size={17} />
          </ActionIconButton>
        ),
      },
    ],
    [display, onOpen, t]
  );

  return (
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
          onChange={(event) => onQueryChange(event.target.value)}
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
          onChange={(event) => onKindChange(event.target.value as CatalogEntityKind | 'ALL')}
        >
          {CATALOG_KINDS.map((value) => (
            <MenuItem key={value} value={value}>
              {value === 'ALL' ? t('catalog.allKinds') : t(`catalog.kinds.${value}`)}
            </MenuItem>
          ))}
        </FormField>
      </Box>
      <EnterpriseDataGrid
        ariaLabel={t('catalog.views.inventory')}
        rows={rows}
        columns={columns}
        getRowId={(row) => row.ref}
        loading={loading}
        hideFooter={rows.length <= 25}
        initialState={{ pagination: { paginationModel: { pageSize: 25, page: 0 } } }}
        onRowClick={({ row }) => onOpen(row)}
        sx={{ border: 0, borderRadius: 0 }}
      />
    </Box>
  );
}
