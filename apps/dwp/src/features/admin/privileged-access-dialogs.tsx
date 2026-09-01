import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRoleDisplay } from '@dwp-frontend/shared-i18n';
import {
  DateTimePickerField,
  FormDialog,
  FormField,
  SelectField,
} from '@dwp-frontend/design-system';

import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';

import { localizedRoleOptions } from './localized-role-column';
import {
  isFuturePrivilegedAccessDateTime,
  isOptionalFuturePrivilegedAccessDateTime,
} from './privileged-access-validation';

import type { PrivilegedAccessPolicy, PrivilegedAccessRequest } from '@dwp-frontend/shared-utils';

export type PrivilegedAccessDecision = 'APPROVE' | 'DENY' | 'REVOKE';

export function PrivilegedAccessDecisionDialog({
  operation,
  busy,
  onClose,
  onSubmit,
}: {
  operation: { request: PrivilegedAccessRequest; decision: PrivilegedAccessDecision } | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const displayRole = useRoleDisplay();
  const roleName = operation
    ? displayRole(operation.request.roleCode, operation.request.roleName).name
    : '';
  const [reason, setReason] = useState('');
  return (
    <FormDialog
      open={Boolean(operation)}
      title={t(`privilegedAccess.decision.${operation?.decision ?? 'APPROVE'}.title`)}
      description={t('privilegedAccess.decision.description', {
        role: roleName,
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

export function PolicyDialog({
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
  const displayRole = useRoleDisplay();
  const roleName = policy ? displayRole(policy.roleCode, policy.roleName).name : '';
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
      title={t('privilegedAccess.policyDialog.title', { role: roleName })}
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

export function EligibilityDialog({
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
  const displayRole = useRoleDisplay();
  const [principalType, setPrincipalType] = useState<'USER' | 'GROUP'>('USER');
  const [principalId, setPrincipalId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [scopeType, setScopeType] = useState<'TENANT' | 'ORG_UNIT' | 'RESOURCE'>('TENANT');
  const [scopeRef, setScopeRef] = useState('');
  const [validTo, setValidTo] = useState<string | null>(null);
  const [justification, setJustification] = useState('');
  const principals = principalType === 'USER' ? users : groups;
  const validToInvalid = !isOptionalFuturePrivilegedAccessDateTime(validTo);
  const valid =
    Boolean(principalId) &&
    Boolean(roleId) &&
    (scopeType === 'TENANT' || Boolean(scopeRef.trim())) &&
    !validToInvalid &&
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
          options={localizedRoleOptions(
            policies.filter((policy) => policy.lifecycleState === 'ACTIVE'),
            displayRole
          )}
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
          errorMessage={
            validToInvalid ? t('privilegedAccess.fields.futureDateTimeError') : undefined
          }
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

export function BoundaryDialog({
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
  const reviewDueAtValid = isFuturePrivilegedAccessDateTime(reviewDueAt);
  const valid =
    Boolean(userId) &&
    justification.trim().length >= 10 &&
    (kind === 'emergency' ? reviewDueAtValid : scopeType === 'TENANT' || Boolean(scopeRef.trim()));
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
            errorMessage={
              reviewDueAt && !reviewDueAtValid
                ? t('privilegedAccess.fields.futureDateTimeError')
                : undefined
            }
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
