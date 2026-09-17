import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  acceptWorkplaceAlternativeOffer,
  cancelWorkplaceWaitlistEntry,
  compensateWorkplaceBookingBatch,
  createWorkplaceIdempotencyKey,
  createWorkplaceReservationHolds,
  createWorkplaceWaitlistEntry,
  getWorkplaceAuthorizedBookingBeneficiaries,
  getWorkplaceBookingBatch,
  getWorkplaceBookingIntent,
  getWorkplaceExplore,
  getWorkplaceWaitlistEntries,
  previewWorkplaceBookingIntent,
  replanWorkplaceBookingBatch,
  resolveIdempotentMutationIntent,
  startWorkplaceBookingBatch,
  updateWorkplaceWaitlistEntry,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ConfirmDialog,
  InlineFeedback,
  PageCanvas,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useRoomsCapabilities } from './rooms-capabilities';
import { RoomsPageHeading, RoomsPermissionNotice } from './rooms-ui';
import { retryRecoverableWorkplaceRead } from './workplace-authority-failure';
import { workplaceHomeSourceState } from './workplace-home-source-state';
import { workplaceMemberCard } from './workplace-member-surfaces';
import { WorkplacePlannerConfiguration } from './workplace-planner-configuration';
import {
  buildWorkplacePlannerHoldRequest,
  buildWorkplacePlannerIntentItems,
  buildWorkplacePlannerTeamConstraints,
  defaultWorkplacePlannerCandidateSelections,
  shouldPollWorkplacePlannerBatch,
  workplacePlannerHoldSecondsRemaining,
  workplacePlannerRange,
} from './workplace-planner-model';
import { WorkplacePlannerResult } from './workplace-planner-result';
import { WorkplacePlannerReview } from './workplace-planner-review';
import { WorkplacePlannerWaitlists } from './workplace-planner-waitlists';
import {
  parseWorkplacePlannerUrl,
  updateWorkplacePlannerUrl,
  type WorkplacePlannerUrlPatch,
} from './workplace-planner-url-state';

import type {
  IdempotentMutationIntent,
  WorkplaceBookingFailurePolicy,
  WorkplaceBookingHoldResponse,
  WorkplaceBookingIntentItemInput,
  WorkplaceBookingIntentPreview,
  WorkplaceWaitlistEntry,
} from '@dwp-frontend/shared-utils';

type Confirmation = 'BATCH' | 'COMPENSATE' | null;

function authorizedReference(value: {
  beneficiaryUserId: number;
  beneficiaryPersonPublicId: string | null;
}) {
  return value.beneficiaryPersonPublicId ?? String(value.beneficiaryUserId);
}

function sourceState(query: {
  data: unknown;
  error: unknown;
  failureCount: number;
  failureReason: unknown;
  isError: boolean;
  isPending: boolean;
}) {
  return workplaceHomeSourceState({ ...query, required: true });
}

