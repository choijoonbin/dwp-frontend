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
import { EnterpriseDataGrid } from '@dwp-frontend/design-system';
import { useDisplayDictionary, useRoleDisplay } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
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

import {
  ManagementPanelError,
  ManagementPanelLoading,
} from '../../components/management-panel-state';
import { PrivilegedAccessManager } from './privileged-access-manager';
import { createRoleAssignmentColumns } from './role-assignment-columns';
import { RoleAssignmentSummary } from './role-assignment-summary';
import { RoleAssignmentRevokeDialog } from './role-assignment-revoke-dialog';
import { RoleGovernanceLayout, type RoleGovernanceView } from './role-governance-layout';
import { RoleGovernanceRoleDialog } from './role-governance-role-dialog';

import type { GridColDef } from '@mui/x-data-grid';
import type {
  EffectiveAccess,
  GovernanceResource,
  GovernanceRole,
  GroupRoleAssignment,
  PermissionEffect,
  PermissionSelection,
} from '@dwp-frontend/shared-utils';

const PERMISSION_CODES = ['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'MANAGE'] as const;

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function PermissionDialog({
  role,
  resources,
  busy,
  onClose,
  onSave,
}: {
  role: GovernanceRole | null;
  resources: GovernanceResource[];
  busy: boolean;
  onClose: () => void;
  onSave: (permissions: PermissionSelection[]) => Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const displayRole = useRoleDisplay();
  const roleDisplay = role ? displayRole(role.code, role.name, role.description) : null;
  const initial = useMemo(
    () =>
      new Map(
        (role?.permissions ?? []).map((item) => [
          `${item.resourceId}:${item.permissionCode}`,
          item.effect,
        ])
      ),
    [role]
  );
  const [selection, setSelection] = useState<Map<string, PermissionEffect>>(initial);

  const setGrant = (resourceId: number, permissionCode: string, value: string) => {
    setSelection((current) => {
      const next = new Map(current);
      const key = `${resourceId}:${permissionCode}`;
      if (!value) next.delete(key);
      else next.set(key, value as PermissionEffect);
      return next;
    });
  };

  return (
    <Dialog open={Boolean(role)} onClose={busy ? undefined : onClose} fullWidth maxWidth="lg">
      <DialogTitle>
        {t('roleGovernance.permissionDialog.title', { role: roleDisplay?.name })}
      </DialogTitle>
      <DialogContent sx={{ pt: '8px !important' }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('roleGovernance.permissionDialog.description')}
        </Typography>
        <Box sx={{ overflowX: 'auto', borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
          <Box
            component="table"
            sx={{
              width: 1,
              minWidth: 760,
              borderCollapse: 'collapse',
              '& th, & td': {
                px: 1.25,
                py: 1,
                borderBottom: 1,
                borderColor: 'divider',
                textAlign: 'left',
              },
            }}
          >
            <Box component="thead">
              <Box component="tr">
                <Box component="th">
                  <Typography variant="caption">{t('roleGovernance.columns.resource')}</Typography>
                </Box>
                {PERMISSION_CODES.map((code) => (
                  <Box component="th" key={code}>
                    <Typography variant="caption">{code}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
            <Box component="tbody">
              {resources.map((resource) => (
                <Box component="tr" key={resource.resourceId}>
                  <Box component="td">
                    <Typography variant="body2" fontWeight={700}>
                      {resource.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {resource.type} / {resource.key}
                    </Typography>
                  </Box>
                  {PERMISSION_CODES.map((code) => (
                    <Box component="td" key={code}>
                      <TextField
                        select
                        size="small"
                        value={selection.get(`${resource.resourceId}:${code}`) ?? ''}
                        onChange={(event) =>
                          setGrant(resource.resourceId, code, event.target.value)
                        }
                        inputProps={{
                          'aria-label': t('roleGovernance.permissionDialog.grantLabel', {
                            resource: resource.name,
                            permission: code,
                          }),
                        }}
                        sx={{ width: 92 }}
                      >
                        <MenuItem value="">{t('roleGovernance.effects.NONE')}</MenuItem>
                        <MenuItem value="ALLOW">{t('roleGovernance.effects.ALLOW')}</MenuItem>
                        <MenuItem value="DENY">{t('roleGovernance.effects.DENY')}</MenuItem>
                      </TextField>
                    </Box>
                  ))}
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {t('common.actions.cancel')}
        </Button>
        <Button
          variant="contained"
          disabled={busy}
          onClick={() =>
            void onSave(
              [...selection.entries()].map(([key, effect]) => {
                const [resourceId, permissionCode] = key.split(':');
                return { resourceId: Number(resourceId), permissionCode, effect };
              })
            )
          }
        >
          {t('roleGovernance.actions.savePermissions')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ResourceDialog({
  open,
  busy,
  onClose,
  onSave,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (request: { type: string; key: string; name: string }) => Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const [type, setType] = useState('APP');
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('roleGovernance.resourceDialog.title')}</DialogTitle>
      <DialogContent sx={{ pt: '8px !important' }}>
        <Stack gap={2}>
          <TextField
            select
            label={t('roleGovernance.fields.resourceType')}
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            {['APP', 'NAVIGATION', 'API', 'ACTION', 'DATA'].map((value) => (
              <MenuItem key={value} value={value}>
                {value}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            required
            label={t('roleGovernance.fields.resourceKey')}
            value={key}
            onChange={(event) => setKey(event.target.value)}
          />
          <TextField
            required
            label={t('roleGovernance.fields.name')}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.actions.cancel')}</Button>
        <Button
          variant="contained"
          disabled={busy || !key.trim() || !name.trim()}
          onClick={() => void onSave({ type, key: key.trim(), name: name.trim() })}
        >
          {t('common.actions.create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
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
        headerName: '',
        width: 112,
        sortable: false,
        renderCell: ({ row }) => {
          const systemManaged = row.roleType === 'SYSTEM';
          const tooltip = systemManaged
            ? t('roleGovernance.systemManaged')
            : t('roleGovernance.actions.permissions');
          return (
            <Stack direction="row">
              <Tooltip title={tooltip}>
                <span>
                  <IconButton
                    size="small"
                    disabled={systemManaged}
                    aria-label={tooltip}
                    onClick={() => setPermissionRole(row)}
                  >
                    <KeyRound size={16} />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip
                title={systemManaged ? t('roleGovernance.systemManaged') : t('common.actions.edit')}
              >
                <span>
                  <IconButton
                    size="small"
                    disabled={systemManaged}
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
      <ManagementPanelError
        message={errorMessage(roles.error ?? resources.error, t('common.operationError'))}
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
            <IconButton onClick={() => void Promise.all([roles.refetch(), resources.refetch()])}>
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
        <PermissionDialog
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
          }}
        />
      )}
      {resourceOpen && (
        <ResourceDialog
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
            helperText={groups.isError ? t('common.loadError') : undefined}
            onChange={(event) => setGroupId(event.target.value)}
          >
            {(groups.data?.content ?? []).map((group) => (
              <MenuItem key={group.groupId} value={group.groupId}>
                {group.displayName}
              </MenuItem>
            ))}
          </TextField>
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
    return <ManagementPanelError message={t('common.operationError')} />;
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
      { field: 'source', headerName: t('roleGovernance.columns.source'), width: 140 },
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
      },
      { field: 'permissionCode', headerName: t('roleGovernance.columns.permission'), width: 140 },
      {
        field: 'effect',
        headerName: t('roleGovernance.columns.effect'),
        width: 110,
        renderCell: ({ row }) => (
          <Chip
            size="small"
            variant="outlined"
            color={row.effect === 'ALLOW' ? 'success' : 'error'}
            label={row.effect}
          />
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
    return <ManagementPanelError message={errorMessage(users.error, t('common.loadError'))} />;
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
      {access.isLoading && <ManagementPanelLoading label={t('roleGovernance.effectiveLoading')} />}
      {access.isError && (
        <ManagementPanelError message={errorMessage(access.error, t('common.operationError'))} />
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
