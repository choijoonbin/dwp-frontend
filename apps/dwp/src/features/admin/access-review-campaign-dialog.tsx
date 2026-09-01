import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  listDirectoryGroups,
  listGovernanceRoles,
  listIdentityUsers,
} from '@dwp-frontend/shared-utils';
import {
  DateTimePickerField,
  FormDialog,
  FormField,
  SelectField,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type {
  AccessReviewReviewerStrategy,
  AccessReviewScopeType,
  CreateAccessReviewCampaignRequest,
} from '@dwp-frontend/shared-utils';

function defaultDueAt(): string {
  const due = new Date();
  due.setDate(due.getDate() + 14);
  due.setHours(18, 0, 0, 0);
  return due.toISOString();
}

export function AccessReviewCampaignDialog({
  open,
  busy,
  onClose,
  onCreate,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onCreate: (request: CreateAccessReviewCampaignRequest) => Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scopeType, setScopeType] = useState<AccessReviewScopeType>('TENANT');
  const [scopeRef, setScopeRef] = useState('');
  const [reviewerStrategy, setReviewerStrategy] =
    useState<AccessReviewReviewerStrategy>('TENANT_ADMIN');
  const [reviewerUserId, setReviewerUserId] = useState('');
  const [dueAt, setDueAt] = useState(defaultDueAt);
  const rolesQuery = useQuery({
    queryKey: ['admin', 'governance-roles'],
    queryFn: listGovernanceRoles,
    enabled: open,
  });
  const groupsQuery = useQuery({
    queryKey: ['admin', 'directory-groups', 'access-review'],
    queryFn: () => listDirectoryGroups('', 'ACTIVE', 0, 100),
    enabled: open,
  });
  const usersQuery = useQuery({
    queryKey: ['admin', 'identity-users', 'access-review-reviewers'],
    queryFn: () => listIdentityUsers(''),
    enabled: open,
  });

  const scopeOptions =
    scopeType === 'ROLE' ? (rolesQuery.data ?? []) : (groupsQuery.data?.content ?? []);
  const valid =
    name.trim().length > 0 &&
    Boolean(dueAt) &&
    (scopeType === 'TENANT' || Boolean(scopeRef)) &&
    (reviewerStrategy === 'TENANT_ADMIN' || Boolean(reviewerUserId));

  const submit = async () => {
    if (!valid) return;
    await onCreate({
      name: name.trim(),
      description: description.trim() || undefined,
      scopeType,
      scopeRef: scopeType === 'TENANT' ? undefined : Number(scopeRef),
      reviewerStrategy,
      reviewerUserId: reviewerStrategy === 'TENANT_ADMIN' ? undefined : Number(reviewerUserId),
      dueAt: new Date(dueAt).toISOString(),
    });
  };

  return (
    <FormDialog
      open={open}
      title={t('accessReviews.create.title')}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t('common.actions.create')}
      busy={busy}
      submitDisabled={!valid}
      onClose={onClose}
      onSubmit={submit}
      maxWidth="md"
    >
      <Stack gap={2}>
        <FormField
          autoFocus
          required
          label={t('accessReviews.fields.name')}
          value={name}
          inputProps={{ maxLength: 200 }}
          onChange={(event) => setName(event.target.value)}
        />
        <FormField
          multiline
          minRows={2}
          label={t('accessReviews.fields.description')}
          value={description}
          inputProps={{ maxLength: 1000 }}
          onChange={(event) => setDescription(event.target.value)}
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <SelectField<AccessReviewScopeType>
            required
            label={t('accessReviews.fields.scope')}
            value={scopeType}
            options={(['TENANT', 'ROLE', 'GROUP'] as const).map((value) => ({
              value,
              label: t(`accessReviews.scopes.${value}`),
            }))}
            onValueChange={(value) => {
              if (!value) return;
              setScopeType(value);
              setScopeRef('');
            }}
          />
          {scopeType !== 'TENANT' && (
            <SelectField<number>
              required
              label={t(
                scopeType === 'ROLE' ? 'accessReviews.fields.role' : 'accessReviews.fields.group'
              )}
              value={scopeRef ? Number(scopeRef) : ''}
              options={scopeOptions.map((option) => ({
                value: 'roleId' in option ? option.roleId : option.groupId,
                label: 'roleId' in option ? `${option.name} (${option.code})` : option.displayName,
              }))}
              onValueChange={(value) => setScopeRef(value === '' ? '' : String(value))}
            />
          )}
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <SelectField<AccessReviewReviewerStrategy>
            required
            label={t('accessReviews.fields.reviewerStrategy')}
            value={reviewerStrategy}
            options={(['TENANT_ADMIN', 'NAMED_REVIEWER'] as const).map((value) => ({
              value,
              label: t(`accessReviews.reviewerStrategies.${value}`),
            }))}
            onValueChange={(value) => {
              if (!value) return;
              setReviewerStrategy(value);
              setReviewerUserId('');
            }}
          />
          {reviewerStrategy === 'NAMED_REVIEWER' && (
            <SelectField<number>
              required
              label={t('accessReviews.fields.reviewer')}
              value={reviewerUserId ? Number(reviewerUserId) : ''}
              options={(usersQuery.data?.content ?? [])
                .filter((user) => user.status === 'ACTIVE')
                .map((user) => ({
                  value: user.userId,
                  label: `${user.displayName}${user.email ? ` (${user.email})` : ''}`,
                }))}
              onValueChange={(value) => setReviewerUserId(value === '' ? '' : String(value))}
            />
          )}
        </Stack>
        <DateTimePickerField
          required
          label={t('accessReviews.fields.dueAt')}
          value={dueAt}
          onValueChange={(value) => setDueAt(value ?? '')}
        />
        <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {t('accessReviews.create.snapshotNotice')}
          </Typography>
        </Box>
      </Stack>
    </FormDialog>
  );
}
