import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Braces,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  FilterX,
  LockKeyhole,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getProviderSystemCodeCatalog, getProviderSystemCodeSet } from '@dwp-frontend/shared-utils';
import { formatNumber, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  ActionIconButton,
  EnterpriseDataGrid,
  FormField,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Select from '@mui/material/Select';
import Collapse from '@mui/material/Collapse';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import Typography from '@mui/material/Typography';
import FormControl from '@mui/material/FormControl';
import { alpha, useTheme } from '@mui/material/styles';
import ListItemButton from '@mui/material/ListItemButton';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress from '@mui/material/LinearProgress';
import useMediaQuery from '@mui/material/useMediaQuery';

import { ProviderError, ProviderLoading } from './provider-ui';

import type { GridColDef } from '@mui/x-data-grid';
import type {
  SystemCodeContractKind,
  SystemCodeSetHealth,
  SystemCodeValue,
} from '@dwp-frontend/shared-utils';

const ALL = 'ALL';
const LIST_PAGE_SIZE = 40;

type DetailTab = 'overview' | 'values' | 'consumers';

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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ minWidth: 0, px: { xs: 1.75, md: 2.5 }, py: 1.25 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5" sx={{ mt: 0.25 }}>
        {value}
      </Typography>
    </Box>
  );
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.25, overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
    </Box>
  );
}

