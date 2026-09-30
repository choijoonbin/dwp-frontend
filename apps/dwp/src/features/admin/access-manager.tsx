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
  getCompleteTenantAccessProjection,
  replaceIdentityUserRoles,
  usePermissions,
} from '@dwp-frontend/shared-utils';
import { useDisplayDictionary, useRoleDisplay } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  DetailInspector,
  EnterpriseDataGrid,
  FormDialog,
  FormField,
  InlineFeedback,
  OperationalKpiStrip,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
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
import { TenantAccessProjectionInspector } from './tenant-access-projection-inspector';
import { AccessAssignmentRow } from './access-assignment-row';
import { IdentityAvatar } from './identity-avatar';
import { projectionExclusionLabelKey } from './tenant-access-projection-model';
import {
  effectiveRoleCodes,
  equalRoleCodes,
  formatIdentityDateTime,
  identityStatusLabelKey,
  managementReasonLabelKey,
  sortedRoleCodes,
} from './access-manager-model';
import type { GridColDef } from '@mui/x-data-grid';
import type {
  IdentityRole,
  IdentityUserAccess,
  TenantAccessProjection,
} from '@dwp-frontend/shared-utils';

function RoleChips({ roles, maxVisible = 3 }: { roles: string[]; maxVisible?: number }) {
  const { t } = useTranslation('admin');
  const roleDisplay = useRoleDisplay();
  if (!roles.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t('access.noRole')}
      </Typography>
    );
  }
  const visibleRoles = roles.slice(0, maxVisible);
  const hiddenRoles = roles.slice(maxVisible);
  const label = (role: string) => roleDisplay(role, t('access.unknownRole')).name;

  return (
    <Stack direction="row" alignItems="center" gap={0.5} sx={{ minWidth: 0, minHeight: 24 }}>
      {visibleRoles.map((role) => (
        <Chip
          key={role}
          label={label(role)}
          size="small"
          variant="outlined"
          sx={{ maxWidth: 128 }}
        />
      ))}
      {hiddenRoles.length > 0 && (
        <Tooltip title={hiddenRoles.map(label).join(', ')}>
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
  const roleLabel = (code: string) => {
    const role = roles.find((candidate) => candidate.code === code);
    return roleDisplay(code, role?.name || t('access.unknownRole')).name;
  };

  const changed = Boolean(user) && !equalRoleCodes(user?.roles ?? [], [...selected]);
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
      onSubmit={() => onSave(sortedRoleCodes(selected), justification.trim())}
    >
      {user && (
        <>
          <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 2.5 }}>
            <IdentityAvatar displayName={user.displayName} size={40} fontSize={14} />
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
                              {roleCopy.description || t('access.roleDescriptionUnavailable')}
                            </Typography>
                            {conflictBlocked && (
                              <Typography variant="caption" color="warning.main" display="block">
                                {t('access.dialog.conflictsWith', {
                                  roles: activeConflicts.map(roleLabel).join(', '),
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
  projected,
  projectionCoverage,
  projectionLoading,
  projectionUnavailable,
  canManage,
  locale,
  onClose,
  onEdit,
}: {
  user: IdentityUserAccess | null;
  projected?: TenantAccessProjection['principals'][number];
  projectionCoverage?: TenantAccessProjection['coverage'];
  projectionLoading: boolean;
  projectionUnavailable: boolean;
  canManage: boolean;
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
              label={t(identityStatusLabelKey(user.status))}
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
                  value: formatIdentityDateTime(
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
                disabled={!canManage || !user.roleManagement.allowed}
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

          <TenantAccessProjectionInspector
            projected={projected}
            coverage={projectionCoverage}
            loading={projectionLoading}
            unavailable={projectionUnavailable}
          />

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

export function AccessManager() {
  const { t, i18n } = useTranslation('admin');
  const toast = useToast();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('sm'));
  const { hasPermission, isLoaded: permissionsLoaded } = usePermissions();
  const canManage = permissionsLoaded && hasPermission('ADMIN.IDENTITY_DIRECTORY', 'MANAGE');
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
  const projectionQuery = useQuery({
    queryKey: ['admin', 'tenant-settings', 'access-projection', deferredQuery],
    queryFn: ({ signal }) => getCompleteTenantAccessProjection(deferredQuery, signal),
    retry: false,
  });
  const users = useMemo(() => usersQuery.data?.content ?? [], [usersQuery.data]);
  const projectionMatchesUsers = useMemo(() => {
    if (!usersQuery.data || !projectionQuery.data) return false;
    if (usersQuery.data.totalElements !== projectionQuery.data.totalElements) return false;
    const projectedIds = new Set(
      projectionQuery.data.principals.map((principal) => principal.userId)
    );
    return (
      users.length === projectedIds.size && users.every((user) => projectedIds.has(user.userId))
    );
  }, [projectionQuery.data, users, usersQuery.data]);
  const projectedByUser = useMemo(
    () =>
      new Map(
        (projectionMatchesUsers ? (projectionQuery.data?.principals ?? []) : []).map(
          (principal) => [principal.userId, principal]
        )
      ),
    [projectionMatchesUsers, projectionQuery.data]
  );
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
    if (!canManage || !selectedUser) return;
    setBusy(true);
    try {
      await replaceIdentityUserRoles(selectedUser, roleCodes, justification);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'identity-users'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'audit-events'] }),
      ]);
      setSelectedUser(null);
      toast.success(t('access.toasts.updated'));
    } catch {
      toast.error(t('common.operationError'));
    } finally {
      setBusy(false);
    }
  };

  const editButton = useCallback(
    (user: IdentityUserAccess) => {
      const manageable = canManage && user.roleManagement.allowed;
      const reason = user.roleManagement.reason;
      return (
        <Tooltip
          title={manageable ? t('access.actions.editRoles') : t(managementReasonLabelKey(reason))}
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
    [canManage, t]
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
            <IdentityAvatar displayName={row.displayName} size={32} fontSize={12} />
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
        renderCell: ({ row }) => <RoleChips roles={effectiveRoleCodes(row)} maxVisible={2} />,
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
          const projected = projectedByUser.get(row.userId);
          const appPresets =
            projected?.grants.filter((grant) => grant.entitlementType === 'APP_PRESET').length ?? 0;
          return (
            <Stack direction="row" alignItems="center" gap={0.5} flexWrap="wrap">
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
              {appPresets > 0 && (
                <Chip
                  size="small"
                  color={projected?.pendingApprovalCount ? 'warning' : 'info'}
                  variant="outlined"
                  label={t('access.projection.appPresetCount', {
                    count: appPresets,
                    pending: projected?.pendingApprovalCount ?? 0,
                  })}
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
            {formatIdentityDateTime(row.lastSignInAt, locale, t('access.inspector.neverSignedIn'))}
          </Typography>
        ),
      },
      {
        field: 'status',
        headerName: t('access.columns.status'),
        width: 104,
        renderCell: ({ row }) => (
          <Chip
            label={t(identityStatusLabelKey(row.status))}
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
        width: 104,
        align: 'right',
        sortable: false,
        filterable: false,
        renderCell: ({ row }) => (
          <Box sx={{ width: 1, display: 'flex', justifyContent: 'flex-end' }}>
            <Tooltip title={t('access.actions.reviewEffectiveAccess')}>
              <IconButton
                size="small"
                aria-label={t('access.actions.reviewEffectiveAccessFor', {
                  name: row.displayName,
                })}
                onClick={(event) => {
                  event.stopPropagation();
                  setInspectedUser(row);
                }}
              >
                <ShieldCheck size={17} strokeWidth={1.8} />
              </IconButton>
            </Tooltip>
            {editButton(row)}
          </Box>
        ),
      },
    ],
    [editButton, locale, projectedByUser, t]
  );

  if (usersQuery.isLoading || rolesQuery.isLoading) {
    return <ManagementPanelLoading label={t('access.loading')} />;
  }
  if (usersQuery.isError || rolesQuery.isError) {
    return <ManagementPanelError message={t('common.operationError')} />;
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
                onClick={() =>
                  void Promise.all([
                    usersQuery.refetch(),
                    rolesQuery.refetch(),
                    projectionQuery.refetch(),
                  ])
                }
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

        {projectionQuery.data && projectionMatchesUsers && (
          <InlineFeedback severity="info" sx={{ mx: 2, my: 1.5 }}>
            {t('access.projection.coverage', {
              owners: projectionQuery.data.coverage.includedOwners.length,
              identities: projectionQuery.data.totalElements,
              pages: projectionQuery.data.collectedPages,
              observedAt: formatIdentityDateTime(
                projectionQuery.data.observedAt,
                locale,
                t('access.inspector.notAvailable')
              ),
            })}{' '}
            {t('access.projection.exclusions', {
              exclusions: projectionQuery.data.coverage.exclusions
                .map((exclusion) => t(projectionExclusionLabelKey(exclusion)))
                .join(', '),
            })}
          </InlineFeedback>
        )}
        {projectionQuery.isLoading && (
          <InlineFeedback severity="info" sx={{ mx: 2, my: 1.5 }}>
            {t('access.projection.loading')}
          </InlineFeedback>
        )}
        {(projectionQuery.isError || (projectionQuery.data && !projectionMatchesUsers)) && (
          <InlineFeedback severity="warning" sx={{ mx: 2, my: 1.5 }}>
            {t('access.projection.unavailable')}
          </InlineFeedback>
        )}

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
                      <IdentityAvatar displayName={user.displayName} size={36} fontSize={12} />
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
                    <RoleChips roles={effectiveRoleCodes(user)} />
                  </Box>
                  <Stack direction="row" gap={1} sx={{ mt: 1.25 }}>
                    <Chip
                      label={t(identityStatusLabelKey(user.status))}
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
        user={canManage ? selectedUser : null}
        roles={roles}
        busy={busy}
        onClose={() => setSelectedUser(null)}
        onSave={saveRoles}
      />
      <AccessInspector
        user={inspectedUser}
        projected={inspectedUser ? projectedByUser.get(inspectedUser.userId) : undefined}
        projectionCoverage={projectionMatchesUsers ? projectionQuery.data?.coverage : undefined}
        projectionLoading={projectionQuery.isLoading}
        projectionUnavailable={
          projectionQuery.isError || Boolean(projectionQuery.data && !projectionMatchesUsers)
        }
        canManage={canManage}
        locale={locale}
        onClose={() => setInspectedUser(null)}
        onEdit={(user) => {
          if (!canManage) return;
          setInspectedUser(null);
          setSelectedUser(user);
        }}
      />
    </>
  );
}
