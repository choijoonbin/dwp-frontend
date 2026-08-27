import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionButton,
  DateTimePickerField,
  FormDialog,
  FormField,
  SelectField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type {
  CreateWorkforceAccessPolicyRequest,
  WorkforceAccessPolicy,
  WorkforceOrganizationOption,
} from '@dwp-frontend/shared-utils';
import type { TFunction } from 'i18next';
const FIELD_GROUPS = ['DIRECTORY', 'WORKER_IDENTIFIERS', 'EMPLOYMENT', 'JOB_GRADE'] as const;
const ACTIONS = ['READ', 'EXPORT'] as const;
const WORKFORCE_ROLES = ['HR_ADMIN', 'PEOPLE_ADMIN'] as const;

type FieldGroup = (typeof FIELD_GROUPS)[number];
type WorkforceAction = (typeof ACTIONS)[number];
type SubjectType = 'ROLE' | 'USER';
type PopulationType = 'TENANT' | 'ORG_UNIT' | 'ORG_TREE';
export type WorkforceAccessReferenceUser = {
  userId: number;
  displayName: string;
  email?: string | null;
};
export type WorkforceAccessPolicyDialogProps = {
  open: boolean;
  busy: boolean;
  referencesLoading: boolean;
  referencesError: boolean;
  users: WorkforceAccessReferenceUser[];
  organizations: WorkforceOrganizationOption[];
  onRetryReferences: () => void;
  onClose: () => void;
  onSave: (request: CreateWorkforceAccessPolicyRequest) => Promise<void>;
};
export type WorkforceAccessRevokeDialogProps = {
  policy: WorkforceAccessPolicy;
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
};
function populationLabel(value: PopulationType, t: TFunction<'admin'>) {
  if (value === 'ORG_UNIT') return t('workforceAccess.populations.ORG_UNIT');
  if (value === 'ORG_TREE') return t('workforceAccess.populations.ORG_TREE');
  return t('workforceAccess.populations.TENANT');
}
function policySubjectLabel(policy: WorkforceAccessPolicy, t: TFunction<'admin'>) {
  if (policy.subjectType === 'USER') {
    return t('workforceAccess.userSubject', { id: policy.subjectRef });
  }
  if (WORKFORCE_ROLES.includes(policy.subjectRef as (typeof WORKFORCE_ROLES)[number])) {
    return t(`workforceAccess.roles.${policy.subjectRef as (typeof WORKFORCE_ROLES)[number]}`);
  }
  return policy.subjectRef;
}
function hasInvalidValidityRange(validFrom: string | null, validTo: string | null) {
  if (!validFrom || !validTo) return false;
  const start = Date.parse(validFrom);
  const end = Date.parse(validTo);
  return Number.isFinite(start) && Number.isFinite(end) && end <= start;
}
function hasPastValidityEnd(validTo: string | null) {
  if (!validTo) return false;
  const end = Date.parse(validTo);
  return Number.isFinite(end) && end <= Date.now();
}
export function WorkforceAccessPolicyDialog({
  open,
  busy,
  referencesLoading,
  referencesError,
  users,
  organizations,
  onRetryReferences,
  onClose,
  onSave,
}: WorkforceAccessPolicyDialogProps) {
  const { t } = useTranslation('admin');
  const [subjectType, setSubjectType] = useState<SubjectType>('ROLE');
  const [subjectRef, setSubjectRef] = useState('HR_ADMIN');
  const [populationType, setPopulationType] = useState<PopulationType>('ORG_TREE');
  const [organizationId, setOrganizationId] = useState('');
  const [fieldGroups, setFieldGroups] = useState<FieldGroup[]>(['DIRECTORY', 'EMPLOYMENT']);
  const [actions, setActions] = useState<WorkforceAction[]>(['READ']);
  const [validFrom, setValidFrom] = useState<string | null>(null);
  const [validTo, setValidTo] = useState<string | null>(null);
  const [justification, setJustification] = useState('');

  const referencesUnavailable = referencesLoading || referencesError;
  const invalidValidityRange = hasInvalidValidityRange(validFrom, validTo);
  const pastValidityEnd = hasPastValidityEnd(validTo);
  const valid =
    !referencesUnavailable &&
    Boolean(subjectRef) &&
    (populationType === 'TENANT' || Boolean(organizationId)) &&
    fieldGroups.includes('DIRECTORY') &&
    actions.length > 0 &&
    !invalidValidityRange &&
    !pastValidityEnd &&
    justification.trim().length >= 10;

  const toggleField = (value: FieldGroup) => {
    if (value === 'DIRECTORY') return;
    setFieldGroups((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  };

  const toggleAction = (value: WorkforceAction) => {
    setActions((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  };
  return (
    <FormDialog
      open={open}
      maxWidth="md"
      title={t('workforceAccess.dialog.title')}
      description={t('workforceAccess.dialog.description')}
      cancelLabel={t('workforceAccess.dialog.cancel')}
      submitLabel={t('workforceAccess.dialog.submit')}
      submittingLabel={t('workforceAccess.dialog.submitting')}
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
          validFrom: validFrom ?? undefined,
          validTo: validTo ?? undefined,
          justification: justification.trim(),
        })
      }
    >
      <Stack gap={2}>
        {referencesError ? (
          <Alert severity="error">
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              gap={1}
            >
              <Typography variant="body2" sx={{ flex: 1 }}>
                {t('workforceAccess.references.error')}
              </Typography>
              <ActionButton
                type="button"
                size="small"
                intent="secondary"
                onClick={onRetryReferences}
              >
                {t('workforceAccess.references.retry')}
              </ActionButton>
            </Stack>
          </Alert>
        ) : referencesLoading ? (
          <Alert severity="info">{t('workforceAccess.references.loading')}</Alert>
        ) : null}
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
        {subjectType === 'USER' && (
          <Alert severity="warning">{t('workforceAccess.warnings.userOverride')}</Alert>
        )}
        <SelectField
          required
          disabled={subjectType === 'USER' && referencesUnavailable}
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
            disabled={referencesUnavailable}
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
        <Box component="fieldset" sx={{ m: 0, minWidth: 0, border: 0, p: 0, '& legend': { p: 0 } }}>
          <Typography component="legend" variant="caption" color="text.secondary" fontWeight={700}>
            {t('workforceAccess.fields.fieldGroups')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('workforceAccess.warnings.directoryRequired')}
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
                    checked={field === 'DIRECTORY' || fieldGroups.includes(field)}
                    disabled={field === 'DIRECTORY'}
                    onChange={() => toggleField(field)}
                  />
                }
                label={t(`workforceAccess.fieldGroups.${field}`)}
              />
            ))}
          </Stack>
        </Box>
        <Box component="fieldset" sx={{ m: 0, minWidth: 0, border: 0, p: 0, '& legend': { p: 0 } }}>
          <Typography component="legend" variant="caption" color="text.secondary" fontWeight={700}>
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
        {actions.includes('EXPORT') && (
          <Alert severity="warning">{t('workforceAccess.warnings.export')}</Alert>
        )}

        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <DateTimePickerField
            label={t('workforceAccess.fields.validFrom')}
            value={validFrom}
            onValueChange={setValidFrom}
          />
          <DateTimePickerField
            label={t('workforceAccess.fields.validTo')}
            value={validTo}
            errorMessage={
              pastValidityEnd
                ? t('workforceAccess.fields.validityFutureError')
                : invalidValidityRange
                  ? t('workforceAccess.fields.validityError')
                  : undefined
            }
            onValueChange={setValidTo}
          />
        </Stack>
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

export function WorkforceAccessRevokeDialog({
  policy,
  busy,
  onClose,
  onSubmit,
}: WorkforceAccessRevokeDialogProps) {
  const { t } = useTranslation('admin');
  const [reason, setReason] = useState('');
  const subject = policySubjectLabel(policy, t);
  return (
    <FormDialog
      open
      title={t('workforceAccess.revoke.title')}
      description={t('workforceAccess.revoke.description', { subject })}
      cancelLabel={t('workforceAccess.revoke.cancel')}
      submitLabel={t('workforceAccess.revoke.submit')}
      submittingLabel={t('workforceAccess.revoke.submitting')}
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
        supportingText={t('workforceAccess.fields.reasonHelp')}
        value={reason}
        inputProps={{ maxLength: 1000 }}
        onChange={(event) => setReason(event.target.value)}
      />
    </FormDialog>
  );
}
