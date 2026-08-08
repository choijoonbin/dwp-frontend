import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  Pencil,
  Network,
  Power,
  Search,
  Plus,
  RefreshCw,
  PowerOff,
  Building2,
  ChevronLeft,
  ChevronRight,
  UsersRound,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useToast,
  getDirectoryGroup,
  listDirectoryUsers,
  listDirectoryGroups,
  createDirectoryGroup,
  updateDirectoryGroup,
  getOrganizationUnit,
  listOrganizationUnits,
  createOrganizationUnit,
  updateOrganizationUnit,
  changeDirectoryGroupStatus,
  replaceDirectoryGroupMembers,
  changeOrganizationUnitStatus,
  replaceOrganizationUnitMembers,
} from '@dwp-frontend/shared-utils';
import { EnterpriseDataGrid } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import { useTheme } from '@mui/material/styles';
import InputAdornment from '@mui/material/InputAdornment';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import useMediaQuery from '@mui/material/useMediaQuery';

import { AdminPanelError, AdminPanelLoading } from './admin-ui';
import { ConfirmActionDialog } from './reference-dialogs';
import {
  GroupDialog,
  OrganizationDialog,
  DirectoryMemberDialog,
  type MemberDialogTarget,
} from './directory-dialogs';

import type { GridColDef } from '@mui/x-data-grid';
import type {
  DirectoryGroup,
  DirectoryGroupDetail,
  DirectoryStatus,
  OrganizationUnit,
  OrganizationUnitDetail,
  CreateDirectoryGroupRequest,
  CreateOrganizationUnitRequest,
  UpdateDirectoryGroupRequest,
  UpdateOrganizationUnitRequest,
} from '@dwp-frontend/shared-utils';

type DirectoryMode = 'organizations' | 'groups';
type OrganizationDialogState = 'create' | OrganizationUnit | null;
type GroupDialogState = 'create' | DirectoryGroup | null;
type LifecycleTarget =
  | { kind: 'organization'; value: OrganizationUnit; nextStatus: DirectoryStatus }
  | { kind: 'group'; value: DirectoryGroup; nextStatus: DirectoryStatus }
  | null;

const PAGE_SIZE = 50;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The operation could not be completed.';
}

function displayStatus(status: DirectoryStatus) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function StatusChip({ status }: { status: DirectoryStatus }) {
  return (
    <Chip
      label={displayStatus(status)}
      size="small"
      color={status === 'ACTIVE' ? 'success' : 'default'}
      variant={status === 'ACTIVE' ? 'filled' : 'outlined'}
    />
  );
}

function SourceChip({ source }: { source: string }) {
  return (
    <Chip
      label={source === 'SCIM' ? 'SCIM managed' : 'Local'}
      size="small"
      color={source === 'SCIM' ? 'info' : 'default'}
      variant="outlined"
    />
  );
}

