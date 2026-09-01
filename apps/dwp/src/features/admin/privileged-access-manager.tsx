import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Check,
  Clock3,
  KeyRound,
  Plus,
  ShieldAlert,
  ShieldCheck,
  UserRoundCog,
  X,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createDelegatedAdminScope,
  createPrivilegedRoleEligibility,
  decidePrivilegedAccessRequest,
  listDelegatedAdminScopes,
  listDirectoryGroups,
  listEmergencyAccessPrincipals,
  listIdentityUsers,
  listPrivilegedAccessPolicies,
  listPrivilegedAccessRequests,
  listPrivilegedRoleEligibilities,
  registerEmergencyAccessPrincipal,
  revokeDelegatedAdminScope,
  revokePrivilegedAccessRequest,
  revokePrivilegedRoleEligibility,
  updatePrivilegedAccessPolicy,
  useToast,
} from '@dwp-frontend/shared-utils';
import { useRoleDisplay } from '@dwp-frontend/shared-i18n';
import { ActionButton, EnterpriseDataGrid } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';

import {
  ManagementPanelError,
  ManagementPanelLoading,
} from '../../components/management-panel-state';
import { localizedRoleNameColumn } from './localized-role-column';
import { PrivilegedBoundaryQueryState } from './privileged-boundary-query-state';
import {
  activationModeLabel,
  assuranceLabel,
  delegatedActionLabel,
  displayPrivilegedDate as displayDate,
  emergencyModeLabel,
  privilegedAccessError as message,
  privilegedScopeLabel as scopeLabel,
  privilegedStatusColor as statusColor,
} from './privileged-access-display';
import {
  BoundaryDialog,
  EligibilityDialog,
  PolicyDialog,
  PrivilegedAccessDecisionDialog as DecisionDialog,
} from './privileged-access-dialogs';

import type { GridColDef } from '@mui/x-data-grid';
import type {
  DelegatedAdminScope,
  EmergencyAccessPrincipal,
  PrivilegedAccessPolicy,
  PrivilegedAccessRequest,
  PrivilegedRoleEligibility,
} from '@dwp-frontend/shared-utils';
import type { PrivilegedAccessDecision as Decision } from './privileged-access-dialogs';

type View = 'requests' | 'eligibilities' | 'policies' | 'boundaries';

