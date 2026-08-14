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
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  DateTimePickerField,
  EnterpriseDataGrid,
  FormDialog,
  FormField,
  SelectField,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';

import {
  ManagementPanelError,
  ManagementPanelLoading,
} from '../../components/management-panel-state';

import type { GridColDef } from '@mui/x-data-grid';
import type { TFunction } from 'i18next';
import type {
  DelegatedAdminScope,
  EmergencyAccessPrincipal,
  PrivilegedAccessPolicy,
  PrivilegedAccessRequest,
  PrivilegedRoleEligibility,
} from '@dwp-frontend/shared-utils';

type View = 'requests' | 'eligibilities' | 'policies' | 'boundaries';
type Decision = 'APPROVE' | 'DENY' | 'REVOKE';

function message(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function displayDate(value?: string | null) {
  return value ? formatDate(value, { dateStyle: 'medium', timeStyle: 'short' }) : '-';
}

function statusColor(state: string) {
  if (state === 'ACTIVE') return 'success' as const;
  if (state === 'PENDING_APPROVAL') return 'warning' as const;
  if (state === 'DENIED' || state === 'REVOKED') return 'error' as const;
  return 'default' as const;
}

function scopeLabel(value: string, t: TFunction<'admin'>): string {
  if (value === 'ORG_UNIT') return t('roleGovernance.scopes.ORG_UNIT');
  if (value === 'RESOURCE') return t('roleGovernance.scopes.RESOURCE');
  return t('roleGovernance.scopes.TENANT');
}

function activationModeLabel(value: string, t: TFunction<'admin'>): string {
  if (value === 'SELF_SERVICE') return t('privilegedAccess.activationModes.SELF_SERVICE');
  if (value === 'DISABLED') return t('privilegedAccess.activationModes.DISABLED');
  return t('privilegedAccess.activationModes.APPROVAL');
}

function assuranceLabel(value: string, t: TFunction<'admin'>): string {
  if (value === 'PHISHING_RESISTANT') {
    return t('privilegedAccess.assurance.PHISHING_RESISTANT');
  }
  if (value === 'MFA') return t('privilegedAccess.assurance.MFA');
  return t('privilegedAccess.assurance.SESSION');
}

function emergencyModeLabel(value: string, t: TFunction<'admin'>): string {
  if (value === 'REGISTERED_PRINCIPAL') {
    return t('privilegedAccess.emergencyModes.REGISTERED_PRINCIPAL');
  }
  if (value === 'DUAL_APPROVAL') return t('privilegedAccess.emergencyModes.DUAL_APPROVAL');
  return t('privilegedAccess.emergencyModes.DISABLED');
}

function delegatedActionLabel(value: string, t: TFunction<'admin'>): string {
  if (value === 'ACCESS.ROLE.MANAGE') {
    return t('privilegedAccess.actionsCatalog.ACCESS.ROLE.MANAGE');
  }
  if (value === 'ACCESS.RESOURCE.MANAGE') {
    return t('privilegedAccess.actionsCatalog.ACCESS.RESOURCE.MANAGE');
  }
  return t('privilegedAccess.actionsCatalog.ACCESS.ASSIGNMENT.MANAGE');
}

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

function DecisionDialog({
  operation,
  busy,
  onClose,
  onSubmit,
}: {
  operation: { request: PrivilegedAccessRequest; decision: Decision } | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const [reason, setReason] = useState('');
  return (
    <FormDialog
      open={Boolean(operation)}
      title={t(`privilegedAccess.decision.${operation?.decision ?? 'APPROVE'}.title`)}
      description={t('privilegedAccess.decision.description', {
        role: operation?.request.roleName,
        person: operation?.request.requesterDisplayName,
      })}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t(`privilegedAccess.decision.${operation?.decision ?? 'APPROVE'}.action`)}
      submitIntent={operation?.decision === 'APPROVE' ? 'primary' : 'danger'}
      submitDisabled={reason.trim().length < 10}
      busy={busy}
      onClose={onClose}
      onSubmit={() => onSubmit(reason.trim())}
    >
      <FormField
        autoFocus
        required
        multiline
        minRows={3}
        label={t('privilegedAccess.fields.reason')}
        supportingText={t('privilegedAccess.fields.reasonHelp')}
        value={reason}
        inputProps={{ maxLength: 1000 }}
        onChange={(event) => setReason(event.target.value)}
      />
    </FormDialog>
  );
}

function PolicyDialog({
  policy,
  busy,
  onClose,
  onSave,
}: {
  policy: PrivilegedAccessPolicy | null;
  busy: boolean;
  onClose: () => void;
  onSave: (
    changes: Omit<
      PrivilegedAccessPolicy,
      'policyId' | 'roleId' | 'roleCode' | 'roleName' | 'version'
    >
  ) => Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const [activationMode, setActivationMode] = useState(policy?.activationMode ?? 'APPROVAL');
  const [duration, setDuration] = useState(String(policy?.maximumDurationMinutes ?? 120));
  const [assurance, setAssurance] = useState(policy?.assuranceLevel ?? 'MFA');
  const [quorum, setQuorum] = useState(String(policy?.approvalQuorum ?? 1));
  const [emergencyMode, setEmergencyMode] = useState(policy?.emergencyMode ?? 'DISABLED');
  const [ticketRequired, setTicketRequired] = useState(policy?.ticketRequired ?? true);
  const [lifecycle, setLifecycle] = useState(policy?.lifecycleState ?? 'ACTIVE');
  const valid = Number(duration) >= 15 && Number(duration) <= 480;

  return (
    <FormDialog
      open={Boolean(policy)}
      title={t('privilegedAccess.policyDialog.title', { role: policy?.roleName })}
      description={t('privilegedAccess.policyDialog.description')}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t('common.actions.save')}
      submitDisabled={!valid}
      busy={busy}
      onClose={onClose}
      onSubmit={() =>
        onSave({
          activationMode,
          maximumDurationMinutes: Number(duration),
          assuranceLevel: assurance,
          approvalQuorum: Number(quorum),
          emergencyMode,
          ticketRequired,
          lifecycleState: lifecycle,
        })
      }
    >
      <Stack gap={2}>
        <SelectField
          label={t('privilegedAccess.fields.activationMode')}
          value={activationMode}
          options={(['SELF_SERVICE', 'APPROVAL', 'DISABLED'] as const).map((value) => ({
            value,
            label: t(`privilegedAccess.activationModes.${value}`),
          }))}
          onValueChange={(value) => value && setActivationMode(value)}
        />
        <FormField
          required
          type="number"
          label={t('privilegedAccess.fields.maximumDuration')}
          value={duration}
          inputProps={{ min: 15, max: 480, step: 15 }}
          errorMessage={valid ? undefined : t('privilegedAccess.fields.durationError')}
          onChange={(event) => setDuration(event.target.value)}
        />
        <SelectField
          label={t('privilegedAccess.fields.assurance')}
          value={assurance}
          options={(['SESSION', 'MFA', 'PHISHING_RESISTANT'] as const).map((value) => ({
            value,
            label: t(`privilegedAccess.assurance.${value}`),
          }))}
          onValueChange={(value) => value && setAssurance(value)}
        />
        <SelectField
          label={t('privilegedAccess.fields.approvalQuorum')}
          value={quorum}
          options={[
            { value: '1', label: t('privilegedAccess.quorum', { count: 1 }) },
            { value: '2', label: t('privilegedAccess.quorum', { count: 2 }) },
          ]}
          onValueChange={(value) => value && setQuorum(value)}
        />
        <SelectField
          label={t('privilegedAccess.fields.emergencyMode')}
          value={emergencyMode}
          options={(['DISABLED', 'REGISTERED_PRINCIPAL', 'DUAL_APPROVAL'] as const).map(
            (value) => ({
              value,
              label: t(`privilegedAccess.emergencyModes.${value}`),
            })
          )}
          onValueChange={(value) => value && setEmergencyMode(value)}
        />
        <SelectField
          label={t('roleGovernance.fields.status')}
          value={lifecycle}
          options={(['ACTIVE', 'RETIRED'] as const).map((value) => ({
            value,
            label: t(`privilegedAccess.states.${value}`),
          }))}
          onValueChange={(value) => value && setLifecycle(value)}
        />
        <FormControlLabel
          control={
            <Switch
              checked={ticketRequired}
              onChange={(event) => setTicketRequired(event.target.checked)}
            />
          }
          label={t('privilegedAccess.fields.ticketRequired')}
        />
      </Stack>
    </FormDialog>
  );
}

function EligibilityDialog({
  open,
  busy,
  policies,
  users,
  groups,
  onClose,
  onCreate,
}: {
  open: boolean;
  busy: boolean;
  policies: PrivilegedAccessPolicy[];
  users: Array<{ userId: number; displayName: string }>;
  groups: Array<{ groupId: number; displayName: string }>;
  onClose: () => void;
  onCreate: (request: {
    principalType: 'USER' | 'GROUP';
    principalId: number;
    roleId: number;
    scopeType: 'TENANT' | 'ORG_UNIT' | 'RESOURCE';
    scopeRef?: string;
    validTo?: string;
    justification: string;
  }) => Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const [principalType, setPrincipalType] = useState<'USER' | 'GROUP'>('USER');
  const [principalId, setPrincipalId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [scopeType, setScopeType] = useState<'TENANT' | 'ORG_UNIT' | 'RESOURCE'>('TENANT');
  const [scopeRef, setScopeRef] = useState('');
  const [validTo, setValidTo] = useState<string | null>(null);
  const [justification, setJustification] = useState('');
  const principals = principalType === 'USER' ? users : groups;
  const valid =
    Boolean(principalId) &&
    Boolean(roleId) &&
    (scopeType === 'TENANT' || Boolean(scopeRef.trim())) &&
    justification.trim().length >= 10;

  return (
    <FormDialog
      open={open}
      title={t('privilegedAccess.eligibilityDialog.title')}
      description={t('privilegedAccess.eligibilityDialog.description')}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t('privilegedAccess.actions.createEligibility')}
      submitDisabled={!valid}
      busy={busy}
      onClose={onClose}
      onSubmit={() =>
        onCreate({
          principalType,
          principalId: Number(principalId),
          roleId: Number(roleId),
          scopeType,
          scopeRef: scopeType === 'TENANT' ? undefined : scopeRef.trim(),
          validTo: validTo ?? undefined,
          justification: justification.trim(),
        })
      }
    >
      <Stack gap={2}>
        <SelectField
          label={t('privilegedAccess.fields.principalType')}
          value={principalType}
          options={(['USER', 'GROUP'] as const).map((value) => ({
            value,
            label: t(`privilegedAccess.principalTypes.${value}`),
          }))}
          onValueChange={(value) => {
            if (!value) return;
            setPrincipalType(value);
            setPrincipalId('');
          }}
        />
        <SelectField
          required
          label={t('privilegedAccess.fields.principal')}
          value={principalId}
          placeholder={t('privilegedAccess.fields.selectPrincipal')}
          options={principals.map((item) => ({
            value: String('userId' in item ? item.userId : item.groupId),
            label: item.displayName,
          }))}
          onValueChange={(value) => setPrincipalId(String(value))}
        />
        <SelectField
          required
          label={t('roleGovernance.fields.role')}
          value={roleId}
          placeholder={t('privilegedAccess.fields.selectRole')}
          options={policies
            .filter((policy) => policy.lifecycleState === 'ACTIVE')
            .map((policy) => ({ value: String(policy.roleId), label: policy.roleName }))}
          onValueChange={(value) => setRoleId(String(value))}
        />
        <SelectField
          label={t('roleGovernance.fields.scope')}
          value={scopeType}
          options={(['TENANT', 'ORG_UNIT', 'RESOURCE'] as const).map((value) => ({
            value,
            label: t(`roleGovernance.scopes.${value}`),
          }))}
          onValueChange={(value) => value && setScopeType(value)}
        />
        {scopeType !== 'TENANT' && (
          <FormField
            required
            label={t('roleGovernance.fields.scopeRef')}
            value={scopeRef}
            inputProps={{ maxLength: 160 }}
            onChange={(event) => setScopeRef(event.target.value)}
          />
        )}
        <DateTimePickerField
          label={t('roleGovernance.fields.validTo')}
          value={validTo}
          onValueChange={setValidTo}
        />
        <FormField
          required
          multiline
          minRows={3}
          label={t('roleGovernance.fields.justification')}
          value={justification}
          inputProps={{ maxLength: 1000 }}
          onChange={(event) => setJustification(event.target.value)}
        />
      </Stack>
    </FormDialog>
  );
}

function BoundaryDialog({
  kind,
  busy,
  users,
  onClose,
  onSubmit,
}: {
  kind: 'emergency' | 'delegation' | null;
  busy: boolean;
  users: Array<{ userId: number; displayName: string }>;
  onClose: () => void;
  onSubmit: (request: Record<string, unknown>) => Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const [userId, setUserId] = useState('');
  const [scopeType, setScopeType] = useState<'TENANT' | 'ORG_UNIT' | 'RESOURCE'>('TENANT');
  const [scopeRef, setScopeRef] = useState('');
  const [actionCode, setActionCode] = useState('ACCESS.ASSIGNMENT.MANAGE');
  const [reviewDueAt, setReviewDueAt] = useState<string | null>(null);
  const [justification, setJustification] = useState('');
  const valid =
    Boolean(userId) &&
    justification.trim().length >= 10 &&
    (kind === 'emergency'
      ? Boolean(reviewDueAt)
      : scopeType === 'TENANT' || Boolean(scopeRef.trim()));
  return (
    <FormDialog
      open={Boolean(kind)}
      title={t(`privilegedAccess.boundaryDialog.${kind ?? 'emergency'}.title`)}
      description={t(`privilegedAccess.boundaryDialog.${kind ?? 'emergency'}.description`)}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t('common.actions.create')}
      submitDisabled={!valid}
      busy={busy}
      onClose={onClose}
      onSubmit={() =>
        onSubmit(
          kind === 'emergency'
            ? {
                userId: Number(userId),
                reviewDueAt,
                justification: justification.trim(),
              }
            : {
                administratorUserId: Number(userId),
                scopeType,
                scopeRef: scopeType === 'TENANT' ? undefined : scopeRef.trim(),
                actionCode,
                justification: justification.trim(),
              }
        )
      }
    >
      <Stack gap={2}>
        <SelectField
          required
          label={t('privilegedAccess.fields.principal')}
          value={userId}
          placeholder={t('privilegedAccess.fields.selectPrincipal')}
          options={users.map((user) => ({ value: String(user.userId), label: user.displayName }))}
          onValueChange={(value) => setUserId(String(value))}
        />
        {kind === 'emergency' ? (
          <DateTimePickerField
            required
            label={t('privilegedAccess.fields.reviewDueAt')}
            value={reviewDueAt}
            onValueChange={setReviewDueAt}
          />
        ) : (
          <>
            <SelectField
              label={t('roleGovernance.fields.scope')}
              value={scopeType}
              options={(['TENANT', 'ORG_UNIT', 'RESOURCE'] as const).map((value) => ({
                value,
                label: t(`roleGovernance.scopes.${value}`),
              }))}
              onValueChange={(value) => value && setScopeType(value)}
            />
            {scopeType !== 'TENANT' && (
              <FormField
                required
                label={t('roleGovernance.fields.scopeRef')}
                value={scopeRef}
                onChange={(event) => setScopeRef(event.target.value)}
              />
            )}
            <SelectField
              label={t('privilegedAccess.fields.action')}
              value={actionCode}
              options={[
                'ACCESS.ASSIGNMENT.MANAGE',
                'ACCESS.ROLE.MANAGE',
                'ACCESS.RESOURCE.MANAGE',
              ].map((value) => ({
                value,
                label: t(`privilegedAccess.actionsCatalog.${value}`),
              }))}
              onValueChange={(value) => value && setActionCode(value)}
            />
          </>
        )}
        <FormField
          required
          multiline
          minRows={3}
          label={t('roleGovernance.fields.justification')}
          value={justification}
          inputProps={{ maxLength: 1000 }}
          onChange={(event) => setJustification(event.target.value)}
        />
      </Stack>
    </FormDialog>
  );
}

export function PrivilegedAccessManager() {
  const { t } = useTranslation('admin');
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
    async (action: () => Promise<unknown>, success: string) => {
      setBusy(true);
      try {
        await action();
        await queryClient.invalidateQueries({ queryKey: ['admin', 'privileged-access'] });
        toast.success(success);
      } catch (error) {
        toast.error(message(error, t('common.operationError')));
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
      { field: 'roleName', headerName: t('roleGovernance.columns.role'), minWidth: 180, flex: 1 },
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
    [t]
  );

  const eligibilityColumns = useMemo<GridColDef<PrivilegedRoleEligibility>[]>(
    () => [
      {
        field: 'principalDisplayName',
        headerName: t('privilegedAccess.columns.principal'),
        minWidth: 190,
        flex: 1,
      },
      { field: 'roleName', headerName: t('roleGovernance.columns.role'), minWidth: 180, flex: 1 },
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
    [run, t]
  );

  const policyColumns = useMemo<GridColDef<PrivilegedAccessPolicy>[]>(
    () => [
      { field: 'roleName', headerName: t('roleGovernance.columns.role'), minWidth: 200, flex: 1 },
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
    [t]
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
          </Box>
        </Stack>
      )}

      <PolicyDialog
        key={policy?.policyId ?? 'closed'}
        policy={policy}
        busy={busy}
        onClose={() => setPolicy(null)}
        onSave={async (changes) => {
          if (!policy) return;
          await run(
            () => updatePrivilegedAccessPolicy(policy, changes),
            t('privilegedAccess.toasts.policyUpdated')
          );
          setPolicy(null);
        }}
      />
      <EligibilityDialog
        key={eligibilityOpen ? 'open' : 'closed'}
        open={eligibilityOpen}
        busy={busy}
        policies={policyRows}
        users={users.data?.content ?? []}
        groups={groups.data?.content ?? []}
        onClose={() => setEligibilityOpen(false)}
        onCreate={async (request) => {
          await run(
            () => createPrivilegedRoleEligibility(request),
            t('privilegedAccess.toasts.eligibilityCreated')
          );
          setEligibilityOpen(false);
        }}
      />
      <DecisionDialog
        key={decision ? `${decision.request.requestId}:${decision.decision}` : 'closed'}
        operation={decision}
        busy={busy}
        onClose={() => setDecision(null)}
        onSubmit={async (reason) => {
          if (!decision) return;
          await run(
            () =>
              decision.decision === 'REVOKE'
                ? revokePrivilegedAccessRequest(decision.request, reason)
                : decidePrivilegedAccessRequest(decision.request, decision.decision, reason),
            t(`privilegedAccess.toasts.${decision.decision.toLowerCase()}`)
          );
          setDecision(null);
        }}
      />
      <BoundaryDialog
        key={boundaryDialog ?? 'closed'}
        kind={boundaryDialog}
        busy={busy}
        users={users.data?.content ?? []}
        onClose={() => setBoundaryDialog(null)}
        onSubmit={async (request) => {
          if (boundaryDialog === 'emergency') {
            await run(
              () =>
                registerEmergencyAccessPrincipal(
                  request as { userId: number; justification: string; reviewDueAt: string }
                ),
              t('privilegedAccess.toasts.emergencyRegistered')
            );
          } else {
            await run(
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
          setBoundaryDialog(null);
        }}
      />
    </Box>
  );
}
