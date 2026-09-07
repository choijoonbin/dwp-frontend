import { useCallback, useEffect, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CalendarCheck, ShieldCheck } from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  ConfirmDialog,
  ErrorState,
  LoadingState,
  PageCanvas,
  SectionHeader,
  foundationTokens,
  DwpDateTimeProvider,
  useDateTimePolicy,
  InlineFeedback,
} from '@dwp-frontend/design-system';
import { HttpError, useAuth } from '@dwp-frontend/shared-utils';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  getVideoMeetingCapabilities,
  searchVideoMeetingPeople,
  type VideoMeetingCapabilities,
  type VideoMeetingPerson,
} from '@dwp-frontend/shared-utils/api/video-meeting-api';
import {
  commitVideoMeetingScheduleDraft,
  discardVideoMeetingScheduleDraft,
  getVideoMeetingScheduleDraft,
  previewVideoMeetingSeries,
  previewVideoMeetingScheduleDraftRecurrence,
  saveVideoMeetingScheduleDraft,
  type VideoMeetingScheduleDraft,
  type VideoMeetingScheduleDraftSlot,
  type VideoMeetingSeriesPreview,
} from '@dwp-frontend/shared-utils/api/video-meeting-schedule-api';
import type { VideoMeetingTemplateScheduleDraft } from '@dwp-frontend/shared-utils/api/video-meeting-templates-api';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import { MeetingScheduleSections } from './meeting-schedule-fields';
import {
  emptyMeetingSchedule,
  meetingScheduleDraftAttempt,
  meetingScheduleDraftInput,
  meetingScheduleDraftStepIndex,
  meetingScheduleError,
  meetingScheduleStepError,
  restoreMeetingScheduleDraft,
  scheduleMeetingInput,
  type MeetingScheduleDraft,
} from './meeting-schedule-model';
import {
  MeetingScheduleDesktopDraftActions,
  MeetingScheduleDraftConflict,
  MeetingScheduleDraftHeaderAction,
  MeetingScheduleDraftSourceUnavailable,
  MeetingScheduleMobileFooter,
  type MeetingScheduleDraftStatus,
} from './meeting-schedule-draft-controls';

type Props = {
  initialTemplateDraft?: VideoMeetingTemplateScheduleDraft;
  onCreated: (meetingId: string) => void;
  onCancel: () => void;
};
const steps = ['information', 'people', 'repeat', 'review'] as const;
const authorizationError = (error: unknown) =>
  error instanceof HttpError && [401, 403].includes(error.status);
export function MeetingScheduleWorkspace(props: Props) {
  const { user, isAuthenticated } = useAuth();
  const scope = JSON.stringify([
    isAuthenticated,
    user?.identityPlane,
    user?.tenantId,
    user?.userId,
  ]);
  const initialScope = useRef(scope);
  return (
    <MeetingScheduleWorkspaceContent
      key={scope}
      {...props}
      initialTemplateDraft={initialScope.current === scope ? props.initialTemplateDraft : undefined}
      actorId={Number(user?.userId) || 0}
      authenticated={isAuthenticated && Boolean(user?.tenantId) && Number(user?.userId) > 0}
    />
  );
}

