import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, Pencil, RefreshCw, Search, ShieldAlert, UsersRound } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useAuth,
  useToast,
  listIdentityRoles,
  listIdentityUsers,
  replaceIdentityUserRoles,
} from '@dwp-frontend/shared-utils';
import { EnterpriseDataGrid } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import FormGroup from '@mui/material/FormGroup';
import { useTheme } from '@mui/material/styles';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import InputAdornment from '@mui/material/InputAdornment';
import FormControlLabel from '@mui/material/FormControlLabel';
import useMediaQuery from '@mui/material/useMediaQuery';

import { AdminPanelError, AdminPanelLoading } from './admin-ui';
import { resolveRoleDisplayCopy } from './role-display';

import type { GridColDef } from '@mui/x-data-grid';
import type { IdentityRole, IdentityUserAccess } from '@dwp-frontend/shared-utils';

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function sorted(values: Iterable<string>): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function equalRoles(left: string[], right: string[]): boolean {
  const normalizedLeft = sorted(left);
  const normalizedRight = sorted(right);
  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((value, index) => value === normalizedRight[index])
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}

function RoleChips({ roles, maxVisible = 3 }: { roles: string[]; maxVisible?: number }) {
  const { t } = useTranslation('admin');
  if (!roles.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t('access.noRole')}
      </Typography>
    );
  }
  const visibleRoles = roles.slice(0, maxVisible);
  const hiddenRoles = roles.slice(maxVisible);

  return (
    <Stack direction="row" alignItems="center" gap={0.5} sx={{ minWidth: 0, minHeight: 24 }}>
      {visibleRoles.map((role) => (
        <Chip key={role} label={role} size="small" variant="outlined" sx={{ maxWidth: 128 }} />
      ))}
      {hiddenRoles.length > 0 && (
        <Tooltip title={hiddenRoles.join(', ')}>
          <Chip
            label={`+${hiddenRoles.length}`}
            aria-label={t('access.additionalRoles', { count: hiddenRoles.length })}
            size="small"
            variant="outlined"
          />
        </Tooltip>
      )}
    </Stack>
  );
}

