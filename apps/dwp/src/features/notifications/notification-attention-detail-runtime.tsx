import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BellDot } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  applyNotificationAttentionControl,
  getNotificationAttentionControls,
  previewNotificationAttentionControl,
} from '@dwp-frontend/shared-utils/api/notification-attention-api';
import { createNotificationIdempotencyKey } from '@dwp-frontend/shared-utils/api/notification-api';
import { HttpError, useToast } from '@dwp-frontend/shared-utils';
import { InlineFeedback, LoadingState } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { controlEffect, toAttentionScopeOption } from './notification-attention-adapters';
import { NotificationAttentionControls } from './notification-attention-controls';
import { notificationQueryKeys } from './integration-contract';
import { useOnlineStatus } from './use-notification-runtime';

import type { NotificationAttentionImpactPreview } from './notification-attention-model';
import type { NotificationAttentionControlImpactPreview } from '@dwp-frontend/shared-utils/api/notification-attention-api';

type AttentionPreviewTicket = {
  optionId: string;
  expirationId: string | null;
  preview: NotificationAttentionControlImpactPreview;
};

function sameExpiry(left: string | null | undefined, right: string | null | undefined): boolean {
  return (left ?? null) === (right ?? null);
}

export function NotificationAttentionDetailRuntime({
  notificationId,
  notificationTitle,
}: {
  notificationId: string;
  notificationTitle?: string;
}) {
  const { t } = useTranslation('notifications');
  const toast = useToast();
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const previewSequence = useRef(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [selectedExpirationId, setSelectedExpirationId] = useState<string | null>(null);
  const [preview, setPreview] = useState<NotificationAttentionImpactPreview>({ state: 'IDLE' });
  const [previewTicket, setPreviewTicket] = useState<AttentionPreviewTicket | null>(null);

  const query = useQuery({
    queryKey: notificationQueryKeys.attentionControls(notificationId),
    queryFn: ({ signal }) => getNotificationAttentionControls(notificationId, signal),
    staleTime: 30_000,
    retry: 1,
  });
  const options = useMemo(
    () =>
      (query.data?.controls ?? [])
        .map((control) => toAttentionScopeOption(control, t))
        .filter((option): option is NonNullable<typeof option> => Boolean(option)),
    [query.data?.controls, t]
  );
  const controlsById = useMemo(
    () => new Map((query.data?.controls ?? []).map((control) => [control.controlKey, control])),
    [query.data?.controls]
  );

  useEffect(() => {
    if (!options.some((option) => option.optionId === selectedOptionId)) {
      const first = options.find((option) => option.availability === 'AVAILABLE') ?? options[0];
      setSelectedOptionId(first?.optionId ?? null);
      setSelectedExpirationId(first?.expirationOptions[0]?.optionId ?? null);
      previewSequence.current += 1;
      setPreviewTicket(null);
      setPreview({ state: 'IDLE' });
    }
  }, [options, selectedOptionId]);

  useEffect(() => {
    previewSequence.current += 1;
    setPreviewTicket(null);
    setPreview({ state: 'IDLE' });
  }, [query.data?.generatedAt]);

  const previewMutation = useMutation({
    mutationFn: async ({
      optionId,
      expirationId,
      requestId,
    }: {
      optionId: string;
      expirationId: string | null;
      requestId: number;
    }) => {
      const option = options.find((candidate) => candidate.optionId === optionId);
      const raw = controlsById.get(optionId);
      if (!option || !raw)
        throw new Error('Selected notification attention control is unavailable.');
      const expiresAt = option.expirationOptions.find(
        (item) => item.optionId === expirationId
      )?.expiresAt;
      const result = await previewNotificationAttentionControl(notificationId, {
        controlKey: raw.controlKey,
        effect: controlEffect(option.action),
        expiresAt,
      });
      return { expirationId, expiresAt, option, raw, requestId, result };
    },
    onMutate: () => {
      setPreviewTicket(null);
      setPreview({ state: 'LOADING' });
    },
    onSuccess: ({ expirationId, expiresAt, option, raw, requestId, result }) => {
      if (requestId !== previewSequence.current) return;
      const responseIsBound =
        result.controlKey === raw.controlKey &&
        result.effectiveEffect === controlEffect(option.action) &&
        sameExpiry(result.expiresAt, expiresAt) &&
        /^[a-f0-9]{64}$/u.test(result.previewFingerprint);
      if (!responseIsBound) {
        setPreviewTicket(null);
        setPreview({ state: 'ERROR', message: t('attention.controls.previewFailed') });
        return;
      }
      if (!result.allowed || result.policyLocked) {
        setPreviewTicket(null);
        setPreview({
          state: 'ERROR',
          message: result.policyReason ?? t('attention.controls.previewDenied'),
        });
        return;
      }
      setPreviewTicket({ optionId: option.optionId, expirationId, preview: result });
      setPreview({
        state: 'READY',
        asOf: result.asOf,
        statements: [
          t('attention.controls.previewStatement', {
            action: t(`attention.actions.${option.action}`),
            scope: option.scopeLabel,
          }),
          result.expiresAt
            ? t('attention.controls.previewExpiry', {
                date:
                  option.expirationOptions.find((item) => item.optionId === expirationId)?.label ??
                  result.expiresAt,
              })
            : t('attention.controls.previewOngoing'),
        ],
        policyNotices: [
          t('attention.controls.previewAuthoritative'),
          ...(result.policyReason
            ? [t('attention.controls.previewPolicyReason', { reason: result.policyReason })]
            : []),
        ],
      });
    },
    onError: async (_error, variables) => {
      if (variables.requestId !== previewSequence.current) return;
      setPreviewTicket(null);
      if (!online || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        setPreview({ state: 'OFFLINE', message: t('attention.controls.previewOffline') });
        return;
      }
      setPreview({ state: 'ERROR', message: t('attention.controls.previewFailed') });
    },
  });

  const mutation = useMutation({
    mutationFn: ({
      optionId,
      expirationId,
      expiresAt,
    }: {
      optionId: string;
      expirationId: string | null;
      expiresAt?: string | null;
    }) => {
      const option = options.find((candidate) => candidate.optionId === optionId);
      const raw = controlsById.get(optionId);
      if (
        !option ||
        !raw ||
        !previewTicket ||
        previewTicket.optionId !== optionId ||
        previewTicket.expirationId !== expirationId ||
        !sameExpiry(previewTicket.preview.expiresAt, expiresAt)
      )
        throw new Error('Selected notification attention control is unavailable.');
      return applyNotificationAttentionControl(notificationId, {
        controlKey: raw.controlKey,
        effect: controlEffect(option.action),
        expiresAt,
        expectedVersion: previewTicket.preview.currentRuleVersion,
        previewFingerprint: previewTicket.preview.previewFingerprint,
        idempotencyKey: createNotificationIdempotencyKey('attention-control'),
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: notificationQueryKeys.attentionControls(notificationId),
        }),
        queryClient.invalidateQueries({ queryKey: notificationQueryKeys.attentionRules() }),
      ]);
      previewSequence.current += 1;
      setPreviewTicket(null);
      setPreview({ state: 'IDLE' });
      toast.success(t('attention.controls.feedback.saved'));
    },
    onError: async (error) => {
      if (error instanceof HttpError && error.status === 409) {
        const latest = await query.refetch();
        setPreview({
          state: 'CONFLICT',
          asOf: latest.data?.generatedAt ?? new Date().toISOString(),
          message: t('attention.controls.feedback.conflict'),
        });
        setPreviewTicket(null);
        return;
      }
      if (error instanceof HttpError && error.status === 403) {
        await query.refetch();
        setPreviewTicket(null);
        setPreview({ state: 'ERROR', message: t('attention.controls.previewDenied') });
        toast.error(t('attention.controls.feedback.denied'));
        return;
      }
      setPreviewTicket(null);
      toast.error(t('attention.controls.feedback.failed'));
    },
  });

  const onPreview = (optionId: string, expirationId: string | null) => {
    if (!online) {
      setPreviewTicket(null);
      setPreview({ state: 'OFFLINE', message: t('attention.controls.previewOffline') });
      return;
    }
    const requestId = previewSequence.current + 1;
    previewSequence.current = requestId;
    previewMutation.mutate({ optionId, expirationId, requestId });
  };

  return (
    <Box component="details" sx={{ mt: 2, borderTop: 1, borderColor: 'divider' }}>
      <Box
        component="summary"
        sx={{
          py: 1.5,
          cursor: 'pointer',
          listStyle: 'none',
          '&::-webkit-details-marker': { display: 'none' },
        }}
      >
        <Stack direction="row" gap={0.75} alignItems="center">
          <BellDot size={17} aria-hidden />
          <Typography variant="subtitle2">{t('attention.controls.openLabel')}</Typography>
        </Stack>
      </Box>
      {query.isLoading ? (
        <LoadingState
          label={t('attention.controls.loading')}
          variant="skeleton"
          skeletonRows={3}
          embedded
        />
      ) : query.isError || !query.data ? (
        <InlineFeedback severity="warning" sx={{ mb: 1.5 }}>
          {t('attention.controls.loadFailed')}
        </InlineFeedback>
      ) : (
        <NotificationAttentionControls
          notificationTitle={notificationTitle}
          whyReceived={query.data.whyReceived}
          reasonDetails={
            query.data.partial ? [query.data.message ?? t('attention.controls.partial')] : []
          }
          scopeOptions={options}
          selectedOptionId={selectedOptionId}
          selectedExpirationId={selectedExpirationId}
          preview={preview}
          mutationState={mutation.isPending ? 'SAVING' : 'IDLE'}
          onOptionChange={(optionId) => {
            const option = options.find((candidate) => candidate.optionId === optionId);
            setSelectedOptionId(optionId);
            setSelectedExpirationId(option?.expirationOptions[0]?.optionId ?? null);
            previewSequence.current += 1;
            setPreviewTicket(null);
            setPreview({ state: 'IDLE' });
          }}
          onExpirationChange={(expirationId) => {
            setSelectedExpirationId(expirationId);
            previewSequence.current += 1;
            setPreviewTicket(null);
            setPreview({ state: 'IDLE' });
          }}
          onPreview={(option, expirationId) => onPreview(option.optionId, expirationId)}
          onApply={(option, expirationId) => {
            const expiresAt = option.expirationOptions.find(
              (item) => item.optionId === expirationId
            )?.expiresAt;
            mutation.mutate({ optionId: option.optionId, expirationId, expiresAt });
          }}
          onRebase={() => void query.refetch()}
        />
      )}
    </Box>
  );
}