function MeetingScheduleWorkspaceContent({
  initialTemplateDraft,
  onCreated,
  onCancel,
  actorId,
  authenticated,
}: Props & { actorId: number; authenticated: boolean }) {
  const { t, i18n } = useTranslation('meetings');
  const { timeZone } = useDateTimePolicy();
  const [seed] = useState(() => {
    const now = new Date();
    return {
      blank: emptyMeetingSchedule(timeZone, undefined, now),
      authored: emptyMeetingSchedule(timeZone, initialTemplateDraft, now),
    };
  });
  const [draft, setDraft] = useState(seed.authored);
  const [savedDraft, setSavedDraft] = useState(seed.blank);
  const [step, setStep] = useState(0);
  const [savedStep, setSavedStep] = useState(0);
  const [draftSlot, setDraftSlot] = useState<VideoMeetingScheduleDraftSlot | null>(null);
  const [conflictSlot, setConflictSlot] = useState<VideoMeetingScheduleDraftSlot | null>(null);
  const [draftLoading, setDraftLoading] = useState(authenticated);
  const [draftLoadError, setDraftLoadError] = useState(false);
  const [draftRefresh, setDraftRefresh] = useState(0);
  const [draftStatus, setDraftStatus] = useState<MeetingScheduleDraftStatus>(
    initialTemplateDraft ? 'dirty' : 'idle'
  );
  const [confirmPersistedDiscard, setConfirmPersistedDiscard] = useState(false);
  const [capability, setCapability] = useState<VideoMeetingCapabilities | null>(null);
  const [capabilityError, setCapabilityError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [revoked, setRevoked] = useState(!authenticated);
  const [busy, setBusy] = useState(false);
  const [commandError, setCommandError] = useState<string | null>(null);
  const [validation, setValidation] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [people, setPeople] = useState<VideoMeetingPerson[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [seriesPreview, setSeriesPreview] = useState<VideoMeetingSeriesPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [previewReviewed, setPreviewReviewed] = useState(false);
  const [previewRefresh, setPreviewRefresh] = useState(0);
  const mounted = useRef(false);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const completed = useRef(false);
  const saveAttempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const commitAttempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const discardAttempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const dirty =
    !revoked && (JSON.stringify(draft) !== JSON.stringify(savedDraft) || step !== savedStep);
  const blocker = useBlocker(() => dirty && !completed.current);
  const revoke = useCallback(() => {
    generation.current += 1;
    setRevoked(true);
    setDraft(emptyMeetingSchedule(timeZone));
    setSavedDraft(emptyMeetingSchedule(timeZone));
    setStep(0);
    setSavedStep(0);
    setDraftSlot(null);
    setConflictSlot(null);
    setDraftLoading(false);
    setDraftLoadError(false);
    setDraftStatus('idle');
    setPeople([]);
    setSearch('');
    setCapability(null);
    setBusy(false);
    setCommandError(null);
    setValidation(null);
    setDiscard(false);
    setConfirmPersistedDiscard(false);
    setSeriesPreview(null);
    setPreviewing(false);
    setPreviewError(false);
    setPreviewReviewed(false);
    saveAttempt.current = null;
    commitAttempt.current = null;
    discardAttempt.current = null;
  }, [timeZone]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
    };
  }, []);
  useEffect(() => {
    if (!authenticated || revoked) return;
    const controller = new AbortController();
    const captured = generation.current;
    setDraftLoading(true);
    setDraftLoadError(false);
    void getVideoMeetingScheduleDraft(controller.signal)
      .then((slot) => {
        if (!mounted.current || controller.signal.aborted || captured !== generation.current)
          return;
        setDraftSlot(slot);
        setConflictSlot(null);
        if (slot.discardOnly) {
          setDraft(seed.blank);
          setSavedDraft(seed.blank);
          setStep(0);
          setSavedStep(0);
          setDraftStatus('conflict');
          return;
        }
        if (slot.draft) {
          const restored = restoreMeetingScheduleDraft(slot.draft, seed.blank);
          const restoredStep = meetingScheduleDraftStepIndex(slot.draft.lastStep);
          setDraft(restored);
          setSavedDraft(restored);
          setStep(restoredStep);
          setSavedStep(restoredStep);
          setDraftStatus('restored');
          return;
        }
        setDraft(seed.authored);
        setSavedDraft(seed.blank);
        setStep(0);
        setSavedStep(0);
        setDraftStatus(initialTemplateDraft ? 'dirty' : 'idle');
      })
      .catch((error) => {
        if (!mounted.current || controller.signal.aborted || captured !== generation.current)
          return;
        if (authorizationError(error)) revoke();
        else setDraftLoadError(true);
      })
      .finally(() => {
        if (mounted.current && !controller.signal.aborted && captured === generation.current)
          setDraftLoading(false);
      });
    return () => controller.abort();
  }, [authenticated, revoked, draftRefresh, initialTemplateDraft, revoke, seed]);
  useEffect(() => {
    if (!authenticated || revoked) return;
    let current = true;
    const captured = generation.current;
    setCapability(null);
    setCapabilityError(false);
    void getVideoMeetingCapabilities()
      .then((value) => {
        if (current && mounted.current && captured === generation.current) setCapability(value);
      })
      .catch((error) => {
        if (!mounted.current || captured !== generation.current) return;
        if (authorizationError(error)) revoke();
        else if (current) setCapabilityError(true);
      });
    return () => {
      current = false;
    };
  }, [authenticated, revoked, refresh, revoke]);
  useEffect(() => {
    setPeople([]);
    setSearchError(false);
    setSearching(false);
    const query = search.trim();
    if (revoked || !authenticated || query.length < 2) return;
    let current = true;
    const captured = generation.current;
    const timer = window.setTimeout(() => {
      setSearching(true);
      void searchVideoMeetingPeople(query, 30)
        .then((value) => {
          if (current && mounted.current && captured === generation.current)
            setPeople(value.filter((person) => person.userId !== actorId));
        })
        .catch((error) => {
          if (!mounted.current || captured !== generation.current) return;
          if (authorizationError(error)) revoke();
          else if (current) setSearchError(true);
        })
        .finally(() => {
          if (current && mounted.current && captured === generation.current) setSearching(false);
        });
    }, 250);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [search, actorId, authenticated, revoked, revoke]);
  useEffect(() => {
    setSeriesPreview(null);
    setPreviewReviewed(false);
    setPreviewError(false);
    if (
      draft.recurrence.frequency === 'NONE' ||
      revoked ||
      !authenticated ||
      meetingScheduleError(draft, actorId)
    )
      return;
    const controller = new AbortController();
    const captured = generation.current;
    setPreviewing(true);
    const input = scheduleMeetingInput(draft, '');
    void previewVideoMeetingSeries(
      input,
      {
        frequency: draft.recurrence.frequency,
        interval: draft.recurrence.interval,
        occurrenceCount: draft.recurrence.occurrenceCount,
      },
      controller.signal
    )
      .then((value) => {
        if (mounted.current && captured === generation.current && !controller.signal.aborted)
          setSeriesPreview(value);
      })
      .catch((error) => {
        if (!mounted.current || captured !== generation.current || controller.signal.aborted)
          return;
        if (authorizationError(error)) revoke();
        else setPreviewError(true);
      })
      .finally(() => {
        if (mounted.current && captured === generation.current && !controller.signal.aborted)
          setPreviewing(false);
      });
    return () => controller.abort();
  }, [draft, previewRefresh, actorId, authenticated, revoked, revoke]);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => {
      if (!completed.current) event.preventDefault();
    };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty]);
  const update = (next: MeetingScheduleDraft) => {
    if (inFlight.current || revoked) return;
    setDraft(next);
    setDraftStatus('dirty');
    setSeriesPreview(null);
    setPreviewReviewed(false);
    setPreviewError(false);
    setValidation(null);
    setCommandError(null);
  };
  const goTo = (next: number) => {
    if (busy) return;
    if (next > step) {
      const error = meetingScheduleStepError(draft, actorId, step);
      if (error) {
        setValidation(error);
        return;
      }
    }
    setValidation(null);
    setStep(next);
    if (next !== savedStep) setDraftStatus('dirty');
    heading.current?.focus();
  };
  const applyPersistedDraft = (
    persisted: VideoMeetingScheduleDraft,
    status: Extract<MeetingScheduleDraftStatus, 'saved' | 'restored'>
  ) => {
    const restored = restoreMeetingScheduleDraft(persisted, seed.blank);
    const restoredStep = meetingScheduleDraftStepIndex(persisted.lastStep);
    setDraft(restored);
    setSavedDraft(restored);
    setStep(restoredStep);
    setSavedStep(restoredStep);
    setDraftSlot({
      draft: persisted,
      discardOnly: false,
      draftId: persisted.draftId,
      version: persisted.version,
      retentionUntil: persisted.retentionUntil,
      observedAt: persisted.updatedAt,
    });
    setConflictSlot(null);
    setDraftStatus(status);
  };
  const reconcileDraftFailure = async (failure: unknown, captured: number) => {
    if (!mounted.current || captured !== generation.current) return;
    if (authorizationError(failure)) {
      revoke();
      return;
    }
    if (!(failure instanceof HttpError) || ![409, 410].includes(failure.status)) {
      setDraftStatus('error');
      return;
    }
    try {
      const latest = await getVideoMeetingScheduleDraft();
      if (!mounted.current || captured !== generation.current) return;
      setDraftSlot(latest);
      if (latest.discardOnly) {
        setDraft(seed.blank);
        setSavedDraft(seed.blank);
        setStep(0);
        setSavedStep(0);
        setConflictSlot(latest);
        setDraftStatus('conflict');
      } else if (latest.draft) {
        setConflictSlot(latest);
        setDraftStatus('conflict');
      } else {
        setConflictSlot(null);
        setSavedDraft(seed.blank);
        setSavedStep(0);
        setDraftStatus('expired');
      }
    } catch (refreshFailure) {
      if (!mounted.current || captured !== generation.current) return;
      if (authorizationError(refreshFailure)) revoke();
      else setDraftStatus('error');
    }
  };
  const persistCurrentDraft = async (captured: number) => {
    const input = meetingScheduleDraftInput(draft, draftSlot?.version ?? null, step);
    saveAttempt.current = meetingScheduleDraftAttempt(saveAttempt.current, input, () =>
      crypto.randomUUID()
    );
    setDraftStatus('saving');
    const persisted = await saveVideoMeetingScheduleDraft(input, saveAttempt.current.key);
    if (!mounted.current || captured !== generation.current) return null;
    saveAttempt.current = null;
    applyPersistedDraft(persisted, 'saved');
    return persisted;
  };
  const saveCurrentDraft = async () => {
    if (
      inFlight.current ||
      !dirty ||
      revoked ||
      !authenticated ||
      draftLoading ||
      draftLoadError ||
      draftSlot?.discardOnly ||
      conflictSlot
    )
      return;
    const captured = generation.current;
    inFlight.current = true;
    setBusy(true);
    setCommandError(null);
    try {
      await persistCurrentDraft(captured);
    } catch (failure) {
      await reconcileDraftFailure(failure, captured);
    } finally {
      if (mounted.current && captured === generation.current) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  };
  const restoreLatestDraft = () => {
    if (!conflictSlot?.draft || busy) return;
    applyPersistedDraft(conflictSlot.draft, 'restored');
  };
  const discardPersistedDraft = async () => {
    const slot = conflictSlot ?? draftSlot;
    if (inFlight.current || revoked || !authenticated || slot?.version == null || !slot.draftId)
      return;
    const input = { expectedVersion: slot.version, previewFingerprint: null };
    discardAttempt.current = meetingScheduleDraftAttempt(discardAttempt.current, input, () =>
      crypto.randomUUID()
    );
    const captured = generation.current;
    inFlight.current = true;
    setBusy(true);
    setDraftStatus('discarding');
    try {
      await discardVideoMeetingScheduleDraft(slot.version, discardAttempt.current.key);
      if (!mounted.current || captured !== generation.current) return;
      discardAttempt.current = null;
      saveAttempt.current = null;
      commitAttempt.current = null;
      setDraft(seed.blank);
      setSavedDraft(seed.blank);
      setStep(0);
      setSavedStep(0);
      setDraftSlot(null);
      setConflictSlot(null);
      setDraftStatus('idle');
      setConfirmPersistedDiscard(false);
      setValidation(null);
      setCommandError(null);
    } catch (failure) {
      setConfirmPersistedDiscard(false);
      await reconcileDraftFailure(failure, captured);
    } finally {
      if (mounted.current && captured === generation.current) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  };
  const submit = async () => {
    if (
      inFlight.current ||
      completed.current ||
      revoked ||
      !authenticated ||
      !capability ||
      capabilityError ||
      draftLoading ||
      draftLoadError ||
      draftSlot?.discardOnly ||
      conflictSlot
    )
      return;
    const error = meetingScheduleError(draft, actorId);
    if (error) {
      setValidation(error);
      setStep(['title', 'purpose', 'agenda', 'agendaLimit'].includes(error) ? 0 : 1);
      heading.current?.focus();
      return;
    }
    if (capability.unavailableReason === 'MEETINGS_DISABLED_BY_POLICY') return;
    const recurring = draft.recurrence.frequency !== 'NONE';
    if (recurring && (!seriesPreview || !previewReviewed || previewError)) {
      setValidation('recurrenceReview');
      setStep(3);
      heading.current?.focus();
      return;
    }
    const captured = generation.current;
    inFlight.current = true;
    setBusy(true);
    setCommandError(null);
    try {
      let persisted = draftSlot?.draft ?? null;
      if (dirty || !persisted) persisted = await persistCurrentDraft(captured);
      if (!persisted || !mounted.current || captured !== generation.current) return;
      let fingerprint: string | null = null;
      if (recurring) {
        const canonicalPreview = await previewVideoMeetingScheduleDraftRecurrence(
          persisted.version
        );
        if (!mounted.current || captured !== generation.current) return;
        setSeriesPreview(canonicalPreview);
        if (canonicalPreview.previewFingerprint !== seriesPreview!.previewFingerprint) {
          setPreviewReviewed(false);
          setValidation('recurrenceChanged');
          setStep(3);
          heading.current?.focus();
          return;
        }
        fingerprint = canonicalPreview.previewFingerprint;
      }
      const commitInput = { expectedVersion: persisted.version, previewFingerprint: fingerprint };
      commitAttempt.current = meetingScheduleDraftAttempt(commitAttempt.current, commitInput, () =>
        crypto.randomUUID()
      );
      const result = await commitVideoMeetingScheduleDraft(
        persisted.version,
        fingerprint,
        commitAttempt.current.key
      );
      if (!mounted.current || captured !== generation.current) return;
      completed.current = true;
      commitAttempt.current = null;
      onCreated(result.meetingId);
    } catch (failure) {
      if (!mounted.current || captured !== generation.current) return;
      if (failure instanceof HttpError && [409, 410].includes(failure.status)) {
        await reconcileDraftFailure(failure, captured);
        setCommandError(failure.status === 409 ? 'conflict' : 'draftExpired');
      } else if (authorizationError(failure)) revoke();
      else {
        if (draftSlot?.draft) setDraftStatus('saved');
        setCommandError(
          failure instanceof HttpError && failure.status === 400 ? 'policyRejected' : 'createFailed'
        );
      }
    } finally {
      if (mounted.current && captured === generation.current) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  };
  const policyBlocked = capability?.unavailableReason === 'MEETINGS_DISABLED_BY_POLICY';
  const disabled =
    busy ||
    previewing ||
    revoked ||
    draftLoading ||
    draftLoadError ||
    draftSlot?.discardOnly ||
    Boolean(conflictSlot) ||
    !capability ||
    capabilityError ||
    policyBlocked ||
    (draft.recurrence.frequency !== 'NONE' && (!seriesPreview || !previewReviewed));
  const cancel = () => {
    if (!busy) {
      if (dirty) setDiscard(true);
      else onCancel();
    }
  };
  const formattedStart =
    draft.startsAt && Number.isFinite(Date.parse(draft.startsAt))
      ? formatDate(
          draft.startsAt,
          {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: draft.timeZone,
          },
          resolveSupportedLocale(i18n.language)
        )
      : t('scheduleWorkspace.notSet');
  const draftUpdatedAt = draftSlot?.draft?.updatedAt;
  const saveDraftDisabled =
    busy ||
    !dirty ||
    revoked ||
    draftLoading ||
    draftLoadError ||
    Boolean(draftSlot?.discardOnly) ||
    Boolean(conflictSlot);
  const submitButton = (
    <ActionButton
      fullWidth
      intent="primary"
      disabled={disabled}
      onClick={() => void submit()}
      startIcon={<CalendarCheck size={18} aria-hidden="true" />}
    >
      {t(busy ? 'schedule.submitting' : 'scheduleWorkspace.submit')}
    </ActionButton>
  );
  return (
    <PageCanvas>
      <Box
        data-testid="meeting-schedule-workspace"
        sx={{
          minWidth: 0,
          pb: { xs: 24, md: 0 },
          '@media (forced-colors: active)': {
            '&& button': {
              color: 'ButtonText',
              WebkitTextFillColor: 'ButtonText',
              backgroundColor: 'ButtonFace',
              borderColor: 'ButtonText',
            },
            '&& button[aria-current="step"]': { outline: '2px solid Highlight' },
            '&& button:disabled': { WebkitTextFillColor: 'GrayText' },
          },
        }}
      >
        <Stack direction="row" alignItems="flex-start" gap={1.5} sx={{ mb: 3 }}>
          <ActionIconButton label={t('actions.cancel')} disabled={busy} onClick={cancel}>
            <ArrowLeft size={20} aria-hidden="true" />
          </ActionIconButton>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              ref={heading}
              tabIndex={-1}
              component="h1"
              variant="h5"
              fontWeight="fontWeightBold"
            >
              {t('scheduleWorkspace.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('scheduleWorkspace.description')}
            </Typography>
          </Box>
          <MeetingScheduleDraftHeaderAction
            disabled={saveDraftDisabled}
            hasStatus={draftStatus !== 'idle'}
            onSave={() => void saveCurrentDraft()}
          />
        </Stack>
        {revoked ? (
          <ErrorState
            title={t('scheduleWorkspace.accessRevoked')}
            description={t('scheduleWorkspace.accessRevokedHint')}
          />
        ) : draftLoading ? (
          <LoadingState label={t('scheduleWorkspace.loadingDraft')} variant="skeleton" />
        ) : draftLoadError ? (
          <ErrorState
            title={t('scheduleWorkspace.draftLoadError')}
            description={t('scheduleWorkspace.draftLoadErrorHint')}
            retryLabel={t('actions.retry')}
            onRetry={() => setDraftRefresh((value) => value + 1)}
          />
        ) : draftSlot?.discardOnly ? (
          <MeetingScheduleDraftSourceUnavailable
            busy={busy}
            onDiscard={() => setConfirmPersistedDiscard(true)}
          />
        ) : (
          <>
            <Box
              component="nav"
              aria-label={t('scheduleWorkspace.stepsLabel')}
              sx={{
                display: { xs: 'grid', md: 'none' },
                gridTemplateColumns: 'repeat(4,minmax(0,1fr))',
                gap: 0.5,
                mb: 3,
              }}
            >
              {steps.map((value, index) => (
                <ActionButton
                  key={value}
                  size="small"
                  intent={step === index ? 'primary' : 'secondary'}
                  aria-current={step === index ? 'step' : undefined}
                  disabled={busy || index > step + 1}
                  onClick={() => goTo(index)}
                  sx={{ minWidth: 0, px: 0.5, whiteSpace: 'normal', minHeight: 44 }}
                >
                  {index + 1}. {t('scheduleWorkspace.steps.' + value)}
                </ActionButton>
              ))}
            </Box>
            {(validation || commandError) && (
              <InlineFeedback severity="error" sx={{ mb: 2, overflowWrap: 'anywhere' }}>
                {validation
                  ? t('scheduleWorkspace.validation.' + validation)
                  : t('scheduleWorkspace.' + commandError)}
              </InlineFeedback>
            )}
            {capabilityError && (
              <Box
                data-testid="meeting-schedule-mobile-capability-error"
                sx={{ display: { xs: 'block', md: 'none' }, mb: 2 }}
              >
                <ErrorState
                  size="compact"
                  title={t('scheduleWorkspace.capabilityError')}
                  retryLabel={t('actions.retry')}
                  retrying={false}
                  onRetry={() => setRefresh((value) => value + 1)}
                />
              </Box>
            )}
            {policyBlocked && (
              <InlineFeedback severity="warning" sx={{ mb: 2 }}>
                {t('scheduleWorkspace.policyDisabled')}
              </InlineFeedback>
            )}
            {conflictSlot && (
              <MeetingScheduleDraftConflict
                busy={busy}
                canRestore={Boolean(conflictSlot.draft)}
                onRestore={restoreLatestDraft}
                onDiscard={() => setConfirmPersistedDiscard(true)}
              />
            )}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'minmax(0,1fr)',
                  md: 'minmax(0,2.1fr) minmax(260px,1fr)',
                },
                gap: { xs: 3, md: 4 },
                alignItems: 'start',
              }}
            >
              <DwpDateTimeProvider locale={i18n.language} timeZone={draft.timeZone}>
                <MeetingScheduleSections
                  draft={draft}
                  actorId={actorId}
                  step={step}
                  busy={busy}
                  update={update}
                  people={people}
                  search={search}
                  onSearch={setSearch}
                  searching={searching}
                  searchError={searchError}
                  capability={capability}
                />
              </DwpDateTimeProvider>
              <Box
                component="aside"
                aria-label={t('scheduleWorkspace.preview')}
                sx={{
                  display: { xs: step === 3 ? 'block' : 'none', md: 'block' },
                  position: { md: 'sticky' },
                  top: 80,
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: foundationTokens.radius.surface + 'px',
                  p: 3,
                  minWidth: 0,
                }}
              >
                <SectionHeader
                  icon={CalendarCheck}
                  title={t('scheduleWorkspace.preview')}
                  divider
                />
                <Stack gap={2} sx={{ pt: 2.5 }}>
                  <Typography component="h3" variant="h6" sx={{ overflowWrap: 'anywhere' }}>
                    {draft.title.trim() || t('scheduleWorkspace.untitled')}
                  </Typography>
                  <Box
                    component="dl"
                    sx={{
                      m: 0,
                      '& dt': { color: 'text.secondary', typography: 'caption', mt: 1.5 },
                      '& dd': { m: 0, typography: 'body2', mt: 0.5, overflowWrap: 'anywhere' },
                    }}
                  >
                    <dt>{t('schedule.startsAt')}</dt>
                    <dd>{formattedStart}</dd>
                    <dt>{t('schedule.duration')}</dt>
                    <dd>
                      {t('units.minutes', { count: draft.durationMinutes })} ·{' '}
                      {t(
                        draft.recurrence.frequency === 'NONE'
                          ? 'scheduleWorkspace.once'
                          : draft.recurrence.frequency === 'WEEKLY'
                            ? 'scheduleWorkspace.weekly'
                            : 'scheduleWorkspace.monthly'
                      )}
                    </dd>
                    <dt>{t('schedule.participants')}</dt>
                    <dd>
                      {t('scheduleWorkspace.invitedCount', { count: draft.participants.length })}
                    </dd>
                    <dt>{t('scheduleWorkspace.sections.agenda')}</dt>
                    <dd>
                      {t('scheduleWorkspace.agendaCount', { count: draft.agendaItems.length })}
                    </dd>
                  </Box>
                  {draft.recurrence.frequency !== 'NONE' && (
                    <Box aria-live="polite">
                      {previewing ? (
                        <LoadingState label={t('scheduleWorkspace.previewingRecurrence')} />
                      ) : previewError ? (
                        <ErrorState
                          title={t('scheduleWorkspace.recurrencePreviewError')}
                          retryLabel={t('actions.retry')}
                          onRetry={() => setPreviewRefresh((value) => value + 1)}
                        />
                      ) : seriesPreview ? (
                        <Stack gap={1.5}>
                          {seriesPreview.hasCalendarAdjustments && (
                            <InlineFeedback severity="warning">
                              {t('scheduleWorkspace.calendarAdjustments')}
                            </InlineFeedback>
                          )}
                          <Stack
                            component="ol"
                            gap={1}
                            sx={{ m: 0, pl: 2.5, maxHeight: 240, overflowY: 'auto' }}
                          >
                            {seriesPreview.occurrences.map((occurrence) => (
                              <Typography
                                component="li"
                                variant="caption"
                                key={occurrence.occurrenceIndex}
                              >
                                {formatDate(
                                  occurrence.startsAt,
                                  {
                                    dateStyle: 'medium',
                                    timeStyle: 'short',
                                    timeZone: draft.timeZone,
                                  },
                                  resolveSupportedLocale(i18n.language)
                                )}
                                {occurrence.adjustment !== 'NONE'
                                  ? ` · ${t('scheduleWorkspace.adjustments.' + occurrence.adjustment)}`
                                  : ''}
                              </Typography>
                            ))}
                          </Stack>
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={previewReviewed}
                                onChange={(_, checked) => setPreviewReviewed(checked)}
                              />
                            }
                            label={t('scheduleWorkspace.confirmRecurrencePreview')}
                          />
                        </Stack>
                      ) : null}
                    </Box>
                  )}
                  <Typography variant="body2" color="text.secondary">
                    {t('scheduleWorkspace.availabilityUnavailable')}
                  </Typography>
                  <Stack direction="row" gap={1}>
                    <ShieldCheck size={18} aria-hidden="true" />
                    <Typography variant="caption" color="text.secondary">
                      {t('scheduleWorkspace.policyRecheck')}
                    </Typography>
                  </Stack>
                  {capabilityError ? (
                    <ErrorState
                      title={t('scheduleWorkspace.capabilityError')}
                      retryLabel={t('actions.retry')}
                      onRetry={() => setRefresh((value) => value + 1)}
                    />
                  ) : !capability ? (
                    <LoadingState label={t('scheduleWorkspace.checkingPolicy')} />
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      {t(
                        capability.available
                          ? 'scheduleWorkspace.mediaAvailable'
                          : 'scheduleWorkspace.mediaUnavailable'
                      )}
                    </Typography>
                  )}
                  <Box sx={{ display: { xs: 'none', md: 'block' } }}>{submitButton}</Box>
                  <Typography variant="caption" color="text.secondary">
                    {t('scheduleWorkspace.deliveryHint')}
                  </Typography>
                  <MeetingScheduleDesktopDraftActions
                    busy={busy}
                    disabled={saveDraftDisabled}
                    hasPersistedDraft={draftSlot?.version != null}
                    status={draftStatus}
                    updatedAt={draftUpdatedAt}
                    timeZone={timeZone}
                    onSave={() => void saveCurrentDraft()}
                    onDiscard={() => setConfirmPersistedDiscard(true)}
                    onCancel={cancel}
                  />
                </Stack>
              </Box>
            </Box>
            <MeetingScheduleMobileFooter
              step={step}
              busy={busy}
              submitButton={submitButton}
              draftDisabled={saveDraftDisabled}
              hasPersistedDraft={draftSlot?.version != null}
              status={draftStatus}
              updatedAt={draftUpdatedAt}
              timeZone={timeZone}
              onPrevious={() => goTo(step - 1)}
              onNext={() => goTo(step + 1)}
              onSave={() => void saveCurrentDraft()}
              onDiscard={() => setConfirmPersistedDiscard(true)}
            />
          </>
        )}
      </Box>
      <ConfirmDialog
        open={confirmPersistedDiscard}
        title={t('scheduleWorkspace.discardDraftTitle')}
        description={t('scheduleWorkspace.discardDraftDescription')}
        cancelLabel={t('templates.keepEditing')}
        confirmLabel={t('scheduleWorkspace.discardSavedDraft')}
        busy={busy}
        onClose={() => setConfirmPersistedDiscard(false)}
        onConfirm={() => void discardPersistedDraft()}
      />
      <ConfirmDialog
        open={discard || blocker.state === 'blocked'}
        title={t('templates.discardTitle')}
        description={t('scheduleWorkspace.discardHint')}
        cancelLabel={t('templates.keepEditing')}
        confirmLabel={t('templates.discard')}
        busy={busy}
        onClose={() => {
          setDiscard(false);
          if (blocker.state === 'blocked') blocker.reset();
        }}
        onConfirm={() => {
          completed.current = true;
          if (blocker.state === 'blocked') blocker.proceed();
          else onCancel();
        }}
      />
    </PageCanvas>
  );
}
