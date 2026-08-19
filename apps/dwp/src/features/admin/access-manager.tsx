import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyRound,
  Pencil,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useToast,
  listIdentityRoles,
  listIdentityUsers,
  replaceIdentityUserRoles,
} from '@dwp-frontend/shared-utils';
import {
  formatDate,
  resolveSupportedLocale,
  useDisplayDictionary,
  useRoleDisplay,
} from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  DetailInspector,
  EnterpriseDataGrid,
  FormDialog,
  FormField,
  OperationalKpiStrip,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import FormGroup from '@mui/material/FormGroup';
import { useTheme } from '@mui/material/styles';
import InputAdornment from '@mui/material/InputAdornment';
import FormControlLabel from '@mui/material/FormControlLabel';
import useMediaQuery from '@mui/material/useMediaQuery';

import {
  ManagementPanelError,
  ManagementPanelLoading,
} from '../../components/management-panel-state';
import type { GridColDef } from '@mui/x-data-grid';
import type {
  IdentityEffectiveAccess,
  IdentityRole,
  IdentityUserAccess,
} from '@dwp-frontend/shared-utils';

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

function effectiveRoles(user: IdentityUserAccess): string[] {
  return user.effectiveRoles?.length ? user.effectiveRoles : user.roles;
}

function formatDateTime(value: string | null | undefined, locale: string, fallback: string) {
  if (!value) return fallback;
  return formatDate(
    value,
    { dateStyle: 'medium', timeStyle: 'short' },
    resolveSupportedLocale(locale)
  );
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
  onSave: (roles: string[], justification: string) => Promise<void>;
};

function RoleDialog({ user, roles, busy, onClose, onSave }: RoleDialogProps) {
  const { t } = useTranslation('admin');
  const display = useDisplayDictionary();
  const roleDisplay = useRoleDisplay();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [justification, setJustification] = useState('');

  const groupedRoles = useMemo(() => {
    const groups = new Map<string, IdentityRole[]>();
    roles.forEach((role) => {
      const family = role.roleFamily || 'OTHER';
      groups.set(family, [...(groups.get(family) ?? []), role]);
    });
    return [...groups.entries()];
  }, [roles]);

  useEffect(() => {
    const available = new Set(roles.map((role) => role.code));
    const next = new Set((user?.roles ?? []).filter((code) => available.has(code)));
    const baseline = roles.find((role) => role.assignmentClass === 'BASELINE');
    if (user && baseline) next.add(baseline.code);
    setSelected(next);
    setJustification('');
  }, [roles, user]);

  const toggle = (role: IdentityRole) => {
    if (role.assignmentClass === 'BASELINE') return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(role.code)) next.delete(role.code);
      else next.add(role.code);
      return next;
    });
  };

  const changed = Boolean(user) && !equalRoles(user?.roles ?? [], [...selected]);
  const justificationValid = justification.trim().length >= 10;

  return (
    <FormDialog
      open={Boolean(user)}
      title={t('access.dialog.title')}
      description={t('access.dialog.delegationBoundary')}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t('access.actions.save')}
      submittingLabel={t('access.actions.saving')}
      busy={busy}
      submitDisabled={!user || !changed || !justificationValid}
      onClose={onClose}
      onSubmit={() => onSave(sorted(selected), justification.trim())}
    >
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

          {groupedRoles.map(([family, familyRoles]) => (
            <Box key={family} sx={{ mb: 2 }}>
              <Typography variant="overline" color="text.secondary">
                {display('roleFamilies', family)}
              </Typography>
              <FormGroup aria-label={t('access.dialog.assignedRoles')}>
                {familyRoles.map((role) => {
                  const roleCopy = roleDisplay(role.code, role.name, role.description);
                  const baseline = role.assignmentClass === 'BASELINE';
                  const activeConflicts = (role.conflictsWith ?? []).filter((code) =>
                    selected.has(code)
                  );
                  const conflictBlocked = !selected.has(role.code) && activeConflicts.length > 0;
                  return (
                    <Box key={role.code} sx={{ borderTop: 1, borderColor: 'divider', py: 0.75 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={selected.has(role.code)}
                            disabled={baseline || conflictBlocked}
                            onChange={() => toggle(role)}
                          />
                        }
                        label={
                          <Box sx={{ minWidth: 0, py: 0.25 }}>
                            <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
                              <Typography variant="body2" fontWeight={700}>
                                {roleCopy.name}
                              </Typography>
                              <Chip
                                size="small"
                                variant="outlined"
                                label={display('roleAssignmentClasses', role.assignmentClass)}
                              />
                            </Stack>
                            <Typography variant="caption" color="text.secondary">
                              {role.code}
                              {roleCopy.description ? ` / ${roleCopy.description}` : ''}
                            </Typography>
                            {conflictBlocked && (
                              <Typography variant="caption" color="warning.main" display="block">
                                {t('access.dialog.conflictsWith', {
                                  roles: activeConflicts.join(', '),
                                })}
                              </Typography>
                            )}
                          </Box>
                        }
                        sx={{ alignItems: 'flex-start', m: 0, width: 1 }}
                      />
                    </Box>
                  );
                })}
              </FormGroup>
            </Box>
          ))}

          <FormField
            required
            multiline
            minRows={2}
            inputProps={{ maxLength: 500 }}
            label={t('access.dialog.justification')}
            value={justification}
            onChange={(event) => setJustification(event.target.value)}
            supportingText={t('access.dialog.justificationHelp')}
          />
          <Stack
            direction="row"
            alignItems="flex-start"
            gap={1}
            sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}
          >
            <ShieldAlert size={18} strokeWidth={1.8} aria-hidden="true" />
            <Typography variant="body2" color="text.secondary">
              {t('access.dialog.sessionNotice')}
            </Typography>
          </Stack>
        </>
      )}
    </FormDialog>
  );
}

