import { useMemo, useState } from 'react';
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
  return WORKFORCE_ROLES.includes(subjectRef as (typeof WORKFORCE_ROLES)[number])
    ? t(`workforceAccess.roles.${subjectRef as (typeof WORKFORCE_ROLES)[number]}`)
    : subjectRef;
}

function policySubjectLabel(
  policy: WorkforceAccessPolicy,
  usersById: ReadonlyMap<string, { displayName: string; email?: string | null }>,
  t: TFunction<'admin'>
) {
  if (policy.subjectType === 'ROLE') return roleLabel(policy.subjectRef, t);
  const user = usersById.get(policy.subjectRef);
  return user?.email
    ? `${user.displayName} · ${user.email}`
    : (user?.displayName ?? t('workforceAccess.userSubject', { id: policy.subjectRef }));
}

export function canRevokeWorkforceAccessPolicy(policy: WorkforceAccessPolicy): boolean {
  const state = effectiveWorkforcePolicyState(policy);
  return state === 'ACTIVE' || state === 'SCHEDULED';
}

function WorkforceAccessManagerContent() {
  const { t } = useTranslation('admin');
  const auth = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [revoke, setRevoke] = useState<WorkforceAccessPolicy | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<PolicyStateFilter>('ALL');
  const [actionFilter, setActionFilter] = useState<PolicyActionFilter>('ALL');

  const policies = useQuery({
    queryKey: POLICY_QUERY_KEY,
    queryFn: listWorkforceAccessPolicies,
  });
  const shouldLoadUsers =
    open || Boolean(policies.data?.some((policy) => policy.subjectType === 'USER'));
  const organizations = useQuery({
    queryKey: ['admin', 'workforce-access', 'organizations'],
    queryFn: listWorkforcePolicyOrganizations,
    enabled: open,
  });
  const users = useQuery({
    queryKey: ['admin', 'identity-users', 'workforce-access'],
    queryFn: () => listIdentityUsers(''),
    enabled: shouldLoadUsers,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: POLICY_QUERY_KEY });

  const allUsers = useMemo(() => users.data?.content ?? [], [users.data?.content]);
  const selectableUsers = useMemo(
    () => allUsers.filter((user) => String(user.userId) !== String(auth.user?.userId ?? '')),
    [allUsers, auth.user?.userId]
  );
  const usersById = useMemo(
    () => new Map(allUsers.map((user) => [String(user.userId), user])),
    [allUsers]
  );

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
              {t(`workforceAccess.subjectTypes.${row.subjectType}`)}
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
        minWidth: 280,
        flex: 1.45,
        renderCell: ({ row }) => (
          <Stack direction="row" alignItems="center" gap={0.5} sx={{ overflow: 'hidden' }}>
            {row.fieldGroups.slice(0, 2).map((field) => (
              <Chip key={field} size="small" label={t(`workforceAccess.fieldGroups.${field}`)} />
            ))}
            {row.fieldGroups.length > 2 && (
              <Chip size="small" variant="outlined" label={`+${row.fieldGroups.length - 2}`} />
            )}
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
        type: 'actions',
        headerName: t('workforceAccess.columns.actions'),
        width: 110,
        getActions: ({ row }) =>
          canRevokeWorkforceAccessPolicy(row)
            ? [
                <ActionButton
                  key="revoke"
                  size="small"
                  intent="danger"
                  aria-label={t('workforceAccess.revoke.ariaLabel', {
                    subject: policySubjectLabel(row, usersById, t),
                  })}
                  onClick={() => setRevoke(row)}
                >
                  {t('workforceAccess.revoke.action')}
                </ActionButton>,
              ]
            : [],
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
  const referenceLoading = organizations.isFetching || users.isFetching;
  const referenceError = organizations.isError || users.isError;

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
          referencesLoading={referenceLoading}
          referencesError={referenceError}
          users={selectableUsers}
          organizations={organizations.data ?? []}
          onRetryReferences={() => {
            void Promise.all([organizations.refetch(), users.refetch()]);
          }}
          onClose={() => setOpen(false)}
          onSave={async (request) => {
            setBusy(true);
            try {
              await createWorkforceAccessPolicy(request);
              await refresh();
              setOpen(false);
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
