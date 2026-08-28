import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createWorkforceAccessPolicy,
  listIdentityUsers,
  listWorkforceAccessPolicies,
  listWorkforcePolicyOrganizations,
  revokeWorkforceAccessPolicy,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  EnterpriseDataGrid,
  ErrorState,
  FilterBar,
  GuidedEmptyState,
  SelectField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ManagementPanelLoading } from '../../components/management-panel-state';
import {
  WorkforceAccessPolicyDialog,
  WorkforceAccessRevokeDialog,
} from './workforce-access-dialogs';
import {
  effectiveWorkforcePolicyState,
  filterWorkforceAccessPolicies,
} from './workforce-access-model';
import { WorkforceAccessOverview } from './workforce-access-overview';

import type { GridColDef } from '@mui/x-data-grid';
import type { WorkforceAccessPolicy } from '@dwp-frontend/shared-utils';
import type { EffectiveWorkforceAccessState } from './workforce-access-model';
import type { TFunction } from 'i18next';

const POLICY_QUERY_KEY = ['admin', 'workforce-access', 'policies'] as const;
const WORKFORCE_ROLES = ['HR_ADMIN', 'PEOPLE_ADMIN'] as const;
const DISPLAY_WORKFORCE_ROLES = ['ADMIN', ...WORKFORCE_ROLES] as const;

type PolicyStateFilter = EffectiveWorkforceAccessState | 'ALL';
type PolicyActionFilter = WorkforceAccessPolicy['actionCodes'][number] | 'ALL';

function displayDate(value?: string | null) {
  return value ? formatDate(value, { dateStyle: 'medium', timeStyle: 'short' }) : null;
}

function populationLabel(value: string, t: TFunction<'admin'>) {
  if (value === 'ORG_UNIT') return t('workforceAccess.populations.ORG_UNIT');
  if (value === 'ORG_TREE') return t('workforceAccess.populations.ORG_TREE');
  return t('workforceAccess.populations.TENANT');
}

function roleLabel(subjectRef: string, t: TFunction<'admin'>) {
  return DISPLAY_WORKFORCE_ROLES.includes(subjectRef as (typeof DISPLAY_WORKFORCE_ROLES)[number])
    ? t(`workforceAccess.roles.${subjectRef as (typeof DISPLAY_WORKFORCE_ROLES)[number]}`)
    : subjectRef;
}

function roleDescription(subjectRef: string, t: TFunction<'admin'>) {
  return DISPLAY_WORKFORCE_ROLES.includes(subjectRef as (typeof DISPLAY_WORKFORCE_ROLES)[number])
    ? t(
        `workforceAccess.roleDescriptions.${subjectRef as (typeof DISPLAY_WORKFORCE_ROLES)[number]}`
      )
    : null;
}

type WorkforcePolicySubject = { displayName: string; email?: string | null };
type WorkforceUserDisplayCache = {
  tenantId: number | null;
  usersById: ReadonlyMap<string, WorkforcePolicySubject>;
};
const EMPTY_USER_DISPLAY_MAP: ReadonlyMap<string, WorkforcePolicySubject> = new Map();

function policySubject(
  policy: WorkforceAccessPolicy,
  usersById: ReadonlyMap<string, WorkforcePolicySubject>,
  t: TFunction<'admin'>
): WorkforcePolicySubject {
  if (policy.subjectType === 'ROLE') return { displayName: roleLabel(policy.subjectRef, t) };
  return (
    usersById.get(policy.subjectRef) ?? {
      displayName: t('workforceAccess.userSubject', { id: policy.subjectRef }),
    }
  );
}

function policySubjectLabel(
  policy: WorkforceAccessPolicy,
  usersById: ReadonlyMap<string, { displayName: string; email?: string | null }>,
  t: TFunction<'admin'>
) {
  const user = policySubject(policy, usersById, t);
  return user?.email ? `${user.displayName} · ${user.email}` : user.displayName;
}

export function canRevokeWorkforceAccessPolicy(policy: WorkforceAccessPolicy): boolean {
  const state = effectiveWorkforcePolicyState(policy);
  return state === 'ACTIVE' || state === 'SCHEDULED';
}

