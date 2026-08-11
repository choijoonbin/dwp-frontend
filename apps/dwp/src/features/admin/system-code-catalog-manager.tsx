import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Braces, RefreshCw, Search } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getAdminSystemCodeSet, listSystemCodeSetHealth } from '@dwp-frontend/shared-utils';
import { EnterpriseDataGrid } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import ListItemButton from '@mui/material/ListItemButton';
import InputAdornment from '@mui/material/InputAdornment';
import useMediaQuery from '@mui/material/useMediaQuery';

import { AdminPanelError, AdminPanelLoading } from './admin-ui';

import type { GridColDef } from '@mui/x-data-grid';
import type { SystemCodeSetHealth, SystemCodeValue } from '@dwp-frontend/shared-utils';

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

const levelColor = {
  SYSTEM: 'default',
  EXTENSIBLE: 'info',
  USER: 'success',
} as const;

const kindColor = {
  REFERENCE: 'info',
  STATE_MACHINE: 'warning',
  SECURITY: 'error',
  PROTOCOL: 'primary',
  OBSERVABILITY: 'success',
  REGISTRY_META: 'default',
} as const;

export function SystemCodeCatalogManager() {
  const { t, i18n } = useTranslation('admin');
  const queryClient = useQueryClient();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const healthQuery = useQuery({
    queryKey: ['admin', 'system-code-catalog'],
    queryFn: listSystemCodeSetHealth,
  });
  const codeSets = useMemo(() => healthQuery.data ?? [], [healthQuery.data]);
  const filteredSets = useMemo(
    () =>
      deferredQuery
        ? codeSets.filter((item) =>
            [
              item.codeSetKey,
              item.ownerService,
              item.contractKind,
              item.configurationLevel,
              item.validationSource,
              item.runtimeVisibility,
            ]
              .join(' ')
              .toLowerCase()
              .includes(deferredQuery)
          )
        : codeSets,
    [codeSets, deferredQuery]
  );

  useEffect(() => {
    if (filteredSets.length === 0) {
      setSelectedKey(null);
      return;
    }
    if (!selectedKey || !filteredSets.some((item) => item.codeSetKey === selectedKey)) {
      setSelectedKey(filteredSets[0].codeSetKey);
    }
  }, [filteredSets, selectedKey]);

  const detailQuery = useQuery({
    queryKey: ['admin', 'system-code-set', selectedKey, locale],
    queryFn: () => getAdminSystemCodeSet(selectedKey!, locale),
    enabled: Boolean(selectedKey),
  });
  const detail = detailQuery.data;

  const summary = useMemo(
    () => ({
      registered: codeSets.filter((item) => item.registrationState === 'REGISTERED').length,
      incomplete: codeSets.filter((item) => item.registrationState === 'INCOMPLETE').length,
      values: codeSets.reduce((total, item) => total + item.valueCount, 0),
      bindings: codeSets.reduce((total, item) => total + item.bindingCount, 0),
      enforced: codeSets.reduce((total, item) => total + item.enforcedBindingCount, 0),
    }),
    [codeSets]
  );

  const valueColumns = useMemo<GridColDef<SystemCodeValue>[]>(
    () => [
      {
        field: 'code',
        headerName: t('systemCodeCatalog.columns.code'),
        minWidth: 170,
        flex: 0.8,
        renderCell: ({ row }) => (
          <Typography variant="body2" fontWeight={700} noWrap>
            {row.code}
          </Typography>
        ),
      },
      {
        field: 'label',
        headerName: t('systemCodeCatalog.columns.label'),
        minWidth: 190,
        flex: 1,
      },
      {
        field: 'predefined',
        headerName: t('systemCodeCatalog.columns.origin'),
        width: 118,
        renderCell: ({ row }) => (
          <Chip
            label={t(
              row.predefined
                ? 'systemCodeCatalog.origins.predefined'
                : 'systemCodeCatalog.origins.extension'
            )}
            size="small"
            variant="outlined"
          />
        ),
      },
      {
        field: 'sortOrder',
        headerName: t('systemCodeCatalog.columns.order'),
        width: 84,
        type: 'number',
      },
    ],
    [t]
  );

  if (healthQuery.isLoading) {
    return <AdminPanelLoading label={t('systemCodeCatalog.loading')} />;
  }
  if (healthQuery.isError) {
    return (
      <AdminPanelError message={errorMessage(healthQuery.error, t('common.operationError'))} />
    );
  }

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'system-code-catalog'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'system-code-set'] }),
    ]);
  };

  const metrics = [
    ['registered', summary.registered],
    ['incomplete', summary.incomplete],
    ['values', summary.values],
    [
      'bindings',
      `${summary.enforced.toLocaleString(locale)} / ${summary.bindings.toLocaleString(locale)}`,
    ],
  ] as const;

  return (
    <Box sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
      <Box
        component="section"
        aria-label={t('systemCodeCatalog.summary.label')}
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, 1fr)' },
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        {metrics.map(([key, value], index) => (
          <Box
            key={key}
            sx={{
              minWidth: 0,
              px: { xs: 2, md: 2.5 },
              py: 1.75,
              borderRight: {
                xs: index % 2 === 0 ? 1 : 0,
                md: index < metrics.length - 1 ? 1 : 0,
              },
              borderBottom: { xs: index < 2 ? 1 : 0, md: 0 },
              borderColor: 'divider',
            }}
          >
            <Typography variant="caption" color="text.secondary">
              {t(`systemCodeCatalog.summary.${key}`)}
            </Typography>
            <Typography variant="h5" sx={{ mt: 0.25 }}>
              {typeof value === 'number' ? value.toLocaleString(locale) : value}
            </Typography>
          </Box>
        ))}
      </Box>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        gap={1.5}
        sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <TextField
          size="small"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('systemCodeCatalog.searchPlaceholder')}
          inputProps={{ 'aria-label': t('systemCodeCatalog.searchLabel') }}
          sx={{ width: { xs: 1, sm: 360 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search size={17} strokeWidth={1.8} />
              </InputAdornment>
            ),
          }}
        />
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
          <Typography variant="caption" color="text.secondary">
            {t('systemCodeCatalog.resultCount', { count: filteredSets.length })}
          </Typography>
          <Tooltip title={t('common.actions.refresh')}>
            <IconButton aria-label={t('systemCodeCatalog.refresh')} onClick={() => void refresh()}>
              <RefreshCw size={18} strokeWidth={1.8} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(280px, 0.34fr) minmax(0, 1fr)' },
          minHeight: 520,
          height: { md: 'clamp(520px, calc(100dvh - 340px), 760px)' },
        }}
      >
        <Box
          component="nav"
          aria-label={t('systemCodeCatalog.listLabel')}
          sx={{
            maxHeight: { xs: 320, md: 'none' },
            overflowY: 'auto',
            borderRight: { md: 1 },
            borderBottom: { xs: 1, md: 0 },
            borderColor: 'divider',
          }}
        >
          {filteredSets.length ? (
            filteredSets.map((item: SystemCodeSetHealth) => (
              <ListItemButton
                key={item.codeSetKey}
                selected={item.codeSetKey === selectedKey}
                onClick={() => setSelectedKey(item.codeSetKey)}
                sx={{
                  minHeight: 72,
                  px: 2,
                  py: 1.25,
                  alignItems: 'flex-start',
                  borderBottom: 1,
                  borderColor: 'divider',
                }}
              >
                <Box sx={{ minWidth: 0, width: 1 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                    <Typography variant="subtitle2" noWrap>
                      {item.codeSetKey}
                    </Typography>
                    <Box
                      aria-label={t(`systemCodeCatalog.states.${item.registrationState}`)}
                      sx={{
                        width: 8,
                        height: 8,
                        flex: '0 0 8px',
                        borderRadius: '50%',
                        bgcolor:
                          item.registrationState === 'REGISTERED' ? 'success.main' : 'warning.main',
                      }}
                    />
                  </Stack>
                  <Typography variant="caption" color="text.secondary" noWrap display="block">
                    {item.ownerService}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap display="block">
                    {t('systemCodeCatalog.listSummary', {
                      values: item.valueCount,
                      bindings: item.bindingCount,
                      enforced: item.enforcedBindingCount,
                    })}
                  </Typography>
                </Box>
              </ListItemButton>
            ))
          ) : (
            <Box sx={{ py: 8, px: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {t('systemCodeCatalog.empty')}
              </Typography>
            </Box>
          )}
        </Box>

        <Box
          component="section"
          aria-label={t('systemCodeCatalog.detailLabel')}
          sx={{ minWidth: 0, overflowY: { md: 'auto' } }}
        >
          {detailQuery.isLoading ? (
            <AdminPanelLoading label={t('systemCodeCatalog.loadingDetail')} />
          ) : detailQuery.isError ? (
            <AdminPanelError
              message={errorMessage(detailQuery.error, t('common.operationError'))}
            />
          ) : detail ? (
            <>
              <Box sx={{ px: { xs: 2, md: 2.5 }, py: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  justifyContent="space-between"
                  gap={1.5}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                      <Braces size={19} strokeWidth={1.8} aria-hidden="true" />
                      <Typography component="h2" variant="h6">
                        {detail.displayName}
                      </Typography>
                      <Chip
                        label={t(`systemCodeCatalog.levels.${detail.configurationLevel}`)}
                        color={levelColor[detail.configurationLevel]}
                        size="small"
                        variant="outlined"
                      />
                      <Chip
                        label={t(`systemCodeCatalog.kinds.${detail.contractKind}`)}
                        color={kindColor[detail.contractKind]}
                        size="small"
                        variant="outlined"
                      />
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {detail.description}
                    </Typography>
                  </Box>
                  <Chip label={`v${detail.schemaVersion}`} size="small" variant="outlined" />
                </Stack>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(2, minmax(0, 1fr))',
                      lg: 'repeat(4, minmax(0, 1fr))',
                    },
                    gap: 1.5,
                    mt: 2,
                  }}
                >
                  {[
                    ['owner', detail.ownerService],
                    ['validation', detail.validationSource],
                    ['source', detail.sourceReference],
                    ['visibility', t(`systemCodeCatalog.visibility.${detail.runtimeVisibility}`)],
                  ].map(([key, value]) => (
                    <Box key={key} sx={{ minWidth: 0 }}>
                      <Typography variant="caption" color="text.secondary">
                        {t(`systemCodeCatalog.metadata.${key}`)}
                      </Typography>
                      <Typography variant="body2" noWrap title={value}>
                        {value}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>

              <Box sx={{ px: { xs: 2, md: 2.5 }, pt: 2 }}>
                <Typography component="h3" variant="subtitle1">
                  {t('systemCodeCatalog.valuesTitle')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('systemCodeCatalog.valuesHelp')}
                </Typography>
              </Box>
              {desktop ? (
                <EnterpriseDataGrid
                  ariaLabel={t('systemCodeCatalog.valuesLabel')}
                  rows={detail.values}
                  columns={valueColumns}
                  getRowId={(row) => row.code}
                  hideFooter={detail.values.length <= 25}
                  maxVisibleRows={7}
                  initialState={{ pagination: { paginationModel: { page: 0, pageSize: 25 } } }}
                  sx={{ border: 0, borderRadius: 0, mt: 1 }}
                />
              ) : (
                <Box component="ul" sx={{ listStyle: 'none', p: 0, mt: 1, mb: 0 }}>
                  {detail.values.map((value) => (
                    <Box
                      component="li"
                      key={value.code}
                      sx={{ px: 2, py: 1.5, borderTop: 1, borderColor: 'divider' }}
                    >
                      <Stack direction="row" justifyContent="space-between" gap={2}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="subtitle2">{value.code}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {value.label}
                          </Typography>
                        </Box>
                        <Chip
                          label={t(
                            value.predefined
                              ? 'systemCodeCatalog.origins.predefined'
                              : 'systemCodeCatalog.origins.extension'
                          )}
                          size="small"
                          variant="outlined"
                        />
                      </Stack>
                    </Box>
                  ))}
                </Box>
              )}

              <Box sx={{ px: { xs: 2, md: 2.5 }, pt: 2, pb: 1 }}>
                <Typography component="h3" variant="subtitle1">
                  {t('systemCodeCatalog.bindingsTitle')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('systemCodeCatalog.bindingsHelp')}
                </Typography>
              </Box>
              <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
                {detail.bindings.map((binding) => (
                  <Box
                    component="li"
                    key={`${binding.consumerService}:${binding.usageType}:${binding.sourceReference}`}
                    sx={{
                      px: { xs: 2, md: 2.5 },
                      py: 1.25,
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: '0.7fr 0.8fr minmax(0, 1.6fr)' },
                      gap: 1,
                      borderTop: 1,
                      borderColor: 'divider',
                    }}
                  >
                    <Typography variant="body2" fontWeight={700} noWrap>
                      {binding.consumerService}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {binding.usageType} / {binding.enforcementType}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      noWrap
                      title={binding.sourceReference}
                    >
                      {binding.sourceReference}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </>
          ) : (
            <Box sx={{ minHeight: 320, display: 'grid', placeItems: 'center', px: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {t('systemCodeCatalog.selectSet')}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
