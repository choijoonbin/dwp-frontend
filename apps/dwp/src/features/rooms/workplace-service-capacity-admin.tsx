import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarRange, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  createWorkplaceIdempotencyKey,
  getWorkplaceServiceCapacity,
  updateWorkplaceServiceCapacity,
} from '@dwp-frontend/shared-utils';
import { ActionButton, FormField, InlineFeedback } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { workplaceMemberSoftSurface } from './workplace-member-surfaces';
import { requireWorkplaceServiceWrite } from './workplace-services-ui-model';

type CapacityDraft = Readonly<{
  startsAt: string;
  endsAt: string;
  capacityLimit: number;
  sourceVersion: string;
  sourceObservedAt: string;
}>;

function defaultWindow() {
  const from = new Date();
  from.setMinutes(0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 7);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function WorkplaceServiceCapacityAdmin({
  catalogItemId,
  siteId,
  canManage,
  elevated,
}: {
  catalogItemId: string | null;
  siteId: string | null;
  canManage: boolean;
  elevated: boolean;
}) {
  const { t } = useTranslation('rooms');
  const { t: tCommon } = useTranslation('common');
  const queryClient = useQueryClient();
  const range = useMemo(defaultWindow, [catalogItemId, siteId]);
  const query = useQuery({
    queryKey: [
      'workplace',
      'services',
      'admin-capacity',
      catalogItemId,
      siteId,
      range.from,
      range.to,
    ],
    queryFn: () => getWorkplaceServiceCapacity(catalogItemId!, siteId!, range.from, range.to, true),
    enabled: Boolean(catalogItemId && siteId && canManage),
    retry: false,
  });
  const [drafts, setDrafts] = useState<readonly CapacityDraft[]>([]);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    setDrafts(
      query.data?.buckets.map((bucket) => ({
        startsAt: bucket.startsAt,
        endsAt: bucket.endsAt,
        capacityLimit: bucket.capacityLimit,
        sourceVersion: bucket.sourceVersion,
        sourceObservedAt: bucket.sourceObservedAt,
      })) ?? []
    );
    setReason('');
    setConfirmed(false);
  }, [query.data]);
  const valid = Boolean(
    query.data &&
    query.data.mode === 'BUCKETED' &&
    drafts.length > 0 &&
    drafts.every(
      (bucket, index) =>
        Number.isInteger(bucket.capacityLimit) &&
        bucket.capacityLimit >= 0 &&
        Boolean(bucket.sourceVersion.trim()) &&
        Number.isFinite(Date.parse(bucket.startsAt)) &&
        Number.isFinite(Date.parse(bucket.endsAt)) &&
        Date.parse(bucket.endsAt) > Date.parse(bucket.startsAt) &&
        (index === 0 || Date.parse(bucket.startsAt) >= Date.parse(drafts[index - 1]!.endsAt))
    )
  );
  const mutation = useMutation({
    mutationFn: () => {
      requireWorkplaceServiceWrite(
        canManage && elevated && valid && confirmed && Boolean(reason.trim())
      );
      return updateWorkplaceServiceCapacity(
        catalogItemId!,
        {
          siteReference: siteId!,
          buckets: drafts,
          reason: reason.trim(),
          explicitConfirmation: true,
        },
        {
          idempotencyKey: createWorkplaceIdempotencyKey('service-capacity-update'),
          activeAccessMode: 'ELEVATED',
        }
      );
    },
    retry: false,
    onSuccess: (result) => {
      queryClient.setQueryData(
        ['workplace', 'services', 'admin-capacity', catalogItemId, siteId, range.from, range.to],
        result.capacity
      );
      setConfirmed(false);
      setReason('');
    },
  });
  const patchDraft = (index: number, values: Partial<CapacityDraft>) =>
    setDrafts((current) =>
      current.map((draft, draftIndex) => (draftIndex === index ? { ...draft, ...values } : draft))
    );
  const appendDraft = () => {
    const previousEnd = drafts.at(-1)?.endsAt ?? range.from;
    const startsAt = new Date(previousEnd);
    const endsAt = new Date(startsAt);
    endsAt.setHours(endsAt.getHours() + 1);
    setDrafts((current) => [
      ...current,
      {
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        capacityLimit: 0,
        sourceVersion: `manual-${Date.now()}`,
        sourceObservedAt: new Date().toISOString(),
      },
    ]);
  };

  if (!catalogItemId) return null;
  if (!siteId) {
    return (
      <InlineFeedback severity="warning">
        {t('workplace.services.extensions.capacitySiteUnavailable')}
      </InlineFeedback>
    );
  }
  return (
    <Box
      data-testid="workplace-service-capacity-admin"
      sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.25 })}
    >
      <Stack direction="row" gap={0.75} alignItems="center">
        <CalendarRange size={17} aria-hidden="true" />
        <Typography component="h3" variant="subtitle2" fontWeight="fontWeightBold">
          {t('workplace.services.extensions.capacityAdminTitle')}
        </Typography>
      </Stack>
      {query.isLoading ? (
        <Typography variant="body2" color="text.secondary" mt={1}>
          {t('workplace.services.loading')}
        </Typography>
      ) : query.isError || !query.data ? (
        <InlineFeedback
          severity="warning"
          action={
            <ActionButton intent="quiet" size="small" onClick={() => void query.refetch()}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('workplace.services.extensions.capacityUnavailable')}
        </InlineFeedback>
      ) : (
        <Stack spacing={1} mt={1}>
          {drafts.map((draft, index) => {
            const current = query.data.buckets.find(
              (bucket) => bucket.startsAt === draft.startsAt && bucket.endsAt === draft.endsAt
            );
            return (
              <Box
                key={`${draft.startsAt}:${index}`}
                sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}
              >
                <FormField
                  label={t('workplace.services.extensions.capacityStartsAt')}
                  value={draft.startsAt}
                  disabled={!canManage || !elevated || mutation.isPending}
                  onChange={(event) => patchDraft(index, { startsAt: event.target.value })}
                />
                <FormField
                  label={t('workplace.services.extensions.capacityEndsAt')}
                  value={draft.endsAt}
                  disabled={!canManage || !elevated || mutation.isPending}
                  onChange={(event) => patchDraft(index, { endsAt: event.target.value })}
                />
                <FormField
                  type="number"
                  label={t('workplace.services.extensions.capacityLimit')}
                  value={draft.capacityLimit}
                  inputProps={{ min: 0, step: 1 }}
                  disabled={!canManage || !elevated || mutation.isPending}
                  supportingText={t('workplace.services.extensions.capacityReserved', {
                    count: (current?.committedQuantity ?? 0) + (current?.heldQuantity ?? 0),
                  })}
                  onChange={(event) =>
                    patchDraft(index, { capacityLimit: Number(event.target.value) })
                  }
                />
                <FormField
                  label={t('workplace.services.extensions.capacitySourceVersion')}
                  value={draft.sourceVersion}
                  inputProps={{ maxLength: 160 }}
                  disabled={!canManage || !elevated || mutation.isPending}
                  onChange={(event) =>
                    patchDraft(index, {
                      sourceVersion: event.target.value,
                      sourceObservedAt: new Date().toISOString(),
                    })
                  }
                />
                {!current ? (
                  <ActionButton
                    intent="danger"
                    size="small"
                    startIcon={<Trash2 size={15} />}
                    disabled={!canManage || !elevated || mutation.isPending}
                    onClick={() =>
                      setDrafts((values) => values.filter((_, draftIndex) => draftIndex !== index))
                    }
                  >
                    {tCommon('actions.delete')}
                  </ActionButton>
                ) : null}
              </Box>
            );
          })}
          {!drafts.length ? (
            <InlineFeedback severity="info">
              {t('workplace.services.extensions.capacityEmpty')}
            </InlineFeedback>
          ) : null}
          <ActionButton
            intent="secondary"
            size="small"
            startIcon={<Plus size={15} />}
            disabled={!canManage || !elevated || mutation.isPending || drafts.length >= 1000}
            onClick={appendDraft}
          >
            {t('workplace.services.extensions.addCapacityBucket')}
          </ActionButton>
          <FormField
            label={t('workplace.services.changeReason')}
            value={reason}
            inputProps={{ maxLength: 500 }}
            disabled={!canManage || !elevated || mutation.isPending}
            onChange={(event) => setReason(event.target.value)}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={confirmed}
                disabled={!canManage || !elevated || mutation.isPending}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
            }
            label={t('workplace.services.extensions.capacityConfirmation')}
          />
          {!elevated && canManage ? (
            <InlineFeedback severity="warning" icon={<ShieldCheck size={17} />}>
              {t('workplace.services.stepUpRequired')}
            </InlineFeedback>
          ) : null}
          {mutation.isError ? (
            <InlineFeedback severity="error">{t('workplace.services.commandError')}</InlineFeedback>
          ) : null}
          <ActionButton
            intent="primary"
            loading={mutation.isPending}
            disabled={!canManage || !elevated || !valid || !confirmed || !reason.trim()}
            onClick={() => mutation.mutate()}
          >
            {t('workplace.services.extensions.saveCapacity')}
          </ActionButton>
        </Stack>
      )}
    </Box>
  );
}
