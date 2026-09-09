import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  CalendarClock,
  CameraOff,
  CheckCircle2,
  Clock3,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  ShieldX,
  UserRound,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ActionButton, PageCanvas } from '@dwp-frontend/design-system';
import { useAuth } from '@dwp-frontend/shared-utils';
import {
  getVideoMeetingJoinRequest,
  normalizeVideoMeetingCode,
  requestVideoMeetingJoin,
  resolveVideoMeetingCode,
  type VideoMeetingCodeResolution,
  type VideoMeetingJoinRequest,
} from '@dwp-frontend/shared-utils/api/video-meeting-api';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { MeetingCodeField } from './meeting-code-field';
import { formatMeetingDateTime, MeetingPageHeading, MeetingStatusChip } from './meeting-components';
import {
  createMeetingJoinAttemptFence,
  type MeetingJoinRequestIntent,
  type MeetingJoinResolutionIntent,
} from './meeting-join-attempt-fence';
import {
  hasValidJoinCodeLength,
  isJoinCodeLocked,
  maskJoinCode,
  meetingJoinStep,
  safeJoinDenialReason,
  visibleJoinCodeSuffix,
} from './meeting-join-model';
import { meetingInsetSurface, meetingShape, meetingSurface } from './meeting-visual-system';

export function MeetingJoin() {
  const { t } = useTranslation('meetings');
  const auth = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [code, setCode] = useState(() => normalizeVideoMeetingCode(searchParams.get('code') ?? ''));
  const [resolution, setResolution] = useState<VideoMeetingCodeResolution | null>(null);
  const [joinRequest, setJoinRequest] = useState<VideoMeetingJoinRequest | null>(null);
  const [resolveError, setResolveError] = useState(false);
  const [requestError, setRequestError] = useState(false);
  const [pendingResolutionGeneration, setPendingResolutionGeneration] = useState<number | null>(
    null
  );
  const [pendingRequestGeneration, setPendingRequestGeneration] = useState<number | null>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const summaryHeadingRef = useRef<HTMLHeadingElement>(null);
  const requestErrorRef = useRef<HTMLDivElement>(null);
  const attemptFenceRef = useRef<ReturnType<typeof createMeetingJoinAttemptFence> | null>(null);
  if (!attemptFenceRef.current) {
    attemptFenceRef.current = createMeetingJoinAttemptFence(code);
  }
  const attemptFence = attemptFenceRef.current;

  useEffect(
    () => () => {
      // Mutation callbacks outlive their observer; leaving J01 ends its navigation authority.
      attemptFence.replaceCode('');
    },
    [attemptFence]
  );

  useEffect(() => {
    if (!searchParams.has('code')) return;
    const scrubbed = new URLSearchParams(searchParams);
    scrubbed.delete('code');
    setSearchParams(scrubbed, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!resolution) return;
    const frame = requestAnimationFrame(() => summaryHeadingRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [resolution]);

  useEffect(() => {
    if (resolveError) codeInputRef.current?.focus();
  }, [resolveError]);

  useEffect(() => {
    if (requestError) requestErrorRef.current?.focus();
  }, [requestError]);

  const resolveMutation = useMutation({
    mutationFn: (intent: MeetingJoinResolutionIntent) => resolveVideoMeetingCode(intent.code),
    onSuccess: (result, intent) => {
      if (!attemptFence.acceptResolution(intent, result.meeting.meetingId)) return;
      setPendingResolutionGeneration(null);
      setResolution(result);
      setJoinRequest(null);
      setResolveError(false);
      setRequestError(false);
    },
    onError: (_error, intent) => {
      if (!attemptFence.canCommitResolution(intent)) return;
      setPendingResolutionGeneration(null);
      setResolveError(true);
    },
  });
  const requestMutation = useMutation({
    mutationFn: (intent: MeetingJoinRequestIntent) =>
      requestVideoMeetingJoin(intent.meetingId, {
        displayName: intent.displayName,
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: (result, intent) => {
      if (!attemptFence.canCommitRequest(intent) || result.meetingId !== intent.meetingId) return;
      // A renewed request can reuse the participant ID; its POST receipt supersedes old polls.
      queryClient.setQueryData(
        ['meetings', 'join-request', result.meetingId, result.requestId],
        result
      );
      setPendingRequestGeneration(null);
      setRequestError(false);
      setJoinRequest(result);
      if (!intent.requiresApproval && result.state === 'APPROVED') {
        const query = new URLSearchParams({ joinRequest: result.requestId });
        navigate(`/meetings/room/${encodeURIComponent(result.meetingId)}?${query.toString()}`);
      }
    },
    onError: (_error, intent) => {
      if (!attemptFence.canCommitRequest(intent)) return;
      setPendingRequestGeneration(null);
      setRequestError(true);
    },
  });
  const requestQuery = useQuery({
    queryKey: ['meetings', 'join-request', resolution?.meeting.meetingId, joinRequest?.requestId],
    queryFn: () =>
      getVideoMeetingJoinRequest(resolution?.meeting.meetingId ?? '', joinRequest?.requestId ?? ''),
    enabled: Boolean(
      resolution?.meeting.meetingId && joinRequest?.requestId && joinRequest.state === 'WAITING'
    ),
    refetchInterval: 2_500,
    retry: 1,
  });

  useEffect(() => {
    if (requestQuery.data && attemptFence.ownsMeeting(requestQuery.data.meetingId)) {
      setJoinRequest(requestQuery.data);
    }
  }, [attemptFence, requestQuery.data]);

  const displayName = auth.user?.displayName.trim() ?? '';
  const currentStep = meetingJoinStep(Boolean(resolution), joinRequest?.state);
  const codeLocked = isJoinCodeLocked(joinRequest?.state);
  const steps = [
    { label: t('join.steps.code'), icon: KeyRound },
    { label: t('join.steps.admission'), icon: Clock3 },
    { label: t('join.steps.devices'), icon: CheckCircle2 },
  ] as const;

  const resolveCode = () => {
    if (!hasValidJoinCodeLength(code) || codeLocked) return;
    const normalizedCode = normalizeVideoMeetingCode(code);
    const intent = attemptFence.beginResolution(normalizedCode);
    setPendingResolutionGeneration(intent.generation);
    setResolution(null);
    setJoinRequest(null);
    setResolveError(false);
    setRequestError(false);
    setPendingRequestGeneration(null);
    resolveMutation.mutate(intent);
  };

  const requestAdmission = () => {
    if (!resolution || !displayName) return;
    const intent = attemptFence.beginRequest({
      meetingId: resolution.meeting.meetingId,
      displayName,
      requiresApproval: resolution.requiresApproval,
    });
    if (!intent) return;
    setPendingRequestGeneration(intent.generation);
    setRequestError(false);
    requestMutation.mutate(intent);
  };

  const enterDeviceCheck = () => {
    if (!resolution || !joinRequest) return;
    const query = new URLSearchParams({ joinRequest: joinRequest.requestId });
    navigate(
      `/meetings/room/${encodeURIComponent(resolution.meeting.meetingId)}?${query.toString()}`
    );
  };

  const restartWithAnotherCode = () => {
    attemptFence.replaceCode('');
    setCode('');
    setResolution(null);
    setJoinRequest(null);
    setResolveError(false);
    setRequestError(false);
    setPendingResolutionGeneration(null);
    setPendingRequestGeneration(null);
    requestAnimationFrame(() => codeInputRef.current?.focus());
  };

  const action = !resolution ? (
    <ActionButton
      type="submit"
      intent="primary"
      fullWidth
      disabled={!hasValidJoinCodeLength(code) || codeLocked}
      loading={pendingResolutionGeneration !== null}
      loadingLabel={t('join.resolving')}
      startIcon={<KeyRound size={17} aria-hidden="true" />}
      sx={{ minHeight: 48 }}
    >
      {t('join.resolve')}
    </ActionButton>
  ) : !resolution.joinAllowed ? (
    <ActionButton
      type="button"
      intent="secondary"
      fullWidth
      onClick={restartWithAnotherCode}
      sx={{ minHeight: 48 }}
    >
      {t('join.useAnotherCode')}
    </ActionButton>
  ) : !joinRequest ? (
    <ActionButton
      type="button"
      intent="primary"
      fullWidth
      loading={pendingRequestGeneration !== null}
      loadingLabel={t('join.requesting')}
      disabled={!displayName}
      endIcon={<ArrowRight size={17} aria-hidden="true" />}
      onClick={requestAdmission}
      sx={{ minHeight: 48 }}
    >
      {t(resolution.requiresApproval ? 'join.request' : 'join.continueDirect')}
    </ActionButton>
  ) : joinRequest.state === 'APPROVED' ? (
    <ActionButton
      type="button"
      intent="primary"
      fullWidth
      endIcon={<ArrowRight size={17} aria-hidden="true" />}
      onClick={enterDeviceCheck}
      sx={{ minHeight: 48 }}
    >
      {t('join.continue')}
    </ActionButton>
  ) : joinRequest.state === 'DENIED' ? (
    <ActionButton
      type="button"
      intent="secondary"
      fullWidth
      onClick={restartWithAnotherCode}
      sx={{ minHeight: 48 }}
    >
      {t('join.useAnotherCode')}
    </ActionButton>
  ) : (
    <ActionButton type="button" intent="secondary" fullWidth disabled sx={{ minHeight: 48 }}>
      {t('join.waitingAction')}
    </ActionButton>
  );

  return (
    <PageCanvas mode="focus" topInset="compact">
      <MeetingPageHeading
        eyebrow={t('join.eyebrow')}
        title={t('join.title')}
        description={t('join.description')}
        density="compact"
      />

      <Box
        data-testid="meeting-join-workspace"
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            md: 'minmax(0, 700px) minmax(280px, 320px)',
          },
          alignItems: 'start',
          justifyContent: 'center',
          gap: { xs: 2, md: 3 },
          width: '100%',
        }}
      >
        <Stack
          component="section"
          data-testid="meeting-join-primary"
          aria-label={t('join.primaryRegionLabel')}
          gap={2}
          sx={{ minWidth: 0 }}
        >
          <Box
            component="ol"
            data-testid="meeting-join-step-rail"
            aria-label={t('join.steps.label')}
            sx={(theme) => ({
              ...meetingSurface(theme),
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              m: 0,
              p: 1,
              listStyle: 'none',
            })}
          >
            {steps.map((step, index) => {
              const Icon = step.icon;
              const reached = index <= currentStep;
              return (
                <Stack
                  component="li"
                  key={step.label}
                  alignItems="center"
                  gap={0.5}
                  aria-current={index === currentStep ? 'step' : undefined}
                  sx={{
                    position: 'relative',
                    minWidth: 0,
                    color: reached ? 'primary.main' : 'text.secondary',
                    '&:not(:last-of-type)::after': {
                      content: '""',
                      position: 'absolute',
                      zIndex: 0,
                      top: 16,
                      left: 'calc(50% + 22px)',
                      right: 'calc(-50% + 22px)',
                      borderTop: 1,
                      borderColor: index < currentStep ? 'primary.main' : 'divider',
                    },
                  }}
                >
                  <Box
                    sx={(theme) => ({
                      ...meetingInsetSurface(theme, reached ? 'primary' : 'neutral'),
                      zIndex: 1,
                      width: 32,
                      height: 32,
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor: index === currentStep ? 'background.paper' : undefined,
                    })}
                  >
                    <Icon size={16} aria-hidden="true" />
                  </Box>
                  <Typography variant="caption" fontWeight={reached ? 750 : 550} textAlign="center">
                    {step.label}
                  </Typography>
                </Stack>
              );
            })}
          </Box>

          <Box
            component="form"
            aria-labelledby="meeting-join-primary-title"
            sx={(theme) => ({
              ...meetingSurface(theme, { elevated: true }),
              minWidth: 0,
              overflow: 'clip',
            })}
            onSubmit={(event) => {
              event.preventDefault();
              resolveCode();
            }}
          >
            <Stack gap={2.25} sx={{ p: { xs: 2, sm: 3 } }}>
              <Box>
                <Typography id="meeting-join-primary-title" component="h2" variant="h6">
                  {t('join.codeSectionTitle')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {t('join.codeSectionDescription')}
                </Typography>
              </Box>

              <MeetingCodeField
                ref={codeInputRef}
                code={code}
                disabled={codeLocked}
                masked={codeLocked}
                label={t('join.code')}
                accessibleLabel={
                  codeLocked
                    ? t('join.summary.codeEnding', { suffix: visibleJoinCodeSuffix(code) })
                    : code
                      ? t('join.codeAriaLabel', { code: Array.from(code).join(' ') })
                      : t('join.code')
                }
                placeholder={t('join.codePlaceholder')}
                supportingText={t(codeLocked ? 'join.codeLockedHint' : 'join.codeHint')}
                onCodeChange={(nextCode) => {
                  attemptFence.replaceCode(nextCode);
                  setCode(nextCode);
                  setResolution(null);
                  setJoinRequest(null);
                  setResolveError(false);
                  setRequestError(false);
                  setPendingResolutionGeneration(null);
                  setPendingRequestGeneration(null);
                }}
              />

              <Stack
                data-testid="meeting-join-media-safety"
                direction="row"
                alignItems="flex-start"
                gap={1}
                sx={(theme) => ({
                  ...meetingInsetSurface(theme, 'success'),
                  p: 1.5,
                  color: 'text.secondary',
                })}
              >
                <CameraOff size={18} aria-hidden="true" />
                <Typography variant="body2">{t('join.mediaSafety')}</Typography>
              </Stack>

              {resolveError && <Alert severity="error">{t('join.resolveError')}</Alert>}

              {resolution && (
                <MeetingJoinSummary
                  resolution={resolution}
                  code={code}
                  headingRef={summaryHeadingRef}
                />
              )}

              {resolution && !resolution.joinAllowed && (
                <Alert severity="warning">
                  {t('join.denialReasons.' + safeJoinDenialReason(resolution.denialReason))}
                </Alert>
              )}

              {resolution && resolution.joinAllowed && !joinRequest && (
                <AccountConfirmation
                  displayName={displayName}
                  email={auth.user?.email ?? null}
                  requiresApproval={resolution.requiresApproval}
                />
              )}

              {requestError && (
                <Alert ref={requestErrorRef} tabIndex={-1} severity="error">
                  {t('join.requestError')}
                </Alert>
              )}

              {joinRequest && <JoinRequestState request={joinRequest} />}

              {joinRequest?.state === 'WAITING' && requestQuery.isError && (
                <Alert severity="error">
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                    justifyContent="space-between"
                    gap={1}
                  >
                    <Typography variant="body2">{t('join.statusError')}</Typography>
                    <ActionButton
                      intent="quiet"
                      size="small"
                      loading={requestQuery.isFetching}
                      loadingLabel={t('join.checkingStatus')}
                      onClick={() => requestQuery.refetch()}
                      sx={{ minHeight: 44 }}
                    >
                      {t('join.retryStatus')}
                    </ActionButton>
                  </Stack>
                </Alert>
              )}

              <Box
                data-testid="meeting-join-actions"
                sx={{
                  position: { xs: 'sticky', sm: 'static' },
                  zIndex: 2,
                  bottom: { xs: 'max(8px, env(safe-area-inset-bottom))', sm: 'auto' },
                  width: { xs: '100%', sm: 240 },
                  alignSelf: { sm: 'flex-end' },
                  p: { xs: 1, sm: 0 },
                  mx: { xs: -1, sm: 0 },
                  mb: { xs: -1, sm: 0 },
                  bgcolor: 'background.paper',
                  border: { xs: 1, sm: 0 },
                  borderColor: { xs: 'divider', sm: 'transparent' },
                  borderRadius: { xs: meetingShape.control, sm: 0 },
                }}
              >
                {action}
              </Box>
            </Stack>
          </Box>
        </Stack>

        <MeetingJoinSupportRail
          displayName={displayName}
          email={auth.user?.email ?? null}
          currentStep={currentStep}
        />
      </Box>
    </PageCanvas>
  );
}

function MeetingJoinSummary({
  resolution,
  code,
  headingRef,
}: {
  resolution: VideoMeetingCodeResolution;
  code: string;
  headingRef: React.Ref<HTMLHeadingElement>;
}) {
  const { t, i18n } = useTranslation('meetings');
  const meeting = resolution.meeting;
  return (
    <Box
      component="section"
      data-testid="meeting-join-summary"
      aria-labelledby="meeting-join-summary-title"
      sx={(theme) => ({ ...meetingInsetSurface(theme, 'primary'), p: { xs: 1.75, sm: 2 } })}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1.5}>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            id="meeting-join-summary-title"
            component="h2"
            variant="h6"
            ref={headingRef}
            tabIndex={-1}
            fontWeight={800}
            sx={{ overflowWrap: 'anywhere' }}
          >
            {meeting.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {formatMeetingDateTime(meeting.startsAt, i18n.language)} · {meeting.timeZone}
          </Typography>
        </Box>
        <MeetingStatusChip state={meeting.lifecycleState} />
      </Stack>

      <Box
        component="dl"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          columnGap: 2,
          rowGap: 1.5,
          m: 0,
          mt: 2,
          pt: 2,
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        <MeetingJoinFact label={t('join.summary.organizer')} value={meeting.organizerName} />
        <MeetingJoinFact
          label={t('join.summary.access')}
          value={t('access.' + meeting.accessScope)}
        />
        <MeetingJoinFact
          label={t('join.summary.admission')}
          value={t(
            resolution.requiresApproval
              ? 'join.summary.approvalRequired'
              : 'join.summary.directEntry'
          )}
        />
        <MeetingJoinFact
          label={t('join.summary.code')}
          value={maskJoinCode(code)}
          valueLabel={t('join.summary.codeEnding', { suffix: visibleJoinCodeSuffix(code) })}
        />
      </Box>
    </Box>
  );
}

function MeetingJoinFact({
  label,
  value,
  valueLabel,
}: {
  label: string;
  value: string;
  valueLabel?: string;
}) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography component="dt" variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        component="dd"
        variant="body2"
        aria-label={valueLabel}
        sx={{ m: 0, mt: 0.25, overflowWrap: 'anywhere' }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function AccountConfirmation({
  displayName,
  email,
  requiresApproval,
}: {
  displayName: string;
  email: string | null;
  requiresApproval: boolean;
}) {
  const { t } = useTranslation('meetings');
  return (
    <Stack
      direction="row"
      alignItems="flex-start"
      gap={1.25}
      sx={(theme) => ({ ...meetingInsetSurface(theme), p: 1.5 })}
    >
      <UserRound size={19} aria-hidden="true" />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary">
          {t('join.accountLabel')}
        </Typography>
        <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
          {displayName || t('join.accountUnavailable')}
          {email ? ' · ' + email : ''}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {t(requiresApproval ? 'join.accountApprovalHint' : 'join.accountDirectHint')}
        </Typography>
      </Box>
    </Stack>
  );
}

function MeetingJoinSupportRail({
  displayName,
  email,
  currentStep,
}: {
  displayName: string;
  email: string | null;
  currentStep: number;
}) {
  const { t } = useTranslation('meetings');
  const safeguards = [
    { icon: CameraOff, title: t('join.support.noMediaTitle'), copy: t('join.support.noMediaCopy') },
    {
      icon: KeyRound,
      title: t('join.support.codePurposeTitle'),
      copy: t('join.support.codePurposeCopy'),
    },
    {
      icon: LockKeyhole,
      title: t('join.support.policyTitle'),
      copy: t('join.support.policyCopy'),
    },
  ] as const;
  return (
    <Stack
      component="aside"
      data-testid="meeting-join-support"
      aria-label={t('join.support.label')}
      gap={2}
      sx={{ minWidth: 0, position: { md: 'sticky' }, top: { md: 24 } }}
    >
      <Box sx={(theme) => ({ ...meetingSurface(theme), p: 2 })}>
        <Stack direction="row" alignItems="center" gap={1}>
          <ShieldCheck size={19} aria-hidden="true" />
          <Typography component="h2" variant="subtitle1">
            {t('join.support.title')}
          </Typography>
        </Stack>
        <Stack component="ul" gap={1.75} sx={{ listStyle: 'none', p: 0, m: 0, mt: 2 }}>
          {safeguards.map(({ icon: Icon, title, copy }) => (
            <Stack component="li" key={title} direction="row" alignItems="flex-start" gap={1}>
              <Box sx={{ color: 'primary.main', display: 'inline-flex', pt: 0.25 }}>
                <Icon size={17} aria-hidden="true" />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2">{title}</Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 0.25 }}
                >
                  {copy}
                </Typography>
              </Box>
            </Stack>
          ))}
        </Stack>
      </Box>

      <Box sx={(theme) => ({ ...meetingSurface(theme), p: 2 })}>
        <Stack direction="row" alignItems="center" gap={1}>
          <UserRound size={18} aria-hidden="true" />
          <Typography component="h2" variant="subtitle2">
            {t('join.support.signedIn')}
          </Typography>
        </Stack>
        <Typography variant="body2" sx={{ mt: 1.25, overflowWrap: 'anywhere' }}>
          {displayName || t('join.accountUnavailable')}
        </Typography>
        {email && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', overflowWrap: 'anywhere' }}
          >
            {email}
          </Typography>
        )}
      </Box>

      <Stack
        direction="row"
        alignItems="flex-start"
        gap={1}
        sx={(theme) => ({ ...meetingInsetSurface(theme, 'primary'), p: 2 })}
      >
        <CalendarClock size={18} aria-hidden="true" />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2">{t('join.support.nextTitle')}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
            {t(currentStep === 2 ? 'join.support.nextReady' : 'join.support.nextCopy')}
          </Typography>
        </Box>
      </Stack>
    </Stack>
  );
}

function JoinRequestState({ request }: { request: VideoMeetingJoinRequest }) {
  const { t } = useTranslation('meetings');
  const state = {
    WAITING: {
      icon: (
        <Box sx={{ color: 'warning.main', display: 'inline-flex' }}>
          <CircularProgress size={23} color="inherit" aria-hidden="true" />
        </Box>
      ),
      title: t('join.waitingTitle'),
      description: t('join.waitingDescription'),
    },
    APPROVED: {
      icon: (
        <Box sx={{ color: 'success.main', display: 'inline-flex' }}>
          <CheckCircle2 size={24} aria-hidden="true" />
        </Box>
      ),
      title: t('join.approvedTitle'),
      description: t('join.approvedDescription'),
    },
    DENIED: {
      icon: (
        <Box sx={{ color: 'error.main', display: 'inline-flex' }}>
          <ShieldX size={24} aria-hidden="true" />
        </Box>
      ),
      title: t('join.deniedTitle'),
      description: t('join.deniedDescription'),
    },
  }[request.state];

  return (
    <Stack
      data-testid="meeting-join-status"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      direction="row"
      alignItems="flex-start"
      gap={1.5}
      sx={(theme) => ({
        ...meetingInsetSurface(
          theme,
          request.state === 'APPROVED'
            ? 'success'
            : request.state === 'WAITING'
              ? 'warning'
              : 'error'
        ),
        p: 2,
      })}
    >
      {state.icon}
      <Box sx={{ minWidth: 0 }}>
        <Typography component="h2" variant="subtitle2" fontWeight={800}>
          {state.title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          {state.description}
        </Typography>
      </Box>
    </Stack>
  );
}
