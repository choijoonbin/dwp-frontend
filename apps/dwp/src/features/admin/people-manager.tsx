import { useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  UserRound,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getPerson, listPeople } from '@dwp-frontend/shared-utils';
import { EnterpriseDataGrid } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import InputAdornment from '@mui/material/InputAdornment';

import { AdminPanelError, AdminPanelLoading } from './admin-ui';

import type { GridColDef } from '@mui/x-data-grid';
import type { PersonSummary } from '@dwp-frontend/shared-utils';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function PersonDetailDialog({
  person,
  asOf,
  onClose,
}: {
  person: PersonSummary | null;
  asOf: string;
  onClose: () => void;
}) {
  const { t } = useTranslation('admin');
  const detailQuery = useQuery({
    queryKey: ['admin', 'people', 'detail', person?.personId, asOf],
    queryFn: () => getPerson(person?.personId ?? '', asOf),
    enabled: Boolean(person),
  });

  return (
    <Dialog open={Boolean(person)} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{t('people.detail.title')}</DialogTitle>
      <DialogContent sx={{ pt: '8px !important' }}>
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
        {detailQuery.data && (
          <Stack gap={2.5}>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={3}>
              <Box sx={{ minWidth: 220 }}>
                <Typography variant="h6">{detailQuery.data.person.displayName}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {detailQuery.data.person.businessTitle || t('people.notAvailable')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {detailQuery.data.person.workEmail || t('people.notAvailable')}
                </Typography>
              </Box>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(120px, 1fr))',
                  gap: 2,
                  flex: 1,
                }}
              >
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {t('people.detail.employer')}
                  </Typography>
                  <Typography variant="body2">
                    {detailQuery.data.legalEmployerName || t('people.notAvailable')}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {t('people.detail.hireDate')}
                  </Typography>
                  <Typography variant="body2">
                    {detailQuery.data.originalHireDate || t('people.notAvailable')}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {t('people.detail.manager')}
                  </Typography>
                  <Typography variant="body2">
                    {detailQuery.data.managerAssignmentKey || t('people.notAvailable')}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {t('people.detail.classification')}
                  </Typography>
                  <Typography variant="body2">
                    {detailQuery.data.person.dataAccess.classification}
                  </Typography>
                </Box>
              </Box>
            </Stack>
            <Divider />
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1.25 }}>
                {t('people.detail.assignments')}
              </Typography>
              <Stack component="ol" sx={{ p: 0, m: 0, listStyle: 'none' }}>
                {detailQuery.data.assignments.map((assignment) => (
                  <Box
                    component="li"
                    key={assignment.assignmentKey}
                    sx={{ py: 1.5, borderTop: 1, borderColor: 'divider' }}
                  >
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      justifyContent="space-between"
                      gap={1}
                    >
                      <Box>
                        <Stack direction="row" gap={0.75} alignItems="center">
                          <Typography variant="subtitle2">
                            {assignment.businessTitle || assignment.assignmentKey}
                          </Typography>
                          {assignment.primaryAssignment && (
                            <Chip label={t('people.detail.primary')} size="small" color="info" />
                          )}
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          {[
                            assignment.organizationName,
                            assignment.jobProfileName,
                            assignment.locationName,
                          ]
                            .filter(Boolean)
                            .join(' / ') || t('people.notAvailable')}
                        </Typography>
                      </Box>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ whiteSpace: 'nowrap' }}
                      >
                        {assignment.effectiveStartDate} -{' '}
                        {assignment.effectiveEndDate || t('people.detail.current')}
                      </Typography>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </Box>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function PeopleManager() {
  const { t } = useTranslation('admin');
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [status, setStatus] = useState('ALL');
  const [asOf, setAsOf] = useState(today);
  const [cursor, setCursor] = useState<string | undefined>();
  const [cursorHistory, setCursorHistory] = useState<Array<string | undefined>>([]);
  const [selected, setSelected] = useState<PersonSummary | null>(null);

  const peopleQuery = useQuery({
    queryKey: ['admin', 'people', deferredQuery, status, asOf, cursor],
    queryFn: () =>
      listPeople({
        query: deferredQuery,
        status: status === 'ALL' ? undefined : status,
        cursor,
        asOf,
        size: 50,
      }),
  });

  const rows = peopleQuery.data?.items ?? [];
  const columns = useMemo<GridColDef<PersonSummary>[]>(
    () => [
      {
        field: 'displayName',
        headerName: t('people.columns.person'),
        minWidth: 240,
        flex: 1,
        renderCell: ({ row }) => (
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={700} noWrap>
              {row.displayName}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" noWrap>
              {row.workEmail || row.personId}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'organizationName',
        headerName: t('people.columns.organization'),
        minWidth: 180,
        flex: 0.8,
        valueGetter: (_value, row) => row.organizationName || t('people.notAvailable'),
      },
      {
        field: 'businessTitle',
        headerName: t('people.columns.title'),
        minWidth: 180,
        flex: 0.8,
        valueGetter: (_value, row) => row.businessTitle || t('people.notAvailable'),
      },
      {
        field: 'workerStatus',
        headerName: t('people.columns.status'),
        width: 118,
        renderCell: ({ row }) => (
          <Chip
            label={t(`people.status.${row.workerStatus}`, {
              defaultValue: row.workerStatus || t('people.notAvailable'),
            })}
            size="small"
            color={row.workerStatus === 'ACTIVE' ? 'success' : 'default'}
            variant="outlined"
          />
        ),
      },
      {
        field: 'workerNumber',
        headerName: t('people.columns.workerNumber'),
        width: 130,
        valueGetter: (_value, row) => row.workerNumber || t('people.masked'),
      },
      {
        field: 'locationName',
        headerName: t('people.columns.location'),
        minWidth: 150,
        flex: 0.65,
        valueGetter: (_value, row) => row.locationName || t('people.notAvailable'),
      },
    ],
    [t]
  );

  if (peopleQuery.isLoading) return <AdminPanelLoading label={t('people.loading')} />;
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

  const resetCursor = () => {
    setCursor(undefined);
    setCursorHistory([]);
  };

  return (
    <>
      <Box sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          alignItems={{ xs: 'stretch', lg: 'center' }}
          justifyContent="space-between"
          gap={1.5}
          sx={{ p: 2 }}
        >
          <Stack direction="row" alignItems="center" gap={1}>
            <UserRound size={18} strokeWidth={1.8} />
            <Typography component="h2" variant="subtitle1">
              {t('people.title')}
            </Typography>
            <Chip label={rows.length} size="small" variant="outlined" />
            <Chip
              label={t('people.asOf', { date: peopleQuery.data?.asOf })}
              size="small"
              variant="outlined"
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={0.75}>
            <TextField
              size="small"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                resetCursor();
              }}
              label={t('people.search')}
              sx={{ width: { xs: 1, sm: 260 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={17} />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              select
              size="small"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                resetCursor();
              }}
              label={t('people.filters.status')}
              sx={{ minWidth: 140 }}
            >
              {['ALL', 'ACTIVE', 'LEAVE', 'TERMINATED'].map((value) => (
                <MenuItem key={value} value={value}>
                  {t(`people.status.${value}`)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              type="date"
              value={asOf}
              onChange={(event) => {
                setAsOf(event.target.value);
                resetCursor();
              }}
              label={t('people.filters.asOf')}
              InputLabelProps={{ shrink: true }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <CalendarDays size={16} />
                  </InputAdornment>
                ),
              }}
            />
            <Tooltip title={t('common.actions.refresh')}>
              <IconButton
                aria-label={t('common.actions.refresh')}
                onClick={() => void peopleQuery.refetch()}
              >
                <RefreshCw size={18} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
        <EnterpriseDataGrid
          ariaLabel={t('people.title')}
          rows={rows}
          columns={columns}
          getRowId={(row) => row.personId}
          hideFooter
          minVisibleRows={3}
          maxVisibleRows={10}
          onRowClick={({ row }) => setSelected(row)}
          sx={{ border: 0, borderRadius: 0, '& .MuiDataGrid-row': { cursor: 'pointer' } }}
        />
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="flex-end"
          gap={0.75}
          sx={{ p: 1.5, borderTop: 1, borderColor: 'divider' }}
        >
          <Button
            size="small"
            startIcon={<ChevronLeft size={16} />}
            disabled={!cursorHistory.length}
            onClick={() => {
              const previous = [...cursorHistory];
              setCursor(previous.pop());
              setCursorHistory(previous);
            }}
          >
            {t('people.pagination.previous')}
          </Button>
          <Button
            size="small"
            endIcon={<ChevronRight size={16} />}
            disabled={!peopleQuery.data?.hasMore || !peopleQuery.data.nextCursor}
            onClick={() => {
              setCursorHistory((history) => [...history, cursor]);
              setCursor(peopleQuery.data?.nextCursor || undefined);
            }}
          >
            {t('people.pagination.next')}
          </Button>
        </Stack>
      </Box>
      <PersonDetailDialog person={selected} asOf={asOf} onClose={() => setSelected(null)} />
    </>
  );
}
