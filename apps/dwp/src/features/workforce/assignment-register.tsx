import { useDeferredValue, useMemo, useState } from 'react';
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

import { PersonAvatar } from '../../components/person-avatar';
import { HcmQueryState } from '../../components/hcm-query-state';
import {
  useProductSurfaceRequestScope,
  type ProductSurfaceRequestScope,
} from '../../components/use-product-surface-request-scope';

import type { GridColDef } from '@mui/x-data-grid';
import type { PersonSummary } from '@dwp-frontend/shared-utils';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function AssignmentDetailInspector({
  person,
  asOf,
  requestScope,
  onClose,
}: {
  person: PersonSummary | null;
  asOf: string;
  requestScope: ProductSurfaceRequestScope;
  onClose: () => void;
}) {
  const { t } = useTranslation('workforce');
  const detail = useQuery({
    queryKey: [
      'workforce',
      'assignments',
      'detail',
      person?.personId,
      asOf,
      ...requestScope.cacheKey,
    ],
    queryFn: ({ signal }) =>
      getPerson(person!.personId, asOf, 'workforce', requestScope.contextScopeKey, signal),
    enabled: Boolean(person) && requestScope.ready,
    meta: requestScope.queryMeta,
  });

  return (
    <DetailInspector
      open={Boolean(person)}
      variant="drawer"
      width={480}
      title={person?.displayName ?? t('assignments.detail.title')}
      subtitle={person?.assignmentKey ?? undefined}
      closeLabel={t('common.actions.close')}
      onClose={onClose}
      status={
        person ? (
          <Chip
            size="small"
            variant="outlined"
            color={person.workerStatus === 'ACTIVE' ? 'success' : 'default'}
            label={t(`assignments.status.${person.workerStatus}`, {
              defaultValue: person.workerStatus ?? '-',
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
  const [asOf, setAsOf] = useState(today);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [selectedPerson, setSelectedPerson] = useState<PersonSummary | null>(null);
  const deferredQuery = useDeferredValue(query.trim());
  const requestScope = useProductSurfaceRequestScope({
    productKey: 'hcm',
    surfaceKey: 'hcm.operations',
  });
  const canOpenDetail = requestScope.queryMeta.accessMode !== 'PROVIDER_SUPPORT';
  const people = useInfiniteQuery({
    queryKey: ['workforce', 'assignments', asOf, deferredQuery, status, ...requestScope.cacheKey],
    queryFn: ({ pageParam, signal }) =>
      listPeople({
        asOf,
        query: deferredQuery || undefined,
        status: status === 'ALL' ? undefined : status,
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
            onClick={() => setSelectedPerson(row)}
          >
            <PanelRightOpen size={17} aria-hidden="true" />
          </ActionIconButton>
        ),
      });
    }
    return result.map((column) => ({ ...column, sortable: false }));
  }, [canOpenDetail, t]);

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
            value={query}
            onChange={(event) => setQuery(event.target.value)}
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
            value={status}
            onValueChange={(value) => setStatus(value)}
            options={['ALL', 'ACTIVE', 'LEAVE', 'PENDING', 'TERMINATED'].map((value) => ({
              value,
              label: t(`assignments.status.${value}`),
            }))}
            sx={{ width: { xs: 1, md: 150 } }}
          />
          <DatePickerField
            size="small"
            label={t('assignments.filters.asOf')}
            value={asOf}
            onValueChange={(value) => value && setAsOf(value)}
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
        person={canOpenDetail ? selectedPerson : null}
        asOf={asOf}
        requestScope={requestScope}
        onClose={() => setSelectedPerson(null)}
      />
    </>
  );
}