export function DirectoryManager() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('sm'));
  const [mode, setMode] = useState<DirectoryMode>('organizations');
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [status, setStatus] = useState<DirectoryStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(0);
  const [organizationDialog, setOrganizationDialog] = useState<OrganizationDialogState>(null);
  const [parentSearch, setParentSearch] = useState('');
  const deferredParentSearch = useDeferredValue(parentSearch);
  const [groupDialog, setGroupDialog] = useState<GroupDialogState>(null);
  const [memberTarget, setMemberTarget] = useState<MemberDialogTarget | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const deferredMemberSearch = useDeferredValue(memberSearch);
  const [lifecycleTarget, setLifecycleTarget] = useState<LifecycleTarget>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setPage(0), [deferredQuery, status]);

  const organizationsQuery = useQuery({
    queryKey: ['admin', 'directory', 'organizations', deferredQuery, status, page],
    queryFn: () => listOrganizationUnits(deferredQuery, status, page, PAGE_SIZE),
    enabled: mode === 'organizations' || Boolean(organizationDialog),
  });
  const groupsQuery = useQuery({
    queryKey: ['admin', 'directory', 'groups', deferredQuery, status, page],
    queryFn: () => listDirectoryGroups(deferredQuery, status, page, PAGE_SIZE),
    enabled: mode === 'groups',
  });
  const parentOrganizationsQuery = useQuery({
    queryKey: ['admin', 'directory', 'parent-organizations', deferredParentSearch],
    queryFn: () => listOrganizationUnits(deferredParentSearch, 'ACTIVE', 0, 100),
    enabled: Boolean(organizationDialog),
  });
  const memberDetailQuery = useQuery<OrganizationUnitDetail | DirectoryGroupDetail>({
    queryKey: [
      'admin',
      'directory',
      'member-detail',
      memberTarget?.kind,
      memberTarget?.kind === 'organization'
        ? memberTarget.value.orgUnitId
        : memberTarget?.value.groupId,
    ],
    queryFn: () => {
      if (!memberTarget) throw new Error('Member target is required.');
      return memberTarget.kind === 'organization'
        ? getOrganizationUnit(memberTarget.value.orgUnitId)
        : getDirectoryGroup(memberTarget.value.groupId);
    },
    enabled: Boolean(memberTarget),
  });
  const memberCandidatesQuery = useQuery({
    queryKey: ['admin', 'directory', 'users', deferredMemberSearch],
    queryFn: () => listDirectoryUsers(deferredMemberSearch),
    enabled: Boolean(memberTarget),
  });

  const organizations = useMemo(
    () => organizationsQuery.data?.content ?? [],
    [organizationsQuery.data]
  );
  const groups = useMemo(() => groupsQuery.data?.content ?? [], [groupsQuery.data]);
  const parentOrganizations = useMemo(
    () => parentOrganizationsQuery.data?.content ?? [],
    [parentOrganizationsQuery.data]
  );
  const memberDetail = memberDetailQuery.data;
  const members = memberDetail?.members ?? [];
  const memberCandidates = memberCandidatesQuery.data?.content ?? [];
  const activeQuery = mode === 'organizations' ? organizationsQuery : groupsQuery;
  const totalElements = activeQuery.data?.totalElements ?? 0;
  const totalPages = activeQuery.data?.totalPages ?? 0;

  const invalidateDirectory = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'directory'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'identity-users'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit-events'] }),
    ]);
  };

  const run = async (operation: () => Promise<unknown>, successMessage: string) => {
    setBusy(true);
    try {
      await operation();
      await invalidateDirectory();
      toast.success(successMessage);
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const createOrganization = async (request: CreateOrganizationUnitRequest) => {
    if (await run(() => createOrganizationUnit(request), 'Organization created.')) {
      setOrganizationDialog(null);
    }
  };

  const updateOrganization = async (request: UpdateOrganizationUnitRequest) => {
    if (typeof organizationDialog !== 'object' || !organizationDialog) return;
    if (
      await run(
        () => updateOrganizationUnit(organizationDialog.orgUnitId, request),
        'Organization updated.'
      )
    ) {
      setOrganizationDialog(null);
    }
  };

  const createGroup = async (request: CreateDirectoryGroupRequest) => {
    if (await run(() => createDirectoryGroup(request), 'Group created.')) {
      setGroupDialog(null);
    }
  };

  const updateGroup = async (request: UpdateDirectoryGroupRequest) => {
    if (typeof groupDialog !== 'object' || !groupDialog) return;
    if (await run(() => updateDirectoryGroup(groupDialog.groupId, request), 'Group updated.')) {
      setGroupDialog(null);
    }
  };

  const saveMembers = async (userIds: number[]) => {
    if (!memberTarget || !memberDetail) return;
    const completed =
      memberTarget.kind === 'organization' && 'organization' in memberDetail
        ? await run(
            () => replaceOrganizationUnitMembers(memberDetail.organization, userIds),
            'Organization members updated and affected sessions revoked.'
          )
        : memberTarget.kind === 'group' && 'group' in memberDetail
          ? await run(
              () => replaceDirectoryGroupMembers(memberDetail.group, userIds),
              'Group members updated and affected sessions revoked.'
            )
          : false;
    if (completed) {
      setMemberTarget(null);
      setMemberSearch('');
    }
  };

  const confirmLifecycle = async () => {
    if (!lifecycleTarget) return;
    const activating = lifecycleTarget.nextStatus === 'ACTIVE';
    const completed =
      lifecycleTarget.kind === 'organization'
        ? await run(
            () => changeOrganizationUnitStatus(lifecycleTarget.value, lifecycleTarget.nextStatus),
            activating ? 'Organization activated.' : 'Organization deactivated.'
          )
        : await run(
            () => changeDirectoryGroupStatus(lifecycleTarget.value, lifecycleTarget.nextStatus),
            activating ? 'Group activated.' : 'Group deactivated.'
          );
    if (completed) setLifecycleTarget(null);
  };

  const organizationActions = useCallback((organization: OrganizationUnit) => {
    const readOnly = organization.sourceType !== 'LOCAL';
    const active = organization.status === 'ACTIVE';
    return (
      <Stack direction="row" justifyContent="flex-end" sx={{ width: 1 }}>
        <Tooltip title={readOnly ? 'Managed by SCIM' : 'Edit organization'}>
          <span>
            <IconButton
              size="small"
              aria-label={`Edit ${organization.name}`}
              disabled={readOnly}
              onClick={() => {
                setParentSearch('');
                setOrganizationDialog(organization);
              }}
            >
              <Pencil size={17} strokeWidth={1.8} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={readOnly ? 'Managed by SCIM' : 'Manage members'}>
          <span>
            <IconButton
              size="small"
              aria-label={`Manage members for ${organization.name}`}
              disabled={readOnly || !active}
              onClick={() => {
                setMemberSearch('');
                setMemberTarget({ kind: 'organization', value: organization });
              }}
            >
              <UsersRound size={17} strokeWidth={1.8} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={readOnly ? 'Managed by SCIM' : active ? 'Deactivate' : 'Activate'}>
          <span>
            <IconButton
              size="small"
              color={active ? 'default' : 'success'}
              aria-label={`${active ? 'Deactivate' : 'Activate'} ${organization.name}`}
              disabled={readOnly}
              onClick={() =>
                setLifecycleTarget({
                  kind: 'organization',
                  value: organization,
                  nextStatus: active ? 'INACTIVE' : 'ACTIVE',
                })
              }
            >
              {active ? (
                <PowerOff size={17} strokeWidth={1.8} />
              ) : (
                <Power size={17} strokeWidth={1.8} />
              )}
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    );
  }, []);

  const groupActions = useCallback((group: DirectoryGroup) => {
    const readOnly = group.sourceType !== 'LOCAL';
    const active = group.status === 'ACTIVE';
    return (
      <Stack direction="row" justifyContent="flex-end" sx={{ width: 1 }}>
        <Tooltip title={readOnly ? 'Managed by SCIM' : 'Edit group'}>
          <span>
            <IconButton
              size="small"
              aria-label={`Edit ${group.displayName}`}
              disabled={readOnly}
              onClick={() => setGroupDialog(group)}
            >
              <Pencil size={17} strokeWidth={1.8} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={readOnly ? 'Managed by SCIM' : 'Manage members'}>
          <span>
            <IconButton
              size="small"
              aria-label={`Manage members for ${group.displayName}`}
              disabled={readOnly || !active}
              onClick={() => {
                setMemberSearch('');
                setMemberTarget({ kind: 'group', value: group });
              }}
            >
              <UsersRound size={17} strokeWidth={1.8} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={readOnly ? 'Managed by SCIM' : active ? 'Deactivate' : 'Activate'}>
          <span>
            <IconButton
              size="small"
              color={active ? 'default' : 'success'}
              aria-label={`${active ? 'Deactivate' : 'Activate'} ${group.displayName}`}
              disabled={readOnly}
              onClick={() =>
                setLifecycleTarget({
                  kind: 'group',
                  value: group,
                  nextStatus: active ? 'INACTIVE' : 'ACTIVE',
                })
              }
            >
              {active ? (
                <PowerOff size={17} strokeWidth={1.8} />
              ) : (
                <Power size={17} strokeWidth={1.8} />
              )}
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    );
  }, []);

  const organizationColumns = useMemo<GridColDef<OrganizationUnit>[]>(
    () => [
      {
        field: 'name',
        headerName: 'Organization',
        minWidth: 240,
        flex: 1.2,
        renderCell: ({ row }) => (
          <Stack direction="row" alignItems="center" gap={1.25} sx={{ minWidth: 0 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                flex: '0 0 auto',
                display: 'grid',
                placeItems: 'center',
                bgcolor: 'action.hover',
                borderRadius: 1,
              }}
            >
              <Building2 size={17} strokeWidth={1.8} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={700} noWrap>
                {row.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap display="block">
                {row.orgKey}
              </Typography>
            </Box>
          </Stack>
        ),
      },
      {
        field: 'parentName',
        headerName: 'Parent',
        minWidth: 150,
        flex: 0.7,
        renderCell: ({ row }) => row.parentName || 'Top level',
      },
      { field: 'memberCount', headerName: 'Members', width: 94, type: 'number' },
      {
        field: 'sourceType',
        headerName: 'Source',
        width: 126,
        renderCell: ({ row }) => <SourceChip source={row.sourceType} />,
      },
      {
        field: 'status',
        headerName: 'Status',
        width: 104,
        renderCell: ({ row }) => <StatusChip status={row.status} />,
      },
      { field: 'revision', headerName: 'Revision', width: 88, type: 'number' },
      {
        field: 'actions',
        headerName: 'Actions',
        width: 124,
        sortable: false,
        filterable: false,
        align: 'right',
        renderCell: ({ row }) => organizationActions(row),
      },
    ],
    [organizationActions]
  );

  const groupColumns = useMemo<GridColDef<DirectoryGroup>[]>(
    () => [
      {
        field: 'displayName',
        headerName: 'Group',
        minWidth: 260,
        flex: 1.3,
        renderCell: ({ row }) => (
          <Stack direction="row" alignItems="center" gap={1.25} sx={{ minWidth: 0 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                flex: '0 0 auto',
                display: 'grid',
                placeItems: 'center',
                bgcolor: 'action.hover',
                borderRadius: 1,
              }}
            >
              <UsersRound size={17} strokeWidth={1.8} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={700} noWrap>
                {row.displayName}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap display="block">
                {row.groupKey}
              </Typography>
            </Box>
          </Stack>
        ),
      },
      { field: 'memberCount', headerName: 'Members', width: 104, type: 'number' },
      {
        field: 'sourceType',
        headerName: 'Source',
        width: 126,
        renderCell: ({ row }) => <SourceChip source={row.sourceType} />,
      },
      {
        field: 'status',
        headerName: 'Status',
        width: 104,
        renderCell: ({ row }) => <StatusChip status={row.status} />,
      },
      { field: 'revision', headerName: 'Revision', width: 88, type: 'number' },
      {
        field: 'actions',
        headerName: 'Actions',
        width: 124,
        sortable: false,
        filterable: false,
        align: 'right',
        renderCell: ({ row }) => groupActions(row),
      },
    ],
    [groupActions]
  );

  if (activeQuery.isLoading) return <AdminPanelLoading label="Loading directory" />;
  if (activeQuery.isError) return <AdminPanelError message={errorMessage(activeQuery.error)} />;

  const lifecycleCopy = lifecycleTarget
    ? {
        subject:
          lifecycleTarget.kind === 'organization'
            ? lifecycleTarget.value.name
            : lifecycleTarget.value.displayName,
        activating: lifecycleTarget.nextStatus === 'ACTIVE',
        kind: lifecycleTarget.kind === 'organization' ? 'organization' : 'group',
      }
    : null;

  const changeMode = (_event: React.MouseEvent<HTMLElement>, value: DirectoryMode | null) => {
    if (!value) return;
    setMode(value);
    setPage(0);
    setQuery('');
    setStatus('ALL');
  };

  const newEntry = () => {
    if (mode === 'organizations') {
      setParentSearch('');
      setOrganizationDialog('create');
    } else setGroupDialog('create');
  };

  const rows = mode === 'organizations' ? organizations : groups;

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
          <Stack direction="row" alignItems="center" gap={1.25}>
            <Network size={18} strokeWidth={1.8} aria-hidden="true" />
            <Typography component="h2" variant="subtitle1">
              Directory
            </Typography>
            <Chip label={totalElements} size="small" variant="outlined" />
            <ToggleButtonGroup
              exclusive
              size="small"
              value={mode}
              onChange={changeMode}
              aria-label="Directory type"
            >
              <ToggleButton value="organizations">Organizations</ToggleButton>
              <ToggleButton value="groups">Groups</ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems="stretch" gap={1}>
            <TextField
              size="small"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              label={mode === 'organizations' ? 'Search organizations' : 'Search groups'}
              sx={{ width: { xs: 1, sm: 260 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={17} strokeWidth={1.8} />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              select
              size="small"
              label="Status"
              value={status}
              onChange={(event) => setStatus(event.target.value as DirectoryStatus | 'ALL')}
              sx={{ minWidth: 120 }}
            >
              <MenuItem value="ALL">All</MenuItem>
              <MenuItem value="ACTIVE">Active</MenuItem>
              <MenuItem value="INACTIVE">Inactive</MenuItem>
            </TextField>
            <Stack direction="row" alignItems="center" gap={0.5}>
              <Button
                variant="contained"
                startIcon={<Plus size={17} />}
                onClick={newEntry}
                sx={{ flex: { xs: 1, sm: '0 0 auto' } }}
              >
                {mode === 'organizations' ? 'New organization' : 'New group'}
              </Button>
              <Tooltip title="Refresh directory">
                <IconButton
                  aria-label="Refresh directory"
                  onClick={() => void activeQuery.refetch()}
                >
                  <RefreshCw size={18} strokeWidth={1.8} />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </Stack>

        {desktop && mode === 'organizations' && (
          <EnterpriseDataGrid
            ariaLabel="Organizations"
            rows={organizations}
            columns={organizationColumns}
            getRowId={(row) => row.orgUnitId}
            height={552}
            rowHeight={64}
            columnHeaderHeight={44}
            paginationMode="server"
            rowCount={totalElements}
            paginationModel={{ page, pageSize: PAGE_SIZE }}
            onPaginationModelChange={(model) => setPage(model.page)}
            pageSizeOptions={[PAGE_SIZE]}
            slots={{
              noRowsOverlay: () => (
                <Box sx={{ height: 1, display: 'grid', placeItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No organizations found
                  </Typography>
                </Box>
              ),
            }}
            sx={{ border: 0, borderRadius: 0 }}
          />
        )}

        {desktop && mode === 'groups' && (
          <EnterpriseDataGrid
            ariaLabel="Directory groups"
            rows={groups}
            columns={groupColumns}
            getRowId={(row) => row.groupId}
            height={552}
            rowHeight={64}
            columnHeaderHeight={44}
            paginationMode="server"
            rowCount={totalElements}
            paginationModel={{ page, pageSize: PAGE_SIZE }}
            onPaginationModelChange={(model) => setPage(model.page)}
            pageSizeOptions={[PAGE_SIZE]}
            slots={{
              noRowsOverlay: () => (
                <Box sx={{ height: 1, display: 'grid', placeItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No groups found
                  </Typography>
                </Box>
              ),
            }}
            sx={{ border: 0, borderRadius: 0 }}
          />
        )}

        {!desktop && (
          <Box
            component="ul"
            aria-label={mode === 'organizations' ? 'Organizations' : 'Directory groups'}
            sx={{ display: 'grid', listStyle: 'none', p: 0, m: 0 }}
          >
            {rows.length ? (
              rows.map((row) => {
                const organization = mode === 'organizations' ? (row as OrganizationUnit) : null;
                const group = mode === 'groups' ? (row as DirectoryGroup) : null;
                const name = organization?.name ?? group!.displayName;
                const key = organization?.orgKey ?? group!.groupKey;
                const memberCount = organization?.memberCount ?? group!.memberCount;
                return (
                  <Box
                    component="li"
                    key={`${mode}-${organization?.orgUnitId ?? group!.groupId}`}
                    sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}
                  >
                    <Stack
                      direction="row"
                      alignItems="flex-start"
                      justifyContent="space-between"
                      gap={1}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography component="h3" variant="subtitle2" noWrap>
                          {name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap display="block">
                          {key}
                          {organization ? ` / ${organization.parentName || 'Top level'}` : ''}
                        </Typography>
                      </Box>
                      {organization ? organizationActions(organization) : groupActions(group!)}
                    </Stack>
                    <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 1.25 }}>
                      <StatusChip status={(organization ?? group!).status} />
                      <SourceChip source={(organization ?? group!).sourceType} />
                      <Chip label={`${memberCount} members`} size="small" variant="outlined" />
                      <Chip
                        label={`Rev ${(organization ?? group!).revision}`}
                        size="small"
                        variant="outlined"
                      />
                    </Stack>
                  </Box>
                );
              })
            ) : (
              <Box component="li" sx={{ py: 6, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {mode === 'organizations' ? 'No organizations found' : 'No groups found'}
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {!desktop && totalPages > 1 && (
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ px: 2, py: 1.25, borderTop: 1, borderColor: 'divider' }}
          >
            <IconButton
              aria-label="Previous page"
              disabled={page === 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              <ChevronLeft size={18} />
            </IconButton>
            <Typography variant="caption" color="text.secondary">
              Page {page + 1} of {totalPages}
            </Typography>
            <IconButton
              aria-label="Next page"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              <ChevronRight size={18} />
            </IconButton>
          </Stack>
        )}
      </Box>

      <OrganizationDialog
        open={Boolean(organizationDialog)}
        value={typeof organizationDialog === 'object' ? organizationDialog : null}
        organizations={parentOrganizations}
        parentLoading={parentOrganizationsQuery.isLoading}
        busy={busy}
        onParentSearch={setParentSearch}
        onClose={() => {
          setOrganizationDialog(null);
          setParentSearch('');
        }}
        onCreate={createOrganization}
        onUpdate={updateOrganization}
      />
      <GroupDialog
        open={Boolean(groupDialog)}
        value={typeof groupDialog === 'object' ? groupDialog : null}
        busy={busy}
        onClose={() => setGroupDialog(null)}
        onCreate={createGroup}
        onUpdate={updateGroup}
      />
      <DirectoryMemberDialog
        target={memberTarget}
        members={members}
        candidates={memberCandidates}
        loading={memberDetailQuery.isLoading || memberCandidatesQuery.isLoading}
        busy={busy}
        search={memberSearch}
        onSearch={setMemberSearch}
        onClose={() => {
          setMemberTarget(null);
          setMemberSearch('');
        }}
        onSave={saveMembers}
      />
      <ConfirmActionDialog
        open={Boolean(lifecycleTarget)}
        title={
          lifecycleCopy
            ? `${lifecycleCopy.activating ? 'Activate' : 'Deactivate'} ${lifecycleCopy.subject}?`
            : ''
        }
        message={
          lifecycleCopy?.activating
            ? `This ${lifecycleCopy.kind} will become available for assignments.`
            : `This ${lifecycleCopy?.kind ?? 'entry'} must have no active dependants or members.`
        }
        confirmLabel={lifecycleCopy?.activating ? 'Activate' : 'Deactivate'}
        destructive={!lifecycleCopy?.activating}
        busy={busy}
        onClose={() => setLifecycleTarget(null)}
        onConfirm={confirmLifecycle}
      />
    </>
  );
}
