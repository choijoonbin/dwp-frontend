import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useProductActionMutation } from '../../../../components/use-product-action-mutation';
import { useProductSurfaceRequestScope } from '../../../../components/use-product-surface-request-scope';
import { hrisTimeDataSource } from '../api/hris-time-api';
import {
  classifyTimeCommandFailure,
  hrisTimeQueryKey,
  resolveTimeCalendarPeriod,
  resolveTimeDateCommandState,
  selectTimeWorkspaceDisplay,
  timeCardCanSubmit,
} from '../model/hris-time-model';

import type { HrisTimeDataSource } from '../api/hris-time-api';
import type {
  TimeCommandFailure,
  TimeEntryDisplay,
  TimeWorkMode,
  TimeWorkspaceDisplay,
} from '../model/hris-time-model';
import type { ProductSurfaceRequestScope } from '../../../../components/use-product-surface-request-scope';

export type TimeEntryDraft = Readonly<{
  date: string;
  minutes: number;
  workMode: TimeWorkMode;
  note: string;
  baseVersion: number;
}>;

export type HrisTimeRuntimeOptions = Readonly<{
  requestScope: ProductSurfaceRequestScope;
  dataSource?: HrisTimeDataSource;
  connectedScheduleDateValues?: readonly string[];
}>;

type TimeScopeVisit = Readonly<{
  identity: string;
  generation: number;
}>;

type TimeMutationBoundary = Readonly<{
  scopeIdentity: string;
  scopeGeneration: number;
  settlementGeneration: number;
  cacheKey: ProductSurfaceRequestScope['cacheKey'];
}>;

type SaveEntryMutationInput = TimeMutationBoundary &
  Readonly<{
    cardId: string;
    draft: TimeEntryDraft;
  }>;

type SubmitCardMutationInput = TimeMutationBoundary &
  Readonly<{
    cardId: string;
    version: number;
  }>;

function supersededTimeRead(): never {
  const error = new Error('Time read was superseded.');
  error.name = 'AbortError';
  throw error;
}

function mutationMatchesCurrentVisit(
  input: TimeMutationBoundary,
  currentVisit: TimeScopeVisit,
  settlementGeneration: number
) {
  return (
    currentVisit.identity === input.scopeIdentity &&
    currentVisit.generation === input.scopeGeneration &&
    settlementGeneration === input.settlementGeneration
  );
}

export function useHrisTimeRequestScope() {
  return useProductSurfaceRequestScope({
    productKey: 'hcm',
    surfaceKey: 'hcm.personal',
  });
}