function AccessInspector({
  user,
  locale,
  onClose,
  onEdit,
}: {
  user: IdentityUserAccess | null;
  locale: string;
  onClose: () => void;
  onEdit: (user: IdentityUserAccess) => void;
}) {
  const { t } = useTranslation('admin');
  const assignments = user?.effectiveAccess ?? [];

  return (
    <DetailInspector
      open={Boolean(user)}
      variant="drawer"
      width={460}
      title={user?.displayName ?? t('access.inspector.title')}
      subtitle={user?.email || (user ? t('access.userFallback', { id: user.userId }) : undefined)}
      closeLabel={t('access.inspector.close')}
      onClose={onClose}
      status={
        user ? (
          <Stack direction="row" gap={0.75} flexWrap="wrap">
            <Chip
              size="small"
              color={user.status === 'ACTIVE' ? 'success' : 'default'}
              variant="outlined"
              label={t(`common.status.${user.status}`, { defaultValue: user.status })}
            />
            {assignments.some((assignment) => assignment.privileged) && (
              <Chip
                size="small"
                color="warning"
                variant="outlined"
                label={t('access.inspector.privileged')}
              />
            )}
          </Stack>
        ) : undefined
      }
    >
      {user && (
        <Stack gap={2.5}>
          <Box component="section" aria-labelledby="identity-posture-title">
            <Typography id="identity-posture-title" component="h3" variant="subtitle2">
              {t('access.inspector.posture')}
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                mt: 1,
                borderTop: 1,
                borderLeft: 1,
                borderColor: 'divider',
              }}
            >
              {[
                {
                  label: t('access.inspector.mfa'),
                  value: user.mfaEnabled ? t('common.states.on') : t('common.states.off'),
                },
                {
                  label: t('access.inspector.sessions'),
                  value: String(user.activeSessionCount ?? 0),
                },
                {
                  label: t('access.inspector.lastSignIn'),
                  value: formatDateTime(
                    user.lastSignInAt,
                    locale,
                    t('access.inspector.neverSignedIn')
                  ),
                },
                {
                  label: t('access.inspector.revision'),
                  value: String(user.accessRevision),
                },
              ].map((item) => (
                <Box
                  key={item.label}
                  sx={{ p: 1.25, borderRight: 1, borderBottom: 1, borderColor: 'divider' }}
                >
                  <Typography variant="caption" color="text.secondary" display="block">
                    {item.label}
                  </Typography>
                  <Typography variant="body2" fontWeight={700} sx={{ mt: 0.25 }}>
                    {item.value}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>

          <Box component="section" aria-labelledby="effective-access-title">
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
              <Box>
                <Typography id="effective-access-title" component="h3" variant="subtitle2">
                  {t('access.inspector.effectiveAccess')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('access.inspector.assignmentCount', { count: assignments.length })}
                </Typography>
              </Box>
              <ActionButton
                intent="secondary"
                size="small"
                startIcon={<Pencil size={15} />}
                disabled={!user.roleManagement.allowed}
                onClick={() => onEdit(user)}
              >
                {t('access.actions.editDirectRoles')}
              </ActionButton>
            </Stack>

            {assignments.length ? (
              <Stack sx={{ mt: 1.25, borderTop: 1, borderColor: 'divider' }}>
                {assignments.map((assignment) => (
                  <AccessAssignmentRow
                    key={`${assignment.sourceType}-${assignment.sourceId}`}
                    assignment={assignment}
                    locale={locale}
                  />
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
                {t('access.inspector.noEffectiveAccess')}
              </Typography>
            )}
          </Box>

          <Stack
            direction="row"
            alignItems="flex-start"
            gap={1}
            sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}
          >
            <ShieldCheck size={18} strokeWidth={1.8} aria-hidden="true" />
            <Typography variant="body2" color="text.secondary">
              {t('access.inspector.sourceNotice')}
            </Typography>
          </Stack>
        </Stack>
      )}
    </DetailInspector>
  );
}

function AccessAssignmentRow({
  assignment,
  locale,
}: {
  assignment: IdentityEffectiveAccess;
  locale: string;
}) {
  const { t } = useTranslation('admin');
  const roleDisplay = useRoleDisplay();
  const roleName = roleDisplay(
    assignment.roleCode,
    assignment.roleName || assignment.roleCode
  ).name;
  const source =
    assignment.sourceType === 'GROUP'
      ? assignment.sourceName || assignment.sourceKey || t('access.sources.group')
      : assignment.sourceType === 'DIRECT'
        ? t('access.sources.direct')
        : assignment.sourceName || assignment.sourceKey || t('access.sources.governed');
  const validity = assignment.validTo
    ? t('access.inspector.validUntil', {
        date: formatDateTime(assignment.validTo, locale, t('access.inspector.notAvailable')),
      })
    : t('access.inspector.noExpiry');

  return (
    <Box sx={{ py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
            <Typography variant="body2" fontWeight={700}>
              {roleName}
            </Typography>
            {assignment.privileged && (
              <Chip
                size="small"
                color="warning"
                variant="outlined"
                label={t('access.inspector.privileged')}
              />
            )}
          </Stack>
          <Typography variant="caption" color="text.secondary" display="block">
            {assignment.roleCode}
          </Typography>
        </Box>
        <Chip
          size="small"
          color={assignment.sourceType === 'GROUP' ? 'info' : 'default'}
          variant="outlined"
          label={t(`access.sources.${assignment.sourceType.toLowerCase()}`)}
        />
      </Stack>
      <Stack gap={0.35} sx={{ mt: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {t('access.inspector.sourceValue', { source })}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('access.inspector.scopeValue', {
            scope: assignment.scopeRef
              ? `${assignment.scopeType} / ${assignment.scopeRef}`
              : assignment.scopeType,
          })}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {validity}
        </Typography>
      </Stack>
    </Box>
  );
}

export function AccessManager() {
  const { t, i18n } = useTranslation('admin');
  const toast = useToast();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('sm'));
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [selectedUser, setSelectedUser] = useState<IdentityUserAccess | null>(null);
  const [inspectedUser, setInspectedUser] = useState<IdentityUserAccess | null>(null);
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
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const accessSignals = useMemo(() => {
    const assignments = users.flatMap((user) => user.effectiveAccess ?? []);
    return {
      privilegedIdentities: users.filter((user) =>
        (user.effectiveAccess ?? []).some((assignment) => assignment.privileged)
      ).length,
      inheritedAssignments: assignments.filter((assignment) => assignment.sourceType === 'GROUP')
        .length,
      identitiesWithoutMfa: users.filter((user) => !user.mfaEnabled).length,
    };
  }, [users]);

  const saveRoles = async (roleCodes: string[], justification: string) => {
    if (!selectedUser) return;
    setBusy(true);
    try {
      await replaceIdentityUserRoles(selectedUser, roleCodes, justification);
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
      const manageable = user.roleManagement.allowed;
      const reason = user.roleManagement.reason;
      return (
        <Tooltip
          title={
            manageable
              ? t('access.actions.editRoles')
              : t(`access.managementReasons.${reason}`, { defaultValue: reason })
          }
        >
          <span>
            <IconButton
              size="small"
              aria-label={t('access.actions.editRolesFor', { name: user.displayName })}
              disabled={!manageable}
              onClick={(event) => {
                event.stopPropagation();
                setSelectedUser(user);
              }}
            >
              <Pencil size={17} strokeWidth={1.8} />
            </IconButton>
          </span>
        </Tooltip>
      );
    },
    [t]
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
        renderCell: ({ row }) => <RoleChips roles={effectiveRoles(row)} maxVisible={2} />,
      },
      {
        field: 'sources',
        headerName: t('access.columns.sources'),
        width: 126,
        sortable: false,
        valueGetter: (_value, row) => row.effectiveAccess?.length ?? row.roles.length,
        renderCell: ({ row }) => {
          const inherited = (row.effectiveAccess ?? []).filter(
            (assignment) => assignment.sourceType === 'GROUP'
          ).length;
          return (
            <Stack direction="row" alignItems="center" gap={0.5}>
              <Typography variant="body2">
                {row.effectiveAccess?.length ?? row.roles.length}
              </Typography>
              {inherited > 0 && (
                <Chip
                  size="small"
                  color="info"
                  variant="outlined"
                  label={t('access.inheritedCount', { count: inherited })}
                />
              )}
            </Stack>
          );
        },
      },
      {
        field: 'lastSignInAt',
        headerName: t('access.columns.lastSignIn'),
        width: 168,
        renderCell: ({ row }) => (
          <Typography variant="body2" color={row.lastSignInAt ? 'text.primary' : 'warning.main'}>
            {formatDateTime(row.lastSignInAt, locale, t('access.inspector.neverSignedIn'))}
          </Typography>
        ),
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
    [editButton, locale, t]
  );

  if (usersQuery.isLoading || rolesQuery.isLoading) {
    return <ManagementPanelLoading label={t('access.loading')} />;
  }
  if (usersQuery.isError || rolesQuery.isError) {
    return (
      <ManagementPanelError
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

        <OperationalKpiStrip
          ariaLabel={t('access.signals.label')}
          items={[
            {
              key: 'identities',
              label: t('access.signals.identities'),
              value: usersQuery.data?.totalElements ?? users.length,
              detail: t('access.signals.currentScope'),
            },
            {
              key: 'privileged',
              label: t('access.signals.privileged'),
              value: accessSignals.privilegedIdentities,
              tone: accessSignals.privilegedIdentities ? 'warning' : 'success',
              detail: t('access.signals.reviewEvidence'),
            },
            {
              key: 'inherited',
              label: t('access.signals.inherited'),
              value: accessSignals.inheritedAssignments,
              tone: 'info',
              detail: t('access.signals.groupManaged'),
            },
            {
              key: 'mfa',
              label: t('access.signals.withoutMfa'),
              value: accessSignals.identitiesWithoutMfa,
              tone: accessSignals.identitiesWithoutMfa ? 'critical' : 'success',
              detail: t('access.signals.authenticationPosture'),
            },
          ]}
        />

        {desktop && (
          <Box>
            <EnterpriseDataGrid
              ariaLabel={t('access.tenantUsers')}
              rows={users}
              columns={columns}
              getRowId={(row) => row.userId}
              hideFooter={users.length <= 25}
              initialState={{ pagination: { paginationModel: { pageSize: 25, page: 0 } } }}
              onRowClick={({ row }) => setInspectedUser(row)}
              slots={{
                noRowsOverlay: () => (
                  <Box sx={{ height: 1, display: 'grid', placeItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      {t('access.noUsers')}
                    </Typography>
                  </Box>
                ),
              }}
              sx={{ border: 0, borderRadius: 0, '& .MuiDataGrid-row': { cursor: 'pointer' } }}
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
                    <RoleChips roles={effectiveRoles(user)} />
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
                  <ActionButton
                    intent="quiet"
                    size="small"
                    sx={{ mt: 1.25 }}
                    onClick={() => setInspectedUser(user)}
                  >
                    {t('access.actions.reviewEffectiveAccess')}
                  </ActionButton>
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
      <AccessInspector
        user={inspectedUser}
        locale={locale}
        onClose={() => setInspectedUser(null)}
        onEdit={(user) => {
          setInspectedUser(null);
          setSelectedUser(user);
        }}
      />
    </>
  );
}
