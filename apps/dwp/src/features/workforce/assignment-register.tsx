import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  ActionIconButton,
  DatePickerField,
  EnterpriseDataGrid,
  ErrorState,
  FormField,
  LoadingState,
  SelectField,
} from '@dwp-frontend/design-system';
import { listPeople } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { PersonAvatar } from '../people/directory/person-avatar';

import type { GridColDef } from '@mui/x-data-grid';
import type { PersonSummary } from '@dwp-frontend/shared-utils';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AssignmentRegister() {
  const { t } = useTranslation('workforce');
  const [asOf, setAsOf] = useState(today);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const people = useQuery({
    queryKey: ['workforce', 'assignments', asOf],
    queryFn: () => listPeople({ asOf, size: 100, surface: 'workforce' }),
  });
  const rows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return (people.data?.items ?? []).filter((person) => {
      if (status !== 'ALL' && person.workerStatus !== status) return false;
      if (!needle) return true;
      return [
        person.displayName,
        person.assignmentKey,
        person.businessTitle,
        person.organizationName,
        person.managerDisplayName,
      ].some((value) => value?.toLocaleLowerCase().includes(needle));
    });
  }, [people.data, query, status]);
  const columns = useMemo<GridColDef<PersonSummary>[]>(
    () => [
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
    ],
    [t]
  );

  if (people.isLoading) return <LoadingState label={t('assignments.loading')} size="page" />;
  if (people.isError) {
    return (
      <ErrorState
        title={t('common.loadError')}
        description={t('assignments.loadError')}
        size="standard"
      />
    );
  }

  return (
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
        <ActionIconButton label={t('common.actions.refresh')} onClick={() => void people.refetch()}>
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
    </Box>
  );
}