export function useHrisTimeRuntime({
  requestScope,
  dataSource = hrisTimeDataSource,
  connectedScheduleDateValues,
}: HrisTimeRuntimeOptions) {
  const queryClient = useQueryClient();
  const updateEntry = useProductActionMutation('route.hcm.personal.time-entry-update.action');
  const submitCard = useProductActionMutation('route.hcm.personal.time-submit.action');
  const queryKey = hrisTimeQueryKey(requestScope);
  const scopeIdentity = JSON.stringify(requestScope.cacheKey);
  const scopeVisitRef = useRef<TimeScopeVisit>({ identity: scopeIdentity, generation: 0 });
  const settlementGenerationRef = useRef(0);
  const mountedRef = useRef(true);
  const previousScopeIdentity = useRef(scopeIdentity);
  const [draft, setDraft] = useState<TimeEntryDraft | null>(null);
  const [saveFailure, setSaveFailure] = useState<TimeCommandFailure | null>(null);
  const [submitFailure, setSubmitFailure] = useState<TimeCommandFailure | null>(null);
  const [saveRefreshed, setSaveRefreshed] = useState(false);
  const [submitRefreshed, setSubmitRefreshed] = useState(false);
  const [feedback, setFeedback] = useState<'saved' | 'submitted' | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useLayoutEffect(() => {
    const current = scopeVisitRef.current;
    if (current.identity === scopeIdentity) return;
    scopeVisitRef.current = {
      identity: scopeIdentity,
      generation: current.generation + 1,
    };
    settlementGenerationRef.current += 1;
  }, [scopeIdentity]);

  useEffect(() => {
    if (previousScopeIdentity.current === scopeIdentity) return;
    previousScopeIdentity.current = scopeIdentity;
    setDraft(null);
    setSaveFailure(null);
    setSubmitFailure(null);
    setSaveRefreshed(false);
    setSubmitRefreshed(false);
    setFeedback(null);
  }, [scopeIdentity]);

  const query = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const requestVisit = scopeVisitRef.current;
      const requestSettlementGeneration = settlementGenerationRef.current;
      const display = selectTimeWorkspaceDisplay(
        await dataSource.read(requestScope.contextScopeKey, signal)
      );
      if (
        scopeVisitRef.current !== requestVisit ||
        settlementGenerationRef.current !== requestSettlementGeneration
      ) {
        return queryClient.getQueryData<TimeWorkspaceDisplay>(queryKey) ?? supersededTimeRead();
      }
      return display;
    },
    enabled: requestScope.ready,
    meta: requestScope.queryMeta,
    staleTime: 20_000,
  });

  const saveMutation = useMutation({
    mutationFn: async (input: SaveEntryMutationInput) => {
      if (
        !mutationMatchesCurrentVisit(input, scopeVisitRef.current, settlementGenerationRef.current)
      ) {
        throw new Error('Time entry request scope changed.');
      }
      return selectTimeWorkspaceDisplay(
        await updateEntry((authority) =>
          dataSource.saveEntry(
            input.cardId,
            input.draft.date,
            {
              minutes: input.draft.minutes,
              workMode: input.draft.workMode,
              note: input.draft.note.trim() || undefined,
              cardVersion: input.draft.baseVersion,
            },
            authority
          )
        )
      );
    },
    onSuccess: (display, input) => {
      if (
        !mountedRef.current ||
        !mutationMatchesCurrentVisit(input, scopeVisitRef.current, settlementGenerationRef.current)
      ) {
        return;
      }
      settlementGenerationRef.current += 1;
      const mutationQueryKey = hrisTimeQueryKey({ cacheKey: input.cacheKey });
      void queryClient.cancelQueries({ queryKey: mutationQueryKey, exact: true });
      queryClient.setQueryData(mutationQueryKey, display);
      void queryClient.invalidateQueries({ queryKey: ['hcm', 'home-overview'] });
      setDraft(null);
      setSaveFailure(null);
      setSaveRefreshed(false);
      setFeedback('saved');
    },
    onError: (error, input) => {
      if (
        !mountedRef.current ||
        !mutationMatchesCurrentVisit(input, scopeVisitRef.current, settlementGenerationRef.current)
      ) {
        return;
      }
      setSaveFailure(classifyTimeCommandFailure(error));
      setSaveRefreshed(false);
      setFeedback(null);
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (input: SubmitCardMutationInput) => {
      if (
        !mutationMatchesCurrentVisit(input, scopeVisitRef.current, settlementGenerationRef.current)
      ) {
        throw new Error('Time-card request scope changed.');
      }
      return selectTimeWorkspaceDisplay(
        await submitCard((authority) =>
          dataSource.submitCard(input.cardId, input.version, authority)
        )
      );
    },
    onSuccess: (display, input) => {
      if (
        !mountedRef.current ||
        !mutationMatchesCurrentVisit(input, scopeVisitRef.current, settlementGenerationRef.current)
      ) {
        return;
      }
      settlementGenerationRef.current += 1;
      const mutationQueryKey = hrisTimeQueryKey({ cacheKey: input.cacheKey });
      void queryClient.cancelQueries({ queryKey: mutationQueryKey, exact: true });
      queryClient.setQueryData(mutationQueryKey, display);
      void queryClient.invalidateQueries({ queryKey: ['hcm', 'home-overview'] });
      setSubmitFailure(null);
      setSubmitRefreshed(false);
      setFeedback('submitted');
    },
    onError: (error, input) => {
      if (
        !mountedRef.current ||
        !mutationMatchesCurrentVisit(input, scopeVisitRef.current, settlementGenerationRef.current)
      ) {
        return;
      }
      setSubmitFailure(classifyTimeCommandFailure(error));
      setSubmitRefreshed(false);
      setFeedback(null);
    },
  });

  const card = query.data?.card ?? null;
  const entries = query.data?.entries ?? [];
  const exceptions = query.data?.exceptions ?? [];
  const period = card
    ? resolveTimeCalendarPeriod(card.periodStart, card.periodEnd)
    : { state: 'INVALID' as const, dates: [] };
  const connectedScheduleDates = useMemo(
    () => (connectedScheduleDateValues ? new Set(connectedScheduleDateValues) : undefined),
    [connectedScheduleDateValues]
  );

  const openEditor = (date: string, entry?: TimeEntryDisplay) => {
    if (!card) return;
    const command = resolveTimeDateCommandState({
      card,
      date,
      entry,
      period,
      connectedScheduleDates,
    });
    if (!command.editable) return;
    setDraft({
      date,
      minutes: entry?.minutes ?? 480,
      workMode: entry?.workMode ?? 'HYBRID',
      note: entry?.note ?? '',
      baseVersion: card.version,
    });
    setSaveFailure(null);
    setSaveRefreshed(false);
    setFeedback(null);
  };

  const saveBlocked = Boolean(saveFailure && !saveFailure.retryAllowed);
  const submitBlocked = Boolean(submitFailure && !submitFailure.retryAllowed);

  const save = () => {
    if (
      !draft ||
      !card ||
      !Number.isSafeInteger(draft.minutes) ||
      draft.minutes < 1 ||
      draft.minutes > 1_440 ||
      draft.baseVersion !== card.version ||
      saveFailure?.requiresRefresh ||
      saveBlocked
    ) {
      return;
    }
    const scopeVisit = scopeVisitRef.current;
    settlementGenerationRef.current += 1;
    const settlementGeneration = settlementGenerationRef.current;
    void queryClient.cancelQueries({ queryKey, exact: true });
    saveMutation.mutate({
      cardId: card.timeCardId,
      draft,
      scopeIdentity: scopeVisit.identity,
      scopeGeneration: scopeVisit.generation,
      settlementGeneration,
      cacheKey: requestScope.cacheKey,
    });
  };

  const submit = () => {
    if (!card || !timeCardCanSubmit(card) || submitFailure?.requiresRefresh || submitBlocked) {
      return;
    }
    const scopeVisit = scopeVisitRef.current;
    settlementGenerationRef.current += 1;
    const settlementGeneration = settlementGenerationRef.current;
    void queryClient.cancelQueries({ queryKey, exact: true });
    submitMutation.mutate({
      cardId: card.timeCardId,
      version: card.version,
      scopeIdentity: scopeVisit.identity,
      scopeGeneration: scopeVisit.generation,
      settlementGeneration,
      cacheKey: requestScope.cacheKey,
    });
  };

  const refreshSave = async () => {
    const refreshVisit = scopeVisitRef.current;
    const refreshSettlementGeneration = settlementGenerationRef.current;
    const result = await query.refetch();
    if (
      !mountedRef.current ||
      scopeVisitRef.current !== refreshVisit ||
      settlementGenerationRef.current !== refreshSettlementGeneration
    ) {
      return;
    }
    setSaveRefreshed(result.isSuccess);
  };

  const refreshSubmit = async () => {
    const refreshVisit = scopeVisitRef.current;
    const refreshSettlementGeneration = settlementGenerationRef.current;
    const result = await query.refetch();
    if (
      !mountedRef.current ||
      scopeVisitRef.current !== refreshVisit ||
      settlementGenerationRef.current !== refreshSettlementGeneration
    ) {
      return;
    }
    setSubmitRefreshed(result.isSuccess);
  };

  const reviewLatestDraft = () => {
    if (!draft || !query.data?.card) return;
    setDraft({ ...draft, baseVersion: query.data.card.version });
    setSaveFailure(null);
    setSaveRefreshed(false);
  };

  const reviewLatestSubmit = () => {
    setSubmitFailure(null);
    setSubmitRefreshed(false);
  };

  const closeEditor = () => {
    setDraft(null);
    setSaveFailure(null);
    setSaveRefreshed(false);
  };

  return {
    ready: requestScope.ready,
    loading: !requestScope.ready || query.isLoading,
    error: query.error,
    isFetching: query.isFetching,
    retry: () => query.refetch(),
    card,
    entries,
    exceptions,
    period,
    connectedScheduleDates,
    feedback,
    draft,
    saveFailure,
    submitFailure,
    saveRefreshed,
    submitRefreshed,
    isSaving: saveMutation.isPending,
    isSubmitting: submitMutation.isPending,
    saveBlocked,
    submitBlocked,
    openEditor,
    setDraft,
    closeEditor,
    save,
    submit,
    refreshSave,
    refreshSubmit,
    reviewLatestDraft,
    reviewLatestSubmit,
  };
}
