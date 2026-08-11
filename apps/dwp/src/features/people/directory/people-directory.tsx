import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, Mail, Network, ShieldCheck, UserRound, UsersRound, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  getOrganizationChart,
  getPerson,
  listIdentityUsers,
  listPeople,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  EnterpriseDataGrid,
  FilterBar,
  mergeFilterSearchParams,
  SavedViewMenu,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { AdminPanelError, AdminPanelLoading } from '../../admin/admin-ui';
import { isIsoDate } from '../organization/organization-navigation';
import { PersonAvatar } from './person-avatar';

import type { GridColDef } from '@mui/x-data-grid';
import type { OrganizationChart, PersonDetail, PersonSummary } from '@dwp-frontend/shared-utils';

type PeopleDirectoryRow = PersonSummary & { roles: string[] };
export type PeopleDirectoryExperience = 'directory' | 'workforce';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function statusColor(status?: string | null): 'success' | 'warning' | 'default' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'LEAVE' || status === 'PENDING') return 'warning';
  return 'default';
}

function Fact({ label, value }: { label: string; value?: string | null }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.2, overflowWrap: 'anywhere' }}>
        {value || '-'}
      </Typography>
    </Box>
  );
}

function PersonDetailDialog({
  person,
  asOf,
  chart,
  roles,
  experience,
  onClose,
}: {
  person: PeopleDirectoryRow | null;
  asOf: string;
  chart?: OrganizationChart;
  roles: string[];
  experience: PeopleDirectoryExperience;
  onClose: () => void;
}) {
  const { t } = useTranslation('workforce');
  const navigate = useNavigate();
  const detailQuery = useQuery({
    queryKey: [experience, 'people', 'detail', person?.personId, asOf],
    queryFn: () => getPerson(person?.personId ?? '', asOf, experience),
    enabled: Boolean(person),
  });
  const chartPerson = chart?.people.find((candidate) => candidate.personId === person?.personId);
  const directReports = chart?.people.filter(
    (candidate) => candidate.managerPersonId === person?.personId
  );

  return (
    <Dialog open={Boolean(person)} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ pr: 6 }}>
        {t('people.detail.title')}
        <IconButton
          size="small"
          aria-label={t('people.detail.close')}
          onClick={onClose}
          sx={{ position: 'absolute', right: 16, top: 14 }}
        >
          <X size={18} />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {detailQuery.isLoading && <AdminPanelLoading label={t('people.detail.loading')} />}
        {detailQuery.isError && (
          <AdminPanelError
            message={
              detailQuery.error instanceof Error
                ? detailQuery.error.message
                : t('common.operationError')
            }
          />
        )}
        {detailQuery.data && person && (
          <PersonProfile
            detail={detailQuery.data}
            person={person}
            roles={roles}
            experience={experience}
            managerName={
              chart?.people.find((candidate) => candidate.personId === chartPerson?.managerPersonId)
                ?.displayName
            }
            directReports={directReports ?? []}
            onViewInOrganization={() => {
              const params = new URLSearchParams({
                asOf,
                mode: 'people',
                person: person.personId,
              });
              navigate(
                `${experience === 'workforce' ? '/workforce' : '/people'}/organization?${params}`
              );
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PersonProfile({
  detail,
  person,
  roles,
  experience,
  managerName,
  directReports,
  onViewInOrganization,
}: {
  detail: PersonDetail;
  person: PeopleDirectoryRow;
  roles: string[];
  experience: PeopleDirectoryExperience;
  managerName?: string;
  directReports: OrganizationChart['people'];
  onViewInOrganization: () => void;
}) {
  const { t } = useTranslation('workforce');
  const workforceView = experience === 'workforce';
  return (
    <Stack>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        gap={2}
        sx={{ px: 3, py: 2.5 }}
      >
        <PersonAvatar name={person.displayName} size={58} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" useFlexGap>
            <Typography component="h3" variant="h6">
              {person.displayName}
            </Typography>
            <Chip
              label={t(`people.status.${person.workerStatus}`, {
                defaultValue: person.workerStatus || t('people.notAvailable'),
              })}
              size="small"
              color={statusColor(person.workerStatus)}
              variant="outlined"
            />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {person.businessTitle || person.jobProfileName || t('people.notAvailable')}
          </Typography>
          {person.workEmail && (
            <Stack direction="row" alignItems="center" gap={0.6} sx={{ mt: 0.6 }}>
              <Mail size={14} />
              <Typography variant="body2">{person.workEmail}</Typography>
            </Stack>
          )}
        </Box>
        <ActionButton
          intent="secondary"
          size="small"
          startIcon={<Network size={16} aria-hidden="true" />}
          onClick={onViewInOrganization}
          sx={{ flexShrink: 0 }}
        >
          {t('people.detail.viewInOrganization')}
        </ActionButton>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          gap: 2,
          px: 3,
          py: 2,
          bgcolor: 'action.hover',
          borderTop: 1,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Fact label={t('people.columns.organization')} value={person.organizationName} />
        {workforceView && (
          <Fact
            label={t('people.detail.jobGrade')}
            value={[person.jobGradeName, person.jobGradeKey].filter(Boolean).join(' / ')}
          />
        )}
        <Fact label={t('people.detail.manager')} value={managerName || person.managerDisplayName} />
        <Fact label={t('people.columns.location')} value={person.locationName} />
        {workforceView && (
          <Fact label={t('people.detail.employer')} value={detail.legalEmployerName} />
        )}
        {workforceView && (
          <Fact label={t('people.detail.hireDate')} value={detail.originalHireDate} />
        )}
      </Box>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        divider={<Divider flexItem orientation="vertical" />}
      >
        {workforceView && (
          <Box sx={{ px: 3, py: 2.5, flex: 1, minWidth: 0 }}>
            <Stack direction="row" alignItems="center" gap={0.75} sx={{ mb: 1.25 }}>
              <ShieldCheck size={16} />
              <Typography component="h3" variant="subtitle2">
                {t('people.detail.roles')}
              </Typography>
            </Stack>
            <Stack direction="row" flexWrap="wrap" gap={0.6} useFlexGap>
              {roles.length ? (
                roles.map((role) => <Chip key={role} label={role} size="small" />)
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {t('people.detail.noRoles')}
                </Typography>
              )}
            </Stack>
          </Box>
        )}
        <Box sx={{ px: 3, py: 2.5, flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" gap={0.75} sx={{ mb: 1.25 }}>
            <UsersRound size={16} />
            <Typography component="h3" variant="subtitle2">
              {t('people.detail.directReports', { count: directReports.length })}
            </Typography>
          </Stack>
          {directReports.length ? (
            <Stack gap={1}>
              {directReports.map((report) => (
                <Stack key={report.personId} direction="row" alignItems="center" gap={1}>
                  <PersonAvatar name={report.displayName} size={28} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={650} noWrap>
                      {report.displayName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" noWrap>
                      {report.businessTitle}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {t('people.detail.noDirectReports')}
            </Typography>
          )}
        </Box>
      </Stack>

      {workforceView && (
        <Box sx={{ px: 3, py: 2.5, borderTop: 1, borderColor: 'divider' }}>
          <Stack direction="row" alignItems="center" gap={0.75} sx={{ mb: 1.25 }}>
            <CalendarDays size={16} />
            <Typography component="h3" variant="subtitle2">
              {t('people.detail.assignments')}
            </Typography>
          </Stack>
          <Stack component="ol" sx={{ p: 0, m: 0, listStyle: 'none' }}>
            {detail.assignments.map((assignment, index) => (
              <Stack
                component="li"
                key={`${assignment.assignmentKey}-${assignment.effectiveStartDate}`}
                direction="row"
                gap={1.5}
                sx={{ position: 'relative', pb: index === detail.assignments.length - 1 ? 0 : 2 }}
              >
                <Box sx={{ width: 14, position: 'relative', flex: '0 0 14px' }}>
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 4,
                      left: 3,
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: assignment.primaryAssignment ? 'primary.main' : 'text.disabled',
                    }}
                  />
                  {index < detail.assignments.length - 1 && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 14,
                        bottom: -2,
                        left: 6.5,
                        borderLeft: 1,
                        borderColor: 'divider',
                      }}
                    />
                  )}
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Stack direction="row" justifyContent="space-between" gap={1} flexWrap="wrap">
                    <Typography variant="body2" fontWeight={700}>
                      {assignment.businessTitle || assignment.assignmentKey}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {assignment.effectiveStartDate} -{' '}
                      {assignment.effectiveEndDate || t('people.detail.current')}
                    </Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {[
                      assignment.organizationName,
                      assignment.jobProfileName,
                      assignment.jobGradeName,
                      assignment.locationName,
                    ]
                      .filter(Boolean)
                      .join(' / ') || t('people.notAvailable')}
                  </Typography>
                </Box>
              </Stack>
            ))}
          </Stack>
        </Box>
      )}
    </Stack>
  );
}

export function PeopleDirectory({
  experience = 'workforce',
}: {
  experience?: PeopleDirectoryExperience;
}) {
  const { t } = useTranslation('workforce');
  const workforceView = experience === 'workforce';
  const [searchParams, setSearchParams] = useSearchParams();
  const currentDate = today();
  const asOfParam = searchParams.get('asOf');
  const asOf = isIsoDate(asOfParam) ? asOfParam : currentDate;
  const query = searchParams.get('q') ?? '';
  const status = workforceView ? searchParams.get('status') || 'ALL' : 'ACTIVE';
  const organization = searchParams.get('org') || 'ALL';
  const grade = workforceView ? searchParams.get('grade') || 'ALL' : 'ALL';
  const location = searchParams.get('location') || 'ALL';
  const role = workforceView ? searchParams.get('role') || 'ALL' : 'ALL';
  const columnPreset = searchParams.get('columns') === 'compact' ? 'compact' : 'operational';

  const updateSearchParams = (values: Record<string, string | null | undefined>) => {
    setSearchParams(mergeFilterSearchParams(searchParams, values), { replace: true });
  };

  const peopleQuery = useQuery({
    queryKey: [experience, 'people', 'directory', asOf, workforceView ? undefined : 'ACTIVE'],
    queryFn: () =>
      listPeople({
        asOf,
        status: workforceView ? undefined : 'ACTIVE',
        size: 100,
        surface: experience,
      }),
  });
  const chartQuery = useQuery({
    queryKey: [experience, 'people', 'org-context', asOf],
    queryFn: () => getOrganizationChart({ asOf, depth: 10, surface: experience }),
  });
  const identitiesQuery = useQuery({
    queryKey: ['workforce', 'people', 'identity-roles'],
    queryFn: () => listIdentityUsers(),
    enabled: workforceView,
    retry: false,
  });

  const rolesByEmail = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const identity of identitiesQuery.data?.content ?? []) {
      if (identity.email) map.set(identity.email.toLowerCase(), identity.roles);
    }
    return map;
  }, [identitiesQuery.data]);

  const rows = useMemo<PeopleDirectoryRow[]>(
    () =>
      (peopleQuery.data?.items ?? []).map((person) => ({
        ...person,
        roles: person.workEmail ? (rolesByEmail.get(person.workEmail.toLowerCase()) ?? []) : [],
      })),
    [peopleQuery.data, rolesByEmail]
  );
  const selected = rows.find((row) => row.personId === searchParams.get('person')) ?? null;

  const options = useMemo(
    () => ({
      organizations: unique(rows.map((row) => row.organizationName)),
      grades: unique(rows.map((row) => row.jobGradeName)),
      locations: unique(rows.map((row) => row.locationName)),
      roles: unique(rows.flatMap((row) => row.roles)),
    }),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return rows.filter((row) => {
      if (status !== 'ALL' && row.workerStatus !== status) return false;
      if (organization !== 'ALL' && row.organizationName !== organization) return false;
      if (grade !== 'ALL' && row.jobGradeName !== grade) return false;
      if (location !== 'ALL' && row.locationName !== location) return false;
      if (workforceView && role !== 'ALL' && !row.roles.includes(role)) return false;
      if (!needle) return true;
      return [
        row.displayName,
        row.workEmail,
        row.businessTitle,
        row.jobProfileName,
        row.organizationName,
        row.managerDisplayName,
      ].some((value) => value?.toLocaleLowerCase().includes(needle));
    });
  }, [grade, location, organization, query, role, rows, status, workforceView]);

  const columns = useMemo<GridColDef<PeopleDirectoryRow>[]>(() => {
    const values: GridColDef<PeopleDirectoryRow>[] = [
      {
        field: 'displayName',
        headerName: t('people.columns.person'),
        minWidth: 240,
        flex: 1,
        renderCell: ({ row }) => (
          <Stack direction="row" alignItems="center" gap={1} sx={{ minWidth: 0 }}>
            <PersonAvatar name={row.displayName} size={32} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={700} noWrap>
                {row.displayName}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" noWrap>
                {row.workEmail || row.personId}
              </Typography>
            </Box>
          </Stack>
        ),
      },
      {
        field: 'organizationName',
        headerName: t('people.columns.organization'),
        minWidth: 190,
        flex: 0.85,
        valueGetter: (_value, row) => row.organizationName || t('people.notAvailable'),
      },
      {
        field: 'businessTitle',
        headerName: workforceView ? t('people.columns.position') : t('people.columns.title'),
        minWidth: 210,
        flex: 0.9,
        renderCell: ({ row }) => (
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" noWrap>
              {row.businessTitle || row.jobProfileName || t('people.notAvailable')}
            </Typography>
            {workforceView && (
              <Typography variant="caption" color="text.secondary" display="block" noWrap>
                {[row.jobGradeName, row.jobGradeKey].filter(Boolean).join(' / ')}
              </Typography>
            )}
          </Box>
        ),
      },
      {
        field: 'managerDisplayName',
        headerName: t('people.columns.manager'),
        width: 130,
        valueGetter: (_value, row) => row.managerDisplayName || t('people.notAvailable'),
      },
      {
        field: 'locationName',
        headerName: t('people.columns.location'),
        minWidth: 160,
        flex: 0.65,
        valueGetter: (_value, row) => row.locationName || t('people.notAvailable'),
      },
      ...(workforceView
        ? [
            {
              field: 'roles',
              headerName: t('people.columns.roles'),
              minWidth: 190,
              flex: 0.75,
              renderCell: ({ row }) => (
                <Stack direction="row" gap={0.4} sx={{ minWidth: 0, overflow: 'hidden' }}>
                  {row.roles.slice(0, 2).map((assignedRole) => (
                    <Chip key={assignedRole} label={assignedRole} size="small" variant="outlined" />
                  ))}
                  {row.roles.length > 2 && <Chip label={`+${row.roles.length - 2}`} size="small" />}
                </Stack>
              ),
            } satisfies GridColDef<PeopleDirectoryRow>,
          ]
        : []),
      {
        field: 'workerStatus',
        headerName: t('people.columns.status'),
        width: 112,
        renderCell: ({ row }) => (
          <Chip
            label={t(`people.status.${row.workerStatus}`, {
              defaultValue: row.workerStatus || t('people.notAvailable'),
            })}
            size="small"
            color={statusColor(row.workerStatus)}
            variant="outlined"
          />
        ),
      },
    ];
    return values;
  }, [t, workforceView]);

  if (peopleQuery.isLoading || chartQuery.isLoading) {
    return <AdminPanelLoading label={t('people.loading')} />;
  }
  if (peopleQuery.isError) {
    return (
      <AdminPanelError
        message={
          peopleQuery.error instanceof Error
            ? peopleQuery.error.message
            : t('common.operationError')
        }
      />
    );
  }

  const resetFilters = () => {
    updateSearchParams({
      asOf: null,
      columns: null,
      grade: null,
      location: null,
      org: null,
      person: null,
      q: null,
      role: null,
      status: null,
    });
  };
  const activeFilters = [
    ...(workforceView && status !== 'ALL'
      ? [
          {
            key: 'status',
            label: `${t('people.filters.status')}: ${t(`people.status.${status}`, {
              defaultValue: status,
            })}`,
            onRemove: () => updateSearchParams({ status: null, person: null }),
          },
        ]
      : []),
    ...(organization !== 'ALL'
      ? [
          {
            key: 'organization',
            label: `${t('people.filters.organization')}: ${organization}`,
            onRemove: () => updateSearchParams({ org: null, person: null }),
          },
        ]
      : []),
    ...(workforceView && grade !== 'ALL'
      ? [
          {
            key: 'grade',
            label: `${t('people.filters.grade')}: ${grade}`,
            onRemove: () => updateSearchParams({ grade: null, person: null }),
          },
        ]
      : []),
    ...(location !== 'ALL'
      ? [
          {
            key: 'location',
            label: `${t('people.filters.location')}: ${location}`,
            onRemove: () => updateSearchParams({ location: null, person: null }),
          },
        ]
      : []),
    ...(workforceView && role !== 'ALL'
      ? [
          {
            key: 'role',
            label: `${t('people.filters.role')}: ${role}`,
            onRemove: () => updateSearchParams({ role: null, person: null }),
          },
        ]
      : []),
    ...(asOf !== currentDate
      ? [
          {
            key: 'asOf',
            label: `${t('people.filters.asOf')}: ${asOf}`,
            onRemove: () => updateSearchParams({ asOf: null, person: null }),
          },
        ]
      : []),
  ];

  return (
    <>
      <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          alignItems={{ xs: 'stretch', lg: 'center' }}
          justifyContent="space-between"
          gap={1.5}
          sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}
        >
          <Stack direction="row" alignItems="center" gap={1}>
            <UserRound size={18} strokeWidth={1.8} />
            <Typography component="h2" variant="subtitle1">
              {t('people.title')}
            </Typography>
            <Chip
              label={t('people.resultCount', { count: filteredRows.length })}
              size="small"
              variant="outlined"
            />
            <Chip label={t('people.asOf', { date: peopleQuery.data?.asOf })} size="small" />
          </Stack>
        </Stack>

        <Box sx={{ px: 1.5, bgcolor: 'action.hover' }}>
          <FilterBar
            ariaLabel={t('people.filters.label')}
            searchLabel={t('people.search')}
            searchValue={query}
            onSearchChange={(value) => updateSearchParams({ q: value || null, person: null })}
            filters={
              <>
                {workforceView && (
                  <FilterSelect
                    label={t('people.filters.status')}
                    value={status}
                    onChange={(value) => updateSearchParams({ status: value, person: null })}
                    options={['ACTIVE', 'LEAVE', 'PENDING', 'TERMINATED']}
                    optionLabel={(value) => t(`people.status.${value}`)}
                  />
                )}
                <FilterSelect
                  label={t('people.filters.organization')}
                  value={organization}
                  onChange={(value) => updateSearchParams({ org: value, person: null })}
                  options={options.organizations}
                />
                {workforceView && (
                  <FilterSelect
                    label={t('people.filters.grade')}
                    value={grade}
                    onChange={(value) => updateSearchParams({ grade: value, person: null })}
                    options={options.grades}
                  />
                )}
                <FilterSelect
                  label={t('people.filters.location')}
                  value={location}
                  onChange={(value) => updateSearchParams({ location: value, person: null })}
                  options={options.locations}
                />
                {workforceView && (
                  <FilterSelect
                    label={t('people.filters.role')}
                    value={role}
                    onChange={(value) => updateSearchParams({ role: value, person: null })}
                    options={options.roles}
                  />
                )}
                <TextField
                  size="small"
                  type="date"
                  value={asOf}
                  onChange={(event) =>
                    updateSearchParams({
                      asOf: event.target.value === currentDate ? null : event.target.value,
                      person: null,
                    })
                  }
                  inputProps={{ 'aria-label': t('people.filters.asOf') }}
                  sx={{ width: 172 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <CalendarDays size={15} />
                      </InputAdornment>
                    ),
                  }}
                />
              </>
            }
            savedViews={
              workforceView ? (
                <SavedViewMenu
                  label={t('people.views.label')}
                  personalLabel={t('people.views.personal')}
                  sharedLabel={t('people.views.shared')}
                  defaultLabel={t('people.views.default')}
                  selectedViewId={status}
                  views={[
                    {
                      id: 'ALL',
                      name: t('people.status.ALL'),
                      scope: 'personal',
                      isDefault: workforceView,
                    },
                    {
                      id: 'ACTIVE',
                      name: t('people.status.ACTIVE'),
                      scope: 'personal',
                      isDefault: !workforceView,
                    },
                    {
                      id: 'LEAVE',
                      name: t('people.status.LEAVE'),
                      scope: 'personal',
                    },
                  ]}
                  onSelect={(view) =>
                    updateSearchParams({
                      status: view.id === (workforceView ? 'ALL' : 'ACTIVE') ? null : view.id,
                      person: null,
                    })
                  }
                />
              ) : undefined
            }
            activeFilters={activeFilters}
            resetLabel={t('people.filters.reset', { count: activeFilters.length })}
            onReset={resetFilters}
          />
        </Box>

        <EnterpriseDataGrid
          ariaLabel={t('people.title')}
          rows={filteredRows}
          columns={columns}
          getRowId={(row) => row.personId}
          hideFooter
          minVisibleRows={5}
          maxVisibleRows={12}
          onRowClick={({ row }) => updateSearchParams({ person: row.personId })}
          columnVisibilityModel={
            columnPreset === 'compact'
              ? {
                  locationName: false,
                  managerDisplayName: false,
                  roles: false,
                }
              : undefined
          }
          stickyColumns={{ left: ['displayName'], right: ['workerStatus'] }}
          toolbar={{
            ariaLabel: t('people.grid.toolbar'),
            showColumns: false,
            showFilters: false,
            showQuickFilter: false,
            enableCsvExport: true,
            exportLabel: t('people.grid.export'),
            csvFileName: `dwp-people-${asOf}`,
            refreshLabel: t('common.actions.refresh'),
            refreshing:
              peopleQuery.isFetching || chartQuery.isFetching || identitiesQuery.isFetching,
            onRefresh: () => {
              void peopleQuery.refetch();
              void chartQuery.refetch();
              void identitiesQuery.refetch();
            },
            columnPresetsLabel: t('people.grid.columnPresets.label'),
            selectedColumnPresetId: columnPreset,
            columnPresets: [
              { id: 'operational', label: t('people.grid.columnPresets.operational') },
              { id: 'compact', label: t('people.grid.columnPresets.compact') },
            ],
            onColumnPresetChange: (value) =>
              updateSearchParams({ columns: value === 'operational' ? null : value }),
          }}
          sx={{ border: 0, borderRadius: 0, '& .MuiDataGrid-row': { cursor: 'pointer' } }}
        />
      </Box>
      <PersonDetailDialog
        person={selected}
        asOf={asOf}
        chart={chartQuery.data}
        roles={selected?.roles ?? []}
        experience={experience}
        onClose={() => updateSearchParams({ person: null })}
      />
    </>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
  optionLabel = (option) => option,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  optionLabel?: (option: string) => string;
}) {
  const { t } = useTranslation('workforce');
  return (
    <TextField
      select
      size="small"
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      sx={{ minWidth: 138, maxWidth: 210 }}
    >
      <MenuItem value="ALL">{t('people.filters.all')}</MenuItem>
      {options.map((option) => (
        <MenuItem key={option} value={option}>
          {optionLabel(option)}
        </MenuItem>
      ))}
    </TextField>
  );
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort((a, b) =>
    a.localeCompare(b)
  );
}
