import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Boxes,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createGovernanceResource,
  createGovernanceRole,
  createGroupRoleAssignment,
  getEffectiveAccess,
  listDirectoryGroups,
  listGovernanceResources,
  listGovernanceRoles,
  listGroupRoleAssignments,
  listIdentityRoles,
  listIdentityUsers,
  replaceGovernanceRolePermissions,
  revokeGroupRoleAssignment,
  updateGovernanceRole,
  useToast,
} from '@dwp-frontend/shared-utils';
import { EnterpriseDataGrid, ErrorState, GuidedEmptyState } from '@dwp-frontend/design-system';
import { useDisplayDictionary, useRoleDisplay } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { ManagementPanelLoading } from '../../components/management-panel-state';
import { PrivilegedAccessManager } from './privileged-access-manager';
import { createRoleAssignmentColumns } from './role-assignment-columns';
import { RoleAssignmentSummary } from './role-assignment-summary';
import { RoleAssignmentRevokeDialog } from './role-assignment-revoke-dialog';
import {
  assignmentSourceLabel,
  localizedCodeLabel,
  permissionEffectLabel,
  resourceTypeLabel,
} from './role-governance-display';
import { RoleGovernanceLayout, type RoleGovernanceView } from './role-governance-layout';
import { RoleGovernancePermissionDialog } from './role-governance-permission-dialog';
import { RoleGovernanceResourceDialog } from './role-governance-resource-dialog';
import { RoleGovernanceRoleDialog } from './role-governance-role-dialog';