export function WorkplacePlanner() {
  const { t } = useTranslation('rooms');
  const auth = useAuth();
  const capabilities = useRoomsCapabilities();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const parsedUrl = useMemo(() => parseWorkplacePlannerUrl(searchParams), [searchParams]);
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;
  const identityKey = `${auth.user?.tenantId ?? 'anonymous'}:${auth.user?.userId ?? 'anonymous'}`;
  const [purpose, setPurpose] = useState(t('workplace.planner.defaultPurpose'));
  const [accessibleOnly, setAccessibleOnly] = useState(false);
  const [failurePolicy, setFailurePolicy] =
    useState<WorkplaceBookingFailurePolicy>('KEEP_SUCCEEDED');
  const [previewSnapshot, setPreviewSnapshot] = useState<WorkplaceBookingIntentPreview | null>(
    null
  );
  const [holdSnapshot, setHoldSnapshot] = useState<WorkplaceBookingHoldResponse | null>(null);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [holdAnchor, setHoldAnchor] = useState(0);
  const [tick, setTick] = useState(0);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [uncertainSubmission, setUncertainSubmission] = useState(false);
  const [creatingWaitlistFor, setCreatingWaitlistFor] = useState<string | null>(null);
  const [acceptingOfferId, setAcceptingOfferId] = useState<string | null>(null);
  const [updatingWaitlistId, setUpdatingWaitlistId] = useState<string | null>(null);
  const [cancellingWaitlistId, setCancellingWaitlistId] = useState<string | null>(null);
  const [waitlistToCancel, setWaitlistToCancel] = useState<WorkplaceWaitlistEntry | null>(null);
  const previewIntentRef = useRef<IdempotentMutationIntent | null>(null);
  const holdIntentRef = useRef<IdempotentMutationIntent | null>(null);
  const batchIntentRef = useRef<IdempotentMutationIntent | null>(null);
  const waitlistIntentRef = useRef<IdempotentMutationIntent | null>(null);
  const compensationIntentRef = useRef<IdempotentMutationIntent | null>(null);
  const replanIntentRef = useRef<IdempotentMutationIntent | null>(null);
  const offerIntentRef = useRef<IdempotentMutationIntent | null>(null);
  const waitlistUpdateIntentRef = useRef<IdempotentMutationIntent | null>(null);
  const waitlistCancelIntentRef = useRef<IdempotentMutationIntent | null>(null);

  useEffect(() => {
    if (!parsedUrl.corrected) return;
    searchParamsRef.current = parsedUrl.canonicalSearchParams;
    setSearchParams(parsedUrl.canonicalSearchParams, { replace: true });
  }, [parsedUrl, setSearchParams]);

  const updateParams = useCallback(
    (patch: WorkplacePlannerUrlPatch) => {
      const next = updateWorkplacePlannerUrl(searchParamsRef.current, patch);
      searchParamsRef.current = next;
      setSearchParams(next, { replace: true });
    },
    [setSearchParams]
  );

  const firstRange = useMemo(
    () =>
      workplacePlannerRange(
        parsedUrl.state.dates[0] ?? parsedUrl.state.week,
        parsedUrl.state.start,
        parsedUrl.state.duration,
        parsedUrl.state.timeZone
      ),
    [parsedUrl.state]
  );
  const lastRange = useMemo(
    () =>
      workplacePlannerRange(
        parsedUrl.state.dates.at(-1) ?? parsedUrl.state.week,
        parsedUrl.state.start,
        parsedUrl.state.duration,
        parsedUrl.state.timeZone
      ),
    [parsedUrl.state]
  );

  const beneficiariesQuery = useQuery({
    queryKey: ['workplace', 'planner', identityKey, 'authorized-beneficiaries'],
    queryFn: getWorkplaceAuthorizedBookingBeneficiaries,
    enabled: capabilities.isLoaded && capabilities.canViewWorkplace,
    staleTime: 20_000,
    refetchInterval: 60_000,
    retry: retryRecoverableWorkplaceRead,
  });
  const catalogQuery = useQuery({
    queryKey: [
      'workplace',
      'planner',
      identityKey,
      'catalog',
      firstRange?.from,
      firstRange?.to,
      parsedUrl.state.floorId || null,
    ],
    queryFn: () =>
      getWorkplaceExplore(firstRange!.from, firstRange!.to, parsedUrl.state.floorId || null),
    enabled: capabilities.isLoaded && capabilities.canViewWorkplace && Boolean(firstRange),
    placeholderData: (previous) => previous,
    staleTime: 15_000,
    refetchInterval: 60_000,
    retry: retryRecoverableWorkplaceRead,
  });
  const intentQuery = useQuery({
    queryKey: ['workplace', 'planner', identityKey, 'intent', parsedUrl.state.intentId],
    queryFn: () => getWorkplaceBookingIntent(parsedUrl.state.intentId!),
    enabled: capabilities.canViewWorkplace && Boolean(parsedUrl.state.intentId),
    staleTime: 5_000,
    refetchInterval: (query) =>
      query.state.data?.intent.state === 'HELD' || query.state.data?.intent.state === 'CONFIRMING'
        ? 5_000
        : false,
    retry: retryRecoverableWorkplaceRead,
  });
  const batchQuery = useQuery({
    queryKey: ['workplace', 'planner', identityKey, 'batch', parsedUrl.state.batchId],
    queryFn: () => getWorkplaceBookingBatch(parsedUrl.state.batchId!),
    enabled: capabilities.canViewWorkplace && Boolean(parsedUrl.state.batchId),
    staleTime: 1_000,
    refetchInterval: (query) => (shouldPollWorkplacePlannerBatch(query.state.data) ? 2_000 : false),
    retry: retryRecoverableWorkplaceRead,
  });
  const waitlistsQuery = useQuery({
    queryKey: ['workplace', 'planner', identityKey, 'waitlists', firstRange?.from, lastRange?.to],
    queryFn: () =>
      getWorkplaceWaitlistEntries({ from: firstRange!.from, to: lastRange!.to, size: 50 }),
    enabled: capabilities.canViewWorkplace && Boolean(firstRange) && Boolean(lastRange),
    staleTime: 10_000,
    refetchInterval: 30_000,
    retry: retryRecoverableWorkplaceRead,
  });
  const refetchWaitlists = waitlistsQuery.refetch;
  const refreshWaitlists = useCallback(() => {
    void refetchWaitlists();
  }, [refetchWaitlists]);

  const beneficiariesState = capabilities.isLoaded
    ? capabilities.canViewWorkplace
      ? sourceState(beneficiariesQuery)
      : 'DENIED'
    : 'LOADING';
  const catalogState = capabilities.isLoaded
    ? capabilities.canViewWorkplace
      ? catalogQuery.isPlaceholderData
        ? 'STALE'
        : sourceState(catalogQuery)
      : 'DENIED'
    : 'LOADING';
  const plannerSourceState =
    beneficiariesState === 'DENIED' || catalogState === 'DENIED'
      ? 'DENIED'
      : beneficiariesState === 'LOADING' || catalogState === 'LOADING'
        ? 'LOADING'
        : beneficiariesState === 'UNAVAILABLE' || catalogState === 'UNAVAILABLE'
          ? 'UNAVAILABLE'
          : beneficiariesState === 'STALE' || catalogState === 'STALE'
            ? 'STALE'
            : 'READY';
  const sourceReady = plannerSourceState === 'READY';
  const authorizedBeneficiaries = useMemo(
    () =>
      (beneficiariesQuery.data?.beneficiaries ?? []).filter(
        (beneficiary) =>
          beneficiary.self ||
          beneficiary.validUntil === null ||
          Date.parse(beneficiary.validUntil) > Date.now()
      ),
    [beneficiariesQuery.data?.beneficiaries]
  );

  useEffect(() => {
    if (authorizedBeneficiaries.length === 0) return;
    const allowed = authorizedBeneficiaries.filter((beneficiary) => {
      if (parsedUrl.state.target === 'SELF') return beneficiary.self;
      if (parsedUrl.state.target === 'DELEGATE') return !beneficiary.self;
      return true;
    });
    const allowedReferences = new Set(allowed.map(authorizedReference));
    const selected = parsedUrl.state.beneficiaryRefs.filter((value) =>
      allowedReferences.has(value)
    );
    const maximum = parsedUrl.state.target === 'TEAM' ? 5 : 1;
    const next = selected.slice(0, maximum);
    if (next.length === 0 && allowed[0]) next.push(authorizedReference(allowed[0]));
    if (next.join(',') !== parsedUrl.state.beneficiaryRefs.join(',')) {
      updateParams({ beneficiaries: next });
    }
  }, [authorizedBeneficiaries, parsedUrl.state, updateParams]);

  useEffect(() => {
    const latestBatchId = intentQuery.data?.latestBatchId;
    if (latestBatchId && !parsedUrl.state.batchId) {
      updateParams({ batch: latestBatchId, step: 'RESULT' });
    }
  }, [intentQuery.data?.latestBatchId, parsedUrl.state.batchId, updateParams]);

  const selectedBeneficiaries = useMemo(() => {
    const selected = new Set(parsedUrl.state.beneficiaryRefs);
    return authorizedBeneficiaries
      .filter((beneficiary) => selected.has(authorizedReference(beneficiary)))
      .map((beneficiary) => ({
        userId: beneficiary.beneficiaryUserId,
        personPublicId: beneficiary.beneficiaryPersonPublicId,
        displayName: beneficiary.displayName,
        delegationGrantId: beneficiary.self ? null : beneficiary.delegationGrantId,
      }));
  }, [authorizedBeneficiaries, parsedUrl.state.beneficiaryRefs]);
  const builtItems = useMemo(
    () =>
      buildWorkplacePlannerIntentItems({
        dates: parsedUrl.state.dates,
        beneficiaries: selectedBeneficiaries,
        resourceTypes: parsedUrl.state.resourceTypes,
        start: parsedUrl.state.start,
        durationMinutes: parsedUrl.state.duration,
        timeZone: parsedUrl.state.timeZone,
        siteId: parsedUrl.state.siteId,
        floorId: parsedUrl.state.floorId,
        purpose: purpose.trim() || t('workplace.planner.defaultPurpose'),
        accessibleOnly,
      }),
    [accessibleOnly, parsedUrl.state, purpose, selectedBeneficiaries, t]
  );

  const preview = previewSnapshot ?? intentQuery.data?.intent ?? null;
  const holdStatus =
    holdSnapshot && holdSnapshot.intentId === preview?.intentId ? holdSnapshot : null;
  const holds = holdStatus?.holds ?? intentQuery.data?.holds ?? [];
  const serverTime = holdStatus?.serverTime ?? intentQuery.data?.serverTime ?? '';
  const serverAnchor = holdStatus ? holdAnchor : intentQuery.dataUpdatedAt;
  const holdSecondsRemaining = workplacePlannerHoldSecondsRemaining(
    holds,
    serverTime,
    serverAnchor > 0 ? Date.now() - serverAnchor : 0
  );

  useEffect(() => {
    if (!preview) return;
    setSelections((current) => defaultWorkplacePlannerCandidateSelections(preview, current));
  }, [preview]);
  useEffect(() => {
    if (holdSecondsRemaining <= 0) return;
    const timer = window.setInterval(() => setTick((value) => value + 1), 1_000);
    return () => window.clearInterval(timer);
  }, [holdSecondsRemaining, tick]);

  const previewMutation = useMutation({
    mutationFn: async (items: readonly WorkplaceBookingIntentItemInput[]) => {
      const teamPlacementConstraints = buildWorkplacePlannerTeamConstraints({
        items,
        enabled: parsedUrl.state.target === 'TEAM',
        adjacentSeats: parsedUrl.state.adjacentSeats,
        sameNeighborhood: parsedUrl.state.sameNeighborhood,
        minimumDistanceMeters: parsedUrl.state.minimumDistanceMeters,
        maximumDistanceMeters: parsedUrl.state.maximumDistanceMeters,
      });
      const input = {
        items,
        requestedHoldTtlSeconds: 120,
        allowAlternatives: true,
        teamPlacementConstraints,
        reason: purpose.trim() || t('workplace.planner.defaultPurpose'),
      };
      const intent = resolveIdempotentMutationIntent(previewIntentRef.current, input, () =>
        createWorkplaceIdempotencyKey('planner-preview')
      );
      previewIntentRef.current = intent;
      return previewWorkplaceBookingIntent(input, intent.key);
    },
    retry: false,
    onSuccess: (result) => {
      setPreviewSnapshot(result);
      setHoldSnapshot(null);
      setUncertainSubmission(false);
      updateParams({ intent: result.intentId, batch: null, step: 'REVIEW' });
    },
    onError: () => toast.error(t('workplace.planner.feedback.previewError')),
  });
  const holdMutation = useMutation({
    mutationFn: async () => {
      if (!preview) throw new Error('Missing preview');
      const input = buildWorkplacePlannerHoldRequest(
        preview,
        selections,
        purpose.trim() || t('workplace.planner.defaultPurpose')
      );
      if (!input) throw new Error('Incomplete selection');
      const mutationIntent = resolveIdempotentMutationIntent(holdIntentRef.current, input, () =>
        createWorkplaceIdempotencyKey('planner-hold')
      );
      holdIntentRef.current = mutationIntent;
      return createWorkplaceReservationHolds(preview.intentId, input, mutationIntent.key);
    },
    retry: false,
    onSuccess: (result) => {
      setHoldSnapshot(result);
      setHoldAnchor(Date.now());
      setTick((value) => value + 1);
      toast.success(t('workplace.planner.feedback.holdCreated'));
    },
    onError: () => {
      intentQuery.refetch();
      toast.error(t('workplace.planner.feedback.holdError'));
    },
  });
  const batchMutation = useMutation({
    mutationFn: async () => {
      if (!preview) throw new Error('Missing preview');
      const activeHolds = holds.filter((hold) => hold.state === 'ACTIVE');
      const input = {
        intentId: preview.intentId,
        expectedIntentVersion:
          holdStatus?.intentVersion ?? intentQuery.data?.intent.version ?? preview.version,
        holds: activeHolds.map((hold) => ({ holdId: hold.holdId, expectedVersion: hold.version })),
        failurePolicy,
        reason: purpose.trim() || t('workplace.planner.defaultPurpose'),
        explicitConfirmation: true,
      };
      const mutationIntent = resolveIdempotentMutationIntent(batchIntentRef.current, input, () =>
        createWorkplaceIdempotencyKey('planner-batch')
      );
      batchIntentRef.current = mutationIntent;
      return startWorkplaceBookingBatch(input, mutationIntent.key);
    },
    retry: false,
    onSuccess: (result) => {
      setUncertainSubmission(false);
      setConfirmation(null);
      updateParams({ batch: result.batchId, step: 'RESULT' });
    },
    onError: () => {
      setConfirmation(null);
      setUncertainSubmission(true);
      intentQuery.refetch();
    },
  });
  const waitlistMutation = useMutation({
    mutationFn: async (item: WorkplaceBookingIntentItemInput) => {
      setCreatingWaitlistFor(item.clientItemKey);
      const input = {
        item,
        autoConfirm: false,
        conditions: {
          maximumDistanceMeters: parsedUrl.state.maximumDistanceMeters,
          earliestStart: item.startsAt,
          latestEnd: item.endsAt,
          pricingMode: 'NOT_APPLICABLE' as const,
          maximumPrice: null,
          currency: null,
        },
        notificationChannels: ['IN_APP', 'EMAIL'] as const,
        reason: t('workplace.planner.waitlist.defaultReason'),
      };
      const mutationIntent = resolveIdempotentMutationIntent(waitlistIntentRef.current, input, () =>
        createWorkplaceIdempotencyKey('planner-waitlist')
      );
      waitlistIntentRef.current = mutationIntent;
      return createWorkplaceWaitlistEntry(input, mutationIntent.key);
    },
    retry: false,
    onSuccess: async () => {
      setCreatingWaitlistFor(null);
      await waitlistsQuery.refetch();
      toast.success(t('workplace.planner.feedback.waitlistCreated'));
    },
    onError: () => {
      setCreatingWaitlistFor(null);
      toast.error(t('workplace.planner.feedback.waitlistError'));
    },
  });
  const compensationMutation = useMutation({
    mutationFn: async () => {
      const batch = batchQuery.data;
      if (!batch) throw new Error('Missing batch');
      const input = {
        expectedBatchVersion: batch.version,
        batchItemIds: batch.items
          .filter((item) => item.state === 'SUCCEEDED' && item.compensationAvailable)
          .map((item) => item.batchItemId),
        compensateAllSucceeded: false,
        reason: t('workplace.planner.result.compensationReason'),
        explicitConfirmation: true,
      };
      const mutationIntent = resolveIdempotentMutationIntent(
        compensationIntentRef.current,
        input,
        () => createWorkplaceIdempotencyKey('planner-compensate')
      );
      compensationIntentRef.current = mutationIntent;
      return compensateWorkplaceBookingBatch(batch.batchId, input, mutationIntent.key);
    },
    retry: false,
    onSuccess: (batch) => {
      setConfirmation(null);
      queryClient.setQueryData(
        ['workplace', 'planner', identityKey, 'batch', batch.batchId],
        batch
      );
    },
    onError: () => toast.error(t('workplace.planner.feedback.recoveryError')),
  });
  const replanMutation = useMutation({
    mutationFn: async () => {
      const batch = batchQuery.data;
      if (!batch) throw new Error('Missing batch');
      const input = {
        expectedBatchVersion: batch.version,
        batchItemIds: batch.items
          .filter((item) => item.state === 'FAILED')
          .map((item) => item.batchItemId),
        requestedHoldTtlSeconds: 120,
        allowAlternatives: true,
        reason: t('workplace.planner.result.replanReason'),
      };
      const mutationIntent = resolveIdempotentMutationIntent(replanIntentRef.current, input, () =>
        createWorkplaceIdempotencyKey('planner-replan')
      );
      replanIntentRef.current = mutationIntent;
      return replanWorkplaceBookingBatch(batch.batchId, input, mutationIntent.key);
    },
    retry: false,
    onSuccess: (result) => {
      setPreviewSnapshot(result);
      setHoldSnapshot(null);
      updateParams({ intent: result.intentId, batch: null, step: 'REVIEW' });
    },
    onError: () => toast.error(t('workplace.planner.feedback.recoveryError')),
  });
  const offerMutation = useMutation({
    mutationFn: async ({
      offerId,
      expectedOfferVersion,
    }: {
      offerId: string;
      expectedOfferVersion: number;
    }) => {
      setAcceptingOfferId(offerId);
      const input = {
        expectedOfferVersion,
        failurePolicy,
        reason: t('workplace.planner.waitlist.offerReason'),
        explicitConfirmation: true,
      };
      const mutationIntent = resolveIdempotentMutationIntent(offerIntentRef.current, input, () =>
        createWorkplaceIdempotencyKey('planner-offer')
      );
      offerIntentRef.current = mutationIntent;
      return acceptWorkplaceAlternativeOffer(offerId, input, mutationIntent.key);
    },
    retry: false,
    onSuccess: (result) => {
      setAcceptingOfferId(null);
      updateParams({ batch: result.batchId, step: 'RESULT' });
    },
    onError: () => {
      setAcceptingOfferId(null);
      toast.error(t('workplace.planner.feedback.offerError'));
    },
  });
  const waitlistUpdateMutation = useMutation({
    mutationFn: async (entry: NonNullable<typeof waitlistsQuery.data>['content'][number]) => {
      setUpdatingWaitlistId(entry.waitlistEntryId);
      const input = {
        expectedVersion: entry.version,
        autoConfirm: !entry.autoConfirm,
        conditions: entry.conditions,
        notificationChannels: entry.notificationChannels,
        reason: t('workplace.planner.waitlist.updateReason'),
      };
      const mutationIntent = resolveIdempotentMutationIntent(
        waitlistUpdateIntentRef.current,
        input,
        () => createWorkplaceIdempotencyKey('planner-waitlist-update')
      );
      waitlistUpdateIntentRef.current = mutationIntent;
      return updateWorkplaceWaitlistEntry(entry.waitlistEntryId, input, mutationIntent.key);
    },
    retry: false,
    onSuccess: async () => {
      setUpdatingWaitlistId(null);
      await waitlistsQuery.refetch();
    },
    onError: () => {
      setUpdatingWaitlistId(null);
      toast.error(t('workplace.planner.feedback.waitlistError'));
    },
  });
  const waitlistCancelMutation = useMutation({
    mutationFn: async (entry: WorkplaceWaitlistEntry) => {
      setCancellingWaitlistId(entry.waitlistEntryId);
      const input = {
        expectedVersion: entry.version,
        reason: t('workplace.planner.waitlist.cancelReason'),
        explicitConfirmation: true,
      };
      const mutationIntent = resolveIdempotentMutationIntent(
        waitlistCancelIntentRef.current,
        { waitlistEntryId: entry.waitlistEntryId, ...input },
        () => createWorkplaceIdempotencyKey('planner-waitlist-cancel')
      );
      waitlistCancelIntentRef.current = mutationIntent;
      return cancelWorkplaceWaitlistEntry(entry.waitlistEntryId, input, mutationIntent.key);
    },
    retry: false,
    onSuccess: async () => {
      setCancellingWaitlistId(null);
      setWaitlistToCancel(null);
      await waitlistsQuery.refetch();
      toast.success(t('workplace.planner.feedback.waitlistCancelled'));
    },
    onError: () => {
      setCancellingWaitlistId(null);
      toast.error(t('workplace.planner.feedback.waitlistCancelError'));
    },
  });

  const resetPlan = () => {
    setPreviewSnapshot(null);
    setHoldSnapshot(null);
    setUncertainSubmission(false);
    setSelections({});
    updateParams({ intent: null, batch: null, item: null, step: 'PLAN' });
  };
  const refreshRecovery = async () => {
    if (parsedUrl.state.batchId) await batchQuery.refetch();
    else if (parsedUrl.state.intentId) await intentQuery.refetch();
  };

  if (capabilities.isLoaded && !capabilities.canViewWorkplace) {
    return (
      <PageCanvas topInset="compact">
        <Box data-testid="workplace-weekly-planner">
          <RoomsPageHeading
            eyebrow={t('workplace.planner.eyebrow')}
            title={t('workplace.planner.title')}
            description={t('workplace.planner.description')}
          />
          <RoomsPermissionNotice>{t('permissions.workplaceView')}</RoomsPermissionNotice>
        </Box>
      </PageCanvas>
    );
  }

  return (
    <PageCanvas topInset="compact">
      <Box data-testid="workplace-weekly-planner" sx={{ display: 'contents' }}>
        <RoomsPageHeading
          eyebrow={t('workplace.planner.eyebrow')}
          title={t('workplace.planner.title')}
          description={t('workplace.planner.description')}
          actions={
            <ActionButton
              intent="quiet"
              onClick={() => Promise.all([beneficiariesQuery.refetch(), catalogQuery.refetch()])}
            >
              {t('actions.refresh')}
            </ActionButton>
          }
        />

        <Box sx={(theme) => ({ ...workplaceMemberCard(theme), p: 1.5, mb: 2 })}>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ sm: 'center' }}>
            <Typography component="p" variant="subtitle2">
              {t('workplace.planner.progress.label')}
            </Typography>
            {(['PLAN', 'REVIEW', 'RESULT'] as const).map((step) => (
              <Chip
                key={step}
                size="small"
                color={parsedUrl.state.step === step ? 'primary' : 'default'}
                label={t(`workplace.planner.steps.${step}`)}
                sx={
                  parsedUrl.state.step === step
                    ? { backgroundColor: 'primary.dark', color: 'primary.contrastText' }
                    : undefined
                }
              />
            ))}
            <Chip
              size="small"
              color={
                sourceReady ? 'success' : plannerSourceState === 'LOADING' ? 'default' : 'warning'
              }
              label={t(`workplace.planner.sourceStates.${plannerSourceState}`)}
              sx={{ ml: { sm: 'auto' } }}
            />
          </Stack>
        </Box>

        {uncertainSubmission && (
          <Box data-testid="workplace-planner-submit-uncertain">
            <InlineFeedback
              severity="warning"
              action={
                <ActionButton intent="quiet" size="small" onClick={refreshRecovery}>
                  {t('workplace.planner.actions.queryStatus')}
                </ActionButton>
              }
              sx={{ mb: 2 }}
            >
              {t('workplace.planner.result.unknownDescription')}
            </InlineFeedback>
          </Box>
        )}

        {parsedUrl.state.step === 'PLAN' || !preview ? (
          <WorkplacePlannerConfiguration
            state={parsedUrl.state}
            beneficiaries={authorizedBeneficiaries}
            catalog={catalogQuery.data ?? null}
            sourceState={plannerSourceState}
            canCreate={capabilities.canCreateWorkplaceBooking}
            purpose={purpose}
            accessibleOnly={accessibleOnly}
            buildError={builtItems.ok ? null : builtItems.code}
            actorDisplayName={
              auth.user?.displayName ?? t('workplace.planner.configuration.unknownActor')
            }
            onState={(patch) => {
              resetPlan();
              updateParams(patch);
            }}
            onPurpose={setPurpose}
            onAccessibleOnly={setAccessibleOnly}
            onPreview={() => builtItems.ok && previewMutation.mutate(builtItems.items)}
            previewPending={previewMutation.isPending}
            onRetry={() => Promise.all([beneficiariesQuery.refetch(), catalogQuery.refetch()])}
          />
        ) : parsedUrl.state.step === 'REVIEW' ? (
          <WorkplacePlannerReview
            preview={preview}
            inputs={builtItems.ok ? builtItems.items : []}
            selections={selections}
            holds={holds}
            holdSecondsRemaining={holdSecondsRemaining}
            failurePolicy={failurePolicy}
            sourceReady={sourceReady}
            acquiringHold={holdMutation.isPending}
            confirming={batchMutation.isPending}
            creatingWaitlistFor={creatingWaitlistFor}
            actorDisplayName={
              auth.user?.displayName ?? t('workplace.planner.configuration.unknownActor')
            }
            onSelect={(intentItemId, resourceId) =>
              setSelections((current) => ({ ...current, [intentItemId]: resourceId }))
            }
            onAcquireHold={() => holdMutation.mutate()}
            onFailurePolicy={setFailurePolicy}
            onConfirm={() => setConfirmation('BATCH')}
            onWaitlist={(item) => waitlistMutation.mutate(item)}
            onEdit={resetPlan}
            onRefresh={() => {
              previewIntentRef.current = null;
              if (builtItems.ok) previewMutation.mutate(builtItems.items);
            }}
          />
        ) : (
          <WorkplacePlannerResult
            batch={batchQuery.data ?? null}
            constraints={preview?.teamPlacementConstraints ?? []}
            constraintEvidence={preview?.placementConstraintEvidence ?? []}
            waitlists={waitlistsQuery.data?.content ?? []}
            catalog={catalogQuery.data ?? null}
            loading={batchQuery.isFetching || intentQuery.isFetching}
            sourceReady={sourceReady}
            compensating={compensationMutation.isPending}
            replanning={replanMutation.isPending}
            onRefresh={refreshRecovery}
            onCompensate={() => setConfirmation('COMPENSATE')}
            onReplan={() => replanMutation.mutate()}
            acceptingOfferId={acceptingOfferId}
            cancellingWaitlistId={cancellingWaitlistId}
            onAcceptOffer={(offerId, expectedOfferVersion) =>
              offerMutation.mutate({ offerId, expectedOfferVersion })
            }
            onLeaveWaitlist={setWaitlistToCancel}
            waitlistServerTime={waitlistsQuery.data?.generatedAt ?? ''}
            waitlistServerAnchorMs={waitlistsQuery.dataUpdatedAt}
            timeZone={parsedUrl.state.timeZone}
            onRefreshWaitlists={refreshWaitlists}
            onNewPlan={resetPlan}
          />
        )}

        {parsedUrl.state.step !== 'RESULT' && (
          <WorkplacePlannerWaitlists
            entries={waitlistsQuery.data?.content ?? []}
            catalog={catalogQuery.data ?? null}
            sourceReady={sourceReady}
            timeZone={parsedUrl.state.timeZone}
            serverTime={waitlistsQuery.data?.generatedAt ?? ''}
            serverAnchorMs={waitlistsQuery.dataUpdatedAt}
            updatingId={updatingWaitlistId}
            cancellingId={cancellingWaitlistId}
            acceptingOfferId={acceptingOfferId}
            onToggleAutoConfirm={(entry) => waitlistUpdateMutation.mutate(entry)}
            onLeave={setWaitlistToCancel}
            onAcceptOffer={(offerId, expectedOfferVersion) =>
              offerMutation.mutate({ offerId, expectedOfferVersion })
            }
            onRefresh={refreshWaitlists}
          />
        )}

        <ConfirmDialog
          open={confirmation !== null}
          title={t(
            confirmation === 'COMPENSATE'
              ? 'workplace.planner.confirm.compensateTitle'
              : 'workplace.planner.confirm.batchTitle'
          )}
          description={t(
            confirmation === 'COMPENSATE'
              ? 'workplace.planner.confirm.compensateDescription'
              : 'workplace.planner.confirm.batchDescription'
          )}
          cancelLabel={t('actions.cancel')}
          confirmLabel={t(
            confirmation === 'COMPENSATE'
              ? 'workplace.planner.actions.compensate'
              : 'workplace.planner.actions.confirmNow'
          )}
          confirmingLabel={t('actions.saving')}
          intent={confirmation === 'COMPENSATE' ? 'danger' : 'primary'}
          busy={batchMutation.isPending || compensationMutation.isPending}
          focusCancelAfterOpen
          minimumActionHeight={44}
          onClose={() => setConfirmation(null)}
          onConfirm={() => {
            if (confirmation === 'COMPENSATE') compensationMutation.mutate();
            else batchMutation.mutate();
          }}
        />
        <ConfirmDialog
          open={waitlistToCancel !== null}
          title={t('workplace.planner.confirm.leaveTitle')}
          description={t('workplace.planner.confirm.leaveDescription')}
          cancelLabel={t('actions.cancel')}
          confirmLabel={t('workplace.planner.actions.leaveWaitlist')}
          confirmingLabel={t('actions.saving')}
          intent="danger"
          busy={waitlistCancelMutation.isPending}
          focusCancelAfterOpen
          minimumActionHeight={44}
          onClose={() => setWaitlistToCancel(null)}
          onConfirm={() => {
            if (waitlistToCancel) waitlistCancelMutation.mutate(waitlistToCancel);
          }}
        />
      </Box>
    </PageCanvas>
  );
}
