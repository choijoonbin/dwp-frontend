import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, ShieldCheck, ShieldX } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createWorkforceAccessPolicy,
  listIdentityUsers,
  listWorkforceAccessPolicies,
  listWorkforcePolicyOrganizations,
  revokeWorkforceAccessPolicy,
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
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { AdminPanelError, AdminPanelLoading } from './admin-ui';

import type { GridColDef } from '@mui/x-data-grid';
import type {
  CreateWorkforceAccessPolicyRequest,
  WorkforceAccessPolicy,
  WorkforceOrganizationOption,
} from '@dwp-frontend/shared-utils';
import type { TFunction } from 'i18next';

const FIELD_GROUPS = ['DIRECTORY', 'WORKER_IDENTIFIERS', 'EMPLOYMENT', 'JOB_GRADE'] as const;
const ACTIONS = ['READ', 'EXPORT'] as const;
const WORKFORCE_ROLES = ['HR_ADMIN', 'PEOPLE_ADMIN'] as const;

function displayDate(value?: string | null) {
  return value ? formatDate(value, { dateStyle: 'medium', timeStyle: 'short' }) : '-';
}

function populationLabel(value: string, t: TFunction<'admin'>) {
  if (value === 'ORG_UNIT') return t('workforceAccess.populations.ORG_UNIT');
  if (value === 'ORG_TREE') return t('workforceAccess.populations.ORG_TREE');
  return t('workforceAccess.populations.TENANT');
}

