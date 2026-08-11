import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Ban,
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

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Tooltip from '@mui/material/Tooltip';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { AdminPanelError, AdminPanelLoading } from './admin-ui';
import { resolveRoleDisplayCopy } from './role-display';

import type { GridColDef } from '@mui/x-data-grid';
import type {
  CreateGovernanceRoleRequest,
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

function RoleDialog({
  role,
  open,
  busy,
  onClose,
  onSave,
}: {
  role: GovernanceRole | null;
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (request: CreateGovernanceRoleRequest & { status: string }) => Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const [code, setCode] = useState(role?.code ?? '');
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [status, setStatus] = useState(role?.status ?? 'ACTIVE');
  const [assignableToGroups, setAssignableToGroups] = useState(role?.assignableToGroups ?? true);

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {t(role ? 'roleGovernance.roleDialog.edit' : 'roleGovernance.roleDialog.create')}
      </DialogTitle>
      <DialogContent sx={{ pt: '8px !important' }}>
        <Stack gap={2}>
          <TextField
            autoFocus
            required
            disabled={Boolean(role)}
            label={t('roleGovernance.fields.code')}
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <TextField
            required
            label={t('roleGovernance.fields.name')}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <TextField
            multiline
            minRows={2}
            label={t('roleGovernance.fields.description')}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          {role && (
            <TextField
              select
              label={t('roleGovernance.fields.status')}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <MenuItem value="ACTIVE">{t('common.status.ACTIVE')}</MenuItem>
              <MenuItem value="INACTIVE">{t('common.status.INACTIVE')}</MenuItem>
            </TextField>
          )}
          <Stack>
            <FormControlLabel
              control={
                <Checkbox
                  checked={assignableToGroups}
                  onChange={(event) => setAssignableToGroups(event.target.checked)}
                />
              }
              label={t('roleGovernance.fields.assignableToGroups')}
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {t('common.actions.cancel')}
        </Button>
        <Button
          variant="contained"
          disabled={busy || !code.trim() || !name.trim()}
          onClick={() =>
            void onSave({
              code: code.trim(),
              name: name.trim(),
              description: description.trim(),
              status,
              privileged: false,
              assignableToGroups,
            })
          }
        >
          {t('common.actions.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
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
  const roleDisplay = role ? resolveRoleDisplayCopy(role, t) : null;
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

  const mutate = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await action();
      await refresh();
      toast.success(success);
    } catch (error) {
      toast.error(errorMessage(error, t('common.operationError')));
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
              {resolveRoleDisplayCopy(row, t).name}
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
          resolveRoleDisplayCopy(row, t).description || t('roleGovernance.notAvailable'),
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
    [t]
  );

  if (roles.isLoading || resources.isLoading)
    return <AdminPanelLoading label={t('roleGovernance.loading')} />;
  if (roles.isError || resources.isError)
    return (
      <AdminPanelError
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
        <RoleDialog
          role={editingRole}
          open
          busy={busy}
          onClose={() => setDialogOpen(false)}
          onSave={async (request) => {
            await mutate(
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
            setDialogOpen(false);
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
            await mutate(
              () => replaceGovernanceRolePermissions(permissionRole, selection),
              t('roleGovernance.toasts.permissionsUpdated')
            );
            setPermissionRole(null);
          }}
        />
      )}
      {resourceOpen && (
        <ResourceDialog
          open
          busy={busy}
          onClose={() => setResourceOpen(false)}
          onSave={async (request) => {
            await mutate(
              () => createGovernanceResource(request),
              t('roleGovernance.toasts.resourceCreated')
            );
            setResourceOpen(false);
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
    assignmentType: 'ACTIVE' | 'ELIGIBLE';
    scopeType: 'TENANT' | 'ORG_UNIT' | 'RESOURCE';
    scopeRef?: string;
    validTo?: string;
    justification: string;
  }) => Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const groups = useQuery({
    queryKey: ['admin', 'directory', 'groups', 'assignment'],
    queryFn: () => listDirectoryGroups('', 'ACTIVE', 0, 100),
  });
  const [groupId, setGroupId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [assignmentType, setAssignmentType] = useState<'ACTIVE' | 'ELIGIBLE'>('ACTIVE');
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
            select
            required
            label={t('roleGovernance.fields.group')}
            value={groupId}
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
                  {resolveRoleDisplayCopy(role, t).name} ({role.code})
                </MenuItem>
              ))}
          </TextField>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
            <TextField
              select
              fullWidth
              label={t('roleGovernance.fields.assignmentType')}
              value={assignmentType}
              onChange={(event) => setAssignmentType(event.target.value as 'ACTIVE' | 'ELIGIBLE')}
            >
              <MenuItem value="ACTIVE">{t('roleGovernance.assignmentTypes.ACTIVE')}</MenuItem>
              <MenuItem value="ELIGIBLE">{t('roleGovernance.assignmentTypes.ELIGIBLE')}</MenuItem>
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
          </Stack>
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
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.actions.cancel')}</Button>
        <Button
          variant="contained"
          disabled={
            busy ||
            !groupId ||
            !roleId ||
            !justification.trim() ||
            (scopeType !== 'TENANT' && !scopeRef.trim())
          }
          onClick={() =>
            void onSave({
              groupId: Number(groupId),
              roleId: Number(roleId),
              assignmentType,
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
  const toast = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
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
  const mutate = useCallback(
    async (action: () => Promise<unknown>, success: string) => {
      setBusy(true);
      try {
        await action();
        await queryClient.invalidateQueries({ queryKey: ['admin', 'governance'] });
        toast.success(success);
      } catch (error) {
        toast.error(errorMessage(error, t('common.operationError')));
      } finally {
        setBusy(false);
      }
    },
    [queryClient, t, toast]
  );
  const columns = useMemo<GridColDef<GroupRoleAssignment>[]>(
    () => [
      { field: 'groupName', headerName: t('roleGovernance.columns.group'), minWidth: 200, flex: 1 },
      { field: 'roleCode', headerName: t('roleGovernance.columns.role'), minWidth: 160, flex: 0.8 },
      {
        field: 'assignmentType',
        headerName: t('roleGovernance.columns.assignmentType'),
        width: 130,
      },
      {
        field: 'scopeType',
        headerName: t('roleGovernance.columns.scope'),
        minWidth: 170,
        flex: 0.7,
        valueGetter: (_value, row) =>
          row.scopeRef ? `${row.scopeType} / ${row.scopeRef}` : row.scopeType,
      },
      {
        field: 'validTo',
        headerName: t('roleGovernance.columns.validTo'),
        width: 180,
        valueGetter: (_value, row) =>
          row.validTo ? new Date(row.validTo).toLocaleString() : t('roleGovernance.noExpiry'),
      },
      {
        field: 'lifecycleState',
        headerName: t('roleGovernance.columns.status'),
        width: 120,
        renderCell: ({ row }) => (
          <Chip
            size="small"
            variant="outlined"
            color={row.lifecycleState === 'ACTIVE' ? 'success' : 'default'}
            label={row.lifecycleState}
          />
        ),
      },
      {
        field: 'actions',
        headerName: '',
        width: 64,
        sortable: false,
        renderCell: ({ row }) => (
          <Tooltip title={t('roleGovernance.actions.revoke')}>
            <span>
              <IconButton
                size="small"
                color="error"
                disabled={
                  busy || row.lifecycleState !== 'ACTIVE' || !assignableRoleCodes.has(row.roleCode)
                }
                onClick={() =>
                  void mutate(
                    () => revokeGroupRoleAssignment(row),
                    t('roleGovernance.toasts.assignmentRevoked')
                  )
                }
              >
                <Ban size={16} />
              </IconButton>
            </span>
          </Tooltip>
        ),
      },
    ],
    [assignableRoleCodes, busy, mutate, t]
  );
  if (assignments.isLoading || roles.isLoading || assignableRoles.isLoading)
    return <AdminPanelLoading label={t('roleGovernance.loading')} />;
  if (assignments.isError || roles.isError || assignableRoles.isError)
    return <AdminPanelError message={t('common.operationError')} />;
  return (
    <>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2 }}>
        <Stack direction="row" alignItems="center" gap={1}>
          <UsersRound size={18} />
          <Typography variant="subtitle1">{t('roleGovernance.assignments')}</Typography>
          <Chip label={assignments.data?.length ?? 0} size="small" variant="outlined" />
        </Stack>
        <Button startIcon={<Plus size={17} />} onClick={() => setDialogOpen(true)}>
          {t('roleGovernance.actions.newAssignment')}
        </Button>
      </Stack>
      <EnterpriseDataGrid
        ariaLabel={t('roleGovernance.assignments')}
        rows={assignments.data ?? []}
        columns={columns}
        getRowId={(row) => row.assignmentId}
        hideFooter
        minVisibleRows={3}
        maxVisibleRows={9}
        sx={{ border: 0, borderRadius: 0 }}
      />
      {dialogOpen && (
        <AssignmentDialog
          open
          roles={(roles.data ?? []).filter((role) => assignableRoleCodes.has(role.code))}
          busy={busy}
          onClose={() => setDialogOpen(false)}
          onSave={async (request) => {
            await mutate(
              () => createGroupRoleAssignment(request),
              t('roleGovernance.toasts.assignmentCreated')
            );
            setDialogOpen(false);
          }}
        />
      )}
    </>
  );
}

function EffectiveAccessPanel() {
  const { t } = useTranslation('admin');
  const users = useQuery({
    queryKey: ['admin', 'identity-users', 'effective-access'],
    queryFn: () => listIdentityUsers(''),
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
  if (users.isLoading) return <AdminPanelLoading label={t('roleGovernance.loading')} />;
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
        <TextField
          select
          size="small"
          label={t('roleGovernance.fields.user')}
          value={userId}
          onChange={(event) => setUserId(event.target.value)}
          sx={{ minWidth: 280 }}
        >
          {(users.data?.content ?? []).map((user) => (
            <MenuItem key={user.userId} value={user.userId}>
              {user.displayName} / {user.email}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
      {access.isLoading && <AdminPanelLoading label={t('roleGovernance.effectiveLoading')} />}
      {access.isError && (
        <AdminPanelError message={errorMessage(access.error, t('common.operationError'))} />
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
  const { t } = useTranslation('admin');
  const [tab, setTab] = useState<'roles' | 'assignments' | 'effective'>('roles');
  return (
    <Box sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
      <Tabs
        value={tab}
        onChange={(_event, value: typeof tab) => setTab(value)}
        aria-label={t('roleGovernance.tabs.label')}
        sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab value="roles" label={t('roleGovernance.tabs.roles')} />
        <Tab value="assignments" label={t('roleGovernance.tabs.assignments')} />
        <Tab value="effective" label={t('roleGovernance.tabs.effective')} />
      </Tabs>
      {tab === 'roles' && <RolesPanel />}
      {tab === 'assignments' && <AssignmentsPanel />}
      {tab === 'effective' && <EffectiveAccessPanel />}
    </Box>
  );
}