function WorkforceAccessManagerContent() {
  const { t } = useTranslation('admin');
  const auth = useAuth();
  const tenantId = auth.user?.tenantId ?? null;
  const toast = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [revoke, setRevoke] = useState<WorkforceAccessPolicy | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<PolicyStateFilter>('ALL');
  const [actionFilter, setActionFilter] = useState<PolicyActionFilter>('ALL');
  const [userQuery, setUserQuery] = useState('');
  const [debouncedUserQuery, setDebouncedUserQuery] = useState('');
  const [userDisplayCache, setUserDisplayCache] = useState<WorkforceUserDisplayCache>(() => ({
    tenantId,
    usersById: new Map(),
  }));
  const policyQueryKey = useMemo(() => [...POLICY_QUERY_KEY, tenantId] as const, [tenantId]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedUserQuery(userQuery.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [userQuery]);

  const policies = useQuery({
    queryKey: policyQueryKey,
    queryFn: listWorkforceAccessPolicies,
    retry: false,
  });
  const shouldLoadUsers =
    open || Boolean(policies.data?.some((policy) => policy.subjectType === 'USER'));
  const organizations = useQuery({
    queryKey: ['admin', 'workforce-access', 'organizations', tenantId],
    queryFn: listWorkforcePolicyOrganizations,
    enabled: open,
    retry: false,
  });
  const users = useQuery({
    queryKey: ['admin', 'identity-users', 'workforce-access', tenantId, debouncedUserQuery],
    queryFn: () => listIdentityUsers(debouncedUserQuery),
    enabled: shouldLoadUsers,
    retry: false,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: policyQueryKey });

  const allUsers = useMemo(() => users.data?.content ?? [], [users.data?.content]);
  useEffect(() => {
    setUserDisplayCache((current) => {
      const usersById = current.tenantId === tenantId ? current.usersById : new Map();
      if (allUsers.length === 0) {
        return current.tenantId === tenantId ? current : { tenantId, usersById };
      }
      const next = new Map(usersById);
      let changed = false;
      allUsers.forEach((user) => {
        const key = String(user.userId);
        const known = usersById.get(key);
        if (known?.displayName === user.displayName && known.email === user.email) return;
        next.set(key, { displayName: user.displayName, email: user.email });
        changed = true;
      });
      return changed || current.tenantId !== tenantId ? { tenantId, usersById: next } : current;
    });
  }, [allUsers, tenantId]);
  const selectableUsers = useMemo(
    () => allUsers.filter((user) => String(user.userId) !== String(auth.user?.userId ?? '')),
    [allUsers, auth.user?.userId]
  );
  const usersById =
    userDisplayCache.tenantId === tenantId ? userDisplayCache.usersById : EMPTY_USER_DISPLAY_MAP;

  const searchTermsByPolicy = useMemo(
    () =>
      Object.fromEntries(
        (policies.data ?? []).map((policy) => [
          policy.policyId,
          [
            policySubjectLabel(policy, usersById, t),
            populationLabel(policy.populationType, t),
            ...policy.fieldGroups.map((field) => t(`workforceAccess.fieldGroups.${field}`)),
            ...policy.actionCodes.map((action) => t(`workforceAccess.actions.${action}`)),
            t(`workforceAccess.states.${effectiveWorkforcePolicyState(policy)}`),
          ],
        ])
      ),
    [policies.data, t, usersById]
  );
  const filteredPolicies = useMemo(
    () =>
      filterWorkforceAccessPolicies(
        policies.data ?? [],
        { search, state: stateFilter, operation: actionFilter },
        searchTermsByPolicy
      ),
    [actionFilter, policies.data, search, searchTermsByPolicy, stateFilter]
  );
  const unresolvedUserPolicies = useMemo(
    () =>
      (policies.data ?? []).filter(
        (policy) => policy.subjectType === 'USER' && !usersById.has(policy.subjectRef)
      ),
    [policies.data, usersById]
  );

  const columns = useMemo<GridColDef<WorkforceAccessPolicy>[]>(
    () => [
      {
        field: 'subjectRef',
        headerName: t('workforceAccess.columns.subject'),
        minWidth: 210,
        flex: 1.1,
        renderCell: ({ row }) => (
          <Stack justifyContent="center" sx={{ minWidth: 0, height: 1 }}>
            <Typography variant="body2" fontWeight={700} noWrap>
              {policySubjectLabel(row, usersById, t)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {row.subjectType === 'ROLE' && roleDescription(row.subjectRef, t)
                ? `${t(`workforceAccess.subjectTypes.${row.subjectType}`)} · ${roleDescription(
                    row.subjectRef,
                    t
                  )}`
                : t(`workforceAccess.subjectTypes.${row.subjectType}`)}
            </Typography>
          </Stack>
        ),
      },
      {
        field: 'populationType',
        headerName: t('workforceAccess.columns.population'),
        minWidth: 220,
        flex: 1.1,
        renderCell: ({ row }) => (
          <Stack justifyContent="center" sx={{ minWidth: 0, height: 1 }}>
            <Typography variant="body2" noWrap>
              {row.organizationName ?? populationLabel(row.populationType, t)}
            </Typography>
            {row.organizationName && (
              <Typography variant="caption" color="text.secondary" noWrap>
                {populationLabel(row.populationType, t)}
              </Typography>
            )}
          </Stack>
        ),
      },
      {
        field: 'fieldGroups',
        headerName: t('workforceAccess.columns.fields'),
        minWidth: 360,
        flex: 1.45,
        renderCell: ({ row }) => (
          <Stack direction="row" alignItems="center" flexWrap="wrap" gap={0.5} sx={{ py: 0.75 }}>
            {row.fieldGroups.map((field) => (
              <Chip key={field} size="small" label={t(`workforceAccess.fieldGroups.${field}`)} />
            ))}
          </Stack>
        ),
      },
      {
        field: 'actionCodes',
        headerName: t('workforceAccess.columns.allowedActions'),
        minWidth: 150,
        flex: 0.75,
        renderCell: ({ row }) => (
          <Stack direction="row" alignItems="center" gap={0.5}>
            {row.actionCodes.map((action) => (
              <Chip
                key={action}
                size="small"
                variant="outlined"
                color={action === 'EXPORT' ? 'warning' : 'info'}
                label={t(`workforceAccess.actions.${action}`)}
              />
            ))}
          </Stack>
        ),
      },
      {
        field: 'validTo',
        headerName: t('workforceAccess.columns.validity'),
        width: 190,
        renderCell: ({ row }) => (
          <Stack justifyContent="center" sx={{ height: 1 }}>
            <Typography variant="body2">
              {displayDate(row.validTo) ?? t('workforceAccess.noExpiry')}
            </Typography>
            {row.validFrom && (
              <Typography variant="caption" color="text.secondary">
                {t('workforceAccess.startsAt', { date: displayDate(row.validFrom) })}
              </Typography>
            )}
          </Stack>
        ),
      },
      {
        field: 'lifecycleState',
        headerName: t('workforceAccess.columns.status'),
        width: 120,
        renderCell: ({ row }) => {
          const state = effectiveWorkforcePolicyState(row);
          return (
            <Chip
              size="small"
              variant="outlined"
              color={state === 'ACTIVE' ? 'success' : state === 'SCHEDULED' ? 'info' : 'default'}
              label={t(`workforceAccess.states.${state}`)}
            />
          );
        },
      },
      {
        field: 'rowActions',
        headerName: t('workforceAccess.columns.actions'),
        width: 110,
        sortable: false,
        filterable: false,
        renderCell: ({ row }) =>
          canRevokeWorkforceAccessPolicy(row) ? (
            <ActionButton
              size="small"
              intent="danger"
              aria-label={t('workforceAccess.revoke.ariaLabel', {
                subject: policySubjectLabel(row, usersById, t),
              })}
              onClick={() => setRevoke(row)}
            >
              {t('workforceAccess.revoke.action')}
            </ActionButton>
          ) : null,
      },
    ],
    [t, usersById]
  );

  const hasFilters = Boolean(search.trim()) || stateFilter !== 'ALL' || actionFilter !== 'ALL';
  const resetFilters = () => {
    setSearch('');
    setStateFilter('ALL');
    setActionFilter('ALL');
  };
  return (
    <Stack gap={2.5}>
      <WorkforceAccessOverview policies={policies.data} />

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ sm: 'center' }}
        gap={1}
      >
        <Box>
          <Typography component="h2" variant="h6">
            {t('workforceAccess.list.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('workforceAccess.list.description')}
          </Typography>
        </Box>
        <ActionButton
          startIcon={<Plus size={16} />}
          disabled={policies.isError}
          onClick={() => setOpen(true)}
        >
          {t('workforceAccess.create')}
        </ActionButton>
      </Stack>

      {policies.isLoading ? (
        <ManagementPanelLoading label={t('workforceAccess.loading')} />
      ) : policies.isError ? (
        <ErrorState
          title={t('workforceAccess.error.title')}
          description={t('workforceAccess.error.description')}
          retryLabel={t('workforceAccess.error.retry')}
          retrying={policies.isFetching}
          onRetry={() => void policies.refetch()}
        />
      ) : (
        <>
          {unresolvedUserPolicies.length > 0 && users.isFetched && (
            <Alert severity={users.isError ? 'error' : 'warning'}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                gap={1}
              >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="subtitle2">
                    {t('workforceAccess.references.policyUsersTitle')}
                  </Typography>
                  <Typography variant="body2">
                    {users.isError
                      ? t('workforceAccess.references.policyUsersError')
                      : t('workforceAccess.references.policyUsersUnresolved', {
                          count: unresolvedUserPolicies.length,
                        })}
                  </Typography>
                </Box>
                <ActionButton
                  type="button"
                  size="small"
                  intent="secondary"
                  aria-disabled={users.isFetching || undefined}
                  sx={{ opacity: users.isFetching ? 0.64 : 1 }}
                  onClick={() => {
                    if (!users.isFetching) void users.refetch();
                  }}
                >
                  {t('workforceAccess.references.retryPolicyUsers')}
                </ActionButton>
              </Stack>
            </Alert>
          )}
          <FilterBar
            ariaLabel={t('workforceAccess.filters.ariaLabel')}
            searchLabel={t('workforceAccess.filters.searchLabel')}
            searchPlaceholder={t('workforceAccess.filters.searchPlaceholder')}
            searchValue={search}
            onSearchChange={setSearch}
            filters={
              <>
                <Box sx={{ width: 170 }}>
                  <SelectField
                    label={t('workforceAccess.filters.state')}
                    value={stateFilter}
                    options={(['ALL', 'ACTIVE', 'SCHEDULED', 'EXPIRED', 'REVOKED'] as const).map(
                      (value) => ({
                        value,
                        label:
                          value === 'ALL'
                            ? t('workforceAccess.filters.allStates')
                            : t(`workforceAccess.states.${value}`),
                      })
                    )}
                    onValueChange={(value) => setStateFilter((value ?? 'ALL') as PolicyStateFilter)}
                  />
                </Box>
                <Box sx={{ width: 170 }}>
                  <SelectField
                    label={t('workforceAccess.filters.action')}
                    value={actionFilter}
                    options={(['ALL', 'READ', 'EXPORT'] as const).map((value) => ({
                      value,
                      label:
                        value === 'ALL'
                          ? t('workforceAccess.filters.allActions')
                          : t(`workforceAccess.actions.${value}`),
                    }))}
                    onValueChange={(value) =>
                      setActionFilter((value ?? 'ALL') as PolicyActionFilter)
                    }
                  />
                </Box>
              </>
            }
            resultLabel={t('workforceAccess.filters.result', {
              count: filteredPolicies.length,
              total: policies.data?.length ?? 0,
            })}
            activeFilters={
              hasFilters
                ? [
                    {
                      key: 'all',
                      label: t('workforceAccess.filters.applied'),
                      onRemove: resetFilters,
                    },
                  ]
                : []
            }
            resetLabel={t('workforceAccess.filters.reset')}
            onReset={resetFilters}
          />
          <EnterpriseDataGrid
            ariaLabel={t('workforceAccess.gridLabel')}
            rows={filteredPolicies}
            columns={columns}
            getRowId={(row) => row.policyId}
            rowHeight={72}
            stickyColumns={{ right: ['rowActions'] }}
            minVisibleRows={5}
            maxVisibleRows={10}
            slots={{
              noRowsOverlay: () =>
                hasFilters ? (
                  <GuidedEmptyState
                    kind="no-results"
                    title={t('workforceAccess.empty.filteredTitle')}
                    description={t('workforceAccess.empty.filteredDescription')}
                    actionLabel={t('workforceAccess.filters.reset')}
                    onAction={resetFilters}
                    size="compact"
                  />
                ) : (
                  <GuidedEmptyState
                    kind="first-use"
                    title={t('workforceAccess.empty.title')}
                    description={t('workforceAccess.empty.description')}
                    actionLabel={t('workforceAccess.create')}
                    onAction={() => setOpen(true)}
                    size="compact"
                  />
                ),
            }}
            sx={{ border: 0, borderRadius: 0 }}
          />
        </>
      )}

      {open && (
        <WorkforceAccessPolicyDialog
          open
          busy={busy}
          organizationsLoading={organizations.isFetching}
          organizationsError={organizations.isError}
          usersLoading={users.isFetching}
          usersError={users.isError}
          users={selectableUsers}
          userQuery={userQuery}
          organizations={organizations.data ?? []}
          onUserQueryChange={setUserQuery}
          onRetryOrganizations={() => void organizations.refetch()}
          onRetryUsers={() => void users.refetch()}
          onClose={() => {
            setOpen(false);
            setUserQuery('');
          }}
          onSave={async (request) => {
            setBusy(true);
            try {
              await createWorkforceAccessPolicy(request);
              await refresh();
              setOpen(false);
              setUserQuery('');
              toast.success(t('workforceAccess.toasts.created'));
            } catch {
              await refresh();
              toast.error(t('workforceAccess.toasts.createFailed'));
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
      {revoke && (
        <WorkforceAccessRevokeDialog
          policy={revoke}
          subject={policySubject(revoke, usersById, t)}
          busy={busy}
          onClose={() => setRevoke(null)}
          onSubmit={async (reason) => {
            setBusy(true);
            try {
              await revokeWorkforceAccessPolicy(revoke, reason);
              await refresh();
              setRevoke(null);
              toast.success(t('workforceAccess.toasts.revoked'));
            } catch {
              await refresh();
              toast.error(t('workforceAccess.toasts.revokeFailed'));
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </Stack>
  );
}

export function WorkforceAccessManager() {
  return <WorkforceAccessManagerContent />;
}
