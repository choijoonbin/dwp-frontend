import { useCallback, useDeferredValue, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, RefreshCw, Search, ShieldCheck, UserRound } from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  EnterpriseDataGrid,
  FormField,
  GuidedEmptyState,
  InlineFeedback,
  LoadingState,
  LocalErrorState,
} from '@dwp-frontend/design-system';
import { readRegionalPreference } from '@dwp-frontend/shared-utils';
import { resolveSystemTimeZone } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useSearchParams } from 'react-router-dom';

import { HcmQueryState } from '../../../../components/hcm-query-state';
import { useProductSurfaceRequestScope } from '../../../../components/use-product-surface-request-scope';
import { PersonAvatar } from '../../../../components/person-avatar';
import { People360Detail } from '../components/people-360-detail';
import { People360FilterSheet } from '../components/people-360-filter-sheet';
import { People360MobileList, people360StatusColor } from '../components/people-360-mobile-list';
import { usePeople360Detail, usePeople360List } from '../hooks/use-people-360';
import { getPeople360Copy } from '../model/people-360-copy';
import {
  people360Today,
  replacePeople360SearchParams,
  resolvePeople360Filters,
} from '../model/people-360-model';
import { people360Decision } from '../model/people-360-view-model';

import type { GridColDef } from '@mui/x-data-grid';
import type {
  People360DataSource,
  People360Person,
  People360RequestScope,
} from '../model/people-360-view-model';

function effectiveTimeZone() {
  const preference = readRegionalPreference().timeZone;
  return preference === 'system' ? resolveSystemTimeZone('UTC') : preference;
}