export function ProviderCodeContracts() {
  const { t, i18n } = useTranslation('provider');
  const queryClient = useQueryClient();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const [query, setQuery] = useState('');
  const [owner, setOwner] = useState(ALL);
  const [level, setLevel] = useState(ALL);
  const [kind, setKind] = useState(ALL);
  const [state, setState] = useState(ALL);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [listPage, setListPage] = useState(0);
  const detailSectionRef = useRef<HTMLDivElement | null>(null);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const catalogQuery = useQuery({
    queryKey: ['provider', 'system-code-catalog'],
    queryFn: getProviderSystemCodeCatalog,
  });
  const codeSets = useMemo(() => catalogQuery.data?.codeSets ?? [], [catalogQuery.data]);
  const owners = useMemo(
    () => [...new Set(codeSets.map((item) => item.ownerService))].sort(),
    [codeSets]
  );
  const kinds = useMemo(
    () => [...new Set(codeSets.map((item) => item.contractKind))].sort(),
    [codeSets]
  );
  const filteredSets = useMemo(
    () =>
      codeSets.filter((item) => {
        const matchesQuery =
          !deferredQuery ||
          [item.codeSetKey, item.displayName, item.ownerService, item.validationSource]
            .join(' ')
            .toLowerCase()
            .includes(deferredQuery);
        return (
          matchesQuery &&
          (owner === ALL || item.ownerService === owner) &&
          (level === ALL || item.configurationLevel === level) &&
          (kind === ALL || item.contractKind === kind) &&
          (state === ALL || item.registrationState === state)
        );
      }),
    [codeSets, deferredQuery, kind, level, owner, state]
  );
  const listPageCount = Math.max(1, Math.ceil(filteredSets.length / LIST_PAGE_SIZE));
  const visibleSets = useMemo(
    () =>
      filteredSets.slice(
        listPage * LIST_PAGE_SIZE,
        Math.min((listPage + 1) * LIST_PAGE_SIZE, filteredSets.length)
      ),
    [filteredSets, listPage]
  );

  useEffect(() => {
    if (!filteredSets.length) {
      setSelectedKey(null);
      setListPage(0);
      return;
    }
    const selectedIndex = selectedKey
      ? filteredSets.findIndex((item) => item.codeSetKey === selectedKey)
      : -1;
    if (selectedIndex < 0) {
      setSelectedKey(filteredSets[0].codeSetKey);
      setDetailTab('overview');
      setListPage(0);
      return;
    }
    const selectedPage = Math.floor(selectedIndex / LIST_PAGE_SIZE);
    if (selectedPage !== listPage) {
      setListPage(selectedPage);
    }
  }, [filteredSets, listPage, selectedKey]);

  const detailQuery = useQuery({
    queryKey: ['provider', 'system-code-set', selectedKey, locale],
    queryFn: () => getProviderSystemCodeSet(selectedKey!, locale),
    enabled: Boolean(selectedKey),
  });
  const detail = detailQuery.data;
  const selectedHealth = codeSets.find((item) => item.codeSetKey === selectedKey);
  const summary = useMemo(() => {
    const bindings = codeSets.reduce((total, item) => total + item.bindingCount, 0);
    const enforced = codeSets.reduce((total, item) => total + item.enforcedBindingCount, 0);
    return {
      registered: codeSets.filter((item) => item.registrationState === 'REGISTERED').length,
      incomplete: codeSets.filter((item) => item.registrationState === 'INCOMPLETE').length,
      values: codeSets.reduce((total, item) => total + item.valueCount, 0),
      coverage: bindings ? Math.round((enforced / bindings) * 100) : 0,
    };
  }, [codeSets]);
  const hasFilters = Boolean(query) || [owner, level, kind, state].some((value) => value !== ALL);
  const activeFacetCount = [owner, level, kind, state].filter((value) => value !== ALL).length;

  const valueColumns = useMemo<GridColDef<SystemCodeValue>[]>(
    () => [
      {
        field: 'code',
        headerName: t('codeContracts.columns.code'),
        minWidth: 180,
        flex: 0.8,
        renderCell: ({ row }) => (
          <Typography variant="body2" fontWeight={700} noWrap>
            {row.code}
          </Typography>
        ),
      },
      {
        field: 'label',
        headerName: t('codeContracts.columns.label'),
        minWidth: 220,
        flex: 1,
      },
      {
        field: 'predefined',
        headerName: t('codeContracts.columns.origin'),
        width: 118,
        renderCell: ({ row }) => (
          <Chip
            label={t(
              row.predefined
                ? 'codeContracts.origins.predefined'
                : 'codeContracts.origins.extension'
            )}
            size="small"
            variant="outlined"
          />
        ),
      },
      {
        field: 'sortOrder',
        headerName: t('codeContracts.columns.order'),
        width: 84,
        type: 'number',
      },
    ],
    [t]
  );

  if (catalogQuery.isLoading) return <ProviderLoading />;
  if (catalogQuery.isError) return <ProviderError error={catalogQuery.error} />;

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['provider', 'system-code-catalog'] }),
      queryClient.invalidateQueries({ queryKey: ['provider', 'system-code-set'] }),
    ]);
  };

  const resetFilters = () => {
    setQuery('');
    setOwner(ALL);
    setLevel(ALL);
    setKind(ALL);
    setState(ALL);
  };

  const selectCodeSet = (codeSetKey: string, revealDetail = false) => {
    setSelectedKey(codeSetKey);
    setDetailTab('overview');
    if (revealDetail && !desktop) {
      window.requestAnimationFrame(() => {
        detailSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  };

  const moveListPage = (nextPage: number) => {
    const boundedPage = Math.max(0, Math.min(nextPage, listPageCount - 1));
    setListPage(boundedPage);
    const firstItem = filteredSets[boundedPage * LIST_PAGE_SIZE];
    if (firstItem) selectCodeSet(firstItem.codeSetKey);
  };

  const renderFacetFilters = (idSuffix: 'desktop' | 'mobile', stacked = false) => (
    <Stack direction={stacked ? 'column' : 'row'} gap={1} sx={{ flex: 1 }}>
      <FormControl
        size="small"
        fullWidth={stacked}
        sx={stacked ? undefined : { minWidth: 190, flex: 1 }}
      >
        <InputLabel id={`code-contract-owner-${idSuffix}-label`}>
          {t('codeContracts.filters.owner')}
        </InputLabel>
        <Select
          labelId={`code-contract-owner-${idSuffix}-label`}
          value={owner}
          label={t('codeContracts.filters.owner')}
          onChange={(event) => setOwner(event.target.value)}
        >
          <MenuItem value={ALL}>{t('codeContracts.filters.allOwners')}</MenuItem>
          {owners.map((value) => (
            <MenuItem key={value} value={value}>
              {value}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl
        size="small"
        fullWidth={stacked}
        sx={stacked ? undefined : { minWidth: 155, flex: 1 }}
      >
        <InputLabel id={`code-contract-level-${idSuffix}-label`}>
          {t('codeContracts.filters.level')}
        </InputLabel>
        <Select
          labelId={`code-contract-level-${idSuffix}-label`}
          value={level}
          label={t('codeContracts.filters.level')}
          onChange={(event) => setLevel(event.target.value)}
        >
          <MenuItem value={ALL}>{t('codeContracts.filters.allLevels')}</MenuItem>
          {(['SYSTEM', 'EXTENSIBLE', 'USER'] as const).map((value) => (
            <MenuItem key={value} value={value}>
              {t(`codeContracts.levels.${value}`)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl
        size="small"
        fullWidth={stacked}
        sx={stacked ? undefined : { minWidth: 155, flex: 1 }}
      >
        <InputLabel id={`code-contract-kind-${idSuffix}-label`}>
          {t('codeContracts.filters.kind')}
        </InputLabel>
        <Select
          labelId={`code-contract-kind-${idSuffix}-label`}
          value={kind}
          label={t('codeContracts.filters.kind')}
          onChange={(event) => setKind(event.target.value)}
        >
          <MenuItem value={ALL}>{t('codeContracts.filters.allKinds')}</MenuItem>
          {kinds.map((value) => (
            <MenuItem key={value} value={value}>
              {t(`codeContracts.kinds.${value as SystemCodeContractKind}`)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl
        size="small"
        fullWidth={stacked}
        sx={stacked ? undefined : { minWidth: 145, flex: 1 }}
      >
        <InputLabel id={`code-contract-state-${idSuffix}-label`}>
          {t('codeContracts.filters.state')}
        </InputLabel>
        <Select
          labelId={`code-contract-state-${idSuffix}-label`}
          value={state}
          label={t('codeContracts.filters.state')}
          onChange={(event) => setState(event.target.value)}
        >
          <MenuItem value={ALL}>{t('codeContracts.filters.allStates')}</MenuItem>
          <MenuItem value="REGISTERED">{t('codeContracts.states.REGISTERED')}</MenuItem>
          <MenuItem value="INCOMPLETE">{t('codeContracts.states.INCOMPLETE')}</MenuItem>
        </Select>
      </FormControl>
    </Stack>
  );

  return (
    <Box sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
      <Box
        component="section"
        aria-label={t('codeContracts.scope.label')}
        sx={{
          px: { xs: 2, md: 2.5 },
          py: { xs: 1.75, md: 1.5 },
          bgcolor: 'action.hover',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'flex-start', md: 'center' }}
          justifyContent="space-between"
          gap={1.5}
        >
          <Stack direction="row" alignItems="flex-start" gap={1.25} sx={{ minWidth: 0 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                flex: '0 0 36px',
                display: 'grid',
                placeItems: 'center',
                color: 'primary.main',
                bgcolor: 'action.selected',
                borderRadius: 1,
              }}
            >
              <LockKeyhole size={18} strokeWidth={1.8} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography component="h2" variant="subtitle1">
                {t('codeContracts.scope.title')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                {t('codeContracts.scope.description')}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" flexWrap="wrap" gap={0.75}>
            <Chip label={t('codeContracts.scope.global')} color="primary" size="small" />
            <Chip label={t('codeContracts.scope.readOnly')} variant="outlined" size="small" />
            <Chip label={t('codeContracts.scope.releaseManaged')} variant="outlined" size="small" />
          </Stack>
        </Stack>
      </Box>

      <Box
        component="section"
        aria-label={t('codeContracts.summary.label')}
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, 1fr)' },
          '& > *': { borderRight: 1, borderBottom: 1, borderColor: 'divider' },
          '& > *:nth-of-type(2n)': { borderRight: { xs: 0, md: 1 } },
          '& > *:nth-of-type(n+3)': { borderBottom: { xs: 0, md: 1 } },
          '& > *:last-of-type': { borderRight: 0 },
        }}
      >
        <Metric
          label={t('codeContracts.summary.registered')}
          value={formatNumber(summary.registered, undefined, locale)}
        />
        <Metric
          label={t('codeContracts.summary.incomplete')}
          value={formatNumber(summary.incomplete, undefined, locale)}
        />
        <Metric
          label={t('codeContracts.summary.values')}
          value={formatNumber(summary.values, undefined, locale)}
        />
        <Box sx={{ minWidth: 0, px: { xs: 1.75, md: 2.5 }, py: 1.25 }}>
          <Typography variant="caption" color="text.secondary">
            {t('codeContracts.summary.coverage')}
          </Typography>
          <Stack direction="row" alignItems="baseline" gap={1} sx={{ mt: 0.25 }}>
            <Typography variant="h5">{summary.coverage}%</Typography>
            <LinearProgress
              variant="determinate"
              value={summary.coverage}
              sx={{ flex: 1, minWidth: 56, height: 5, borderRadius: 1 }}
            />
          </Stack>
        </Box>
      </Box>

      <Box sx={{ p: { xs: 1.5, md: 2 }, borderBottom: 1, borderColor: 'divider' }}>
        {desktop ? (
          <Stack direction={{ md: 'column', lg: 'row' }} gap={1.25} alignItems="stretch">
            <FormField
              size="small"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('codeContracts.filters.searchPlaceholder')}
              inputProps={{ 'aria-label': t('codeContracts.filters.searchLabel') }}
              sx={{ width: { md: 1, lg: 320 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={17} strokeWidth={1.8} />
                  </InputAdornment>
                ),
              }}
            />
            {renderFacetFilters('desktop')}
          </Stack>
        ) : (
          <>
            <Stack direction="row" gap={1} alignItems="stretch">
              <FormField
                size="small"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('codeContracts.filters.searchPlaceholder')}
                inputProps={{ 'aria-label': t('codeContracts.filters.searchLabel') }}
                sx={{ flex: 1, minWidth: 0 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={17} strokeWidth={1.8} />
                    </InputAdornment>
                  ),
                }}
              />
              <ActionButton
                intent="secondary"
                size="small"
                startIcon={<SlidersHorizontal size={16} strokeWidth={1.8} />}
                aria-expanded={mobileFiltersOpen}
                aria-controls="code-contract-mobile-filters"
                onClick={() => setMobileFiltersOpen((open) => !open)}
                sx={{ flexShrink: 0 }}
              >
                {activeFacetCount
                  ? t('codeContracts.filters.toggleActive', { count: activeFacetCount })
                  : t('codeContracts.filters.toggle')}
              </ActionButton>
            </Stack>
            <Collapse in={mobileFiltersOpen}>
              <Box id="code-contract-mobile-filters" sx={{ pt: 1.25 }}>
                {renderFacetFilters('mobile', true)}
              </Box>
            </Collapse>
          </>
        )}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={1}
          sx={{ mt: 1.25 }}
        >
          <Typography variant="caption" color="text.secondary">
            {t('codeContracts.resultCount', {
              filtered: filteredSets.length,
              total: codeSets.length,
            })}
          </Typography>
          <Stack direction="row" alignItems="center" gap={0.5}>
            {hasFilters && (
              <ActionButton
                intent="quiet"
                size="small"
                startIcon={<FilterX size={16} strokeWidth={1.8} />}
                onClick={resetFilters}
              >
                {t('codeContracts.filters.reset')}
              </ActionButton>
            )}
            <ActionIconButton
              size="small"
              label={t('codeContracts.refresh')}
              tooltip={t('actions.refresh')}
              onClick={() => void refresh()}
            >
              <RefreshCw size={17} strokeWidth={1.8} />
            </ActionIconButton>
          </Stack>
        </Stack>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '360px minmax(0, 1fr)' },
          minHeight: { xs: 560, md: 500 },
          height: { md: 'clamp(500px, calc(100dvh - 360px), 720px)' },
        }}
      >
        <Box
          component="nav"
          aria-label={t('codeContracts.listLabel')}
          sx={{
            maxHeight: { xs: 340, md: 'none' },
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRight: { md: 1 },
            borderBottom: { xs: 1, md: 0 },
            borderColor: 'divider',
          }}
        >
          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {filteredSets.length ? (
              visibleSets.map((item: SystemCodeSetHealth) => (
                <ListItemButton
                  key={item.codeSetKey}
                  selected={item.codeSetKey === selectedKey}
                  aria-current={item.codeSetKey === selectedKey ? 'true' : undefined}
                  onClick={() => selectCodeSet(item.codeSetKey, true)}
                  sx={{
                    minHeight: 86,
                    px: 2,
                    py: 1.25,
                    alignItems: 'flex-start',
                    borderBottom: 1,
                    borderColor: 'divider',
                  }}
                >
                  <Box sx={{ minWidth: 0, width: 1 }}>
                    <Stack
                      direction="row"
                      alignItems="flex-start"
                      justifyContent="space-between"
                      gap={1}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2" noWrap title={item.displayName}>
                          {item.displayName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap display="block">
                          {item.codeSetKey}
                        </Typography>
                      </Box>
                      {item.registrationState === 'REGISTERED' ? (
                        <CheckCircle2
                          size={16}
                          color={theme.palette.success.main}
                          aria-label={t('codeContracts.states.REGISTERED')}
                        />
                      ) : (
                        <CircleAlert
                          size={16}
                          color={theme.palette.warning.main}
                          aria-label={t('codeContracts.states.INCOMPLETE')}
                        />
                      )}
                    </Stack>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      noWrap
                      display="block"
                      sx={{ mt: 0.5 }}
                    >
                      {item.ownerService} ·{' '}
                      {t('codeContracts.listSummary', {
                        values: item.valueCount,
                        consumers: item.bindingCount,
                      })}
                    </Typography>
                  </Box>
                </ListItemButton>
              ))
            ) : (
              <Box sx={{ py: 8, px: 2, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {t('codeContracts.empty')}
                </Typography>
              </Box>
            )}
          </Box>
          {filteredSets.length > LIST_PAGE_SIZE && (
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ minHeight: 48, px: 1.5, borderTop: 1, borderColor: 'divider' }}
            >
              <Typography variant="caption" color="text.secondary" aria-live="polite">
                {t('codeContracts.pageStatus', {
                  from: listPage * LIST_PAGE_SIZE + 1,
                  to: Math.min((listPage + 1) * LIST_PAGE_SIZE, filteredSets.length),
                  total: filteredSets.length,
                })}
              </Typography>
              <Stack direction="row" gap={0.25}>
                <ActionIconButton
                  size="small"
                  label={t('codeContracts.previousPage')}
                  tooltip={t('codeContracts.previousPage')}
                  disabled={listPage === 0}
                  onClick={() => moveListPage(listPage - 1)}
                >
                  <ChevronLeft size={17} strokeWidth={1.8} />
                </ActionIconButton>
                <ActionIconButton
                  size="small"
                  label={t('codeContracts.nextPage')}
                  tooltip={t('codeContracts.nextPage')}
                  disabled={listPage >= listPageCount - 1}
                  onClick={() => moveListPage(listPage + 1)}
                >
                  <ChevronRight size={17} strokeWidth={1.8} />
                </ActionIconButton>
              </Stack>
            </Stack>
          )}
        </Box>

        <Box
          ref={detailSectionRef}
          component="section"
          aria-label={t('codeContracts.detailLabel')}
          sx={{ minWidth: 0, overflowY: { md: 'auto' } }}
        >
          {detailQuery.isLoading ? (
            <ProviderLoading />
          ) : detailQuery.isError ? (
            <Box sx={{ p: 2 }}>
              <ProviderError error={detailQuery.error} />
            </Box>
          ) : detail && selectedHealth ? (
            <>
              <Box sx={{ px: { xs: 2, md: 2.5 }, py: 2 }}>
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
                        label={t(`codeContracts.levels.${detail.configurationLevel}`)}
                        color={levelColor[detail.configurationLevel]}
                        size="small"
                        variant="outlined"
                      />
                      <Chip
                        label={t(`codeContracts.kinds.${detail.contractKind}`)}
                        color={kindColor[detail.contractKind]}
                        size="small"
                        variant="outlined"
                      />
                    </Stack>
                    <Typography variant="body2" fontWeight={700} sx={{ mt: 0.5 }}>
                      {detail.codeSetKey}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                      {detail.description}
                    </Typography>
                  </Box>
                  <Stack direction="row" alignItems="center" gap={0.75}>
                    <Chip
                      label={t(`codeContracts.states.${selectedHealth.registrationState}`)}
                      color={
                        selectedHealth.registrationState === 'REGISTERED' ? 'success' : 'warning'
                      }
                      size="small"
                    />
                    <Chip label={`v${detail.schemaVersion}`} size="small" variant="outlined" />
                  </Stack>
                </Stack>
              </Box>
              <Tabs
                value={detailTab}
                onChange={(_, value: DetailTab) => setDetailTab(value)}
                aria-label={t('codeContracts.tabs.label')}
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                  px: { xs: 1, md: 1.5 },
                  borderTop: 1,
                  borderBottom: 1,
                  borderColor: 'divider',
                }}
              >
                <Tab value="overview" label={t('codeContracts.tabs.overview')} />
                <Tab
                  value="values"
                  label={t('codeContracts.tabs.values', { count: detail.values.length })}
                />
                <Tab
                  value="consumers"
                  label={t('codeContracts.tabs.consumers', { count: detail.bindings.length })}
                />
              </Tabs>

              {detailTab === 'overview' && (
                <Box sx={{ px: { xs: 2, md: 2.5 }, py: 2.25 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 1.25,
                      py: 1.5,
                      px: 1.75,
                      bgcolor: alpha(
                        selectedHealth.registrationState === 'REGISTERED'
                          ? theme.palette.success.main
                          : theme.palette.warning.main,
                        0.08
                      ),
                      borderLeft: 3,
                      borderColor:
                        selectedHealth.registrationState === 'REGISTERED'
                          ? 'success.main'
                          : 'warning.main',
                    }}
                  >
                    {selectedHealth.registrationState === 'REGISTERED' ? (
                      <CheckCircle2 size={19} color={theme.palette.success.main} />
                    ) : (
                      <CircleAlert size={19} color={theme.palette.warning.main} />
                    )}
                    <Box>
                      <Typography variant="subtitle2">
                        {t(
                          selectedHealth.registrationState === 'REGISTERED'
                            ? 'codeContracts.health.registeredTitle'
                            : 'codeContracts.health.incompleteTitle'
                        )}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                        {t(
                          selectedHealth.registrationState === 'REGISTERED'
                            ? 'codeContracts.health.registeredDescription'
                            : 'codeContracts.health.incompleteDescription',
                          {
                            enforced: selectedHealth.enforcedBindingCount,
                            bindings: selectedHealth.bindingCount,
                          }
                        )}
                      </Typography>
                    </Box>
                  </Box>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: '1fr',
                        sm: 'repeat(2, minmax(0, 1fr))',
                      },
                      gap: 2.25,
                      mt: 2.5,
                    }}
                  >
                    <Metadata
                      label={t('codeContracts.metadata.owner')}
                      value={detail.ownerService}
                    />
                    <Metadata
                      label={t('codeContracts.metadata.validation')}
                      value={detail.validationSource}
                    />
                    <Metadata
                      label={t('codeContracts.metadata.source')}
                      value={detail.sourceReference}
                    />
                    <Metadata
                      label={t('codeContracts.metadata.visibility')}
                      value={t(`codeContracts.visibility.${detail.runtimeVisibility}`)}
                    />
                    <Metadata
                      label={t('codeContracts.metadata.changePolicy')}
                      value={t('codeContracts.scope.releaseManaged')}
                    />
                    <Metadata
                      label={t('codeContracts.metadata.enforcement')}
                      value={t('codeContracts.enforcementSummary', {
                        enforced: selectedHealth.enforcedBindingCount,
                        bindings: selectedHealth.bindingCount,
                      })}
                    />
                  </Box>
                </Box>
              )}

              {detailTab === 'values' && (
                <Box sx={{ py: 1.5 }}>
                  <Box sx={{ px: { xs: 2, md: 2.5 }, pb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t('codeContracts.valuesHelp')}
                    </Typography>
                  </Box>
                  {desktop ? (
                    <EnterpriseDataGrid
                      ariaLabel={t('codeContracts.valuesLabel')}
                      rows={detail.values}
                      columns={valueColumns}
                      getRowId={(row) => row.code}
                      hideFooter={detail.values.length <= 25}
                      maxVisibleRows={9}
                      initialState={{ pagination: { paginationModel: { page: 0, pageSize: 25 } } }}
                      sx={{ border: 0, borderRadius: 0 }}
                    />
                  ) : (
                    <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
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
                                  ? 'codeContracts.origins.predefined'
                                  : 'codeContracts.origins.extension'
                              )}
                              size="small"
                              variant="outlined"
                            />
                          </Stack>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              )}

              {detailTab === 'consumers' && (
                <Box sx={{ py: 1.5 }}>
                  <Box sx={{ px: { xs: 2, md: 2.5 }, pb: 1.5 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t('codeContracts.consumersHelp')}
                    </Typography>
                  </Box>
                  <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
                    {detail.bindings.map((binding) => (
                      <Box
                        component="li"
                        key={`${binding.consumerService}:${binding.usageType}:${binding.sourceReference}`}
                        sx={{
                          px: { xs: 2, md: 2.5 },
                          py: 1.5,
                          display: 'grid',
                          gridTemplateColumns: {
                            xs: '1fr',
                            sm: '0.65fr 0.8fr minmax(0, 1.5fr)',
                          },
                          gap: 1,
                          borderTop: 1,
                          borderColor: 'divider',
                        }}
                      >
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            {t('codeContracts.consumerFields.service')}
                          </Typography>
                          <Typography
                            variant="body2"
                            fontWeight={700}
                            sx={{ overflowWrap: 'anywhere' }}
                          >
                            {binding.consumerService}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            {t('codeContracts.consumerFields.enforcement')}
                          </Typography>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ overflowWrap: 'anywhere' }}
                          >
                            {binding.usageType} / {binding.enforcementType}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            {t('codeContracts.consumerFields.source')}
                          </Typography>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ overflowWrap: 'anywhere' }}
                          >
                            {binding.sourceReference}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
            </>
          ) : (
            <Box sx={{ minHeight: 320, display: 'grid', placeItems: 'center', px: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {t('codeContracts.selectSet')}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
