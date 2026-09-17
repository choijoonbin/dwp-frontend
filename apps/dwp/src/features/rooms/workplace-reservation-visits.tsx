import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, RefreshCw, ShieldCheck, UserRoundPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  cancelWorkplaceVisit,
  createWorkplaceIdempotencyKey,
  createWorkplaceVisit,
  getWorkplaceVisit,
  getWorkplaceVisits,
  previewWorkplaceVisit,
  requestWorkplaceVisitAccess,
  resolveIdempotentMutationIntent,
  sendWorkplaceVisitInvitation,
} from '@dwp-frontend/shared-utils';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import { ActionButton, EmptyState, FormField, InlineFeedback } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useRoomsCapabilities } from './rooms-capabilities';
import { workplaceMemberCard, workplaceMemberSoftSurface } from './workplace-member-surfaces';
import {
  isGetOnlyVisitRecovery,
  requesterVisitActions,
  workplaceVisitProviderTone,
  workplaceVisitTone,
} from './workplace-visits-ui-model';

import type {
  IdempotentMutationIntent,
  WorkplaceRequesterVisit,
  WorkplaceVisitGuestRefInput,
  WorkplaceVisitPreview,
} from '@dwp-frontend/shared-utils';
import type { WorkplaceUnifiedReservation } from './workplace-unified-reservations-model';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

type VisitCommand = 'SEND_INVITATION' | 'REQUEST_ACCESS' | 'CANCEL';

function isVisitCommand(action: string): action is VisitCommand {
  return action === 'SEND_INVITATION' || action === 'REQUEST_ACCESS' || action === 'CANCEL';
}

function retentionDate() {
  return new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
}

function VisitStatus({ visit }: { visit: WorkplaceRequesterVisit }) {
  const { t, i18n } = useTranslation('rooms');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  return (
    <Stack spacing={1.25}>
      <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
        <Chip
          size="small"
          color={workplaceVisitTone(visit.state)}
          label={t(`workplace.visits.states.${visit.state}`)}
        />
        <Typography component="h3" variant="subtitle1" fontWeight="fontWeightBold">
          {t('workplace.visits.visitTitle', { type: visit.visitType })}
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        {formatDate(visit.startsAt, { dateStyle: 'medium', timeStyle: 'short' }, locale)} –{' '}
        {formatDate(visit.endsAt, { timeStyle: 'short' }, locale)}
      </Typography>
      <Stack component="ul" spacing={0.75} sx={{ p: 0, m: 0, listStyle: 'none' }}>
        {visit.guests.map((guest) => (
          <Box component="li" key={guest.opaqueRef}>
            <Typography variant="body2" fontWeight="fontWeightMedium">
              {guest.maskedLabel}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {guest.purpose}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Stack>
  );
}

function PreviewEvidence({ preview }: { preview: WorkplaceVisitPreview }) {
  const { t } = useTranslation('rooms');
  return (
    <Box sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.5 })}>
      <Typography component="h3" variant="subtitle2" fontWeight="fontWeightBold">
        {t('workplace.visits.preview.title')}
      </Typography>
      <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 1 }}>
        <Chip
          size="small"
          color={workplaceVisitProviderTone(preview.visitorProvider.state)}
          label={t('workplace.visits.preview.provider', {
            kind: t('workplace.visits.providerKinds.VISITOR'),
            state: t(`workplace.visits.providerStates.${preview.visitorProvider.state}`),
          })}
        />
        <Chip
          size="small"
          color={workplaceVisitProviderTone(preview.accessProvider.state)}
          label={t('workplace.visits.preview.provider', {
            kind: t('workplace.visits.providerKinds.ACCESS'),
            state: t(`workplace.visits.providerStates.${preview.accessProvider.state}`),
          })}
        />
      </Stack>
      <Typography variant="body2" sx={{ mt: 1 }}>
        {t('workplace.visits.preview.requirements', {
          approval: preview.approvalRequired ? t('workplace.visits.yes') : t('workplace.visits.no'),
          nda: preview.ndaRequired ? t('workplace.visits.yes') : t('workplace.visits.no'),
          identity: preview.identityVerificationRequired
            ? t('workplace.visits.yes')
            : t('workplace.visits.no'),
        })}
      </Typography>
      {preview.minimumCollectionFields.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {t('workplace.visits.preview.minimumFields', {
            fields: preview.minimumCollectionFields.join(', '),
          })}
        </Typography>
      )}
      {preview.limitations.length > 0 && (
        <InlineFeedback severity="warning" sx={{ mt: 1 }}>
          {preview.limitations.join(' · ')}
        </InlineFeedback>
      )}
      {[preview.visitorProvider, preview.accessProvider].some(
        (provider) => provider.state !== 'READY'
      ) && (
        <InlineFeedback severity="warning" sx={{ mt: 1 }}>
          {t('workplace.visits.preview.providerBlocked', {
            owner:
              preview.visitorProvider.manualOwner ??
              preview.accessProvider.manualOwner ??
              t('workplace.visits.preview.ownerUnavailable'),
          })}
        </InlineFeedback>
      )}
    </Box>
  );
}

