import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Save, ShieldCheck } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getMessagingAdminOverview,
  HttpError,
  updateMessagingPolicy,
  usePermissions,
  useToast,
} from '@dwp-frontend/shared-utils';
import { ActionButton, FormField, PageCanvas } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  DEFAULT_MESSAGING_POLICY_FORM,
  MESSAGING_ATTACHMENT_MB,
  MESSAGING_RETENTION_DAYS,
  messagingPolicyForm,
  messagingPolicyFormChanged,
  validateMessagingPolicyForm,
} from './messaging-admin-model';
import {
  MessagingConversationListItem,
  MessagingMetric,
  MessagingPageHeading,
} from './messaging-components';

import type { MessagingAdminOverview } from '@dwp-frontend/shared-utils';

export function MessagingAdminOverview() {
  const { t } = useTranslation('messaging');
  const query = useQuery({
    queryKey: ['messaging', 'admin'],
    queryFn: getMessagingAdminOverview,
    staleTime: 20_000,
    retry: 1,
  });
  const data = query.data;

  return (
    <PageCanvas topInset="compact">
      <MessagingPageHeading
        eyebrow={t('admin.eyebrow')}
        title={t('admin.overview.title')}
        description={t('admin.overview.description')}
        actions={
          <ActionButton
            intent="quiet"
            startIcon={<RefreshCw size={17} />}
            onClick={() => query.refetch()}
          >
            {t('actions.refresh')}
          </ActionButton>
        }
      />

      {query.isError && <Alert severity="error">{t('admin.loadError')}</Alert>}
      {query.isLoading ? (
        <Stack spacing={2}>
          <Skeleton variant="rounded" height={132} />
          <Skeleton variant="rounded" height={420} />
        </Stack>
      ) : data ? (
        <Stack spacing={3}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(5, minmax(0, 1fr))' },
              border: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
              borderRadius: 1,
              overflow: 'hidden',
              '& > *': { borderRight: 1, borderColor: 'divider' },
            }}
          >
            <MessagingMetric
              label={t('admin.metrics.conversations')}
              value={data.metrics.activeConversations}
              detail={t('admin.metrics.conversationsDetail')}
              tone="#2856C7"
            />
            <MessagingMetric
              label={t('admin.metrics.spaces')}
              value={data.metrics.spaceLinkedConversations}
              detail={t('admin.metrics.spacesDetail')}
              tone="#0F8B8D"
            />
            <MessagingMetric
              label={t('admin.metrics.members')}
              value={data.metrics.activeMembers}
              detail={t('admin.metrics.membersDetail')}
              tone="#6B4BB8"
            />
            <MessagingMetric
              label={t('admin.metrics.messages')}
              value={data.metrics.retainedMessages}
              detail={t('admin.metrics.messagesDetail')}
              tone="#B66A0A"
            />
            <MessagingMetric
              label={t('admin.metrics.restricted')}
              value={data.metrics.restrictedConversations}
              detail={t('admin.metrics.restrictedDetail')}
              tone="#A73549"
            />
          </Box>
          <Box
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: 'background.paper',
              overflow: 'hidden',
            }}
          >
            {data.governedConversations.map((conversation) => (
              <MessagingConversationListItem
                key={conversation.conversationId}
                conversation={conversation}
              />
            ))}
          </Box>
        </Stack>
      ) : null}
    </PageCanvas>
  );
}

