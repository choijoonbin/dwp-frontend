import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarClock, Plus, UserRoundCheck } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionButton,
  DateTimePickerField,
  FormDialog,
  FormField,
} from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  createApprovalDelegation,
  getApprovalDelegations,
  useToast,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ApprovalLinkRow, ApprovalSurface, StatusChip, approvalTone } from './approval-ui';

export function ApprovalDelegations() {
  const { t } = useTranslation('approvals');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [delegateUserId, setDelegateUserId] = useState('');
  const [reason, setReason] = useState('');
  const [startsAt, setStartsAt] = useState(() => new Date().toISOString());
  const [endsAt, setEndsAt] = useState(() => new Date(Date.now() + 7 * 86400000).toISOString());
  const delegations = useQuery({
    queryKey: ['approvals', 'delegations'],
    queryFn: getApprovalDelegations,
    staleTime: 20_000,
  });
  const create = useMutation({
    mutationFn: () =>
      createApprovalDelegation({
        delegateUserId: Number(delegateUserId),
        scopeType: 'ALL',
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        reason: reason.trim(),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['approvals', 'delegations'] });
      setOpen(false);
      setReason('');
      toast.success(t('delegations.created'));
    },
    onError: () => toast.error(t('delegations.createError')),
  });
  return (
    <ApprovalSurface
      title={t('delegations.title')}
      meta={t('delegations.meta')}
      action={
        <ActionButton
          intent="primary"
          size="small"
          startIcon={<Plus size={16} />}
          onClick={() => setOpen(true)}
        >
          {t('delegations.add')}
        </ActionButton>
      }
    >
      {(delegations.data ?? []).map((delegation) => (
        <ApprovalLinkRow
          key={delegation.delegationId}
          title={t('delegations.delegateLabel', { userId: delegation.delegateUserId })}
          detail={`${formatDate(delegation.startsAt)} - ${formatDate(delegation.endsAt)} · ${delegation.reason}`}
          route="/approvals/delegations"
          icon={UserRoundCheck}
          tone={approvalTone.teal}
          trailing={<StatusChip status={delegation.lifecycleState} />}
        />
      ))}
      {!delegations.isLoading && delegations.data?.length === 0 && (
        <Box sx={{ py: 8, textAlign: 'center' }}>
          <CalendarClock size={34} color="#728096" />
          <Typography variant="subtitle1" sx={{ mt: 1 }}>
            {t('delegations.empty')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('delegations.emptyDescription')}
          </Typography>
        </Box>
      )}
      <FormDialog
        open={open}
        title={t('delegations.dialog.title')}
        cancelLabel={t('actions.cancel')}
        submitLabel={t('actions.save')}
        busy={create.isPending}
        submitDisabled={
          !delegateUserId || reason.trim().length < 2 || new Date(endsAt) <= new Date(startsAt)
        }
        onClose={() => setOpen(false)}
        onSubmit={() => create.mutate()}
      >
        <Stack gap={2}>
          <FormField
            required
            type="number"
            label={t('delegations.fields.delegateUserId')}
            value={delegateUserId}
            onChange={(event) => setDelegateUserId(event.target.value)}
          />
          <DateTimePickerField
            required
            label={t('delegations.fields.startsAt')}
            value={startsAt || null}
            onValueChange={(value) => setStartsAt(value ?? '')}
          />
          <DateTimePickerField
            required
            label={t('delegations.fields.endsAt')}
            value={endsAt || null}
            onValueChange={(value) => setEndsAt(value ?? '')}
          />
          <FormField
            required
            multiline
            minRows={3}
            label={t('delegations.fields.reason')}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </Stack>
      </FormDialog>
    </ApprovalSurface>
  );
}
