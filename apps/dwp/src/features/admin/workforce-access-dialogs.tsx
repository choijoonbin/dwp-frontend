import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionButton,
  AutocompleteField,
  DateTimePickerField,
  FormDialog,
  FormField,
  SelectField,
} from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
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
  organizationsLoading: boolean;
  organizationsError: boolean;
  usersLoading: boolean;
  usersError: boolean;
  users: WorkforceAccessReferenceUser[];
  userQuery: string;
  organizations: WorkforceOrganizationOption[];
  onUserQueryChange: (value: string) => void;
  onRetryOrganizations: () => void;
  onRetryUsers: () => void;
  onClose: () => void;
  onSave: (request: CreateWorkforceAccessPolicyRequest) => Promise<void>;
};
export type WorkforceAccessRevokeDialogProps = {
  policy: WorkforceAccessPolicy;
  subject: { displayName: string; email?: string | null };
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
};
function populationLabel(value: PopulationType, t: TFunction<'admin'>) {
  if (value === 'ORG_UNIT') return t('workforceAccess.populations.ORG_UNIT');
  if (value === 'ORG_TREE') return t('workforceAccess.populations.ORG_TREE');
  return t('workforceAccess.populations.TENANT');
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
  organizationsLoading,
  organizationsError,
  usersLoading,
  usersError,
  users,
  userQuery,
  organizations,
  onUserQueryChange,
  onRetryOrganizations,
  onRetryUsers,
  onClose,
  onSave,
}: WorkforceAccessPolicyDialogProps) {
  const { t } = useTranslation('admin');
  const [subjectType, setSubjectType] = useState<SubjectType>('ROLE');
  const [subjectRef, setSubjectRef] = useState('HR_ADMIN');
  const [selectedUser, setSelectedUser] = useState<WorkforceAccessReferenceUser | null>(null);
  const [populationType, setPopulationType] = useState<PopulationType>('ORG_TREE');
  const [organizationId, setOrganizationId] = useState('');
  const [fieldGroups, setFieldGroups] = useState<FieldGroup[]>(['DIRECTORY', 'EMPLOYMENT']);
  const [actions, setActions] = useState<WorkforceAction[]>(['READ']);
  const [validFrom, setValidFrom] = useState<string | null>(null);
  const [validTo, setValidTo] = useState<string | null>(null);
  const [justification, setJustification] = useState('');

  const userReferenceUnavailable =
    subjectType === 'USER' && (usersLoading || usersError || !selectedUser);
  const organizationReferenceUnavailable =
    populationType !== 'TENANT' && (organizationsLoading || organizationsError);
  const invalidValidityRange = hasInvalidValidityRange(validFrom, validTo);
  const pastValidityEnd = hasPastValidityEnd(validTo);
  const valid =
    !userReferenceUnavailable &&
    !organizationReferenceUnavailable &&
    Boolean(subjectRef) &&
    (populationType === 'TENANT' || Boolean(organizationId)) &&
    fieldGroups.includes('DIRECTORY') &&
    actions.length > 0 &&
    !invalidValidityRange &&
    !pastValidityEnd &&
    justification.trim().length >= 10;

  const userOptions =
    selectedUser && !users.some((user) => user.userId === selectedUser.userId)
      ? [selectedUser, ...users]
      : users;

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
        {organizationsError && populationType !== 'TENANT' ? (
          <Alert severity="error">
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              gap={1}
            >
              <Typography variant="body2" sx={{ flex: 1 }}>
                {t('workforceAccess.references.organizationsError')}
              </Typography>
              <ActionButton
                type="button"
                size="small"
                intent="secondary"
                onClick={onRetryOrganizations}
              >
                {t('workforceAccess.references.retryOrganizations')}
              </ActionButton>
            </Stack>
          </Alert>
        ) : organizationsLoading && populationType !== 'TENANT' ? (
          <Alert severity="info">{t('workforceAccess.references.organizationsLoading')}</Alert>
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
            setSelectedUser(null);
            onUserQueryChange('');
          }}
        />
        {subjectType === 'USER' && (
          <>
            <Alert severity="warning">{t('workforceAccess.warnings.userOverride')}</Alert>
            {usersError ? (
              <Alert severity="error">
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  gap={1}
                >
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {t('workforceAccess.references.usersError')}
                  </Typography>
                  <ActionButton
                    type="button"
                    size="small"
                    intent="secondary"
                    onClick={onRetryUsers}
                  >
                    {t('workforceAccess.references.retryUsers')}
                  </ActionButton>
                </Stack>
              </Alert>
            ) : null}
          </>
        )}
        {subjectType === 'ROLE' ? (
          <SelectField
            required
            label={t('workforceAccess.fields.subject')}
            value={subjectRef}
            placeholder={t('workforceAccess.fields.selectSubject')}
            options={WORKFORCE_ROLES.map((role) => ({
              value: role,
              label: t(`workforceAccess.roles.${role}`),
            }))}
            onValueChange={(value) => setSubjectRef(String(value))}
          />
        ) : (
          <AutocompleteField<WorkforceAccessReferenceUser>
            required
            disabled={usersError}
            label={t('workforceAccess.fields.userSearch')}
            supportingText={t('workforceAccess.fields.userSearchHelp')}
            value={selectedUser}
            inputValue={userQuery}
            options={userOptions}
            loading={usersLoading}
            loadingText={t('workforceAccess.references.usersLoading')}
            noOptionsText={t('workforceAccess.fields.noUsers')}
            openOnFocus
            filterOptions={(values) => values}
            getOptionLabel={(user) =>
              user.email ? `${user.displayName} (${user.email})` : user.displayName
            }
            isOptionEqualToValue={(option, selected) => option.userId === selected.userId}
            renderOption={(props, user) => {
              const { key, ...optionProps } = props;
              return (
                <Box component="li" key={key} {...optionProps}>
                  <Stack sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={650}>
                      {user.displayName}
                    </Typography>
                    {user.email && (
                      <Typography variant="caption" color="text.secondary">
                        {user.email}
                      </Typography>
                    )}
                  </Stack>
                </Box>
              );
            }}
            onInputChange={(_, value, reason) => {
              if (reason === 'input' || reason === 'clear') onUserQueryChange(value);
            }}
            onChange={(_, user) => {
              setSelectedUser(user);
              setSubjectRef(user ? String(user.userId) : '');
              if (user) onUserQueryChange(user.displayName);
            }}
          />
        )}
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
            disabled={organizationsLoading || organizationsError}
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
  subject,
  busy,
  onClose,
  onSubmit,
}: WorkforceAccessRevokeDialogProps) {
  const { t } = useTranslation('admin');
  const [reason, setReason] = useState('');
  const subjectLabel = subject.email
    ? `${subject.displayName} · ${subject.email}`
    : subject.displayName;
  const organizationLabel = policy.organizationName
    ? `${policy.organizationName} · ${populationLabel(policy.populationType, t)}`
    : populationLabel(policy.populationType, t);
  return (
    <FormDialog
      open
      maxWidth="md"
      title={t('workforceAccess.revoke.title')}
      description={t('workforceAccess.revoke.description', { subject: subjectLabel })}
      cancelLabel={t('workforceAccess.revoke.cancel')}
      submitLabel={t('workforceAccess.revoke.submit')}
      submittingLabel={t('workforceAccess.revoke.submitting')}
      submitIntent="danger"
      submitDisabled={reason.trim().length < 10}
      busy={busy}
      onClose={onClose}
      onSubmit={() => onSubmit(reason.trim())}
    >
      <Stack gap={2}>
        <Box
          component="section"
          aria-labelledby="workforce-access-revoke-impact-title"
          sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 2 }}
        >
          <Typography id="workforce-access-revoke-impact-title" component="h3" variant="subtitle2">
            {t('workforceAccess.revoke.impactTitle')}
          </Typography>
          <Box
            component="dl"
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'minmax(130px, 0.35fr) minmax(0, 1fr)' },
              gap: 1,
              m: 0,
              mt: 1.5,
              '& dt': { color: 'text.secondary' },
              '& dd': { m: 0, minWidth: 0, overflowWrap: 'anywhere' },
            }}
          >
            <Typography component="dt" variant="caption" fontWeight={700}>
              {t('workforceAccess.revoke.subject')}
            </Typography>
            <Typography component="dd" variant="body2">
              {subjectLabel}
            </Typography>
            <Typography component="dt" variant="caption" fontWeight={700}>
              {t('workforceAccess.revoke.organization')}
            </Typography>
            <Typography component="dd" variant="body2">
              {organizationLabel}
            </Typography>
            <Typography component="dt" variant="caption" fontWeight={700}>
              {t('workforceAccess.revoke.data')}
            </Typography>
            <Stack component="dd" direction="row" flexWrap="wrap" gap={0.5}>
              {policy.fieldGroups.map((field) => (
                <Chip key={field} size="small" label={t(`workforceAccess.fieldGroups.${field}`)} />
              ))}
            </Stack>
            <Typography component="dt" variant="caption" fontWeight={700}>
              {t('workforceAccess.revoke.actions')}
            </Typography>
            <Stack component="dd" direction="row" flexWrap="wrap" gap={0.5}>
              {policy.actionCodes.map((action) => (
                <Chip
                  key={action}
                  size="small"
                  variant="outlined"
                  label={t(`workforceAccess.actions.${action}`)}
                />
              ))}
            </Stack>
            <Typography component="dt" variant="caption" fontWeight={700}>
              {t('workforceAccess.revoke.validFrom')}
            </Typography>
            <Typography component="dd" variant="body2">
              {policy.validFrom
                ? formatDate(policy.validFrom, { dateStyle: 'medium', timeStyle: 'short' })
                : t('workforceAccess.revoke.immediate')}
            </Typography>
            <Typography component="dt" variant="caption" fontWeight={700}>
              {t('workforceAccess.revoke.validTo')}
            </Typography>
            <Typography component="dd" variant="body2">
              {policy.validTo
                ? formatDate(policy.validTo, { dateStyle: 'medium', timeStyle: 'short' })
                : t('workforceAccess.noExpiry')}
            </Typography>
          </Box>
        </Box>
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
      </Stack>
    </FormDialog>
  );
}
