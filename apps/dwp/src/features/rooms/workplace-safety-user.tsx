import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, LifeBuoy, MessageSquareText, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  createWorkplaceIdempotencyKey,
  getActiveWorkplaceSafetySheets,
  getWorkplaceSafetyMessages,
  getWorkplaceSafetySheet,
  resolveIdempotentMutationIntent,
  respondToWorkplaceSafetyIncident,
  sendWorkplaceSafetyMessage,
} from '@dwp-frontend/shared-utils';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  EmptyState,
  FormField,
  InlineFeedback,
  LoadingState,
  PageCanvas,
} from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useRoomsCapabilities } from './rooms-capabilities';
import { RoomsPageHeading } from './rooms-ui';
import { workplaceMemberCard, workplaceMemberSoftSurface } from './workplace-member-surfaces';
import { useWorkplaceSafetyOnlineState } from './workplace-safety-online';
import { workplaceSafetySeverityTone } from './workplace-safety-ui-model';

import type {
  IdempotentMutationIntent,
  WorkplaceSafetyCommandReceipt,
  WorkplaceSafetyResponseState,
} from '@dwp-frontend/shared-utils';

export function WorkplaceSafetyUser() {
  const { t, i18n } = useTranslation('rooms');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const capabilities = useRoomsCapabilities();
  const queryClient = useQueryClient();
  const online = useWorkplaceSafetyOnlineState();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('incident');
  const [assistanceNote, setAssistanceNote] = useState('');
  const [reason, setReason] = useState('Confirm my current safety status');
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState('');
  const [messageReason, setMessageReason] = useState('Send a safety update to the command center');
  const [messageConfirmed, setMessageConfirmed] = useState(false);
  const [receipt, setReceipt] = useState<WorkplaceSafetyCommandReceipt | null>(null);
  const responseIntent = useRef<IdempotentMutationIntent | null>(null);
  const messageIntent = useRef<IdempotentMutationIntent | null>(null);

  const activeQuery = useQuery({
    queryKey: ['workplace', 'safety', 'user', 'active'],
    queryFn: getActiveWorkplaceSafetySheets,
    enabled: capabilities.isLoaded && capabilities.canViewWorkplace,
    retry: false,
    refetchInterval: online ? 15_000 : false,
  });
  const sheets = useMemo(() => activeQuery.data ?? [], [activeQuery.data]);

  useEffect(() => {
    if (selectedId && sheets.some((sheet) => sheet.incidentId === selectedId)) return;
    const next = new URLSearchParams(params);
    if (sheets[0]) next.set('incident', sheets[0].incidentId);
    else next.delete('incident');
    setParams(next, { replace: true });
  }, [params, selectedId, setParams, sheets]);

  const sheetQuery = useQuery({
    queryKey: ['workplace', 'safety', 'user', selectedId],
    queryFn: () => getWorkplaceSafetySheet(selectedId!),
    enabled: Boolean(selectedId),
    initialData: sheets.find((sheet) => sheet.incidentId === selectedId),
    retry: false,
  });
  const messagesQuery = useQuery({
    queryKey: ['workplace', 'safety', 'user', selectedId, 'messages'],
    queryFn: () => getWorkplaceSafetyMessages(selectedId!),
    enabled: Boolean(selectedId),
    retry: false,
  });
  const selected = sheetQuery.data ?? null;
  const canWrite =
    capabilities.canUpdateWorkplaceBooking && online && receipt?.state !== 'RESULT_UNKNOWN';

  const responseMutation = useMutation({
    mutationFn: (response: WorkplaceSafetyResponseState) => {
      if (
        !selected ||
        !canWrite ||
        !confirmed ||
        !reason.trim() ||
        (response === 'NEEDS_HELP' && !assistanceNote.trim())
      ) {
        throw new Error('SAFETY_RESPONSE_BLOCKED');
      }
      const input = {
        expectedIncidentVersion: selected.version,
        response,
        assistanceNote: response === 'NEEDS_HELP' ? assistanceNote.trim() : null,
        reason: reason.trim(),
        explicitConfirmation: true as const,
      };
      const intent = resolveIdempotentMutationIntent(
        responseIntent.current,
        { incidentId: selected.incidentId, ...input },
        () => createWorkplaceIdempotencyKey(`safety-response-${response.toLowerCase()}`)
      );
      responseIntent.current = intent;
      return respondToWorkplaceSafetyIncident(selected.incidentId, input, {
        idempotencyKey: intent.key,
        correlationId: crypto.randomUUID(),
      });
    },
    retry: false,
    onSuccess: async (result) => {
      responseIntent.current = null;
      setReceipt(result.receipt);
      setConfirmed(false);
      await queryClient.invalidateQueries({ queryKey: ['workplace', 'safety', 'user'] });
    },
    onError: () => void sheetQuery.refetch(),
  });

  const messageMutation = useMutation({
    mutationFn: () => {
      if (!selected || !canWrite || !message.trim() || !messageReason.trim() || !messageConfirmed) {
        throw new Error('SAFETY_MESSAGE_BLOCKED');
      }
      const input = {
        expectedIncidentVersion: selected.version,
        targetUserId: null,
        body: message.trim(),
        reason: messageReason.trim(),
        explicitConfirmation: true as const,
      };
      const intent = resolveIdempotentMutationIntent(
        messageIntent.current,
        { incidentId: selected.incidentId, ...input },
        () => createWorkplaceIdempotencyKey('safety-user-message')
      );
      messageIntent.current = intent;
      return sendWorkplaceSafetyMessage(selected.incidentId, input, {
        idempotencyKey: intent.key,
        correlationId: crypto.randomUUID(),
      });
    },
    retry: false,
    onSuccess: async (result) => {
      messageIntent.current = null;
      setReceipt(result.receipt);
      setMessage('');
      setMessageConfirmed(false);
      await messagesQuery.refetch();
    },
    onError: () => void messagesQuery.refetch(),
  });

  const recheck = async () => {
    await Promise.all([sheetQuery.refetch(), activeQuery.refetch(), messagesQuery.refetch()]);
    setReceipt(null);
  };

  return (
    <PageCanvas topInset="compact" data-testid="workplace-safety-user">
      <RoomsPageHeading
        eyebrow={t('workplace.safety.user.eyebrow')}
        title={t('workplace.safety.user.title')}
        description={t('workplace.safety.user.description')}
        actions={
          <ActionButton
            intent="secondary"
            startIcon={<RefreshCw size={16} />}
            loading={activeQuery.isFetching}
            onClick={() => void activeQuery.refetch()}
          >
            {t('actions.refresh')}
          </ActionButton>
        }
      />

      {!online && (
        <InlineFeedback severity="error" icon={<AlertTriangle size={18} />} sx={{ mb: 2 }}>
          {t('workplace.safety.user.offline')}
        </InlineFeedback>
      )}
      {capabilities.isLoaded && !capabilities.canUpdateWorkplaceBooking && (
        <InlineFeedback severity="info" sx={{ mb: 2 }}>
          {t('workplace.safety.user.readOnly')}
        </InlineFeedback>
      )}

      {activeQuery.isLoading ? (
        <LoadingState
          embedded
          variant="skeleton"
          skeletonRows={4}
          label={t('workplace.safety.loading')}
        />
      ) : activeQuery.isError ? (
        <InlineFeedback severity="error">{t('workplace.safety.user.loadError')}</InlineFeedback>
      ) : sheets.length === 0 ? (
        <EmptyState
          title={t('workplace.safety.user.emptyTitle')}
          description={t('workplace.safety.user.emptyDescription')}
        />
      ) : (
        <Stack spacing={2}>
          <Stack
            direction="row"
            gap={1}
            flexWrap="wrap"
            aria-label={t('workplace.safety.user.incidentList')}
          >
            {sheets.map((sheet) => (
              <ActionButton
                key={sheet.incidentId}
                intent={sheet.incidentId === selectedId ? 'primary' : 'secondary'}
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.set('incident', sheet.incidentId);
                  setParams(next, { replace: true });
                  setReceipt(null);
                }}
              >
                {sheet.incidentNumber}
              </ActionButton>
            ))}
          </Stack>

          {sheetQuery.isError || !selected ? (
            <InlineFeedback severity="error">
              {t('workplace.safety.user.detailError')}
            </InlineFeedback>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'minmax(0, 1fr)',
                  lg: 'minmax(0, 1.35fr) minmax(320px, .65fr)',
                },
                gap: 2,
              }}
            >
              <Stack spacing={2}>
                <Box sx={(theme) => ({ ...workplaceMemberCard(theme), p: { xs: 2, md: 3 } })}>
                  <Stack spacing={1.5}>
                    <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                      <Chip
                        color={workplaceSafetySeverityTone(selected.severity)}
                        label={t(`workplace.safety.severities.${selected.severity}`)}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {t('workplace.safety.asOf', {
                          value: formatDate(
                            selected.asOf,
                            { dateStyle: 'medium', timeStyle: 'short' },
                            locale
                          ),
                        })}
                      </Typography>
                    </Stack>
                    <Typography component="h2" variant="h5" fontWeight="fontWeightBold">
                      {selected.message}
                    </Typography>
                    <Box sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.5 })}>
                      <Typography variant="overline">
                        {t('workplace.safety.user.actionLabel')}
                      </Typography>
                      <Typography fontWeight="fontWeightBold">{selected.safetyAction}</Typography>
                      {selected.assemblyPoint && (
                        <Typography variant="body2" sx={{ mt: 0.75 }}>
                          {t('workplace.safety.user.assembly', { value: selected.assemblyPoint })}
                        </Typography>
                      )}
                    </Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ overflowWrap: 'anywhere' }}
                    >
                      {selected.scopeLabels.join(' · ')}
                    </Typography>
                    <InlineFeedback severity="info" icon={<LifeBuoy size={18} />}>
                      {t('workplace.safety.user.alternativeContact', {
                        value: selected.accessibleAlternativeContact,
                      })}
                    </InlineFeedback>
                  </Stack>
                </Box>

                {receipt?.state === 'RESULT_UNKNOWN' && (
                  <InlineFeedback severity="warning" icon={<AlertTriangle size={18} />}>
                    {t('workplace.safety.recovery.getOnly')}
                    <ActionButton intent="quiet" size="small" onClick={() => void recheck()}>
                      {t('workplace.safety.actions.recheck')}
                    </ActionButton>
                  </InlineFeedback>
                )}

                <Box
                  sx={(theme) => ({
                    ...workplaceMemberCard(theme),
                    p: { xs: 1.5, md: 2 },
                    position: { xs: 'sticky', md: 'static' },
                    bottom: { xs: 0, md: 'auto' },
                    zIndex: 3,
                  })}
                >
                  <Stack spacing={1.25}>
                    <Typography component="h2" variant="subtitle1" fontWeight="fontWeightBold">
                      {t('workplace.safety.user.responseTitle')}
                    </Typography>
                    {selected.currentResponse && (
                      <Chip
                        size="small"
                        color={selected.currentResponse === 'SAFE' ? 'success' : 'error'}
                        label={t(`workplace.safety.responses.${selected.currentResponse}`)}
                        sx={{ alignSelf: 'flex-start' }}
                      />
                    )}
                    <FormField
                      label={t('workplace.safety.user.assistanceNote')}
                      supportingText={t('workplace.safety.user.assistanceHint')}
                      value={assistanceNote}
                      onChange={(event) => setAssistanceNote(event.target.value)}
                    />
                    <FormField
                      label={t('workplace.safety.fields.reason')}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={confirmed}
                          onChange={(event) => setConfirmed(event.target.checked)}
                        />
                      }
                      label={t('workplace.safety.confirmation')}
                    />
                    <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                      <ActionButton
                        intent="primary"
                        startIcon={<CheckCircle2 size={17} />}
                        disabled={!canWrite || !confirmed || !reason.trim()}
                        loading={responseMutation.isPending}
                        onClick={() => responseMutation.mutate('SAFE')}
                      >
                        {t('workplace.safety.responses.SAFE')}
                      </ActionButton>
                      <ActionButton
                        intent="danger"
                        startIcon={<LifeBuoy size={17} />}
                        disabled={
                          !canWrite || !confirmed || !reason.trim() || !assistanceNote.trim()
                        }
                        loading={responseMutation.isPending}
                        onClick={() => responseMutation.mutate('NEEDS_HELP')}
                      >
                        {t('workplace.safety.responses.NEEDS_HELP')}
                      </ActionButton>
                    </Stack>
                    {responseMutation.isError && (
                      <InlineFeedback severity="error">
                        {t('workplace.safety.user.responseError')}
                      </InlineFeedback>
                    )}
                  </Stack>
                </Box>
              </Stack>

              <Box sx={(theme) => ({ ...workplaceMemberCard(theme), p: { xs: 1.5, md: 2 } })}>
                <Stack spacing={1.25}>
                  <Typography component="h2" variant="subtitle1" fontWeight="fontWeightBold">
                    {t('workplace.safety.messages.title')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('workplace.safety.messages.maskingNotice')}
                  </Typography>
                  {messagesQuery.isError ? (
                    <InlineFeedback severity="error">
                      {t('workplace.safety.messages.loadError')}
                    </InlineFeedback>
                  ) : (messagesQuery.data ?? []).length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      {t('workplace.safety.messages.empty')}
                    </Typography>
                  ) : (
                    <Stack component="ol" spacing={1} sx={{ p: 0, m: 0, listStyle: 'none' }}>
                      {(messagesQuery.data ?? []).map((item) => (
                        <Box
                          component="li"
                          key={item.messageId}
                          sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.25 })}
                        >
                          <Typography variant="caption" color="text.secondary">
                            {t(`workplace.safety.messageDirections.${item.direction}`)} ·{' '}
                            {formatDate(item.createdAt, { timeStyle: 'short' }, locale)}
                          </Typography>
                          <Typography sx={{ overflowWrap: 'anywhere' }}>
                            {item.maskedBody}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  )}
                  <FormField
                    label={t('workplace.safety.messages.body')}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                  />
                  <FormField
                    label={t('workplace.safety.fields.reason')}
                    value={messageReason}
                    onChange={(event) => setMessageReason(event.target.value)}
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={messageConfirmed}
                        onChange={(event) => setMessageConfirmed(event.target.checked)}
                      />
                    }
                    label={t('workplace.safety.confirmation')}
                  />
                  <ActionButton
                    intent="secondary"
                    startIcon={<MessageSquareText size={17} />}
                    disabled={
                      !canWrite || !message.trim() || !messageReason.trim() || !messageConfirmed
                    }
                    loading={messageMutation.isPending}
                    onClick={() => messageMutation.mutate()}
                  >
                    {t('workplace.safety.actions.sendMessage')}
                  </ActionButton>
                  {messageMutation.isError && (
                    <InlineFeedback severity="error">
                      {t('workplace.safety.messages.sendError')}
                    </InlineFeedback>
                  )}
                </Stack>
              </Box>
            </Box>
          )}
        </Stack>
      )}

      {receipt && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mt: 2, overflowWrap: 'anywhere' }}
        >
          {t('workplace.safety.receipt', {
            command: receipt.commandId,
            correlation: receipt.correlationId,
            state: t(`workplace.safety.commandStates.${receipt.state}`),
          })}
        </Typography>
      )}
    </PageCanvas>
  );
}