export function MessagingAdminPolicy() {
  const { t } = useTranslation('messaging');
  const toast = useToast();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('ADMIN.MESSAGING', 'MANAGE');
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['messaging', 'admin'],
    queryFn: getMessagingAdminOverview,
    staleTime: 20_000,
    retry: 1,
  });
  const [form, setForm] = useState(DEFAULT_MESSAGING_POLICY_FORM);
  const validation = useMemo(() => validateMessagingPolicyForm(form), [form]);
  const dirty = messagingPolicyFormChanged(form, query.data?.policy);
  const mutation = useMutation({
    mutationFn: updateMessagingPolicy,
    onSuccess: (policy) => {
      queryClient.setQueryData<MessagingAdminOverview>(['messaging', 'admin'], (current) =>
        current ? { ...current, policy } : current
      );
      toast.success(t('admin.policy.saved'));
    },
    onError: async (error) => {
      if (error instanceof HttpError && error.status === 409) {
        const refreshed = await query.refetch();
        toast.error(refreshed.isError ? t('admin.policy.saveError') : t('admin.policy.conflict'));
        return;
      }
      toast.error(t('admin.policy.saveError'));
    },
  });

  useEffect(() => {
    if (!query.data?.policy) return;
    setForm(messagingPolicyForm(query.data.policy));
  }, [query.data?.policy]);

  const toggle = (key: keyof typeof form) =>
    setForm((current) => ({ ...current, [key]: !current[key] }));

  return (
    <PageCanvas topInset="compact">
      <MessagingPageHeading
        eyebrow={t('admin.eyebrow')}
        title={t('admin.policy.title')}
        description={t('admin.policy.description')}
        actions={
          <ActionButton
            intent="primary"
            startIcon={<Save size={17} />}
            disabled={
              !canManage || mutation.isPending || query.isLoading || !dirty || !validation.valid
            }
            onClick={() => mutation.mutate(form)}
          >
            {mutation.isPending ? t('actions.saving') : t('actions.save')}
          </ActionButton>
        }
      />

      {query.isLoading ? (
        <Skeleton variant="rounded" height={420} />
      ) : query.isError ? (
        <Alert severity="error">{t('admin.loadError')}</Alert>
      ) : (
        <Stack spacing={2} sx={{ maxWidth: 920 }}>
          {!canManage ? <Alert severity="info">{t('admin.policy.readOnly')}</Alert> : null}
          <Box
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: 'background.paper',
            }}
          >
            <Stack spacing={0} divider={<Box sx={{ borderBottom: 1, borderColor: 'divider' }} />}>
              {(
                [
                  'directMessagesEnabled',
                  'spaceMessagingEnabled',
                  'allowMessageEdit',
                  'allowMessageDelete',
                  'aiAssistanceEnabled',
                ] as const
              ).map((key) => (
                <Box key={key} sx={{ px: 2.25, py: 1.35 }}>
                  <FormControlLabel
                    disabled={!canManage}
                    control={<Checkbox checked={Boolean(form[key])} onChange={() => toggle(key)} />}
                    label={
                      <Box>
                        <Typography fontWeight={800}>
                          {t(`admin.policy.fields.${key}.label`)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {t(`admin.policy.fields.${key}.description`)}
                        </Typography>
                      </Box>
                    }
                  />
                </Box>
              ))}
              <Box
                sx={{
                  p: 2.25,
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                  gap: 2,
                }}
              >
                <FormField
                  type="number"
                  disabled={!canManage}
                  label={t('admin.policy.fields.retentionDays.label')}
                  value={form.retentionDays}
                  inputProps={{
                    min: MESSAGING_RETENTION_DAYS.min,
                    max: MESSAGING_RETENTION_DAYS.max,
                    step: 1,
                  }}
                  supportingText={t('admin.policy.fields.retentionDays.range', {
                    min: MESSAGING_RETENTION_DAYS.min,
                    max: MESSAGING_RETENTION_DAYS.max,
                  })}
                  errorMessage={
                    validation.retentionDays
                      ? undefined
                      : t('admin.policy.fields.retentionDays.range', {
                          min: MESSAGING_RETENTION_DAYS.min,
                          max: MESSAGING_RETENTION_DAYS.max,
                        })
                  }
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      retentionDays: Number(event.target.value),
                    }))
                  }
                />
                <FormField
                  type="number"
                  disabled={!canManage}
                  label={t('admin.policy.fields.maximumAttachmentMb.label')}
                  value={form.maximumAttachmentMb}
                  inputProps={{
                    min: MESSAGING_ATTACHMENT_MB.min,
                    max: MESSAGING_ATTACHMENT_MB.max,
                    step: 1,
                  }}
                  supportingText={t('admin.policy.fields.maximumAttachmentMb.range', {
                    min: MESSAGING_ATTACHMENT_MB.min,
                    max: MESSAGING_ATTACHMENT_MB.max,
                  })}
                  errorMessage={
                    validation.maximumAttachmentMb
                      ? undefined
                      : t('admin.policy.fields.maximumAttachmentMb.range', {
                          min: MESSAGING_ATTACHMENT_MB.min,
                          max: MESSAGING_ATTACHMENT_MB.max,
                        })
                  }
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      maximumAttachmentMb: Number(event.target.value),
                    }))
                  }
                />
              </Box>
              <Box sx={{ p: 2.25, bgcolor: 'var(--dwp-product-soft)' }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <ShieldCheck size={18} color="var(--dwp-product-accent)" />
                  <Typography variant="body2" fontWeight={760}>
                    {t('admin.policy.noBypass')}
                  </Typography>
                </Stack>
              </Box>
            </Stack>
          </Box>
        </Stack>
      )}
    </PageCanvas>
  );
}
