import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserRoundCheck, UsersRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  assignWorkplaceServiceTask,
  createWorkplaceIdempotencyKey,
  getWorkplaceServiceAssignees,
  getWorkplaceServiceProviders,
} from '@dwp-frontend/shared-utils';
import { ActionButton, FormField, InlineFeedback, SelectField } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import { workplaceMemberSoftSurface } from './workplace-member-surfaces';
import { requireWorkplaceServiceWrite } from './workplace-services-ui-model';

import type {
  WorkplaceServiceFulfillmentTask,
  WorkplaceServiceOrder,
} from '@dwp-frontend/shared-utils';

export function WorkplaceServiceAssigneePicker({
  order,
  task,
  canManage,
  elevated,
}: {
  order: WorkplaceServiceOrder;
  task: WorkplaceServiceFulfillmentTask;
  canManage: boolean;
  elevated: boolean;
}) {
  const { t, i18n } = useTranslation('rooms');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [queryText, setQueryText] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [reason, setReason] = useState('');
  const providers = useQuery({
    queryKey: ['workplace', 'services', 'providers', 'assignee-picker'],
    queryFn: getWorkplaceServiceProviders,
    enabled: open && canManage && elevated,
    retry: false,
  });
  const providerId = useMemo(
    () =>
      providers.data?.items.find((provider) => provider.providerCode === task.providerCode)
        ?.providerProfileId ?? null,
    [providers.data, task.providerCode]
  );
  const provider = providers.data?.items.find(
    (candidate) => candidate.providerCode === task.providerCode
  );
  const assignees = useQuery({
    queryKey: ['workplace', 'services', 'assignees', providerId, order.siteReference, queryText],
    queryFn: () =>
      getWorkplaceServiceAssignees({
        providerId: providerId!,
        siteReference: order.siteReference!,
        query: queryText.trim(),
        limit: 50,
      }),
    enabled:
      open &&
      canManage &&
      elevated &&
      Boolean(providerId && order.siteReference) &&
      queryText.trim().length >= 2,
    retry: false,
  });
  const selected = assignees.data?.items.find(
    (assignee) => assignee.directorySubjectId === selectedId
  );
  const mutation = useMutation({
    mutationFn: () => {
      requireWorkplaceServiceWrite(
        canManage && elevated && Boolean(selectedId) && Boolean(reason.trim())
      );
      return assignWorkplaceServiceTask(
        order.serviceOrderId,
        task.fulfillmentTaskId,
        {
          directorySubjectId: selectedId,
          expectedTaskVersion: task.version,
          explicitConfirmation: true,
          reason: reason.trim(),
        },
        {
          idempotencyKey: createWorkplaceIdempotencyKey('service-assignee'),
          activeAccessMode: 'ELEVATED',
        }
      );
    },
    retry: false,
    onSuccess: () => {
      setOpen(false);
      setSelectedId('');
      setReason('');
      void queryClient.invalidateQueries({ queryKey: ['workplace', 'services', 'fulfillment'] });
    },
  });

  return (
    <Box
      data-testid="workplace-service-assignee-picker"
      sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.25 })}
    >
      <Stack direction="row" justifyContent="space-between" gap={1} alignItems="center">
        <Box minWidth={0}>
          <Typography component="h4" variant="subtitle2" fontWeight="fontWeightBold">
            {t('workplace.services.extensions.assignee')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {task.assigneeDisplayName ?? t('workplace.services.extensions.unassigned')}
            {task.assigneeSecondaryLabel ? ` · ${task.assigneeSecondaryLabel}` : ''}
          </Typography>
        </Box>
        <ActionButton
          intent="quiet"
          size="small"
          startIcon={<UsersRound size={16} />}
          disabled={!canManage || !elevated}
          onClick={() => setOpen((value) => !value)}
        >
          {t('workplace.services.extensions.changeAssignee')}
        </ActionButton>
      </Stack>
      {open ? (
        <Stack spacing={1} mt={1}>
          <FormField
            label={t('workplace.services.extensions.searchAssignee')}
            value={queryText}
            onChange={(event) => setQueryText(event.target.value)}
            inputProps={{ maxLength: 200 }}
            disabled={mutation.isPending}
          />
          {providers.isError || (providers.isSuccess && !providerId) ? (
            <InlineFeedback severity="warning">
              {t('workplace.services.extensions.assigneeProviderUnavailable')}
            </InlineFeedback>
          ) : null}
          {provider?.support.channel ? (
            <ActionButton
              component="a"
              href={
                typeof provider.support.contactUri === 'string'
                  ? provider.support.contactUri
                  : '#workplace-service-collaboration'
              }
              intent="quiet"
              size="small"
            >
              {t('workplace.services.extensions.contactProvider', {
                name:
                  locale === 'ko'
                    ? (provider.support.labelKo ?? provider.displayNameKo)
                    : (provider.support.labelEn ?? provider.displayNameEn),
              })}
            </ActionButton>
          ) : null}
          {assignees.isError ? (
            <InlineFeedback severity="warning">
              {t('workplace.services.extensions.assigneeDirectoryUnavailable')}
            </InlineFeedback>
          ) : null}
          <SelectField
            label={t('workplace.services.extensions.assignee')}
            value={selectedId}
            options={[
              { value: '', label: t('workplace.services.extensions.chooseAssignee') },
              ...(assignees.data?.items ?? []).map((assignee) => ({
                value: assignee.directorySubjectId,
                label: `${assignee.displayName} · ${assignee.capabilities.join(', ')}`,
              })),
            ]}
            onValueChange={(value) => setSelectedId(value ?? '')}
            disabled={assignees.isLoading || mutation.isPending}
          />
          {selected ? (
            <Typography variant="caption" color="text.secondary">
              {selected.contactAvailable
                ? t('workplace.services.extensions.assigneeContactAvailable')
                : t('workplace.services.extensions.assigneeContactUnavailable')}
            </Typography>
          ) : null}
          <FormField
            label={t('workplace.services.changeReason')}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            inputProps={{ maxLength: 500 }}
            disabled={mutation.isPending}
          />
          {mutation.isError ? (
            <InlineFeedback severity="error">{t('workplace.services.commandError')}</InlineFeedback>
          ) : null}
          <ActionButton
            intent="primary"
            startIcon={<UserRoundCheck size={16} />}
            loading={mutation.isPending}
            disabled={!selectedId || !reason.trim()}
            onClick={() => mutation.mutate()}
          >
            {t('workplace.services.extensions.assign')}
          </ActionButton>
        </Stack>
      ) : null}
    </Box>
  );
}
