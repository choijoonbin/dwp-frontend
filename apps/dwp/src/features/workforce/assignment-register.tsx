import { useCallback, useDeferredValue, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PanelRightOpen, RefreshCw, Search } from 'lucide-react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  ActionButton,
  ActionIconButton,
  DatePickerField,
  DetailInspector,
  EnterpriseDataGrid,
  FormField,
  GuidedEmptyState,
  LoadingState,
  SelectField,
} from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import { getPerson, listPeople } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useSearchParams } from 'react-router-dom';

import { PersonAvatar } from '../../components/person-avatar';
import { HcmQueryState } from '../../components/hcm-query-state';
import {
  useProductSurfaceRequestScope,
  type ProductSurfaceRequestScope,
} from '../../components/use-product-surface-request-scope';
import {
  ASSIGNMENT_REGISTER_STATUSES,
  replaceAssignmentRegisterSearchParams,
  resolveAssignmentRegisterFilters,
} from './assignment-register-model';

import type { GridColDef } from '@mui/x-data-grid';
import type { PersonSummary } from '@dwp-frontend/shared-utils';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function AssignmentDetailInspector({
  personId,
  person,
  asOf,
  requestScope,
  onClose,
}: {
  personId: string | null;
  person: PersonSummary | null;
  asOf: string;
  requestScope: ProductSurfaceRequestScope;
  onClose: () => void;
}) {
  const { t } = useTranslation('workforce');
  const detail = useQuery({
    queryKey: ['workforce', 'assignments', 'detail', personId, asOf, ...requestScope.cacheKey],
    queryFn: ({ signal }) =>
      getPerson(personId!, asOf, 'workforce', requestScope.contextScopeKey, signal),
    enabled: Boolean(personId) && requestScope.ready,
    meta: requestScope.queryMeta,
  });
  const displayPerson = person ?? detail.data?.person ?? null;

  return (
    <DetailInspector
      variant="drawer"
      width={480}
      open={Boolean(personId)}
      title={displayPerson?.displayName ?? t('assignments.detail.title')}
      subtitle={displayPerson?.assignmentKey ?? undefined}
      closeLabel={t('common.actions.close')}
      onClose={onClose}
      status={
        displayPerson ? (
          <Chip
            size="small"
            variant="outlined"
            color={displayPerson.workerStatus === 'ACTIVE' ? 'success' : 'default'}
            label={t(`assignments.status.${displayPerson.workerStatus}`, {
              defaultValue: displayPerson.workerStatus ?? '-',
            })}
          />
        ) : undefined
      }
    >
      {detail.isLoading ? (
        <HcmQueryState loading size="compact" />
      ) : detail.isError ? (
        <HcmQueryState
          error={detail.error}
          retrying={detail.isFetching}
          onRetry={() => void detail.refetch()}
          size="compact"
        />
      ) : (
        <Stack gap={2} divider={<Divider flexItem />}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              gap: 1.5,
            }}
          >
            <Box>
              <Typography variant="caption" color="text.secondary">
                {t('assignments.detail.legalEmployer')}
              </Typography>
              <Typography component="p" variant="subtitle2">
                {detail.data?.legalEmployerName || '-'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                {t('assignments.detail.hireDate')}
              </Typography>
              <Typography component="p" variant="subtitle2">
                {detail.data?.originalHireDate
                  ? formatDate(detail.data.originalHireDate, { dateStyle: 'medium' })
                  : '-'}
              </Typography>
            </Box>
          </Box>

          <Stack gap={1.25}>
            <Typography component="h3" variant="subtitle2">
              {t('assignments.detail.assignments')}
            </Typography>
            {detail.data?.assignments.length ? (
              detail.data.assignments.map((assignment, index) => (
                <Box
                  key={`${assignment.assignmentKey ?? 'assignment'}-${index}`}
                  sx={{
                    p: 1.5,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 'shape.borderRadius',
                  }}
                >
                  <Stack direction="row" alignItems="flex-start" gap={1}>
                    <Box minWidth={0} flex={1}>
                      <Typography component="p" variant="subtitle2">
                        {assignment.businessTitle || assignment.jobProfileName || '-'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {[assignment.organizationName, assignment.locationName]
                          .filter(Boolean)
                          .join(' · ') || '-'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {formatDate(assignment.effectiveStartDate, { dateStyle: 'medium' })} –{' '}
                        {assignment.effectiveEndDate
                          ? formatDate(assignment.effectiveEndDate, { dateStyle: 'medium' })
                          : t(
                              assignment.effectiveStartDate > asOf
                                ? 'assignments.detail.scheduled'
                                : 'assignments.detail.current'
                            )}
                      </Typography>
                    </Box>
                    <Stack direction="row" gap={0.5} flexWrap="wrap" justifyContent="flex-end">
                      {assignment.primaryAssignment && (
                        <Chip
                          size="small"
                          color="primary"
                          label={t('assignments.detail.primary')}
                        />
                      )}
                      <Chip size="small" variant="outlined" label={assignment.assignmentStatus} />
                    </Stack>
                  </Stack>
                </Box>
              ))
            ) : (
              <Typography variant="body2" color="text.secondary">
                {t('assignments.detail.empty')}
              </Typography>
            )}
          </Stack>
        </Stack>
      )}
    </DetailInspector>
  );
}

export function AssignmentRegister() {
  const { t } = useTranslation('workforce');
  const currentDate = today();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = resolveAssignmentRegisterFilters(searchParams, currentDate);
  const updateParams = useCallback(
    (values: Readonly<Record<string, string | null | undefined>>) =>
      setSearchParams(replaceAssignmentRegisterSearchParams(searchParams, values), {
        replace: true,
      }),
    [searchParams, setSearchParams]
  );
  const normalizedQuery = filters.query.trim();
  const deferredQuery = useDeferredValue(normalizedQuery);
  const requestScope = useProductSurfaceRequestScope({
    productKey: 'hcm',
    surfaceKey: 'hcm.operations',
  });
  const canOpenDetail = requestScope.queryMeta.accessMode !== 'PROVIDER_SUPPORT';
  const people = useInfiniteQuery({
    queryKey: [
      'workforce',
      'assignments',
      filters.asOf,
      deferredQuery,
      filters.status,
      ...requestScope.cacheKey,
    ],
    queryFn: ({ pageParam, signal }) =>
      listPeople({
        asOf: filters.asOf,
        query: deferredQuery || undefined,
        status: filters.status === 'ALL' ? undefined : filters.status,
        cursor: pageParam ?? undefined,
        size: 50,
        surface: 'workforce',
        view: 'assignments',
        contextScopeKey: requestScope.contextScopeKey,
        signal,
      }),
    enabled: requestScope.ready,
    meta: requestScope.queryMeta,
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : null),
  });
  const rows = useMemo(
    () => (people.data?.pages ?? []).flatMap((page) => page.items),
    [people.data]
  );
  const selectedPerson = useMemo(
    () => rows.find((person) => person.personId === filters.personId) ?? null,
    [filters.personId, rows]
  );
  const selectPerson = useCallback(
    (person: PersonSummary) => updateParams({ person: person.personId }),
    [updateParams]
  );
  const columns = useMemo<GridColDef<PersonSummary>[]>(() => {
    const result: GridColDef<PersonSummary>[] = [
      {
        field: 'displayName',
        headerName: t('assignments.columns.person'),
        minWidth: 230,
        flex: 1,
        renderCell: ({ row }) => (
          <Stack direction="row" alignItems="center" gap={1} sx={{ minWidth: 0 }}>
            <PersonAvatar name={row.displayName} size={32} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={700} noWrap>
                {row.displayName}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" noWrap>
                {row.workerNumber}
              </Typography>
            </Box>
          </Stack>
        ),
      },
      {
        field: 'assignmentKey',
        headerName: t('assignments.columns.assignment'),
        minWidth: 200,
        flex: 0.8,
        renderCell: ({ row }) => (
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={650} noWrap>
              {row.businessTitle || row.jobProfileName || '-'}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" noWrap>
              {row.assignmentKey}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'organizationName',
        headerName: t('assignments.columns.organization'),
        minWidth: 180,
        flex: 0.75,
      },
      {
        field: 'managerDisplayName',
        headerName: t('assignments.columns.manager'),
        minWidth: 140,
        flex: 0.55,
      },
      {
        field: 'locationName',
        headerName: t('assignments.columns.location'),
        minWidth: 150,
        flex: 0.55,
      },
      {
        field: 'assignmentEffectiveFrom',
        headerName: t('assignments.columns.effectiveFrom'),
        width: 140,
      },
      {
        field: 'workerStatus',
        headerName: t('assignments.columns.status'),
        width: 116,
        renderCell: ({ row }) => (
          <Chip
            size="small"
            variant="outlined"
            color={row.workerStatus === 'ACTIVE' ? 'success' : 'default'}
            label={t(`assignments.status.${row.workerStatus}`, {
              defaultValue: row.workerStatus ?? '-',
            })}
          />
        ),
      },
    ];
    if (canOpenDetail) {
      result.unshift({
        field: 'detail',
        headerName: t('assignments.columns.detail'),
        width: 96,
        minWidth: 96,
        align: 'center',
        headerAlign: 'center',
        disableColumnMenu: true,
        resizable: false,
        renderCell: ({ row }) => (
          <ActionIconButton
            label={t('assignments.detail.openFor', { name: row.displayName })}
            onClick={() => selectPerson(row)}
          >
            <PanelRightOpen size={17} aria-hidden="true" />
          </ActionIconButton>
        ),
      });
    }
    return result.map((column) => ({ ...column, sortable: false }));
  }, [canOpenDetail, selectPerson, t]);

  const filtered = Boolean(
    normalizedQuery || filters.status !== 'ALL' || filters.asOf !== currentDate
  );
  const resetFilters = useCallback(
    () => updateParams({ q: null, status: null, asOf: null, person: null }),
    [updateParams]
  );

  if (people.isLoading) return <LoadingState label={t('assignments.loading')} size="page" />;
  if (people.isLoadingError) {
    return (
      <HcmQueryState
        error={people.error}
        retrying={people.isFetching}
        onRetry={() => void people.refetch()}
        size="standard"
      />
    );
  }

  return (
    <>
      <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'stretch', md: 'center' }}
          gap={1}
          sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
        >
          <FormField
            size="small"
            value={filters.query}
            onChange={(event) => updateParams({ q: event.target.value || null, person: null })}
            placeholder={t('assignments.search')}
            inputProps={{ 'aria-label': t('assignments.search') }}
            sx={{ width: { xs: 1, md: 280 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={16} />
                </InputAdornment>
              ),
            }}
          />
          <SelectField
            size="small"
            label={t('assignments.filters.status')}
            value={filters.status}
            onValueChange={(value) => updateParams({ status: value, person: null })}
            options={ASSIGNMENT_REGISTER_STATUSES.map((value) => ({
              value,
              label: t(`assignments.status.${value}`),
            }))}
            sx={{ width: { xs: 1, md: 150 } }}
          />
          <DatePickerField
            size="small"
            label={t('assignments.filters.asOf')}
            value={filters.asOf}
            onValueChange={(value) =>
              value && updateParams({ asOf: value === currentDate ? null : value, person: null })
            }
            sx={{ width: { xs: 1, md: 174 } }}
          />
          <Box sx={{ flex: 1 }} />
          <Chip
            size="small"
            variant="outlined"
            label={t('assignments.count', { count: rows.length })}
          />
          {people.hasNextPage && (
            <Chip
              size="small"
              color="info"
              variant="outlined"
              label={t('assignments.moreAvailable')}
            />
          )}
          <ActionIconButton
            label={t('common.actions.refresh')}
            onClick={() => void people.refetch()}
          >
            <RefreshCw size={18} />
          </ActionIconButton>
        </Stack>
        {rows.length ? (
          <EnterpriseDataGrid
            ariaLabel={t('assignments.title')}
            rows={rows}
            columns={columns}
            getRowId={(row) => row.personId}
            hideFooter
            minVisibleRows={6}
            maxVisibleRows={14}
            sx={{ border: 0, borderRadius: 0 }}
          />
        ) : (
          <GuidedEmptyState
            kind={filtered ? 'no-results' : 'empty'}
            title={filtered ? t('assignments.filteredEmptyTitle') : t('assignments.emptyTitle')}
            description={
              filtered
                ? t('assignments.filteredEmptyDescription')
                : t('assignments.emptyDescription')
            }
            actionLabel={filtered ? t('assignments.resetFilters') : undefined}
            onAction={filtered ? resetFilters : undefined}
          />
        )}
        {(people.isFetchNextPageError || people.isRefetchError) && (
          <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
            <HcmQueryState
              error={people.error}
              retrying={people.isFetching}
              onRetry={() =>
                void (people.isFetchNextPageError ? people.fetchNextPage() : people.refetch())
              }
              size="compact"
            />
          </Box>
        )}
        {people.hasNextPage && (
          <Stack alignItems="center" sx={{ p: 1.5, borderTop: 1, borderColor: 'divider' }}>
            <ActionButton
              intent="secondary"
              size="small"
              loading={people.isFetchingNextPage}
              onClick={() => void people.fetchNextPage()}
            >
              {t('assignments.loadMore')}
            </ActionButton>
          </Stack>
        )}
      </Box>
      <AssignmentDetailInspector
        personId={canOpenDetail ? filters.personId : null}
        person={canOpenDetail ? selectedPerson : null}
        asOf={filters.asOf}
        requestScope={requestScope}
        onClose={() => updateParams({ person: null })}
      />
    </>
  );
}