function Metric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <Box sx={{ minWidth: 0, px: 2, py: 1.5, borderRight: { md: 1 }, borderColor: 'divider' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Typography variant="caption" color="text.secondary" fontWeight={700}>
          {label}
        </Typography>
        <Icon size={17} aria-hidden="true" />
      </Stack>
      <Typography component="p" variant="h5" sx={{ mt: 0.5, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {detail}
      </Typography>
    </Box>
  );
}

export function PrivilegedAccessManager() {
  const { t } = useTranslation('admin');
  const displayRole = useRoleDisplay();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>('requests');
  const [busy, setBusy] = useState(false);
  const [policy, setPolicy] = useState<PrivilegedAccessPolicy | null>(null);
  const [eligibilityOpen, setEligibilityOpen] = useState(false);
  const [decision, setDecision] = useState<{
    request: PrivilegedAccessRequest;
    decision: Decision;
  } | null>(null);
  const [boundaryDialog, setBoundaryDialog] = useState<'emergency' | 'delegation' | null>(null);

  const policies = useQuery({
    queryKey: ['admin', 'privileged-access', 'policies'],
    queryFn: listPrivilegedAccessPolicies,
  });
  const eligibilities = useQuery({
    queryKey: ['admin', 'privileged-access', 'eligibilities'],
    queryFn: listPrivilegedRoleEligibilities,
  });
  const requests = useQuery({
    queryKey: ['admin', 'privileged-access', 'requests'],
    queryFn: listPrivilegedAccessRequests,
  });
  const users = useQuery({
    queryKey: ['admin', 'identity-users', 'privileged-access'],
    queryFn: () => listIdentityUsers(''),
  });
  const groups = useQuery({
    queryKey: ['admin', 'directory-groups', 'privileged-access'],
    queryFn: () => listDirectoryGroups('', 'ACTIVE', 0, 100),
  });
  const emergency = useQuery({
    queryKey: ['admin', 'privileged-access', 'emergency-principals'],
    queryFn: listEmergencyAccessPrincipals,
    enabled: view === 'boundaries',
  });
  const delegated = useQuery({
    queryKey: ['admin', 'privileged-access', 'delegated-scopes'],
    queryFn: listDelegatedAdminScopes,
    enabled: view === 'boundaries',
  });

  const run = useCallback(
    async (action: () => Promise<unknown>, success: string): Promise<boolean> => {
      setBusy(true);
      try {
        await action();
        await queryClient.invalidateQueries({ queryKey: ['admin', 'privileged-access'] });
        toast.success(success);
        return true;
      } catch (error) {
        toast.error(message(error, t('common.operationError')));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [queryClient, t, toast]
  );

  const requestColumns = useMemo<GridColDef<PrivilegedAccessRequest>[]>(
    () => [
      {
        field: 'requesterDisplayName',
        headerName: t('privilegedAccess.columns.requester'),
        minWidth: 180,
        flex: 1,
      },
      localizedRoleNameColumn(t('roleGovernance.columns.role'), displayRole, 180),
      {
        field: 'scopeType',
        headerName: t('roleGovernance.columns.scope'),
        width: 130,
        valueFormatter: (value) => scopeLabel(String(value), t),
      },
      {
        field: 'lifecycleState',
        headerName: t('roleGovernance.columns.status'),
        width: 160,
        renderCell: ({ row }) => (
          <Chip
            size="small"
            color={statusColor(row.lifecycleState)}
            variant="outlined"
            label={t(`privilegedAccess.states.${row.lifecycleState}`)}
          />
        ),
      },
      {
        field: 'expiresAt',
        headerName: t('roleGovernance.columns.validTo'),
        width: 190,
        valueFormatter: (value) => displayDate(value),
      },
      {
        field: 'actions',
        type: 'actions',
        headerName: t('privilegedAccess.columns.nextAction'),
        width: 250,
        getActions: ({ row }) => {
          if (row.lifecycleState === 'PENDING_APPROVAL') {
            return [
              <ActionButton
                key="approve"
                size="small"
                intent="primary"
                startIcon={<Check size={15} />}
                onClick={() => setDecision({ request: row, decision: 'APPROVE' })}
              >
                {t('privilegedAccess.actions.approve')}
              </ActionButton>,
              <ActionButton
                key="deny"
                size="small"
                intent="quiet"
                startIcon={<X size={15} />}
                onClick={() => setDecision({ request: row, decision: 'DENY' })}
              >
                {t('privilegedAccess.actions.deny')}
              </ActionButton>,
            ];
          }
          return row.lifecycleState === 'ACTIVE'
            ? [
                <ActionButton
                  key="revoke"
                  size="small"
                  intent="danger"
                  onClick={() => setDecision({ request: row, decision: 'REVOKE' })}
                >
                  {t('privilegedAccess.actions.revoke')}
                </ActionButton>,
              ]
            : [];
        },
      },
    ],
    [displayRole, t]
  );

  const eligibilityColumns = useMemo<GridColDef<PrivilegedRoleEligibility>[]>(
    () => [
      {
        field: 'principalDisplayName',
        headerName: t('privilegedAccess.columns.principal'),
        minWidth: 190,
        flex: 1,
      },
      localizedRoleNameColumn(t('roleGovernance.columns.role'), displayRole, 180),
      {
        field: 'scopeType',
        headerName: t('roleGovernance.columns.scope'),
        width: 130,
        valueFormatter: (value) => scopeLabel(String(value), t),
      },
      {
        field: 'validTo',
        headerName: t('roleGovernance.columns.validTo'),
        width: 190,
        valueFormatter: (value) => displayDate(value),
      },
      {
        field: 'lifecycleState',
        headerName: t('roleGovernance.columns.status'),
        width: 130,
        renderCell: ({ row }) => (
          <Chip
            size="small"
            variant="outlined"
            color={statusColor(row.lifecycleState)}
            label={t(`privilegedAccess.states.${row.lifecycleState}`)}
          />
        ),
      },
      {
        field: 'actions',
        type: 'actions',
        width: 120,
        getActions: ({ row }) =>
          row.lifecycleState === 'ACTIVE'
            ? [
                <ActionButton
                  key="revoke"
                  size="small"
                  intent="quiet"
                  onClick={() =>
                    void run(
                      () => revokePrivilegedRoleEligibility(row),
                      t('privilegedAccess.toasts.eligibilityRevoked')
                    )
                  }
                >
                  {t('privilegedAccess.actions.revoke')}
                </ActionButton>,
              ]
            : [],
      },
    ],
    [displayRole, run, t]
  );

  const policyColumns = useMemo<GridColDef<PrivilegedAccessPolicy>[]>(
    () => [
      localizedRoleNameColumn(t('roleGovernance.columns.role'), displayRole, 200),
      {
        field: 'activationMode',
        headerName: t('privilegedAccess.fields.activationMode'),
        width: 160,
        valueFormatter: (value) => activationModeLabel(String(value), t),
      },
      {
        field: 'assuranceLevel',
        headerName: t('privilegedAccess.fields.assurance'),
        width: 180,
        valueFormatter: (value) => assuranceLabel(String(value), t),
      },
      {
        field: 'maximumDurationMinutes',
        headerName: t('privilegedAccess.fields.maximumDuration'),
        width: 150,
        valueFormatter: (value) => t('privilegedAccess.minutes', { count: value }),
      },
      {
        field: 'emergencyMode',
        headerName: t('privilegedAccess.fields.emergencyMode'),
        width: 190,
        valueFormatter: (value) => emergencyModeLabel(String(value), t),
      },
      {
        field: 'actions',
        type: 'actions',
        width: 110,
        getActions: ({ row }) => [
          <ActionButton key="edit" size="small" intent="quiet" onClick={() => setPolicy(row)}>
            {t('common.actions.edit')}
          </ActionButton>,
        ],
      },
    ],
    [displayRole, t]
  );

  if (policies.isLoading || eligibilities.isLoading || requests.isLoading) {
    return <ManagementPanelLoading label={t('privilegedAccess.loading')} />;
  }
  if (policies.isError || eligibilities.isError || requests.isError) {
    return (
      <ManagementPanelError
        message={message(
          policies.error ?? eligibilities.error ?? requests.error,
          t('common.operationError')
        )}
      />
    );
  }

  const requestRows = requests.data ?? [];
  const eligibilityRows = eligibilities.data ?? [];
  const policyRows = policies.data ?? [];
  const active = requestRows.filter((item) => item.lifecycleState === 'ACTIVE').length;
  const pending = requestRows.filter((item) => item.lifecycleState === 'PENDING_APPROVAL').length;
  const expiring = eligibilityRows.filter((item) => {
    if (!item.validTo || item.lifecycleState !== 'ACTIVE') return false;
    const days = (new Date(item.validTo).getTime() - Date.now()) / 86_400_000;
    return days >= 0 && days <= 14;
  }).length;

  return (
    <Box sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, minmax(0, 1fr))' },
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Metric
          icon={ShieldCheck}
          label={t('privilegedAccess.metrics.policies')}
          value={policyRows.filter((item) => item.lifecycleState === 'ACTIVE').length}
          detail={t('privilegedAccess.metrics.policiesDetail')}
        />
        <Metric
          icon={Clock3}
          label={t('privilegedAccess.metrics.pending')}
          value={pending}
          detail={t('privilegedAccess.metrics.pendingDetail')}
        />
        <Metric
          icon={KeyRound}
          label={t('privilegedAccess.metrics.active')}
          value={active}
          detail={t('privilegedAccess.metrics.activeDetail')}
        />
        <Metric
          icon={ShieldAlert}
          label={t('privilegedAccess.metrics.expiring')}
          value={expiring}
          detail={t('privilegedAccess.metrics.expiringDetail')}
        />
      </Box>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'stretch', md: 'center' }}
        justifyContent="space-between"
        gap={1}
        sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tabs
          value={view}
          onChange={(_event, next: View) => setView(next)}
          aria-label={t('privilegedAccess.views.label')}
          variant="scrollable"
          allowScrollButtonsMobile
        >
          <Tab value="requests" label={t('privilegedAccess.views.requests')} />
          <Tab value="eligibilities" label={t('privilegedAccess.views.eligibilities')} />
          <Tab value="policies" label={t('privilegedAccess.views.policies')} />
          <Tab value="boundaries" label={t('privilegedAccess.views.boundaries')} />
        </Tabs>
        {view === 'eligibilities' && (
          <ActionButton
            intent="primary"
            size="small"
            startIcon={<Plus size={16} />}
            onClick={() => setEligibilityOpen(true)}
          >
            {t('privilegedAccess.actions.createEligibility')}
          </ActionButton>
        )}
        {view === 'boundaries' && (
          <Stack direction="row" gap={1}>
            <ActionButton
              size="small"
              startIcon={<UserRoundCog size={16} />}
              onClick={() => setBoundaryDialog('delegation')}
            >
              {t('privilegedAccess.actions.addDelegation')}
            </ActionButton>
            <ActionButton
              size="small"
              intent="primary"
              startIcon={<ShieldAlert size={16} />}
              onClick={() => setBoundaryDialog('emergency')}
            >
              {t('privilegedAccess.actions.registerEmergency')}
            </ActionButton>
          </Stack>
        )}
      </Stack>

      {view === 'requests' && (
        <EnterpriseDataGrid
          ariaLabel={t('privilegedAccess.views.requests')}
          rows={requestRows}
          columns={requestColumns}
          getRowId={(row) => row.requestId}
          stickyColumns={{ right: ['actions'] }}
          minVisibleRows={5}
          maxVisibleRows={10}
          sx={{ border: 0, borderRadius: 0 }}
        />
      )}
      {view === 'eligibilities' && (
        <EnterpriseDataGrid
          ariaLabel={t('privilegedAccess.views.eligibilities')}
          rows={eligibilityRows}
          columns={eligibilityColumns}
          getRowId={(row) => row.eligibilityId}
          minVisibleRows={5}
          maxVisibleRows={10}
          sx={{ border: 0, borderRadius: 0 }}
        />
      )}
      {view === 'policies' && (
        <EnterpriseDataGrid
          ariaLabel={t('privilegedAccess.views.policies')}
          rows={policyRows}
          columns={policyColumns}
          getRowId={(row) => row.policyId}
          minVisibleRows={5}
          maxVisibleRows={10}
          sx={{ border: 0, borderRadius: 0 }}
        />
      )}
      {view === 'boundaries' && (
        <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
          <Box>
            <Box sx={{ px: 2, pt: 2 }}>
              <Typography variant="subtitle1" fontWeight={800}>
                {t('privilegedAccess.boundaries.delegatedTitle')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('privilegedAccess.boundaries.delegatedDescription')}
              </Typography>
            </Box>
            <PrivilegedBoundaryQueryState
              query={delegated}
              title={t('privilegedAccess.boundaries.delegatedTitle')}
              description={message(delegated.error, t('common.operationError'))}
              retryLabel={t('roleGovernance.actions.retry')}
            >
              <EnterpriseDataGrid<DelegatedAdminScope>
                ariaLabel={t('privilegedAccess.boundaries.delegatedTitle')}
                rows={delegated.data ?? []}
                columns={[
                  {
                    field: 'administratorDisplayName',
                    headerName: t('privilegedAccess.columns.principal'),
                    minWidth: 180,
                    flex: 1,
                  },
                  {
                    field: 'actionCode',
                    headerName: t('privilegedAccess.fields.action'),
                    minWidth: 240,
                    flex: 1,
                    valueFormatter: (value) => delegatedActionLabel(String(value), t),
                  },
                  {
                    field: 'scopeType',
                    headerName: t('roleGovernance.columns.scope'),
                    width: 140,
                    valueFormatter: (value) => scopeLabel(String(value), t),
                  },
                  {
                    field: 'validTo',
                    headerName: t('roleGovernance.columns.validTo'),
                    width: 190,
                    valueFormatter: (value) => displayDate(value),
                  },
                  {
                    field: 'actions',
                    type: 'actions',
                    width: 110,
                    getActions: ({ row }) =>
                      row.lifecycleState === 'ACTIVE'
                        ? [
                            <ActionButton
                              key="revoke"
                              size="small"
                              intent="quiet"
                              onClick={() =>
                                void run(
                                  () => revokeDelegatedAdminScope(row),
                                  t('privilegedAccess.toasts.delegationRevoked')
                                )
                              }
                            >
                              {t('privilegedAccess.actions.revoke')}
                            </ActionButton>,
                          ]
                        : [],
                  },
                ]}
                getRowId={(row) => row.scopeId}
                hideFooter
                minVisibleRows={2}
                maxVisibleRows={5}
                sx={{ border: 0, borderRadius: 0 }}
              />
            </PrivilegedBoundaryQueryState>
          </Box>
          <Box>
            <Box sx={{ px: 2, pt: 2 }}>
              <Typography variant="subtitle1" fontWeight={800}>
                {t('privilegedAccess.boundaries.emergencyTitle')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('privilegedAccess.boundaries.emergencyDescription')}
              </Typography>
            </Box>
            <PrivilegedBoundaryQueryState
              query={emergency}
              title={t('privilegedAccess.boundaries.emergencyTitle')}
              description={message(emergency.error, t('common.operationError'))}
              retryLabel={t('roleGovernance.actions.retry')}
            >
              <EnterpriseDataGrid<EmergencyAccessPrincipal>
                ariaLabel={t('privilegedAccess.boundaries.emergencyTitle')}
                rows={emergency.data ?? []}
                columns={[
                  {
                    field: 'displayName',
                    headerName: t('privilegedAccess.columns.principal'),
                    minWidth: 180,
                    flex: 1,
                  },
                  {
                    field: 'justification',
                    headerName: t('roleGovernance.fields.justification'),
                    minWidth: 260,
                    flex: 2,
                  },
                  {
                    field: 'reviewDueAt',
                    headerName: t('privilegedAccess.fields.reviewDueAt'),
                    width: 190,
                    valueFormatter: (value) => displayDate(value),
                  },
                  {
                    field: 'lifecycleState',
                    headerName: t('roleGovernance.columns.status'),
                    width: 120,
                    renderCell: ({ row }) => (
                      <Chip
                        size="small"
                        color={statusColor(row.lifecycleState)}
                        variant="outlined"
                        label={t(`privilegedAccess.states.${row.lifecycleState}`)}
                      />
                    ),
                  },
                ]}
                getRowId={(row) => row.emergencyPrincipalId}
                hideFooter
                minVisibleRows={2}
                maxVisibleRows={5}
                sx={{ border: 0, borderRadius: 0 }}
              />
            </PrivilegedBoundaryQueryState>
          </Box>
        </Stack>
      )}

      <PolicyDialog
        key={`policy-${policy?.policyId ?? 'closed'}`}
        policy={policy}
        busy={busy}
        onClose={() => setPolicy(null)}
        onSave={async (changes) => {
          if (!policy) return;
          const saved = await run(
            () => updatePrivilegedAccessPolicy(policy, changes),
            t('privilegedAccess.toasts.policyUpdated')
          );
          if (saved) setPolicy(null);
        }}
      />
      <EligibilityDialog
        key={`eligibility-${eligibilityOpen ? 'open' : 'closed'}`}
        open={eligibilityOpen}
        busy={busy}
        policies={policyRows}
        users={users.data?.content ?? []}
        groups={groups.data?.content ?? []}
        onClose={() => setEligibilityOpen(false)}
        onCreate={async (request) => {
          const saved = await run(
            () => createPrivilegedRoleEligibility(request),
            t('privilegedAccess.toasts.eligibilityCreated')
          );
          if (saved) setEligibilityOpen(false);
        }}
      />
      <DecisionDialog
        key={`decision-${decision ? `${decision.request.requestId}:${decision.decision}` : 'closed'}`}
        operation={decision}
        busy={busy}
        onClose={() => setDecision(null)}
        onSubmit={async (reason) => {
          if (!decision) return;
          const saved = await run(
            () =>
              decision.decision === 'REVOKE'
                ? revokePrivilegedAccessRequest(decision.request, reason)
                : decidePrivilegedAccessRequest(decision.request, decision.decision, reason),
            t(`privilegedAccess.toasts.${decision.decision.toLowerCase()}`)
          );
          if (saved) setDecision(null);
        }}
      />
      <BoundaryDialog
        key={`boundary-${boundaryDialog ?? 'closed'}`}
        kind={boundaryDialog}
        busy={busy}
        users={users.data?.content ?? []}
        onClose={() => setBoundaryDialog(null)}
        onSubmit={async (request) => {
          let saved: boolean;
          if (boundaryDialog === 'emergency') {
            saved = await run(
              () =>
                registerEmergencyAccessPrincipal(
                  request as { userId: number; justification: string; reviewDueAt: string }
                ),
              t('privilegedAccess.toasts.emergencyRegistered')
            );
          } else {
            saved = await run(
              () =>
                createDelegatedAdminScope(
                  request as {
                    administratorUserId: number;
                    scopeType: 'TENANT' | 'ORG_UNIT' | 'RESOURCE';
                    scopeRef?: string;
                    actionCode: string;
                    justification: string;
                  }
                ),
              t('privilegedAccess.toasts.delegationCreated')
            );
          }
          if (saved) setBoundaryDialog(null);
        }}
      />
    </Box>
  );
}
