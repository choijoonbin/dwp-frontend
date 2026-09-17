import { useWorkplaceMemberScopeRevision } from './workplace-member-scope-revision';
import { foundationTokens } from '@dwp-frontend/design-system';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Armchair, CheckCircle2, Clock3, Eye, MapPin, ShieldCheck } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createWorkplaceBooking,
  createWorkplaceIdempotencyKey,
  HttpError,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  DateTimePickerField,
  DwpDateTimeProvider,
  FormDialog,
  FormField,
} from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import { InlineFeedback } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

import { validateWorkplaceBookingRange } from './workplace-time-policy';
import { useRoomsCapabilities } from './rooms-capabilities';
import { RoomsPermissionNotice } from './rooms-ui';
import {
  workplaceBookingSourceVerified,
  type WorkplaceBookingSourceSnapshot,
} from './workplace-booking-source-snapshot';

import type {
  WorkplaceBooking,
  WorkplaceBookingInput,
  WorkplacePolicy,
  WorkplaceResource,
} from '@dwp-frontend/shared-utils';

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
type BookingSubmission = { scopeKey: string; key: string; input: WorkplaceBookingInput };

export function WorkplaceBookingDialog({
  open,
  resource,
  siteName,
  floorName,
  siteTimeZone,
  serverNow,
  policy,
  initialStart,
  initialEnd,
  sourceSnapshot,
  onClose,
  onSaved,
  onChooseAnother,
}: {
  open: boolean;
  resource: WorkplaceResource | null;
  siteName: string;
  floorName: string;
  siteTimeZone: string;
  serverNow: string;
  policy: WorkplacePolicy | null;
  initialStart: string;
  initialEnd: string;
  sourceSnapshot?: WorkplaceBookingSourceSnapshot | null;
  onClose: () => void;
  onSaved?: (booking: WorkplaceBooking) => void;
  onChooseAnother?: () => void;
}) {
  const { t, i18n } = useTranslation('rooms');
  const toast = useToast();
  const queryClient = useQueryClient();
  const auth = useAuth();
  const { canCreateWorkplaceBooking } = useRoomsCapabilities();
  const identityKey = `${auth.user?.tenantId ?? 'anonymous'}:${auth.user?.userId ?? 'anonymous'}`;
  const scopeKey = useWorkplaceMemberScopeRevision(
    `${identityKey}:${resource?.resourceId ?? 'none'}:${initialStart}:${initialEnd}:${open}:${canCreateWorkplaceBooking}`
  );
  const activeScopeRef = useRef(scopeKey);
  activeScopeRef.current = scopeKey;
  const componentActiveRef = useRef(true);
  useEffect(() => {
    componentActiveRef.current = true;
    return () => {
      componentActiveRef.current = false;
    };
  }, []);
  const [startsAt, setStartsAt] = useState(initialStart);
  const [endsAt, setEndsAt] = useState(initialEnd);
  const [purpose, setPurpose] = useState('');
  const [visible, setVisible] = useState(true);
  const draftRef = useRef<{ context: string; purpose: string; visible: boolean } | null>(null);
  const draftContext = `${identityKey}:${initialStart}:${initialEnd}`;
  const commandRef = useRef<{
    fingerprint: string;
    key: string;
    input: WorkplaceBookingInput;
    context: string;
    unknown: boolean;
  } | null>(null);
  const commandContext = `${identityKey}:${resource?.resourceId}:${initialStart}:${initialEnd}`;
  const [unknownContext, setUnknownContext] = useState<string | null>(null);
  const unknownOutcome = unknownContext === commandContext;
  const inFlightRef = useRef<BookingSubmission | null>(null);
  const sourceSnapshotRef = useRef(sourceSnapshot);
  sourceSnapshotRef.current = sourceSnapshot;

  useEffect(() => {
    if (!open) return;
    const uncertain = commandRef.current;
    if (uncertain?.unknown && uncertain.context === commandContext) {
      setStartsAt(uncertain.input.startsAt);
      setEndsAt(uncertain.input.endsAt);
      setPurpose(uncertain.input.purpose);
      setVisible(uncertain.input.visibleToColleagues);
      return;
    }
    setStartsAt(initialStart);
    setEndsAt(initialEnd);
    const preserved = draftRef.current?.context === draftContext ? draftRef.current : null;
    setPurpose(preserved?.purpose ?? '');
    setVisible(preserved?.visible ?? true);
    commandRef.current = null;
    setUnknownContext(null);
  }, [
    commandContext,
    draftContext,
    identityKey,
    initialEnd,
    initialStart,
    open,
    resource?.resourceId,
  ]);

  const rangeError =
    !startsAt || !endsAt || !policy
      ? 'invalid'
      : validateWorkplaceBookingRange(startsAt, endsAt, siteTimeZone, policy, serverNow);
  const sourceRangeChanged = Boolean(
    sourceSnapshot && (sourceSnapshot.rangeFrom !== startsAt || sourceSnapshot.rangeTo !== endsAt)
  );
  const sourceVerified = workplaceBookingSourceVerified(sourceSnapshot, {
    resourceId: resource?.resourceId,
    resourceVersion: resource?.version,
    rangeFrom: startsAt,
    rangeTo: endsAt,
    policyVersion: policy?.version,
  });
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const mutation = useMutation({
    mutationFn: (submission: BookingSubmission) => {
      if (!componentActiveRef.current || submission.scopeKey !== activeScopeRef.current)
        throw new Error(t('permissions.workplaceBookingReadOnly'));
      if (!resource) throw new Error(t('workplace.booking.resourceRequired'));
      if (
        !workplaceBookingSourceVerified(sourceSnapshotRef.current, {
          resourceId: resource.resourceId,
          resourceVersion: resource.version,
          rangeFrom: submission.input.startsAt,
          rangeTo: submission.input.endsAt,
          policyVersion: policy?.version,
        })
      ) {
        throw new Error(t('workplace.explore.availabilityStale'));
      }
      if (!canCreateWorkplaceBooking) {
        throw new Error(t('permissions.workplaceBookingReadOnly'));
      }
      if (submission.input.resourceId !== resource.resourceId)
        throw new Error(t('workplace.booking.resourceRequired'));
      return createWorkplaceBooking(submission.input, submission.key);
    },
    onSuccess: async (booking, submission) => {
      if (!componentActiveRef.current || submission.scopeKey !== activeScopeRef.current) return;
      commandRef.current = null;
      draftRef.current = null;
      setUnknownContext(null);
      toast.success(t('workplace.booking.created'));
      onClose();
      onSaved?.(booking);
      await queryClient.invalidateQueries({ queryKey: ['workplace'] });
    },
    onError: (error, submission) => {
      if (!componentActiveRef.current || submission.scopeKey !== activeScopeRef.current) return;
      if (error instanceof HttpError && [401, 403].includes(error.status)) {
        commandRef.current = null;
        draftRef.current = null;
        setUnknownContext(null);
        onClose();
        void queryClient.invalidateQueries({ queryKey: ['workplace'] });
      } else if (!(error instanceof HttpError) || error.status >= 500) {
        if (commandRef.current?.key === submission.key) commandRef.current.unknown = true;
        setUnknownContext(commandContext);
      }
    },
    onSettled: (_, __, submission) => {
      if (inFlightRef.current === submission) inFlightRef.current = null;
    },
  });
  const submit = () => {
    if (
      inFlightRef.current ||
      !resource ||
      rangeError ||
      !canCreateWorkplaceBooking ||
      !sourceVerified
    )
      return;
    const input = {
      resourceId: resource.resourceId,
      startsAt,
      endsAt,
      purpose: purpose.trim(),
      visibleToColleagues: visible,
    };
    const fingerprint = JSON.stringify(input);
    if (unknownOutcome && commandRef.current?.fingerprint !== fingerprint) return;
    const command =
      commandRef.current?.fingerprint === fingerprint
        ? commandRef.current
        : {
            fingerprint,
            key: createWorkplaceIdempotencyKey('booking'),
            input,
            context: commandContext,
            unknown: false,
          };
    commandRef.current = command;
    const submission = { scopeKey, key: command.key, input: command.input };
    inFlightRef.current = submission;
    mutation.mutate(submission);
  };

  const closeDialog = () => {
    draftRef.current = null;
    mutation.reset();
    onClose();
  };

  return (
    <FormDialog
      open={open}
      title={t('workplace.booking.title')}
      description={t('workplace.booking.description')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t(unknownOutcome ? 'workplace.experience.sameRequestRetry' : 'actions.book')}
      submittingLabel={t('actions.saving')}
      busy={mutation.isPending}
      submitDisabled={
        !resource || Boolean(rangeError) || !canCreateWorkplaceBooking || !sourceVerified
      }
      onClose={closeDialog}
      onSubmit={submit}
      maxWidth="sm"
      mobileFullScreen
    >
      <Stack spacing={2.25}>
        {resource && sourceVerified ? (
          <Stack
            data-testid="workplace-booking-verified-source"
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            gap={1.5}
            sx={{
              px: 1.5,
              py: 1,
              borderRadius: foundationTokens.radius.surface + 'px',
              bgcolor: 'var(--dwp-product-soft)',
              color: 'primary.main',
            }}
          >
            <Stack direction="row" gap={0.75} alignItems="center" minWidth={0}>
              <CheckCircle2 size={17} aria-hidden="true" />
              <Typography variant="body2" fontWeight="fontWeightBold">
                {t('workplace.explore.bookingEligibility.eligible')}
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              {t('workplace.experience.version')} {resource.version} · {siteTimeZone}
            </Typography>
          </Stack>
        ) : null}
        {mutation.variables?.scopeKey === scopeKey &&
        mutation.error instanceof HttpError &&
        mutation.error.status === 409 &&
        onChooseAnother ? (
          <InlineFeedback
            severity="warning"
            action={
              <ActionButton
                intent="secondary"
                onClick={() => {
                  draftRef.current = { context: draftContext, purpose, visible };
                  mutation.reset();
                  onClose();
                  onChooseAnother();
                }}
              >
                {t('workplace.member.bookings.chooseAnother')}
              </ActionButton>
            }
          >
            {t('workplace.experience.conflict')}
          </InlineFeedback>
        ) : null}
        {unknownOutcome ? (
          <InlineFeedback severity="warning">
            {t('workplace.member.bookings.changeUnknown')}
          </InlineFeedback>
        ) : null}
        {mutation.isError && (
          <InlineFeedback severity="error">
            {errorMessage(mutation.error, t('workplace.booking.saveError'))}
          </InlineFeedback>
        )}
        {!canCreateWorkplaceBooking && (
          <RoomsPermissionNotice>{t('permissions.workplaceBookingReadOnly')}</RoomsPermissionNotice>
        )}
        {!sourceVerified && (
          <InlineFeedback severity="warning">
            {t(
              sourceRangeChanged
                ? 'workplace.explore.rangeChanged'
                : 'workplace.explore.availabilityStale'
            )}
          </InlineFeedback>
        )}
        {resource && (
          <Box
            sx={{
              p: { xs: 1.5, sm: 2 },
              borderRadius: foundationTokens.radius.surface + 'px',
              border: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
          >
            <Stack direction="row" justifyContent="space-between" gap={1.5} alignItems="flex-start">
              <Box
                aria-hidden="true"
                sx={{
                  width: 44,
                  height: 44,
                  flex: '0 0 44px',
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: foundationTokens.radius.control + 'px',
                  bgcolor: 'var(--dwp-product-soft)',
                  color: 'primary.main',
                }}
              >
                <Armchair size={22} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary">
                  {resource.code}
                </Typography>
                <Typography component="h3" variant="h6" fontWeight="fontWeightBold">
                  {resource.name}
                </Typography>
                <Stack direction="row" gap={0.6} alignItems="flex-start" sx={{ mt: 0.35 }}>
                  <MapPin size={14} />
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ overflowWrap: 'anywhere' }}
                  >
                    {siteName} · {floorName} · {resource.neighborhood}
                  </Typography>
                </Stack>
              </Box>
              <Chip size="small" label={t(`workplace.resourceTypes.${resource.type}`)} />
            </Stack>
            <Box
              component="dl"
              sx={{
                m: 0,
                mt: 1.5,
                pt: 1.5,
                borderTop: 1,
                borderColor: 'divider',
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 1.25,
              }}
            >
              {[
                [
                  t('workplace.booking.start'),
                  formatDate(
                    startsAt,
                    { dateStyle: 'medium', timeStyle: 'short', timeZone: siteTimeZone },
                    locale
                  ),
                ],
                [
                  t('workplace.booking.end'),
                  formatDate(
                    endsAt,
                    { dateStyle: 'medium', timeStyle: 'short', timeZone: siteTimeZone },
                    locale
                  ),
                ],
              ].map(([label, value]) => (
                <Box key={label}>
                  <Typography component="dt" variant="caption" color="text.secondary">
                    {label}
                  </Typography>
                  <Typography
                    component="dd"
                    variant="body2"
                    fontWeight="fontWeightBold"
                    sx={{ m: 0, mt: 0.25, overflowWrap: 'anywhere' }}
                  >
                    {value}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        <DwpDateTimeProvider locale={i18n.resolvedLanguage} timeZone={siteTimeZone}>
          <Box
            sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}
          >
            <DateTimePickerField
              required
              disabled={mutation.isPending || unknownOutcome}
              label={t('workplace.booking.start')}
              value={startsAt}
              onValueChange={(value) => value && setStartsAt(value)}
              supportingText={siteTimeZone}
            />
            <DateTimePickerField
              required
              disabled={mutation.isPending || unknownOutcome}
              label={t('workplace.booking.end')}
              value={endsAt}
              onValueChange={(value) => value && setEndsAt(value)}
              errorMessage={
                rangeError ? t(`workplace.booking.rangeErrors.${rangeError}`) : undefined
              }
            />
          </Box>
        </DwpDateTimeProvider>
        <InlineFeedback severity="info" icon={<ShieldCheck size={18} />}>
          <Stack gap={0.35}>
            <Typography variant="body2">
              {policy
                ? t('workplace.booking.policySummary', {
                    minimum: policy.minimumBookingMinutes,
                    maximum: policy.maximumBookingMinutes,
                    start: policy.workingDayStart.slice(0, 5),
                    end: policy.workingDayEnd.slice(0, 5),
                    days: policy.bookingWindowDays,
                  })
                : t('workplace.booking.policyNotice')}
            </Typography>
            {policy?.requireCheckIn && (
              <Stack direction="row" gap={0.6} alignItems="center">
                <Clock3 size={14} />
                <Typography variant="caption">
                  {t('workplace.booking.autoReleaseSummary', {
                    lead: policy.checkInLeadMinutes,
                    release: policy.autoReleaseMinutes,
                  })}
                </Typography>
              </Stack>
            )}
          </Stack>
        </InlineFeedback>

        <FormField
          disabled={mutation.isPending || unknownOutcome}
          label={t('workplace.booking.purpose')}
          value={purpose}
          onChange={(event) => setPurpose(event.target.value)}
          inputProps={{ maxLength: 500 }}
        />
        <FormControlLabel
          control={
            <Switch
              disabled={mutation.isPending || unknownOutcome}
              checked={visible}
              onChange={(_, checked) => setVisible(checked)}
            />
          }
          label={
            <Stack direction="row" gap={0.8} alignItems="center">
              <Eye size={16} />
              <Typography variant="body2">{t('workplace.booking.visible')}</Typography>
            </Stack>
          }
        />
        <InlineFeedback severity="info" icon={<ShieldCheck size={18} />}>
          {t('workplace.explore.policyApplied')}
        </InlineFeedback>
      </Stack>
    </FormDialog>
  );
}