function MfaState({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation('admin');
  return (
    <Stack
      direction="row"
      alignItems="center"
      gap={0.75}
      sx={{ minHeight: 24, color: enabled ? 'text.primary' : 'text.disabled' }}
    >
      <KeyRound size={14} strokeWidth={1.8} aria-hidden="true" />
      <Typography variant="body2" color="inherit">
        {enabled ? t('common.states.on') : t('common.states.off')}
      </Typography>
    </Stack>
  );
}

type RoleDialogProps = {
  user: IdentityUserAccess | null;
  roles: IdentityRole[];
  busy: boolean;
  onClose: () => void;
  onSave: (roles: string[]) => Promise<void>;
};

function RoleDialog({ user, roles, busy, onClose, onSave }: RoleDialogProps) {
  const { t } = useTranslation('admin');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelected(new Set(user?.roles ?? []));
  }, [user]);

  const toggle = (code: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  return (
    <Dialog open={Boolean(user)} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('access.dialog.title')}</DialogTitle>
      <DialogContent sx={{ pt: '8px !important' }}>
        {user && (
          <>
            <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 2.5 }}>
              <Avatar sx={{ width: 40, height: 40, bgcolor: 'primary.main', fontSize: 14 }}>
                {initials(user.displayName)}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" noWrap>
                  {user.displayName}
                </Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {user.email || t('access.userFallback', { id: user.userId })}
                </Typography>
              </Box>
            </Stack>
            <FormGroup aria-label={t('access.dialog.assignedRoles')} sx={{ gap: 0.75 }}>
              {roles.map((role) => {
                const display = resolveRoleDisplayCopy(role, t);
                return (
                  <Box key={role.code} sx={{ borderTop: 1, borderColor: 'divider', pt: 0.75 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={selected.has(role.code)}
                          onChange={() => toggle(role.code)}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2" fontWeight={700}>
                            {display.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {role.code}
                            {display.description ? ` / ${display.description}` : ''}
                          </Typography>
                        </Box>
                      }
                      sx={{ alignItems: 'flex-start', m: 0, width: 1 }}
                    />
                  </Box>
                );
              })}
            </FormGroup>
            <Stack
              direction="row"
              alignItems="flex-start"
              gap={1}
              sx={{ mt: 2.5, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}
            >
              <ShieldAlert size={18} strokeWidth={1.8} aria-hidden="true" />
              <Typography variant="body2" color="text.secondary">
                {t('access.dialog.sessionNotice')}
              </Typography>
            </Stack>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {t('common.actions.cancel')}
        </Button>
        <Button
          variant="contained"
          disabled={busy || !user || equalRoles(user.roles, [...selected])}
          onClick={() => void onSave(sorted(selected))}
        >
          {t('access.actions.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function AccessManager() {
  const { t } = useTranslation('admin');
  const auth = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('sm'));
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [selectedUser, setSelectedUser] = useState<IdentityUserAccess | null>(null);
  const [busy, setBusy] = useState(false);

  const usersQuery = useQuery({
    queryKey: ['admin', 'identity-users', deferredQuery],
    queryFn: () => listIdentityUsers(deferredQuery),
  });
  const rolesQuery = useQuery({
    queryKey: ['admin', 'identity-roles'],
    queryFn: listIdentityRoles,
  });
  const users = useMemo(() => usersQuery.data?.content ?? [], [usersQuery.data]);
  const roles = rolesQuery.data ?? [];

  const saveRoles = async (roleCodes: string[]) => {
    if (!selectedUser) return;
    setBusy(true);
    try {
      await replaceIdentityUserRoles(selectedUser, roleCodes);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'identity-users'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'audit-events'] }),
      ]);
      setSelectedUser(null);
      toast.success(t('access.toasts.updated'));
    } catch (error) {
      toast.error(errorMessage(error, t('common.operationError')));
    } finally {
      setBusy(false);
    }
  };

  const editButton = useCallback(
    (user: IdentityUserAccess) => {
      const currentUser = user.userId === auth.user?.userId;
      return (
        <Tooltip
          title={currentUser ? t('access.ownRolesUnavailable') : t('access.actions.editRoles')}
        >
          <span>
            <IconButton
              size="small"
              aria-label={t('access.actions.editRolesFor', { name: user.displayName })}
              disabled={currentUser}
              onClick={() => setSelectedUser(user)}
            >
              <Pencil size={17} strokeWidth={1.8} />
            </IconButton>
          </span>
        </Tooltip>
      );
    },
    [auth.user?.userId, t]
  );

  const columns = useMemo<GridColDef<IdentityUserAccess>[]>(
    () => [
      {
        field: 'displayName',
        headerName: t('access.columns.user'),
        minWidth: 240,
        flex: 1.2,
        renderCell: ({ row }) => (
          <Stack direction="row" alignItems="center" gap={1.25} sx={{ minWidth: 0 }}>
            <Avatar
              sx={{
                width: 32,
                height: 32,
                flex: '0 0 auto',
                bgcolor: 'primary.main',
                fontSize: 12,
              }}
            >
              {initials(row.displayName)}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={700} noWrap>
                {row.displayName}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap display="block">
                {row.email || t('access.userFallback', { id: row.userId })}
              </Typography>
            </Box>
          </Stack>
        ),
      },
      {
        field: 'roles',
        headerName: t('access.columns.roles'),
        minWidth: 220,
        flex: 1,
        sortable: false,
        renderCell: ({ row }) => <RoleChips roles={row.roles} maxVisible={2} />,
      },
      {
        field: 'status',
        headerName: t('access.columns.status'),
        width: 104,
        renderCell: ({ row }) => (
          <Chip
            label={t(`common.status.${row.status}`, { defaultValue: row.status })}
            size="small"
            color={row.status === 'ACTIVE' ? 'success' : 'default'}
            variant="outlined"
            sx={{ minWidth: 64 }}
          />
        ),
      },
      {
        field: 'mfaEnabled',
        headerName: t('access.columns.mfa'),
        width: 82,
        renderCell: ({ row }) => <MfaState enabled={row.mfaEnabled} />,
      },
      {
        field: 'accessRevision',
        headerName: t('access.columns.revision'),
        width: 92,
        align: 'right',
        headerAlign: 'right',
        renderCell: ({ row }) => (
          <Typography
            variant="body2"
            sx={{ width: 1, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
          >
            {row.accessRevision}
          </Typography>
        ),
      },
      {
        field: 'actions',
        headerName: '',
        width: 64,
        align: 'right',
        sortable: false,
        filterable: false,
        renderCell: ({ row }) => (
          <Box sx={{ width: 1, display: 'flex', justifyContent: 'flex-end' }}>
            {editButton(row)}
          </Box>
        ),
      },
    ],
    [editButton, t]
  );

  if (usersQuery.isLoading || rolesQuery.isLoading) {
    return <AdminPanelLoading label={t('access.loading')} />;
  }
  if (usersQuery.isError || rolesQuery.isError) {
    return (
      <AdminPanelError
        message={errorMessage(usersQuery.error ?? rolesQuery.error, t('common.operationError'))}
      />
    );
  }

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
            <UsersRound size={18} strokeWidth={1.8} aria-hidden="true" />
            <Typography component="h2" variant="subtitle1">
              {t('access.title')}
            </Typography>
            <Chip
              label={usersQuery.data?.totalElements ?? users.length}
              size="small"
              variant="outlined"
            />
          </Box>
          <Stack direction="row" alignItems="center" gap={0.5}>
            <TextField
              size="small"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              label={t('access.searchUsers')}
              sx={{ width: { xs: 1, sm: 280 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={17} strokeWidth={1.8} />
                  </InputAdornment>
                ),
              }}
            />
            <Tooltip title={t('access.actions.refresh')}>
              <IconButton
                aria-label={t('access.actions.refresh')}
                onClick={() => void Promise.all([usersQuery.refetch(), rolesQuery.refetch()])}
              >
                <RefreshCw size={18} strokeWidth={1.8} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {desktop && (
          <Box>
            <EnterpriseDataGrid
              ariaLabel={t('access.tenantUsers')}
              rows={users}
              columns={columns}
              getRowId={(row) => row.userId}
              hideFooter={users.length <= 25}
              initialState={{ pagination: { paginationModel: { pageSize: 25, page: 0 } } }}
              slots={{
                noRowsOverlay: () => (
                  <Box sx={{ height: 1, display: 'grid', placeItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      {t('access.noUsers')}
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
            component="ul"
            aria-label={t('access.tenantUsers')}
            sx={{ display: 'grid', listStyle: 'none', p: 0, m: 0 }}
          >
            {users.length ? (
              users.map((user) => (
                <Box
                  component="li"
                  key={user.userId}
                  sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}
                >
                  <Stack
                    direction="row"
                    alignItems="flex-start"
                    justifyContent="space-between"
                    gap={1}
                  >
                    <Stack direction="row" alignItems="center" gap={1.25} sx={{ minWidth: 0 }}>
                      <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: 12 }}>
                        {initials(user.displayName)}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography component="h3" variant="subtitle2" noWrap>
                          {user.displayName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap display="block">
                          {user.email || t('access.userFallback', { id: user.userId })}
                        </Typography>
                      </Box>
                    </Stack>
                    {editButton(user)}
                  </Stack>
                  <Box sx={{ mt: 1.25 }}>
                    <RoleChips roles={user.roles} />
                  </Box>
                  <Stack direction="row" gap={1} sx={{ mt: 1.25 }}>
                    <Chip
                      label={t(`common.status.${user.status}`, { defaultValue: user.status })}
                      size="small"
                      variant="outlined"
                    />
                    <Chip
                      icon={<KeyRound size={14} strokeWidth={1.8} />}
                      label={user.mfaEnabled ? t('access.mfaEnabled') : t('access.mfaDisabled')}
                      size="small"
                      variant="outlined"
                    />
                  </Stack>
                </Box>
              ))
            ) : (
              <Box component="li" sx={{ py: 6, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {t('access.noUsers')}
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </Box>

      <RoleDialog
        user={selectedUser}
        roles={roles}
        busy={busy}
        onClose={() => setSelectedUser(null)}
        onSave={saveRoles}
      />
    </>
  );
}