export function WorkplaceReservationVisits({
  reservation,
  sourceReady,
  focus,
}: {
  reservation: WorkplaceUnifiedReservation;
  sourceReady: boolean;
  focus: 'visitors' | 'access';
}) {
  const { t, i18n } = useTranslation('rooms');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const capabilities = useRoomsCapabilities();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [siteId, setSiteId] = useState('');
  const [zoneIds, setZoneIds] = useState('');
  const [visitType, setVisitType] = useState('BUSINESS');
  const [opaqueRef, setOpaqueRef] = useState('');
  const [maskedLabel, setMaskedLabel] = useState('');
  const [purpose, setPurpose] = useState('Business visit');
  const [reason, setReason] = useState('Prepare visitor access for this reservation');
  const [confirmed, setConfirmed] = useState(false);
  const [preview, setPreview] = useState<WorkplaceVisitPreview | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [commandReason, setCommandReason] = useState('Continue the approved visit lifecycle');
  const [commandConfirmed, setCommandConfirmed] = useState(false);
  const createIntent = useRef<IdempotentMutationIntent | null>(null);
  const previewIntent = useRef<IdempotentMutationIntent | null>(null);
  const commandIntent = useRef<IdempotentMutationIntent | null>(null);
  const retention = useRef(retentionDate());

  const canWrite =
    sourceReady &&
    capabilities.isLoaded &&
    (capabilities.canCreateWorkplaceBooking || capabilities.canManageWorkplace);
  const visitsQuery = useQuery({
    queryKey: ['workplace', 'visits', reservation.authority, reservation.authorityId],
    queryFn: () => getWorkplaceVisits(reservation.authority, reservation.authorityId),
    enabled: capabilities.isLoaded && capabilities.canViewWorkplace,
    retry: false,
  });
  const visits = useMemo(() => visitsQuery.data?.items ?? [], [visitsQuery.data?.items]);

  useEffect(() => {
    if (selectedId && visits.some((visit) => visit.visitId === selectedId)) return;
    setSelectedId(visits[0]?.visitId ?? null);
  }, [selectedId, visits]);

  const detailQuery = useQuery({
    queryKey: ['workplace', 'visits', 'detail', selectedId],
    queryFn: () => getWorkplaceVisit(selectedId!),
    enabled: Boolean(selectedId),
    initialData: visits.find((visit) => visit.visitId === selectedId),
    retry: false,
  });
  const selected = detailQuery.data ?? null;
  const parsedZoneIds = useMemo(
    () =>
      zoneIds
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    [zoneIds]
  );
  const guest = useMemo<WorkplaceVisitGuestRefInput>(
    () => ({
      opaqueRef: opaqueRef.trim(),
      maskedLabel: maskedLabel.trim(),
      purpose: purpose.trim(),
      fieldRetentionExpiresAt: { maskedLabel: retention.current, purpose: retention.current },
    }),
    [maskedLabel, opaqueRef, purpose]
  );
  const formValid =
    UUID.test(siteId.trim()) &&
    parsedZoneIds.length > 0 &&
    parsedZoneIds.every((value) => UUID.test(value)) &&
    opaqueRef.trim().length >= 8 &&
    Boolean(maskedLabel.trim() && purpose.trim() && reason.trim() && confirmed);

  const previewMutation = useMutation({
    mutationFn: () => {
      if (!canWrite || !formValid) throw new Error('VISIT_PREVIEW_BLOCKED');
      const input = {
        reservation: {
          authority: reservation.authority,
          id: reservation.authorityId,
          version: reservation.version,
        },
        visitType: visitType.trim(),
        siteId: siteId.trim(),
        startsAt: reservation.startsAt,
        endsAt: reservation.endsAt,
        zoneIds: parsedZoneIds,
        guests: [guest],
        reason: reason.trim(),
        explicitConfirmation: confirmed,
      };
      const intent = resolveIdempotentMutationIntent(previewIntent.current, input, () =>
        createWorkplaceIdempotencyKey('visit-preview')
      );
      previewIntent.current = intent;
      return previewWorkplaceVisit(input, { idempotencyKey: intent.key });
    },
    retry: false,
    onSuccess: (result) => {
      previewIntent.current = null;
      setPreview(result);
    },
  });

  const createMutation = useMutation({
    mutationFn: () => {
      if (
        !preview ||
        !preview.eligible ||
        preview.visitorProvider.state !== 'READY' ||
        preview.accessProvider.state !== 'READY' ||
        !canWrite
      ) {
        throw new Error('VISIT_CREATE_BLOCKED');
      }
      const input = {
        previewId: preview.previewId,
        expectedPreviewVersion: preview.version,
        guests: [guest],
        reason: reason.trim(),
        explicitConfirmation: true as const,
      };
      const intent = resolveIdempotentMutationIntent(createIntent.current, input, () =>
        createWorkplaceIdempotencyKey('visit-create')
      );
      createIntent.current = intent;
      return createWorkplaceVisit(input, { idempotencyKey: intent.key });
    },
    retry: false,
    onSuccess: async (result) => {
      createIntent.current = null;
      setSelectedId(result.visit.visitId);
      setPreview(null);
      setShowCreate(false);
      setConfirmed(false);
      await queryClient.invalidateQueries({ queryKey: ['workplace', 'visits'] });
    },
    onError: () => void queryClient.invalidateQueries({ queryKey: ['workplace', 'visits'] }),
  });

  const commandMutation = useMutation({
    mutationFn: (action: VisitCommand) => {
      if (
        !selected ||
        !canWrite ||
        isGetOnlyVisitRecovery(selected.state, selected.recoveryByGetOnly)
      ) {
        throw new Error('VISIT_COMMAND_BLOCKED');
      }
      const input = {
        expectedVersion: selected.version,
        reason: commandReason.trim(),
        explicitConfirmation: true as const,
      };
      if (!commandConfirmed || !input.reason)
        throw new Error('VISIT_COMMAND_CONFIRMATION_REQUIRED');
      const intent = resolveIdempotentMutationIntent(
        commandIntent.current,
        { action, visitId: selected.visitId, ...input },
        () => createWorkplaceIdempotencyKey(`visit-${action.toLowerCase()}`)
      );
      commandIntent.current = intent;
      const options = { idempotencyKey: intent.key };
      if (action === 'SEND_INVITATION') {
        return sendWorkplaceVisitInvitation(selected.visitId, input, options);
      }
      if (action === 'REQUEST_ACCESS') {
        return requestWorkplaceVisitAccess(selected.visitId, input, options);
      }
      return cancelWorkplaceVisit(selected.visitId, input, options);
    },
    retry: false,
    onSuccess: async () => {
      commandIntent.current = null;
      setCommandConfirmed(false);
      await queryClient.invalidateQueries({ queryKey: ['workplace', 'visits'] });
    },
    onError: () => void queryClient.invalidateQueries({ queryKey: ['workplace', 'visits'] }),
  });
  const actions = selected
    ? requesterVisitActions(selected.state, selected.recoveryByGetOnly).filter(isVisitCommand)
    : [];

  return (
    <Stack spacing={2} data-testid={`workplace-reservation-${focus}`}>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} justifyContent="space-between">
        <Box>
          <Typography component="h2" variant="subtitle1" fontWeight="fontWeightBold">
            {t('workplace.visits.user.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t(`workplace.visits.user.${focus}Description`)}
          </Typography>
        </Box>
        <ActionButton
          intent="primary"
          startIcon={<UserRoundPlus size={16} />}
          disabled={!canWrite}
          onClick={() => setShowCreate((value) => !value)}
        >
          {t('workplace.visits.actions.prepare')}
        </ActionButton>
      </Stack>

      {!canWrite && (
        <InlineFeedback severity="warning">
          {sourceReady ? t('workplace.visits.readOnly') : t('workplace.visits.sourceNotReady')}
        </InlineFeedback>
      )}
      {visitsQuery.isError && (
        <InlineFeedback severity="error">
          {t('workplace.visits.loadError')}
          <ActionButton intent="quiet" size="small" onClick={() => void visitsQuery.refetch()}>
            {t('actions.retry')}
          </ActionButton>
        </InlineFeedback>
      )}

      {showCreate && (
        <Box sx={(theme) => ({ ...workplaceMemberCard(theme), p: { xs: 1.5, md: 2 } })}>
          <Stack spacing={1.5}>
            <Typography component="h3" variant="subtitle1" fontWeight="fontWeightBold">
              {preview
                ? t('workplace.visits.create.reviewTitle')
                : t('workplace.visits.create.inputTitle')}
            </Typography>
            {!preview ? (
              <>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                    gap: 1.25,
                  }}
                >
                  <FormField
                    label={t('workplace.visits.fields.visitType')}
                    value={visitType}
                    onChange={(event) => setVisitType(event.target.value)}
                  />
                  <FormField
                    label={t('workplace.visits.fields.siteId')}
                    value={siteId}
                    onChange={(event) => setSiteId(event.target.value)}
                  />
                  <FormField
                    label={t('workplace.visits.fields.zoneIds')}
                    supportingText={t('workplace.visits.fields.zoneIdsHint')}
                    value={zoneIds}
                    onChange={(event) => setZoneIds(event.target.value)}
                  />
                  <FormField
                    label={t('workplace.visits.fields.opaqueRef')}
                    supportingText={t('workplace.visits.fields.opaqueRefHint')}
                    value={opaqueRef}
                    onChange={(event) => setOpaqueRef(event.target.value)}
                  />
                  <FormField
                    label={t('workplace.visits.fields.maskedLabel')}
                    value={maskedLabel}
                    onChange={(event) => setMaskedLabel(event.target.value)}
                  />
                  <FormField
                    label={t('workplace.visits.fields.purpose')}
                    value={purpose}
                    onChange={(event) => setPurpose(event.target.value)}
                  />
                </Box>
                <FormField
                  label={t('workplace.visits.fields.reason')}
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
                  label={t('workplace.visits.create.confirmation')}
                />
                {previewMutation.isError && (
                  <InlineFeedback severity="error">
                    {t('workplace.visits.preview.error')}
                  </InlineFeedback>
                )}
                <ActionButton
                  intent="primary"
                  disabled={!formValid}
                  loading={previewMutation.isPending}
                  onClick={() => previewMutation.mutate()}
                >
                  {t('workplace.visits.actions.preview')}
                </ActionButton>
              </>
            ) : (
              <>
                <PreviewEvidence preview={preview} />
                <Stack direction="row" gap={1} flexWrap="wrap">
                  <ActionButton intent="quiet" onClick={() => setPreview(null)}>
                    {t('workplace.visits.actions.edit')}
                  </ActionButton>
                  <ActionButton
                    intent="primary"
                    startIcon={<ArrowRight size={16} />}
                    disabled={
                      !preview.eligible ||
                      preview.visitorProvider.state !== 'READY' ||
                      preview.accessProvider.state !== 'READY'
                    }
                    loading={createMutation.isPending}
                    onClick={() => createMutation.mutate()}
                  >
                    {t('workplace.visits.actions.create')}
                  </ActionButton>
                </Stack>
                {createMutation.isError && (
                  <InlineFeedback severity="error">
                    {t('workplace.visits.create.error')}
                  </InlineFeedback>
                )}
              </>
            )}
          </Stack>
        </Box>
      )}

      {!visitsQuery.isLoading && !visitsQuery.isError && visits.length === 0 ? (
        <EmptyState
          title={t('workplace.visits.empty.title')}
          description={t('workplace.visits.empty.description')}
        />
      ) : visits.length > 0 ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'minmax(180px, .8fr) minmax(0, 1.7fr)' },
            gap: 1.5,
          }}
        >
          <Stack component="ul" spacing={1} sx={{ p: 0, m: 0, listStyle: 'none' }}>
            {visits.map((visit) => (
              <Box component="li" key={visit.visitId}>
                <ActionButton
                  fullWidth
                  intent={visit.visitId === selectedId ? 'primary' : 'secondary'}
                  onClick={() => setSelectedId(visit.visitId)}
                  sx={{ justifyContent: 'flex-start', minHeight: 44 }}
                >
                  {visit.guests[0]?.maskedLabel ?? t('workplace.visits.maskedGuest')}
                </ActionButton>
              </Box>
            ))}
          </Stack>
          {selected && (
            <Box sx={(theme) => ({ ...workplaceMemberCard(theme), p: { xs: 1.5, md: 2 } })}>
              <VisitStatus visit={selected} />
              {isGetOnlyVisitRecovery(selected.state, selected.recoveryByGetOnly) && (
                <InlineFeedback
                  severity="warning"
                  icon={<AlertTriangle size={18} />}
                  sx={{ mt: 2 }}
                >
                  {t('workplace.visits.recovery.getOnly')}
                  <ActionButton
                    intent="quiet"
                    size="small"
                    startIcon={<RefreshCw size={15} />}
                    loading={detailQuery.isFetching}
                    onClick={() => void detailQuery.refetch()}
                  >
                    {t('workplace.visits.actions.refreshStatus')}
                  </ActionButton>
                </InlineFeedback>
              )}
              {actions.length > 0 && (
                <Stack spacing={1.25} sx={{ mt: 2 }}>
                  <FormField
                    label={t('workplace.visits.fields.reason')}
                    value={commandReason}
                    onChange={(event) => setCommandReason(event.target.value)}
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={commandConfirmed}
                        onChange={(event) => setCommandConfirmed(event.target.checked)}
                      />
                    }
                    label={t('workplace.visits.commandConfirmation')}
                  />
                  <Stack direction="row" gap={1} flexWrap="wrap">
                    {actions.map((action) => (
                      <ActionButton
                        key={action}
                        intent={action === 'CANCEL' ? 'secondary' : 'primary'}
                        startIcon={
                          action === 'REQUEST_ACCESS' ? <ShieldCheck size={16} /> : undefined
                        }
                        disabled={!canWrite || !commandReason.trim() || !commandConfirmed}
                        loading={commandMutation.isPending}
                        onClick={() => commandMutation.mutate(action)}
                      >
                        {t(`workplace.visits.actions.${action}`)}
                      </ActionButton>
                    ))}
                  </Stack>
                </Stack>
              )}
              {commandMutation.isError && (
                <InlineFeedback severity="error" sx={{ mt: 1 }}>
                  {t('workplace.visits.commandError')}
                </InlineFeedback>
              )}
              <Box sx={{ mt: 2 }}>
                <Typography component="h4" variant="subtitle2" fontWeight="fontWeightBold">
                  {t('workplace.visits.timeline')}
                </Typography>
                <Stack component="ol" spacing={1} sx={{ pl: 2.5, mb: 0 }}>
                  {selected.timeline.map((event) => (
                    <Box component="li" key={event.eventId}>
                      <Typography variant="body2">
                        {t(`workplace.visits.states.${event.state}`)} · {event.eventType}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(
                          event.occurredAt,
                          { dateStyle: 'short', timeStyle: 'short' },
                          locale
                        )}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            </Box>
          )}
        </Box>
      ) : null}
    </Stack>
  );
}
