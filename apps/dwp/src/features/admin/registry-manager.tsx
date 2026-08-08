import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import {
  Archive,
  Boxes,
  CheckCircle2,
  CopyPlus,
  Pencil,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useToast,
  listRegistryEntries,
  createRegistryEntry,
  createRegistryRevision,
  updateRegistryRevision,
  retireRegistryRevision,
  activateRegistryRevision,
} from '@dwp-frontend/shared-utils';
import { EnterpriseDataGrid } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import InputAdornment from '@mui/material/InputAdornment';
import useMediaQuery from '@mui/material/useMediaQuery';

import { AdminPanelError, AdminPanelLoading, LifecycleChip } from './admin-ui';
import { ConfirmActionDialog } from './reference-dialogs';
import { RegistryDialog } from './registry-dialog';

import type { GridColDef } from '@mui/x-data-grid';
import type { RegistryEntry, RegistryType, ReferenceLifecycle } from '@dwp-frontend/shared-utils';
import type { RegistryDialogValue } from './registry-dialog';

type RegistryDialogState =
  | { mode: 'create'; entry?: undefined }
  | { mode: 'edit' | 'revision'; entry: RegistryEntry }
  | null;

type PendingAction = { kind: 'activate' | 'retire'; entry: RegistryEntry } | null;

const registryTypes: Array<RegistryType | 'ALL'> = [
  'ALL',
  'APP',
  'CONNECTOR',
  'AGENT',
  'TOOL',
  'POLICY',
];
const lifecycleStates: Array<ReferenceLifecycle | 'ALL'> = ['ALL', 'DRAFT', 'ACTIVE', 'RETIRED'];

const typeColor = {
  APP: 'info',
  CONNECTOR: 'secondary',
  AGENT: 'primary',
  TOOL: 'warning',
  POLICY: 'default',
} as const;

const riskColor = {
  LOW: 'success',
  MEDIUM: 'info',
  HIGH: 'warning',
  CRITICAL: 'error',
} as const;

function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The operation could not be completed.';
}

function RegistryTypeChip({ type }: { type: RegistryType }) {
  return <Chip label={titleCase(type)} color={typeColor[type]} variant="outlined" size="small" />;
}

function RiskChip({ entry }: { entry: RegistryEntry }) {
  return (
    <Chip
      label={titleCase(entry.riskTier)}
      color={riskColor[entry.riskTier]}
      variant="outlined"
      size="small"
    />
  );
}