function People360BoundaryNotice() {
  const { i18n } = useTranslation();
  const copy = getPeople360Copy(i18n.resolvedLanguage, i18n.language);
  return (
    <Paper component="aside" variant="outlined" role="note" sx={{ p: 1.5, minWidth: 0 }}>
      <Stack direction="row" alignItems="flex-start" gap={1} minWidth={0}>
        <ShieldCheck size={18} aria-hidden="true" />
        <Box minWidth={0}>
          <Typography component="h2" variant="subtitle2">
            {copy.accessBoundary}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {copy.accessDescription}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

function displayName(row: People360Person, fallback: string) {
  return people360Decision(row, 'person.displayName') === 'OMIT'
    ? fallback
    : row.person.displayName || fallback;
}

function usePeople360Columns(onSelect: (personId: string) => void): GridColDef<People360Person>[] {
  const { i18n } = useTranslation();
  const copy = getPeople360Copy(i18n.resolvedLanguage, i18n.language);
  return useMemo(
    () => [
      {
        field: 'person',
        headerName: copy.personSection,
        minWidth: 220,
        flex: 1,
        renderCell: ({ row }) => {
          const name = displayName(row, copy.undisclosedPerson);
          return (
            <Stack direction="row" alignItems="center" gap={1} minWidth={0}>
              <PersonAvatar name={name} size={32} />
              <Box minWidth={0}>
                <Typography component="span" variant="subtitle2" display="block" noWrap>
                  {name}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" noWrap>
                  {row.access.scope}
                </Typography>
              </Box>
            </Stack>
          );
        },
      },
      {
        field: 'employment',
        headerName: copy.employmentSection,
        minWidth: 170,
        flex: 0.72,
        renderCell: ({ row }) => {
          const status = row.employment?.workerStatus;
          return people360Decision(row, 'employment.workerStatus') === 'OMIT' ? (
            <Typography variant="body2" color="text.secondary">
              {copy.notAvailable}
            </Typography>
          ) : (
            <Chip
              size="small"
              variant="outlined"
              color={people360StatusColor(status)}
              label={status || copy.notAvailable}
            />
          );
        },
      },
      {
        field: 'assignment',
        headerName: copy.assignmentSection,
        minWidth: 220,
        flex: 0.9,
        renderCell: ({ row }) => (
          <Box minWidth={0}>
            <Typography variant="body2" display="block" noWrap>
              {row.primaryAssignment?.businessTitle ||
                row.primaryAssignment?.jobProfileName ||
                copy.notAvailable}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" noWrap>
              {row.primaryAssignment?.organizationName || copy.notAvailable}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'asOf',
        headerName: copy.asOf,
        width: 126,
        valueGetter: (_value, row) => row.asOf,
      },
      {
        field: 'state',
        headerName: copy.fieldPolicy,
        width: 112,
        renderCell: ({ row }) => (
          <Chip
            size="small"
            variant="outlined"
            color={row.state === 'PARTIAL' ? 'warning' : 'success'}
            label={row.state}
          />
        ),
      },
      {
        field: 'openDetail',
        headerName: copy.detailTitle,
        width: 74,
        sortable: false,
        filterable: false,
        renderCell: ({ row }) => {
          const label = copy.openPerson(displayName(row, copy.undisclosedPerson));
          return (
            <ActionIconButton
              label={label}
              tooltip={label}
              onClick={() => onSelect(row.person.personId)}
            >
              <ArrowRight size={16} aria-hidden="true" />
            </ActionIconButton>
          );
        },
      },
    ],
    [copy, onSelect]
  );
}

function People360ListState({
  rows,
  filtered,
  loading,
  error,
  retrying,
  onRetry,
  onReset,
  children,
}: {
  rows: readonly People360Person[];
  filtered: boolean;
  loading: boolean;
  error?: unknown;
  retrying: boolean;
  onRetry: () => void;
  onReset: () => void;
  children: React.ReactNode;
}) {
  const { i18n } = useTranslation();
  const copy = getPeople360Copy(i18n.resolvedLanguage, i18n.language);
  if (loading) return <LoadingState label={copy.loading} size="page" embedded />;
  if (error) {
    return <HcmQueryState error={error} retrying={retrying} onRetry={onRetry} size="page" />;
  }
  if (rows.length === 0) {
    return (
      <GuidedEmptyState
        kind={filtered ? 'no-results' : 'empty'}
        title={filtered ? copy.filteredEmptyTitle : copy.emptyTitle}
        description={filtered ? copy.filteredEmptyDescription : copy.emptyDescription}
        actionLabel={filtered ? copy.resetFilters : undefined}
        onAction={filtered ? onReset : undefined}
      />
    );
  }
  return children;
}

export function People360Runtime({
  requestScope,
  dataSource,
  now,
}: {
  requestScope: People360RequestScope;
  dataSource?: People360DataSource;
  now?: string;
}) {
  const { i18n } = useTranslation();
  const copy = getPeople360Copy(i18n.resolvedLanguage, i18n.language);
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const [searchParams, setSearchParams] = useSearchParams();
  const currentDate = people360Today(effectiveTimeZone(), now);
  const filters = resolvePeople360Filters(searchParams, currentDate);
  const deferredQuery = useDeferredValue(filters.query);
  const updateParams = useCallback(
    (values: Readonly<Record<string, string | null | undefined>>) =>
      setSearchParams(replacePeople360SearchParams(searchParams, values), { replace: true }),
    [searchParams, setSearchParams]
  );
  const selectPerson = useCallback(
    (personId: string) => updateParams({ person: personId }),
    [updateParams]
  );
  const columns = usePeople360Columns(selectPerson);
  const { people, loadedRows, accessInvalidated, refreshError } = usePeople360List({
    filters,
    deferredQuery,
    requestScope,
    dataSource,
  });
  const detail = usePeople360Detail({
    personId: filters.personId,
    asOf: filters.asOf,
    requestScope,
    dataSource,
  });
  const filtered = Boolean(
    filters.query || filters.status !== 'ALL' || filters.asOf !== currentDate
  );
  const partialCount = loadedRows.filter((row) => row.state === 'PARTIAL').length;
  const reset = useCallback(
    () => updateParams({ asOf: null, person: null, q: null, status: null }),
    [updateParams]
  );

  if (!requestScope.ready) return <HcmQueryState loading size="page" />;
  if (accessInvalidated) {
    return (
      <HcmQueryState
        error={people.error}
        retrying={people.isFetching}
        onRetry={() => void people.refetch()}
        size="page"
      />
    );
  }

  return (
    <Stack gap={1.5} data-slice="BASE-TFR-HRM-004" minWidth={0}>
      <Paper component="header" variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, minWidth: 0 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ sm: 'center' }}
          gap={1.25}
          minWidth={0}
        >
          <UserRound size={22} aria-hidden="true" />
          <Box minWidth={0} flex={1}>
            <Typography variant="overline" color="text.secondary">
              {copy.eyebrow}
            </Typography>
            <Typography component="h2" variant="h5" sx={{ overflowWrap: 'anywhere' }}>
              {copy.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {copy.description}
            </Typography>
          </Box>
          <Stack direction="row" gap={0.75} flexWrap="wrap" useFlexGap>
            <Chip size="small" variant="outlined" label={filters.asOf} />
            <Chip size="small" variant="outlined" label={copy.resultCount(loadedRows.length)} />
            {people.hasNextPage && (
              <Chip size="small" color="info" variant="outlined" label={copy.moreAvailable} />
            )}
          </Stack>
        </Stack>
      </Paper>

      <People360BoundaryNotice />

      {refreshError && (
        <InlineFeedback
          severity="warning"
          title={copy.staleTitle}
          action={
            <ActionButton
              intent="quiet"
              size="small"
              loading={people.isFetching}
              startIcon={<RefreshCw size={14} aria-hidden="true" />}
              onClick={() => void people.refetch()}
            >
              {copy.retry}
            </ActionButton>
          }
        >
          {copy.staleDescription}
        </InlineFeedback>
      )}

      {partialCount > 0 && (
        <InlineFeedback severity="warning" title={copy.partialTitle}>
          {copy.partialDescription}
        </InlineFeedback>
      )}

      <Paper variant="outlined" sx={{ overflow: 'hidden', minWidth: 0 }}>
        <Stack gap={1} sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider', minWidth: 0 }}>
          <Stack
            direction={{ xs: 'column', lg: 'row' }}
            alignItems={{ lg: 'center' }}
            gap={1}
            minWidth={0}
          >
            <FormField
              size="small"
              label={copy.searchLabel}
              value={filters.query}
              onChange={(event) => updateParams({ q: event.target.value || null, person: null })}
              placeholder={copy.searchPlaceholder}
              inputProps={{
                'aria-label': copy.searchLabel,
                'data-testid': 'hris-people360-search',
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={16} aria-hidden="true" />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 0, width: { xs: 1, lg: 320 } }}
            />
            <People360FilterSheet
              asOf={filters.asOf}
              status={filters.status}
              activeCount={Number(filters.status !== 'ALL') + Number(filters.asOf !== currentDate)}
              onAsOfChange={(value) =>
                updateParams({ asOf: value && value !== currentDate ? value : null, person: null })
              }
              onStatusChange={(value) => updateParams({ status: value, person: null })}
              onReset={reset}
            />
            <Box flex={1} />
            <ActionButton
              intent="quiet"
              size="small"
              loading={people.isFetching && !people.isFetchingNextPage}
              startIcon={<RefreshCw size={16} aria-hidden="true" />}
              onClick={() => void people.refetch()}
            >
              {copy.refresh}
            </ActionButton>
          </Stack>
        </Stack>

        <People360ListState
          rows={loadedRows}
          filtered={filtered}
          loading={people.isLoading}
          error={people.isError && !people.data ? people.error : undefined}
          retrying={people.isFetching}
          onRetry={() => void people.refetch()}
          onReset={reset}
        >
          {desktop ? (
            <EnterpriseDataGrid
              ariaLabel={copy.title}
              rows={loadedRows}
              columns={columns}
              getRowId={(row) => row.person.personId}
              hideFooter
              minVisibleRows={5}
              maxVisibleRows={12}
              stickyColumns={{ left: ['person'], right: ['openDetail'] }}
              onRowClick={({ row }) => selectPerson(row.person.personId)}
              toolbar={{
                ariaLabel: copy.title,
                showColumns: false,
                showFilters: false,
                showQuickFilter: false,
                refreshLabel: copy.refresh,
                refreshing: people.isFetching,
                onRefresh: () => void people.refetch(),
              }}
              sx={{ border: 0, borderRadius: 0, '& .MuiDataGrid-row': { cursor: 'pointer' } }}
            />
          ) : (
            <People360MobileList rows={loadedRows} onSelect={selectPerson} />
          )}
        </People360ListState>

        {(people.isFetchNextPageError || people.isRefetchError) && people.data && !refreshError && (
          <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
            <LocalErrorState
              size="compact"
              title={copy.partialListTitle}
              description={copy.partialListDescription}
              retryLabel={copy.retry}
              retrying={people.isFetching}
              onRetry={() =>
                void (people.isFetchNextPageError ? people.fetchNextPage() : people.refetch())
              }
            />
          </Box>
        )}
        {people.hasNextPage && (
          <Stack alignItems="center" sx={{ p: 1.5, borderTop: 1, borderColor: 'divider' }}>
            <ActionButton
              intent="secondary"
              loading={people.isFetchingNextPage}
              onClick={() => void people.fetchNextPage()}
            >
              {copy.loadMore}
            </ActionButton>
          </Stack>
        )}
      </Paper>

      <People360Detail
        personId={filters.personId}
        detail={detail}
        onClose={() => updateParams({ person: null })}
      />
    </Stack>
  );
}

export function HrisPeople360Workspace() {
  const requestScope = useProductSurfaceRequestScope({
    productKey: 'hcm',
    surfaceKey: 'hcm.operations',
  });
  return <People360Runtime requestScope={requestScope} />;
}
