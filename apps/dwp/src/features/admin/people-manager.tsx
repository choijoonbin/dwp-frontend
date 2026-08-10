import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CalendarDays,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  getOrganizationChart,
  getPerson,
  listIdentityUsers,
  listPeople,
} from '@dwp-frontend/shared-utils';
import { EnterpriseDataGrid } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
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
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { AdminPanelError, AdminPanelLoading } from './admin-ui';
import { PersonAvatar } from './people/person-avatar';

import type { GridColDef } from '@mui/x-data-grid';
import type { OrganizationChart, PersonDetail, PersonSummary } from '@dwp-frontend/shared-utils';

type PeopleDirectoryRow = PersonSummary & { roles: string[] };

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
  onClose,
}: {
  person: PeopleDirectoryRow | null;
  asOf: string;
  chart?: OrganizationChart;
  roles: string[];
  onClose: () => void;
}) {
  const { t } = useTranslation('admin');
  const detailQuery = useQuery({
    queryKey: ['admin', 'people', 'detail', person?.personId, asOf],
    queryFn: () => getPerson(person?.personId ?? '', asOf),
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
            managerName={
              chart?.people.find((candidate) => candidate.personId === chartPerson?.managerPersonId)
                ?.displayName
            }
            directReports={directReports ?? []}
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
  managerName,
  directReports,
}: {
  detail: PersonDetail;
  person: PeopleDirectoryRow;
  roles: string[];
  managerName?: string;
  directReports: OrganizationChart['people'];
}) {
  const { t } = useTranslation('admin');
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
        <Fact
          label={t('people.detail.jobGrade')}
          value={[person.jobGradeName, person.jobGradeKey].filter(Boolean).join(' / ')}
        />
        <Fact label={t('people.detail.manager')} value={managerName || person.managerDisplayName} />
        <Fact label={t('people.columns.location')} value={person.locationName} />
        <Fact label={t('people.detail.employer')} value={detail.legalEmployerName} />
        <Fact label={t('people.detail.hireDate')} value={detail.originalHireDate} />
      </Box>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        divider={<Divider flexItem orientation="vertical" />}
      >
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
    </Stack>
  );
}

export function PeopleManager() {
  const { t } = useTranslation('admin');
  const [asOf, setAsOf] = useState(today);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [organization, setOrganization] = useState('ALL');
  const [grade, setGrade] = useState('ALL');
  const [location, setLocation] = useState('ALL');
  const [role, setRole] = useState('ALL');
  const [selected, setSelected] = useState<PeopleDirectoryRow | null>(null);

  const peopleQuery = useQuery({
    queryKey: ['admin', 'people', 'directory', asOf],
    queryFn: () => listPeople({ asOf, size: 100 }),
  });
  const chartQuery = useQuery({
    queryKey: ['admin', 'people', 'org-context', asOf],
    queryFn: () => getOrganizationChart({ asOf, depth: 10 }),
  });
  const identitiesQuery = useQuery({
    queryKey: ['admin', 'people', 'identity-roles'],
    queryFn: () => listIdentityUsers(),
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
      if (role !== 'ALL' && !row.roles.includes(role)) return false;
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
  }, [grade, location, organization, query, role, rows, status]);

  const columns = useMemo<GridColDef<PeopleDirectoryRow>[]>(
    () => [
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
        headerName: t('people.columns.position'),
        minWidth: 210,
        flex: 0.9,
        renderCell: ({ row }) => (
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" noWrap>
              {row.businessTitle || row.jobProfileName || t('people.notAvailable')}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" noWrap>
              {[row.jobGradeName, row.jobGradeKey].filter(Boolean).join(' / ')}
            </Typography>
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
      },
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
    ],
    [t]
  );

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

  const activeFilters = [status, organization, grade, location, role].filter(
    (value) => value !== 'ALL'
  ).length;
  const resetFilters = () => {
    setStatus('ALL');
    setOrganization('ALL');
    setGrade('ALL');
    setLocation('ALL');
    setRole('ALL');
    setQuery('');
  };

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
          <Stack direction="row" gap={0.5} justifyContent="flex-end">
            {activeFilters > 0 && (
              <Button size="small" startIcon={<X size={15} />} onClick={resetFilters}>
                {t('people.filters.reset', { count: activeFilters })}
              </Button>
            )}
            <Tooltip title={t('common.actions.refresh')}>
              <IconButton
                aria-label={t('common.actions.refresh')}
                onClick={() => {
                  void peopleQuery.refetch();
                  void chartQuery.refetch();
                  void identitiesQuery.refetch();
                }}
              >
                <RefreshCw size={18} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        <Stack
          direction="row"
          alignItems="center"
          gap={0.75}
          flexWrap="wrap"
          useFlexGap
          sx={{ p: 1.5, bgcolor: 'action.hover', borderBottom: 1, borderColor: 'divider' }}
        >
          <TextField
            size="small"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('people.search')}
            inputProps={{ 'aria-label': t('people.search') }}
            sx={{ width: { xs: 1, sm: 250 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={16} />
                </InputAdornment>
              ),
            }}
          />
          <FilterSelect
            label={t('people.filters.status')}
            value={status}
            onChange={setStatus}
            options={['ACTIVE', 'LEAVE', 'PENDING', 'TERMINATED']}
            optionLabel={(value) => t(`people.status.${value}`)}
          />
          <FilterSelect
            label={t('people.filters.organization')}
            value={organization}
            onChange={setOrganization}
            options={options.organizations}
          />
          <FilterSelect
            label={t('people.filters.grade')}
            value={grade}
            onChange={setGrade}
            options={options.grades}
          />
          <FilterSelect
            label={t('people.filters.location')}
            value={location}
            onChange={setLocation}
            options={options.locations}
          />
          <FilterSelect
            label={t('people.filters.role')}
            value={role}
            onChange={setRole}
            options={options.roles}
          />
          <TextField
            size="small"
            type="date"
            value={asOf}
            onChange={(event) => {
              setAsOf(event.target.value);
              setSelected(null);
            }}
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
        </Stack>

        <EnterpriseDataGrid
          ariaLabel={t('people.title')}
          rows={filteredRows}
          columns={columns}
          getRowId={(row) => row.personId}
          hideFooter
          minVisibleRows={5}
          maxVisibleRows={12}
          onRowClick={({ row }) => setSelected(row)}
          sx={{ border: 0, borderRadius: 0, '& .MuiDataGrid-row': { cursor: 'pointer' } }}
        />
      </Box>
      <PersonDetailDialog
        person={selected}
        asOf={asOf}
        chart={chartQuery.data}
        roles={selected?.roles ?? []}
        onClose={() => setSelected(null)}
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
  const { t } = useTranslation('admin');
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
