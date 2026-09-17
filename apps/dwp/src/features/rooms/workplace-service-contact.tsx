import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Headphones, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  contactWorkplaceServiceOrder,
  createWorkplaceIdempotencyKey,
  resolveIdempotentMutationIntent,
} from '@dwp-frontend/shared-utils';
import { ActionButton, FormField, InlineFeedback, SelectField } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { workplaceMemberSoftSurface } from './workplace-member-surfaces';
import { requireWorkplaceServiceWrite } from './workplace-services-ui-model';

import type { IdempotentMutationIntent, WorkplaceServiceOrder } from '@dwp-frontend/shared-utils';

export function WorkplaceServiceContact({
  order,
  canWrite,
}: {
  order: WorkplaceServiceOrder;
  canWrite: boolean;
}) {
  const { t } = useTranslation('rooms');
  const [target, setTarget] = useState<'SERVICE_DESK' | 'ASSIGNEE'>('SERVICE_DESK');
  const [lineId, setLineId] = useState(order.lines[0]?.serviceOrderLineId ?? '');
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const intentRef = useRef<IdempotentMutationIntent | null>(null);
  const mutation = useMutation({
    mutationFn: () => {
      requireWorkplaceServiceWrite(
        canWrite &&
          Boolean(message.trim()) &&
          Boolean(reason.trim()) &&
          confirmed &&
          Boolean(lineId)
      );
      const input = {
        target,
        serviceOrderLineId: lineId,
        expectedOrderVersion: order.version,
        message: message.trim(),
        explicitConfirmation: true as const,
        reason: reason.trim(),
      };
      const intent = resolveIdempotentMutationIntent(intentRef.current, input, () =>
        createWorkplaceIdempotencyKey('service-contact')
      );
      intentRef.current = intent;
      return contactWorkplaceServiceOrder(order.serviceOrderId, input, {
        idempotencyKey: intent.key,
      });
    },
    retry: false,
    onSuccess: () => {
      intentRef.current = null;
      setMessage('');
      setReason('');
      setConfirmed(false);
    },
  });
  const valid =
    canWrite && Boolean(message.trim()) && Boolean(reason.trim()) && confirmed && Boolean(lineId);

  return (
    <Box
      id="workplace-service-contact"
      sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.25 })}
    >
      <Stack direction="row" gap={0.75} alignItems="center" mb={1}>
        <Headphones size={17} aria-hidden="true" />
        <Typography component="h4" variant="subtitle2" fontWeight="fontWeightBold">
          {t('workplace.services.extensions.contactTitle')}
        </Typography>
      </Stack>
      <Stack spacing={1}>
        <SelectField
          label={t('workplace.services.extensions.contactTarget')}
          value={target}
          options={(['SERVICE_DESK', 'ASSIGNEE'] as const).map((value) => ({
            value,
            label: t(`workplace.services.extensions.contactTargets.${value}`),
          }))}
          onValueChange={(value) => value && setTarget(value as 'SERVICE_DESK' | 'ASSIGNEE')}
          disabled={!canWrite || mutation.isPending}
        />
        <SelectField
          label={t('workplace.services.extensions.contactLine')}
          value={lineId}
          options={order.lines.map((line) => ({
            value: line.serviceOrderLineId,
            label: `${line.serviceCode} · ${line.providerCode}`,
          }))}
          onValueChange={(value) => setLineId(value ?? '')}
          disabled={!canWrite || mutation.isPending}
        />
        <FormField
          multiline
          minRows={2}
          label={t('workplace.services.extensions.contactMessage')}
          value={message}
          inputProps={{ maxLength: 2000 }}
          onChange={(event) => setMessage(event.target.value)}
          disabled={!canWrite || mutation.isPending}
        />
        <FormField
          label={t('workplace.services.changeReason')}
          value={reason}
          inputProps={{ maxLength: 500 }}
          onChange={(event) => setReason(event.target.value)}
          disabled={!canWrite || mutation.isPending}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              disabled={!canWrite || mutation.isPending}
            />
          }
          label={t('workplace.services.extensions.contactConfirmation')}
        />
        {mutation.isSuccess ? (
          <InlineFeedback severity="success">
            {t('workplace.services.extensions.contactAccepted', {
              name: mutation.data.resolvedTargetDisplayName,
            })}
          </InlineFeedback>
        ) : null}
        {mutation.isError ? (
          <InlineFeedback severity="error">
            {t('workplace.services.extensions.contactError')}
          </InlineFeedback>
        ) : null}
        <ActionButton
          intent="primary"
          startIcon={<Send size={16} />}
          loading={mutation.isPending}
          disabled={!valid}
          onClick={() => mutation.mutate()}
        >
          {t('workplace.services.extensions.sendContact')}
        </ActionButton>
      </Stack>
    </Box>
  );
}