export function RegistryManager() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('sm'));
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [registryType, setRegistryType] = useState<RegistryType | 'ALL'>('ALL');
  const [lifecycle, setLifecycle] = useState<ReferenceLifecycle | 'ALL'>('ALL');
  const [dialog, setDialog] = useState<RegistryDialogState>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);

  const registryQuery = useQuery({
    queryKey: ['admin', 'registry-entries', deferredQuery, registryType, lifecycle],
    queryFn: () => listRegistryEntries({ query: deferredQuery, registryType, lifecycle }),
  });
  const entries = useMemo(() => registryQuery.data?.content ?? [], [registryQuery.data]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'registry-entries'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit-events'] }),
    ]);
  };

  const run = async (operation: () => Promise<RegistryEntry>, message: string) => {
    setBusy(true);
    try {
      await operation();
      await refresh();
      toast.success(message);
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveDialog = async (value: RegistryDialogValue) => {
    if (!dialog) return;
    const definition = {
      name: value.name,
      description: value.description,
      ownerRef: value.ownerRef,
      riskTier: value.riskTier,
      artifactVersion: value.artifactVersion,
    };
    let completed = false;
    if (dialog.mode === 'create') {
      completed = await run(
        () =>
          createRegistryEntry({
            ...definition,
            registryType: value.registryType,
            entryKey: value.entryKey,
          }),
        'Registry draft created.'
      );
    } else if (dialog.mode === 'edit') {
      completed = await run(
        () =>
          updateRegistryRevision(dialog.entry, { ...definition, version: dialog.entry.version }),
        'Registry draft updated.'
      );
    } else {
      completed = await run(
        () => createRegistryRevision(dialog.entry, definition),
        'Registry revision created.'
      );
    }
    if (completed) setDialog(null);
  };

  const confirmAction = async () => {
    if (!pendingAction) return;
    const completed =
      pendingAction.kind === 'activate'
        ? await run(
            () => activateRegistryRevision(pendingAction.entry),
            'Registry revision activated.'
          )
        : await run(
            () => retireRegistryRevision(pendingAction.entry),
            pendingAction.entry.lifecycleState === 'DRAFT'
              ? 'Draft revision retired.'
              : 'Registry revision retired.'
          );
    if (completed) setPendingAction(null);
  };

  const renderActions = useCallback(
    (entry: RegistryEntry) => (
      <Stack direction="row" justifyContent="flex-end" sx={{ width: 1 }}>
        {entry.lifecycleState === 'DRAFT' ? (
          <>
            <Tooltip title="Edit draft">
              <IconButton
                size="small"
                aria-label={`Edit ${entry.entryKey}`}
                onClick={() => setDialog({ mode: 'edit', entry })}
              >
                <Pencil size={17} strokeWidth={1.8} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Activate revision">
              <IconButton
                size="small"
                color="success"
                aria-label={`Activate ${entry.entryKey}`}
                onClick={() => setPendingAction({ kind: 'activate', entry })}
              >
                <CheckCircle2 size={17} strokeWidth={1.8} />
              </IconButton>
            </Tooltip>
          </>
        ) : (
          <Tooltip title="Create revision">
            <IconButton
              size="small"
              aria-label={`Create revision for ${entry.entryKey}`}
              onClick={() => setDialog({ mode: 'revision', entry })}
            >
              <CopyPlus size={17} strokeWidth={1.8} />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title={entry.lifecycleState === 'DRAFT' ? 'Discard draft' : 'Retire revision'}>
          <span>
            <IconButton
              size="small"
              aria-label={`Retire ${entry.entryKey}`}
              disabled={entry.lifecycleState === 'RETIRED'}
              onClick={() => setPendingAction({ kind: 'retire', entry })}
            >
              <Archive size={17} strokeWidth={1.8} />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    ),
    []
  );

  const columns = useMemo<GridColDef<RegistryEntry>[]>(
    () => [
      {
        field: 'registryType',
        headerName: 'Type',
        width: 116,
        renderCell: ({ row }) => <RegistryTypeChip type={row.registryType} />,
      },
      {
        field: 'name',
        headerName: 'Entry',
        minWidth: 200,
        flex: 1,
        renderCell: ({ row }) => (
          <Box sx={{ minWidth: 0, py: 1 }}>
            <Typography variant="body2" fontWeight={700} noWrap>
              {row.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {row.entryKey}
            </Typography>
          </Box>
        ),
      },
      { field: 'ownerRef', headerName: 'Owner', minWidth: 170, flex: 0.8 },
      {
        field: 'artifactVersion',
        headerName: 'Version',
        width: 106,
        renderCell: ({ row }) => `${row.artifactVersion} / r${row.revision}`,
      },
      {
        field: 'riskTier',
        headerName: 'Risk',
        width: 102,
        renderCell: ({ row }) => <RiskChip entry={row} />,
      },
      {
        field: 'lifecycleState',
        headerName: 'State',
        width: 102,
        renderCell: ({ row }) => <LifecycleChip state={row.lifecycleState} />,
      },
      {
        field: 'actions',
        headerName: '',
        width: 108,
        align: 'right',
        sortable: false,
        filterable: false,
        renderCell: ({ row }) => renderActions(row),
      },
    ],
    [renderActions]
  );

  if (registryQuery.isLoading) return <AdminPanelLoading label="Loading product registry" />;
  if (registryQuery.isError) return <AdminPanelError message={errorMessage(registryQuery.error)} />;

  const confirmCopy = pendingAction
    ? pendingAction.kind === 'activate'
      ? {
          title: `Activate ${pendingAction.entry.entryKey}?`,
          message: 'This revision will replace the active revision in the tenant runtime catalog.',
          confirmLabel: 'Activate',
          destructive: false,
        }
      : {
          title:
            pendingAction.entry.lifecycleState === 'DRAFT'
              ? `Discard revision ${pendingAction.entry.revision}?`
              : `Retire ${pendingAction.entry.entryKey}?`,
          message:
            pendingAction.entry.lifecycleState === 'DRAFT'
              ? 'The draft will remain in version history but cannot be edited or activated.'
              : 'This entry will be removed from the tenant runtime catalog.',
          confirmLabel: 'Retire',
          destructive: true,
        }
    : null;

  return (
    <>
      <Box sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'stretch', md: 'center' }}
          justifyContent="space-between"
          gap={1.5}
          sx={{ p: 2 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Boxes size={18} strokeWidth={1.8} aria-hidden="true" />
            <Typography component="h2" variant="subtitle1">
              Product registry
            </Typography>
            <Chip label={entries.length} size="small" variant="outlined" />
          </Box>
          <Stack direction="row" alignItems="center" justifyContent="flex-end" gap={0.5}>
            <Tooltip title="Refresh registry">
              <IconButton
                aria-label="Refresh registry"
                onClick={() => void registryQuery.refetch()}
              >
                <RefreshCw size={18} strokeWidth={1.8} />
              </IconButton>
            </Tooltip>
            <Tooltip title="New registry entry">
              <IconButton
                aria-label="New registry entry"
                onClick={() => setDialog({ mode: 'create' })}
              >
                <Plus size={19} strokeWidth={1.8} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'minmax(220px, 1fr) 160px 140px' },
            gap: 1.5,
            px: 2,
            pb: 2,
          }}
        >
          <TextField
            size="small"
            label="Search registry"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={17} strokeWidth={1.8} aria-hidden="true" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <TextField
            select
            size="small"
            label="Type"
            value={registryType}
            onChange={(event) => setRegistryType(event.target.value as RegistryType | 'ALL')}
          >
            {registryTypes.map((type) => (
              <MenuItem key={type} value={type}>
                {titleCase(type)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="State"
            value={lifecycle}
            onChange={(event) => setLifecycle(event.target.value as ReferenceLifecycle | 'ALL')}
          >
            {lifecycleStates.map((state) => (
              <MenuItem key={state} value={state}>
                {titleCase(state)}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        {desktop && (
          <Box>
            <EnterpriseDataGrid
              ariaLabel="Product registry entries"
              rows={entries}
              columns={columns}
              getRowId={(row) => `${row.registryType}/${row.entryKey}/${row.revision}`}
              height={520}
              rowHeight={56}
              columnHeaderHeight={44}
              hideFooter={entries.length <= 25}
              initialState={{ pagination: { paginationModel: { pageSize: 25, page: 0 } } }}
              slots={{
                noRowsOverlay: () => (
                  <Box sx={{ height: 1, display: 'grid', placeItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      No registry entries
                    </Typography>
                  </Box>
                ),
              }}
              sx={{ border: 0, borderRadius: 0 }}
            />
          </Box>
        )}

        {!desktop && (
          <Box
            component="ol"
            aria-label="Product registry entries"
            sx={{ display: 'grid', listStyle: 'none', p: 0, m: 0 }}
          >
            {entries.length ? (
              entries.map((entry) => (
                <Box
                  component="li"
                  key={`${entry.registryType}/${entry.entryKey}/${entry.revision}`}
                  sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}
                >
                  <Stack
                    direction="row"
                    alignItems="flex-start"
                    justifyContent="space-between"
                    gap={2}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                        <RegistryTypeChip type={entry.registryType} />
                        <LifecycleChip state={entry.lifecycleState} />
                      </Stack>
                      <Typography component="h3" variant="subtitle2" sx={{ mt: 1 }}>
                        {entry.name}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ overflowWrap: 'anywhere' }}
                      >
                        {entry.entryKey}
                      </Typography>
                    </Box>
                    <Box sx={{ minWidth: 108 }}>{renderActions(entry)}</Box>
                  </Stack>
                  <Stack
                    direction="row"
                    alignItems="center"
                    gap={1}
                    flexWrap="wrap"
                    sx={{ mt: 1.5 }}
                  >
                    <RiskChip entry={entry} />
                    <Typography variant="caption" color="text.secondary">
                      {entry.artifactVersion} / r{entry.revision} / {entry.ownerRef}
                    </Typography>
                  </Stack>
                </Box>
              ))
            ) : (
              <Box component="li" sx={{ py: 6, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  No registry entries
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </Box>

      <RegistryDialog
        open={Boolean(dialog)}
        mode={dialog?.mode ?? 'create'}
        value={dialog?.entry}
        busy={busy}
        onClose={() => setDialog(null)}
        onSubmit={saveDialog}
      />

      {confirmCopy && (
        <ConfirmActionDialog
          open
          title={confirmCopy.title}
          message={confirmCopy.message}
          confirmLabel={confirmCopy.confirmLabel}
          destructive={confirmCopy.destructive}
          busy={busy}
          onClose={() => setPendingAction(null)}
          onConfirm={confirmAction}
        />
      )}
    </>
  );
}