function PolicyDialog({
  open,
  busy,
  users,
  organizations,
  onClose,
  onSave,
}: {
  open: boolean;
  busy: boolean;
  users: Array<{ userId: number; displayName: string; email?: string | null }>;
  organizations: WorkforceOrganizationOption[];
  onClose: () => void;
  onSave: (request: CreateWorkforceAccessPolicyRequest) => Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const [subjectType, setSubjectType] = useState<'ROLE' | 'USER'>('ROLE');
  const [subjectRef, setSubjectRef] = useState('HR_ADMIN');
  const [populationType, setPopulationType] = useState<'TENANT' | 'ORG_UNIT' | 'ORG_TREE'>(
    'ORG_TREE'
  );
  const [organizationId, setOrganizationId] = useState('');
  const [fieldGroups, setFieldGroups] = useState<Array<(typeof FIELD_GROUPS)[number]>>([
    'DIRECTORY',
    'EMPLOYMENT',
  ]);
  const [actions, setActions] = useState<Array<(typeof ACTIONS)[number]>>(['READ']);
  const [validTo, setValidTo] = useState<string | null>(null);
  const [justification, setJustification] = useState('');
  const valid =
    Boolean(subjectRef) &&
    (populationType === 'TENANT' || Boolean(organizationId)) &&
    fieldGroups.length > 0 &&
    actions.length > 0 &&
    justification.trim().length >= 10;

  const toggleField = (value: (typeof FIELD_GROUPS)[number]) => {
    setFieldGroups((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  };
  const toggleAction = (value: (typeof ACTIONS)[number]) => {
    setActions((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  };

  return (
    <FormDialog
      open={open}
      title={t('workforceAccess.dialog.title')}
      description={t('workforceAccess.dialog.description')}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t('common.actions.create')}
      submitDisabled={!valid}
      busy={busy}
      onClose={onClose}
      onSubmit={() =>
        onSave({
          subjectType,
          subjectRef,
          populationType,
          organizationId: populationType === 'TENANT' ? undefined : organizationId,
          fieldGroups,
          actionCodes: actions,
          validTo: validTo ?? undefined,
          justification: justification.trim(),
        })
      }
    >
      <Stack gap={2}>
        <SelectField
          label={t('workforceAccess.fields.subjectType')}
          value={subjectType}
          options={(['ROLE', 'USER'] as const).map((value) => ({
            value,
            label: t(`workforceAccess.subjectTypes.${value}`),
          }))}
          onValueChange={(value) => {
            if (!value) return;
            setSubjectType(value);
            setSubjectRef(value === 'ROLE' ? 'HR_ADMIN' : '');
          }}
        />
        <SelectField
          required
          label={t('workforceAccess.fields.subject')}
          value={subjectRef}
          placeholder={t('workforceAccess.fields.selectSubject')}
          options={
            subjectType === 'ROLE'
              ? WORKFORCE_ROLES.map((role) => ({
                  value: role,
                  label: t(`workforceAccess.roles.${role}`),
                }))
              : users.map((user) => ({
                  value: String(user.userId),
                  label: user.email ? `${user.displayName} (${user.email})` : user.displayName,
                }))
          }
          onValueChange={(value) => setSubjectRef(String(value))}
        />
        <SelectField
          label={t('workforceAccess.fields.population')}
          value={populationType}
          options={(['TENANT', 'ORG_UNIT', 'ORG_TREE'] as const).map((value) => ({
            value,
            label: populationLabel(value, t),
          }))}
          onValueChange={(value) => {
            if (!value) return;
            setPopulationType(value);
            if (value === 'TENANT') setOrganizationId('');
          }}
        />
        {populationType !== 'TENANT' && (
          <SelectField
            required
            label={t('workforceAccess.fields.organization')}
            value={organizationId}
            placeholder={t('workforceAccess.fields.selectOrganization')}
            options={organizations.map((organization) => ({
              value: organization.organizationId,
              label: `${organization.name} (${organization.organizationKey})`,
            }))}
            onValueChange={(value) => setOrganizationId(String(value))}
          />
        )}
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={700}>
            {t('workforceAccess.fields.fieldGroups')}
          </Typography>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            flexWrap="wrap"
            gap={0.25}
            sx={{ mt: 0.5 }}
          >
            {FIELD_GROUPS.map((field) => (
              <FormControlLabel
                key={field}
                control={
                  <Checkbox
                    checked={fieldGroups.includes(field)}
                    onChange={() => toggleField(field)}
                  />
                }
                label={t(`workforceAccess.fieldGroups.${field}`)}
              />
            ))}
          </Stack>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={700}>
            {t('workforceAccess.fields.actions')}
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={0.25} sx={{ mt: 0.5 }}>
            {ACTIONS.map((action) => (
              <FormControlLabel
                key={action}
                control={
                  <Checkbox
                    checked={actions.includes(action)}
                    onChange={() => toggleAction(action)}
                  />
                }
                label={t(`workforceAccess.actions.${action}`)}
              />
            ))}
          </Stack>
        </Box>
        <DateTimePickerField
          label={t('workforceAccess.fields.validTo')}
          value={validTo}
          onValueChange={setValidTo}
        />
        <FormField
          required
          multiline
          minRows={3}
          label={t('workforceAccess.fields.justification')}
          supportingText={t('workforceAccess.fields.justificationHelp')}
          value={justification}
          inputProps={{ maxLength: 1000 }}
          onChange={(event) => setJustification(event.target.value)}
        />
      </Stack>
    </FormDialog>
  );
}

function RevokeDialog({
  policy,
  busy,
  onClose,
  onSubmit,
}: {
  policy: WorkforceAccessPolicy | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const [reason, setReason] = useState('');
  return (
    <FormDialog
      open={Boolean(policy)}
      title={t('workforceAccess.revoke.title')}
      description={t('workforceAccess.revoke.description')}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t('workforceAccess.revoke.action')}
      submitIntent="danger"
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
        label={t('workforceAccess.fields.reason')}
        value={reason}
        inputProps={{ maxLength: 1000 }}
        onChange={(event) => setReason(event.target.value)}
      />
    </FormDialog>
  );
}

export function WorkforceAccessManager() {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [revoke, setRevoke] = useState<WorkforceAccessPolicy | null>(null);
  const [busy, setBusy] = useState(false);
  const policies = useQuery({
    queryKey: ['admin', 'workforce-access', 'policies'],
    queryFn: listWorkforceAccessPolicies,
  });
  const organizations = useQuery({
    queryKey: ['admin', 'workforce-access', 'organizations'],
    queryFn: listWorkforcePolicyOrganizations,
  });
  const users = useQuery({
    queryKey: ['admin', 'identity-users', 'workforce-access'],
    queryFn: () => listIdentityUsers(''),
  });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['admin', 'workforce-access', 'policies'] });

  const columns = useMemo<GridColDef<WorkforceAccessPolicy>[]>(
    () => [
      {
        field: 'subjectRef',
        headerName: t('workforceAccess.columns.subject'),
        minWidth: 180,
        flex: 1,
        valueFormatter: (value, row) =>
          row.subjectType === 'ROLE'
            ? t(
                `workforceAccess.roles.${String(value) === 'PEOPLE_ADMIN' ? 'PEOPLE_ADMIN' : 'HR_ADMIN'}`
              )
            : t('workforceAccess.userSubject', { id: value }),
      },
      {
        field: 'populationType',
        headerName: t('workforceAccess.columns.population'),
        minWidth: 190,
        flex: 1,
        valueFormatter: (value, row) =>
          row.organizationName
            ? `${populationLabel(String(value), t)} · ${row.organizationName}`
            : populationLabel(String(value), t),
      },
      {
        field: 'fieldGroups',
        headerName: t('workforceAccess.columns.fields'),
        minWidth: 260,
        flex: 1.5,
        valueFormatter: (value: string[]) =>
          value.map((field) => t(`workforceAccess.fieldGroups.${field}`)).join(', '),
      },
      {
        field: 'validTo',
        headerName: t('workforceAccess.columns.validTo'),
        width: 180,
        valueFormatter: (value) => displayDate(value),
      },
      {
        field: 'lifecycleState',
        headerName: t('workforceAccess.columns.status'),
        width: 120,
        renderCell: ({ row }) => (
          <Chip
            size="small"
            variant="outlined"
            color={row.lifecycleState === 'ACTIVE' ? 'success' : 'default'}
            label={t(`workforceAccess.states.${row.lifecycleState}`)}
          />
        ),
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
                  intent="danger"
                  onClick={() => setRevoke(row)}
                >
                  {t('workforceAccess.revoke.action')}
                </ActionButton>,
              ]
            : [],
      },
    ],
    [t]
  );

  if (policies.isLoading || organizations.isLoading || users.isLoading) {
    return <AdminPanelLoading label={t('workforceAccess.loading')} />;
  }
  if (policies.isError || organizations.isError || users.isError) {
    const error = policies.error || organizations.error || users.error;
    return (
      <AdminPanelError message={error instanceof Error ? error.message : t('common.loadError')} />
    );
  }

  const active = (policies.data ?? []).filter((policy) => policy.lifecycleState === 'ACTIVE');
  const scoped = active.filter((policy) => policy.populationType !== 'TENANT');
  const metrics = [
    { label: t('workforceAccess.metrics.active'), value: active.length, icon: ShieldCheck },
    { label: t('workforceAccess.metrics.scoped'), value: scoped.length, icon: ShieldX },
    {
      label: t('workforceAccess.metrics.userOverrides'),
      value: active.filter((policy) => policy.subjectType === 'USER').length,
      icon: ShieldCheck,
    },
  ];

  return (
    <Stack gap={2}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
          borderBlock: 1,
          borderColor: 'divider',
        }}
      >
        {metrics.map(({ label, value, icon: Icon }) => (
          <Stack key={label} direction="row" alignItems="center" gap={1.25} sx={{ p: 2 }}>
            <Icon size={19} aria-hidden="true" />
            <Box>
              <Typography variant="caption" color="text.secondary">
                {label}
              </Typography>
              <Typography variant="h5">{value}</Typography>
            </Box>
          </Stack>
        ))}
      </Box>
      <Stack direction="row" justifyContent="flex-end">
        <ActionButton startIcon={<Plus size={16} />} onClick={() => setOpen(true)}>
          {t('workforceAccess.create')}
        </ActionButton>
      </Stack>
      <EnterpriseDataGrid
        ariaLabel={t('workforceAccess.gridLabel')}
        rows={policies.data ?? []}
        columns={columns}
        getRowId={(row) => row.policyId}
        stickyColumns={{ right: ['actions'] }}
        minVisibleRows={5}
        maxVisibleRows={10}
        slots={{
          noRowsOverlay: () => (
            <Stack sx={{ height: 1 }} alignItems="center" justifyContent="center" gap={0.5}>
              <Typography variant="subtitle2">{t('workforceAccess.empty.title')}</Typography>
              <Typography variant="body2" color="text.secondary">
                {t('workforceAccess.empty.description')}
              </Typography>
            </Stack>
          ),
        }}
        sx={{ border: 0, borderRadius: 0 }}
      />
      <PolicyDialog
        open={open}
        busy={busy}
        users={users.data?.content ?? []}
        organizations={organizations.data ?? []}
        onClose={() => setOpen(false)}
        onSave={async (request) => {
          setBusy(true);
          try {
            await createWorkforceAccessPolicy(request);
            await refresh();
            setOpen(false);
            toast.success(t('workforceAccess.toasts.created'));
          } catch (error) {
            toast.error(error instanceof Error ? error.message : t('common.operationError'));
          } finally {
            setBusy(false);
          }
        }}
      />
      <RevokeDialog
        policy={revoke}
        busy={busy}
        onClose={() => setRevoke(null)}
        onSubmit={async (reason) => {
          if (!revoke) return;
          setBusy(true);
          try {
            await revokeWorkforceAccessPolicy(revoke, reason);
            await refresh();
            setRevoke(null);
            toast.success(t('workforceAccess.toasts.revoked'));
          } catch (error) {
            toast.error(error instanceof Error ? error.message : t('common.operationError'));
          } finally {
            setBusy(false);
          }
        }}
      />
    </Stack>
  );
}