import type { GridColDef } from '@mui/x-data-grid';
import type {
  EffectiveAccess,
  GovernanceRole,
  GroupRoleAssignment,
} from '@dwp-frontend/shared-utils';

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function RolesPanel() {
  const { t } = useTranslation('admin');
  const displayRole = useRoleDisplay();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [resourceOpen, setResourceOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<GovernanceRole | null>(null);
  const [permissionRole, setPermissionRole] = useState<GovernanceRole | null>(null);
  const [busy, setBusy] = useState(false);
  const roles = useQuery({
    queryKey: ['admin', 'governance', 'roles'],
    queryFn: listGovernanceRoles,
  });
  const resources = useQuery({
    queryKey: ['admin', 'governance', 'resources'],
    queryFn: listGovernanceResources,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'governance'] });

  const mutate = async (action: () => Promise<unknown>, success: string): Promise<boolean> => {
    setBusy(true);
    try {
      await action();
      await refresh();
      toast.success(success);
      return true;
    } catch (error) {
      toast.error(errorMessage(error, t('common.operationError')));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const columns = useMemo<GridColDef<GovernanceRole>[]>(
    () => [
      {
        field: 'name',
        headerName: t('roleGovernance.columns.role'),
        minWidth: 240,
        flex: 1,
        renderCell: ({ row }) => (
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={700} noWrap>
              {displayRole(row.code, row.name, row.description).name}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {row.code} /{' '}
              {t(`roleGovernance.roleTypes.${row.roleType}`, { defaultValue: row.roleType })}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'description',
        headerName: t('roleGovernance.columns.description'),
        minWidth: 260,
        flex: 1.2,
        valueGetter: (_value, row) =>
          displayRole(row.code, row.name, row.description).description ||
          t('roleGovernance.notAvailable'),
      },
      {
        field: 'privileged',
        headerName: t('roleGovernance.columns.risk'),
        width: 120,
        renderCell: ({ row }) => (
          <Chip
            size="small"
            variant="outlined"
            color={row.privileged ? 'warning' : 'default'}
            label={row.privileged ? t('roleGovernance.privileged') : t('roleGovernance.standard')}
          />
        ),
      },
      {
        field: 'permissions',
        headerName: t('roleGovernance.columns.permissions'),
        width: 120,
        valueGetter: (_value, row) => row.permissions.length,
      },
      {
        field: 'status',
        headerName: t('roleGovernance.columns.status'),
        width: 110,
        renderCell: ({ row }) => (
          <Chip
            size="small"
            variant="outlined"
            color={row.status === 'ACTIVE' ? 'success' : 'default'}
            label={t(`common.status.${row.status}`, { defaultValue: row.status })}
          />
        ),
      },
      {
        field: 'actions',
        headerName: t('roleGovernance.columns.actions'),
        width: 112,
        sortable: false,
        renderCell: ({ row }) => {
          const systemManaged = row.roleType === 'SYSTEM';
          const roleName = displayRole(row.code, row.name, row.description).name;
          const permissionLabel = t('roleGovernance.actions.permissionsFor', { role: roleName });
          const editLabel = t('roleGovernance.actions.editRoleFor', { role: roleName });
          const tooltipLabel = (action: string) =>
            systemManaged
              ? t('roleGovernance.actions.systemManagedAction', { action })
              : action;
          return (
            <Stack direction="row">
              <Tooltip title={tooltipLabel(permissionLabel)}>
                <span>
                  <IconButton
                    size="small"
                    disabled={systemManaged}
                    aria-label={permissionLabel}
                    onClick={() => setPermissionRole(row)}
                  >
                    <KeyRound size={16} />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={tooltipLabel(editLabel)}>
                <span>
                  <IconButton
                    size="small"
                    disabled={systemManaged}
                    aria-label={editLabel}
                    onClick={() => {
                      setEditingRole(row);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil size={16} />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          );
        },
      },
    ],
    [displayRole, t]
  );

  if (roles.isLoading || resources.isLoading)
    return <ManagementPanelLoading label={t('roleGovernance.loading')} />;
  if (roles.isError || resources.isError)
    return (
      <ErrorState
        title={t('roleGovernance.errors.rolesTitle')}
        description={t('roleGovernance.errors.rolesDescription')}
        retryLabel={t('roleGovernance.actions.retry')}
        retrying={roles.isFetching || resources.isFetching}
        onRetry={() => void Promise.all([roles.refetch(), resources.refetch()])}
      />
    );
  return (
    <>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        gap={1}
        sx={{ p: 2 }}
      >
        <Stack direction="row" alignItems="center" gap={1}>
          <ShieldCheck size={18} />
          <Typography component="h2" variant="subtitle1">
            {t('roleGovernance.roles')}
          </Typography>
          <Chip label={roles.data?.length ?? 0} size="small" variant="outlined" />
        </Stack>
        <Stack direction="row" justifyContent="flex-end">
          <Tooltip title={t('common.actions.refresh')}>
            <IconButton
              aria-label={t('common.actions.refresh')}
              onClick={() => void Promise.all([roles.refetch(), resources.refetch()])}
            >
              <RefreshCw size={18} />
            </IconButton>
          </Tooltip>
          <Button startIcon={<Boxes size={17} />} onClick={() => setResourceOpen(true)}>
            {t('roleGovernance.actions.newResource')}
          </Button>
          <Button
            startIcon={<Plus size={17} />}
            onClick={() => {
              setEditingRole(null);
              setDialogOpen(true);
            }}
          >
            {t('roleGovernance.actions.newRole')}
          </Button>
        </Stack>
      </Stack>
      <EnterpriseDataGrid
        ariaLabel={t('roleGovernance.roles')}
        rows={roles.data ?? []}
        columns={columns}
        getRowId={(row) => row.roleId}
        hideFooter
        minVisibleRows={3}
        maxVisibleRows={9}
        slots={{
          noRowsOverlay: () => (
            <GuidedEmptyState
              kind="first-use"
              title={t('roleGovernance.empty.rolesTitle')}
              description={t('roleGovernance.empty.rolesDescription')}
              actionLabel={t('roleGovernance.actions.newRole')}
              onAction={() => {
                setEditingRole(null);
                setDialogOpen(true);
              }}
              size="compact"
            />
          ),
        }}
        sx={{ border: 0, borderRadius: 0 }}
      />
      {dialogOpen && (
        <RoleGovernanceRoleDialog
          role={editingRole}
          open
          busy={busy}
          onClose={() => setDialogOpen(false)}
          onSave={async (request) => {
            const saved = await mutate(
              () =>
                editingRole
                  ? updateGovernanceRole(editingRole, request)
                  : createGovernanceRole(request),
              t(
                editingRole
                  ? 'roleGovernance.toasts.roleUpdated'
                  : 'roleGovernance.toasts.roleCreated'
              )
            );
            if (saved) setDialogOpen(false);
          }}
        />
      )}
      {permissionRole && (
        <RoleGovernancePermissionDialog
          role={permissionRole}
          resources={resources.data ?? []}
          busy={busy}
          onClose={() => setPermissionRole(null)}
          onSave={async (selection) => {
            const saved = await mutate(
              () => replaceGovernanceRolePermissions(permissionRole, selection),
              t('roleGovernance.toasts.permissionsUpdated')
            );
            if (saved) setPermissionRole(null);
            return saved;
          }}
        />
      )}
      {resourceOpen && (
        <RoleGovernanceResourceDialog
          open
          busy={busy}
          onClose={() => setResourceOpen(false)}
          onSave={async (request) => {
            const saved = await mutate(
              () => createGovernanceResource(request),
              t('roleGovernance.toasts.resourceCreated')
            );
            if (saved) setResourceOpen(false);
          }}
        />
      )}
    </>
  );
}

function AssignmentDialog({
  open,
  roles,
  busy,
  onClose,
  onSave,
}: {
  open: boolean;
  roles: GovernanceRole[];
  busy: boolean;
  onClose: () => void;
  onSave: (request: {
    groupId: number;
    roleId: number;
    assignmentType: 'ACTIVE';
    scopeType: 'TENANT' | 'ORG_UNIT' | 'RESOURCE';
    scopeRef?: string;
    validTo?: string;
    justification: string;
  }) => Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const displayRole = useRoleDisplay();
  const [groupQuery, setGroupQuery] = useState('');
  const deferredGroupQuery = useDeferredValue(groupQuery);
  const groups = useQuery({
    queryKey: ['admin', 'directory', 'groups', 'assignment', deferredGroupQuery],
    queryFn: () => listDirectoryGroups(deferredGroupQuery, 'ACTIVE', 0, 100),
  });
  const [groupId, setGroupId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [scopeType, setScopeType] = useState<'TENANT' | 'ORG_UNIT' | 'RESOURCE'>('TENANT');
  const [scopeRef, setScopeRef] = useState('');
  const [validTo, setValidTo] = useState('');
  const [justification, setJustification] = useState('');
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('roleGovernance.assignmentDialog.title')}</DialogTitle>
      <DialogContent sx={{ pt: '8px !important' }}>
        <Stack gap={2}>
          <TextField
            label={t('roleGovernance.fields.groupSearch')}
            value={groupQuery}
            onChange={(event) => {
              setGroupQuery(event.target.value);
              setGroupId('');
            }}
          />
          <TextField
            select
            required
            label={t('roleGovernance.fields.group')}
            value={groupId}
            disabled={groups.isLoading || groups.isError}
            error={groups.isError}
            onChange={(event) => setGroupId(event.target.value)}
          >
            {(groups.data?.content ?? []).map((group) => (
              <MenuItem key={group.groupId} value={group.groupId}>
                {group.displayName}
              </MenuItem>
            ))}
          </TextField>
          {groups.isError ? (
            <Alert
              severity="error"
              action={
                <Button
                  color="inherit"
                  size="small"
                  disabled={groups.isFetching}
                  onClick={() => void groups.refetch()}
                >
                  {t('roleGovernance.actions.retryGroups')}
                </Button>
              }
            >
              {t('roleGovernance.errors.groupsDescription')}
            </Alert>
          ) : null}
          <TextField
            select
            required
            label={t('roleGovernance.fields.role')}
            value={roleId}
            onChange={(event) => setRoleId(event.target.value)}
          >
            {roles
              .filter((role) => role.assignableToGroups && role.status === 'ACTIVE')
              .map((role) => (
                <MenuItem key={role.roleId} value={role.roleId}>
                  {displayRole(role.code, role.name, role.description).name} ({role.code})
                </MenuItem>
              ))}
          </TextField>
          <TextField
            select
            fullWidth
            label={t('roleGovernance.fields.scope')}
            value={scopeType}
            onChange={(event) => setScopeType(event.target.value as typeof scopeType)}
          >
            {['TENANT', 'ORG_UNIT', 'RESOURCE'].map((value) => (
              <MenuItem key={value} value={value}>
                {t(`roleGovernance.scopes.${value}`)}
              </MenuItem>
            ))}
          </TextField>
          {scopeType !== 'TENANT' && (
            <TextField
              required
              label={t('roleGovernance.fields.scopeRef')}
              value={scopeRef}
              onChange={(event) => setScopeRef(event.target.value)}
            />
          )}
          <TextField
            type="datetime-local"
            label={t('roleGovernance.fields.validTo')}
            value={validTo}
            onChange={(event) => setValidTo(event.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            required
            multiline
            minRows={2}
            label={t('roleGovernance.fields.justification')}
            value={justification}
            onChange={(event) => setJustification(event.target.value)}
            helperText={t('roleGovernance.assignmentDialog.justificationHelp')}
            slotProps={{ htmlInput: { maxLength: 500 } }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.actions.cancel')}</Button>
        <Button
          variant="contained"
          disabled={
            busy ||
            groups.isLoading ||
            groups.isError ||
            !groupId ||
            !roleId ||
            justification.trim().length < 10 ||
            (scopeType !== 'TENANT' && !scopeRef.trim())
          }
          onClick={() =>
            void onSave({
              groupId: Number(groupId),
              roleId: Number(roleId),
              assignmentType: 'ACTIVE',
              scopeType,
              scopeRef: scopeRef || undefined,
              validTo: validTo ? new Date(validTo).toISOString() : undefined,
              justification: justification.trim(),
            })
          }
        >
          {t('common.actions.create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function AssignmentsPanel() {
  const { t } = useTranslation('admin');
  const display = useDisplayDictionary();
  const displayRole = useRoleDisplay();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingRevoke, setPendingRevoke] = useState<GroupRoleAssignment | null>(null);
  const [busy, setBusy] = useState(false);
  const assignments = useQuery({
    queryKey: ['admin', 'governance', 'assignments'],
    queryFn: listGroupRoleAssignments,
  });
  const roles = useQuery({
    queryKey: ['admin', 'governance', 'roles'],
    queryFn: listGovernanceRoles,
  });
  const assignableRoles = useQuery({
    queryKey: ['admin', 'identity-roles'],
    queryFn: listIdentityRoles,
  });
  const assignableRoleCodes = useMemo(
    () => new Set((assignableRoles.data ?? []).map((role) => role.code)),
    [assignableRoles.data]
  );
  const roleNamesByCode = useMemo(
    () =>
      new Map(
        (roles.data ?? []).map((role) => [
          role.code,
          displayRole(role.code, role.name, role.description).name,
        ])
      ),
    [displayRole, roles.data]
  );
  const mutate = useCallback(
    async (action: () => Promise<unknown>, success: string) => {
      setBusy(true);
      try {
        await action();
        await queryClient.invalidateQueries({ queryKey: ['admin', 'governance'] });
        toast.success(success);
        return true;
      } catch (error) {
        toast.error(errorMessage(error, t('common.operationError')));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [queryClient, t, toast]
  );
  const columns = useMemo(
    () =>
      createRoleAssignmentColumns({
        t,
        display,
        roleNamesByCode,
        assignableRoleCodes,
        busy,
        onRevoke: setPendingRevoke,
      }),
    [assignableRoleCodes, busy, display, roleNamesByCode, t]
  );
  if (assignments.isLoading || roles.isLoading || assignableRoles.isLoading)
    return <ManagementPanelLoading label={t('roleGovernance.loading')} />;
  if (assignments.isError || roles.isError || assignableRoles.isError)
    return (
      <ErrorState
        title={t('roleGovernance.errors.assignmentsTitle')}
        description={t('roleGovernance.errors.assignmentsDescription')}
        retryLabel={t('roleGovernance.actions.retry')}
        retrying={assignments.isFetching || roles.isFetching || assignableRoles.isFetching}
        onRetry={() =>
          void Promise.all([assignments.refetch(), roles.refetch(), assignableRoles.refetch()])
        }
      />
    );
  return (
    <>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2 }}>
        <Stack direction="row" alignItems="flex-start" gap={1}>
          <UsersRound size={18} />
          <Box>
            <Typography variant="subtitle1">{t('roleGovernance.assignments')}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t('roleGovernance.assignmentsDescription')}
            </Typography>
          </Box>
        </Stack>
        <Button startIcon={<Plus size={17} />} onClick={() => setDialogOpen(true)}>
          {t('roleGovernance.actions.newAssignment')}
        </Button>
      </Stack>
      <RoleAssignmentSummary assignments={assignments.data ?? []} />
      <EnterpriseDataGrid
        ariaLabel={t('roleGovernance.assignments')}
        rows={assignments.data ?? []}
        columns={columns}
        getRowId={(row) => row.assignmentId}
        hideFooter
        minVisibleRows={3}
        maxVisibleRows={9}
        stickyColumns={{ right: ['actions'] }}
        toolbar={{
          ariaLabel: t('roleGovernance.assignmentToolbar.label'),
          columnsLabel: t('roleGovernance.assignmentToolbar.columns'),
          filtersLabel: t('roleGovernance.assignmentToolbar.filters'),
          quickFilterLabel: t('roleGovernance.assignmentToolbar.searchLabel'),
          quickFilterPlaceholder: t('roleGovernance.assignmentToolbar.searchPlaceholder'),
          onRefresh: () => void assignments.refetch(),
          refreshLabel: t('roleGovernance.assignmentToolbar.refresh'),
          refreshing: assignments.isFetching,
        }}
        sx={{ border: 0, borderRadius: 0 }}
      />
      {dialogOpen && (
        <AssignmentDialog
          open
          roles={(roles.data ?? []).filter((role) => assignableRoleCodes.has(role.code))}
          busy={busy}
          onClose={() => setDialogOpen(false)}
          onSave={async (request) => {
            const saved = await mutate(
              () => createGroupRoleAssignment(request),
              t('roleGovernance.toasts.assignmentCreated')
            );
            if (saved) setDialogOpen(false);
          }}
        />
      )}
      <RoleAssignmentRevokeDialog
        assignment={pendingRevoke}
        roleName={
          pendingRevoke
            ? (roleNamesByCode.get(pendingRevoke.roleCode) ?? pendingRevoke.roleCode)
            : ''
        }
        busy={busy}
        onClose={() => setPendingRevoke(null)}
        onConfirm={async () => {
          if (!pendingRevoke) return;
          const revoked = await mutate(
            () => revokeGroupRoleAssignment(pendingRevoke),
            t('roleGovernance.toasts.assignmentRevoked')
          );
          if (revoked) setPendingRevoke(null);
        }}
      />
    </>
  );
}

function EffectiveAccessPanel() {
  const { t } = useTranslation('admin');
  const [userQuery, setUserQuery] = useState('');
  const deferredUserQuery = useDeferredValue(userQuery);
  const users = useQuery({
    queryKey: ['admin', 'identity-users', 'effective-access', deferredUserQuery],
    queryFn: () => listIdentityUsers(deferredUserQuery),
  });
  const [userId, setUserId] = useState('');
  const access = useQuery({
    queryKey: ['admin', 'governance', 'effective-access', userId],
    queryFn: () => getEffectiveAccess(Number(userId)),
    enabled: Boolean(userId),
  });
  const roleColumns = useMemo<GridColDef<EffectiveAccess['roles'][number]>[]>(
    () => [
      { field: 'roleCode', headerName: t('roleGovernance.columns.role'), minWidth: 180, flex: 1 },
      {
        field: 'source',
        headerName: t('roleGovernance.columns.source'),
        width: 160,
        renderCell: ({ row }) => (
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" noWrap>
              {assignmentSourceLabel(row.source, t)}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" noWrap>
              {row.source}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'sourceGroupName',
        headerName: t('roleGovernance.columns.group'),
        minWidth: 180,
        flex: 0.8,
        valueGetter: (_value, row) => row.sourceGroupName || t('roleGovernance.direct'),
      },
      {
        field: 'scopeType',
        headerName: t('roleGovernance.columns.scope'),
        minWidth: 180,
        flex: 0.8,
        valueGetter: (_value, row) =>
          [row.scopeType, row.scopeRef].filter(Boolean).join(' / ') ||
          t('roleGovernance.tenantWide'),
      },
    ],
    [t]
  );
  const permissionColumns = useMemo<GridColDef<EffectiveAccess['permissions'][number]>[]>(
    () => [
      {
        field: 'resourceKey',
        headerName: t('roleGovernance.columns.resource'),
        minWidth: 260,
        flex: 1,
        renderCell: ({ row }) => (
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" noWrap>
              {row.resourceKey}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" noWrap>
              {localizedCodeLabel(resourceTypeLabel(row.resourceType, t), row.resourceType)}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'permissionCode',
        headerName: t('roleGovernance.columns.permission'),
        width: 150,
        renderCell: ({ row }) => (
          <Typography variant="body2">
            {localizedCodeLabel(
              t(`roleGovernance.permissionCodes.${row.permissionCode}`, {
                defaultValue: row.permissionCode,
              }),
              row.permissionCode
            )}
          </Typography>
        ),
      },
      {
        field: 'effect',
        headerName: t('roleGovernance.columns.effect'),
        width: 130,
        renderCell: ({ row }) => (
          <Stack alignItems="flex-start" justifyContent="center" sx={{ height: 1 }}>
            <Chip
              size="small"
              variant="outlined"
              color={row.effect === 'ALLOW' ? 'success' : 'error'}
              label={permissionEffectLabel(row.effect, t)}
            />
            <Typography variant="caption" color="text.secondary">
              {row.effect}
            </Typography>
          </Stack>
        ),
      },
      {
        field: 'grantedByRoles',
        headerName: t('roleGovernance.columns.sourceRoles'),
        minWidth: 220,
        flex: 0.8,
        valueGetter: (_value, row) => row.grantedByRoles.join(', '),
      },
    ],
    [t]
  );
  if (users.isLoading) return <ManagementPanelLoading label={t('roleGovernance.loading')} />;
  if (users.isError)
    return (
      <ErrorState
        title={t('roleGovernance.errors.usersTitle')}
        description={t('roleGovernance.errors.usersDescription')}
        retryLabel={t('roleGovernance.actions.retry')}
        retrying={users.isFetching}
        onRetry={() => void users.refetch()}
      />
    );
  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        gap={2}
        sx={{ p: 2 }}
      >
        <Stack direction="row" alignItems="center" gap={1} sx={{ flex: 1 }}>
          <UserRoundCheck size={18} />
          <Typography variant="subtitle1">{t('roleGovernance.effectiveAccess')}</Typography>
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} sx={{ minWidth: { sm: 420 } }}>
          <TextField
            size="small"
            label={t('roleGovernance.fields.userSearch')}
            value={userQuery}
            onChange={(event) => {
              setUserQuery(event.target.value);
              setUserId('');
            }}
            sx={{ minWidth: 180 }}
          />
          <TextField
            select
            size="small"
            label={t('roleGovernance.fields.user')}
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            sx={{ minWidth: 230 }}
          >
            {(users.data?.content ?? []).map((user) => (
              <MenuItem key={user.userId} value={user.userId}>
                {user.displayName} / {user.email}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Stack>
      {!userId ? (
        <GuidedEmptyState
          kind="first-use"
          title={t('roleGovernance.empty.effectiveTitle')}
          description={t('roleGovernance.empty.effectiveDescription')}
          size="compact"
        />
      ) : null}
      {access.isLoading && <ManagementPanelLoading label={t('roleGovernance.effectiveLoading')} />}
      {access.isError && (
        <ErrorState
          title={t('roleGovernance.errors.effectiveTitle')}
          description={t('roleGovernance.errors.effectiveDescription')}
          retryLabel={t('roleGovernance.actions.retry')}
          retrying={access.isFetching}
          onRetry={() => void access.refetch()}
          size="compact"
        />
      )}
      {access.data && (
        <>
          <Box sx={{ px: 2, pb: 1.5 }}>
            <Typography variant="body2" fontWeight={700}>
              {access.data.displayName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('roleGovernance.accessRevision', { revision: access.data.accessRevision })}
            </Typography>
          </Box>
          <EnterpriseDataGrid
            ariaLabel={t('roleGovernance.effectiveRoles')}
            rows={access.data.roles}
            columns={roleColumns}
            getRowId={(row) => `${row.roleId}:${row.source}:${row.sourceGroupId ?? 'direct'}`}
            hideFooter
            minVisibleRows={2}
            maxVisibleRows={5}
            sx={{ border: 0, borderRadius: 0, borderTop: 1, borderColor: 'divider' }}
          />
          <EnterpriseDataGrid
            ariaLabel={t('roleGovernance.effectivePermissions')}
            rows={access.data.permissions}
            columns={permissionColumns}
            getRowId={(row) => `${row.resourceKey}:${row.permissionCode}`}
            hideFooter
            minVisibleRows={2}
            maxVisibleRows={7}
            sx={{ border: 0, borderRadius: 0, borderTop: 1, borderColor: 'divider' }}
          />
        </>
      )}
    </Box>
  );
}

export function RoleGovernanceManager() {
  const [tab, setTab] = useState<RoleGovernanceView>('roles');
  return (
    <RoleGovernanceLayout view={tab} onChange={setTab}>
      {tab === 'roles' && <RolesPanel />}
      {tab === 'assignments' && <AssignmentsPanel />}
      {tab === 'privileged' && <PrivilegedAccessManager />}
      {tab === 'effective' && <EffectiveAccessPanel />}
    </RoleGovernanceLayout>
  );
}
