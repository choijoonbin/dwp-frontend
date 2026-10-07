import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@dwp-frontend/shared-utils';

import { resolveHcmQueryFailure } from '../../../../components/hcm-query-state-model';
import { useProductActionMutation } from '../../../../components/use-product-action-mutation';
import { useProductSurfaceRequestScope } from '../../../../components/use-product-surface-request-scope';
import {
  getScopedPerformanceTalent,
  updateScopedPerformanceGoal,
} from '../api/performance-talent-api';
import {
  buildPerformanceGoalUpdate,
  classifyPerformanceGoalSaveFailure,
  createPerformanceGoalDraft,
  isPerformanceGoalEditable,
  rebasePerformanceGoalDraft,
  selectPerformancePersonalGoals,
  validatePerformanceGoalDraft,
  withDeclaredPerformanceProvenance,
  withPerformanceGoalSaveFailure,
} from '../model/performance-goal-model';

import type {
  PerformanceDataProvenance,
  PerformanceGoalDraft,
  PerformanceGoalUpdate,
  PerformancePersonalGoals,
} from '../model/performance-goal-model';
import type { ProductSurfaceRequestScope } from '../../../../components/use-product-surface-request-scope';

type PerformanceScopeVisit = Readonly<{
  identity: string;
  generation: number;
}>;

type PerformanceGoalMutationInput = Readonly<{
  update: PerformanceGoalUpdate;
  scopeIdentity: string;
  scopeGeneration: number;
  settlementGeneration: number;
  cacheKey: ProductSurfaceRequestScope['cacheKey'];
}>;

function supersededPerformanceRead(): never {
  const error = new Error('Performance read was superseded.');
  error.name = 'AbortError';
  throw error;
}

export function useHrisPerformanceWorkspace(dataProvenance?: PerformanceDataProvenance) {
  const { t } = useTranslation('hcm');
  const toast = useToast();
  const queryClient = useQueryClient();
  const updateGoal = useProductActionMutation('route.hcm.personal.talent-goal-update.action');
  const requestScope = useProductSurfaceRequestScope({
    productKey: 'hcm',
    surfaceKey: 'hcm.personal',
  });
  const scopeIdentity = JSON.stringify(requestScope.cacheKey);
  const scopeVisitRef = useRef<PerformanceScopeVisit>({
    identity: scopeIdentity,
    generation: 0,
  });
  const settlementGenerationRef = useRef(0);
  const mountedRef = useRef(true);
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
  const previousScopeIdentity = useRef(scopeIdentity);
  const talentQueryKey = ['hcm', 'talent', 'personal-goals-v2', ...requestScope.cacheKey] as const;
  const query = useQuery({
    queryKey: talentQueryKey,
    queryFn: async ({ signal }) => {
      const requestVisit = scopeVisitRef.current;
      const requestSettlementGeneration = settlementGenerationRef.current;
      const workspace = selectPerformancePersonalGoals(
        await getScopedPerformanceTalent(requestScope.contextScopeKey, signal)
      );
      if (
        scopeVisitRef.current !== requestVisit ||
        settlementGenerationRef.current !== requestSettlementGeneration
      ) {
        return (
          queryClient.getQueryData<PerformancePersonalGoals>(talentQueryKey) ??
          supersededPerformanceRead()
        );
      }
      return workspace;
    },
    enabled: requestScope.ready,
    meta: requestScope.queryMeta,
    staleTime: 30_000,
  });
  const [draft, setDraft] = useState<PerformanceGoalDraft | null>(null);

  const mutation = useMutation({
    mutationFn: async (input: PerformanceGoalMutationInput) => {
      const currentVisit = scopeVisitRef.current;
      if (
        currentVisit.identity !== input.scopeIdentity ||
        currentVisit.generation !== input.scopeGeneration ||
        settlementGenerationRef.current !== input.settlementGeneration
      ) {
        throw new Error('Performance goal request scope changed.');
      }
      return selectPerformancePersonalGoals(
        await updateGoal((authority) =>
          updateScopedPerformanceGoal(input.update.goalId, input.update.request, authority)
        )
      );
    },
    onSuccess: (workspace, input) => {
      const currentVisit = scopeVisitRef.current;
      if (
        !mountedRef.current ||
        currentVisit.identity !== input.scopeIdentity ||
        currentVisit.generation !== input.scopeGeneration ||
        settlementGenerationRef.current !== input.settlementGeneration
      )
        return;
      settlementGenerationRef.current += 1;
      void queryClient.cancelQueries({
        queryKey: ['hcm', 'talent', 'personal-goals-v2', ...input.cacheKey],
        exact: true,
      });
      queryClient.setQueryData(
        ['hcm', 'talent', 'personal-goals-v2', ...input.cacheKey],
        workspace
      );
      void queryClient.invalidateQueries({ queryKey: ['hcm', 'home-overview'] });
      setDraft(null);
      toast.success(t('domains.talent.saved'));
    },
    onError: (error, input) => {
      const currentVisit = scopeVisitRef.current;
      if (
        !mountedRef.current ||
        currentVisit.identity !== input.scopeIdentity ||
        currentVisit.generation !== input.scopeGeneration ||
        settlementGenerationRef.current !== input.settlementGeneration
      )
        return;
      const failure = classifyPerformanceGoalSaveFailure(error);
      setDraft((current) => (current ? withPerformanceGoalSaveFailure(current, failure) : current));
      toast.error(t('domains.talent.saveError'));
    },
  });

  useEffect(() => {
    if (previousScopeIdentity.current === scopeIdentity) return;
    previousScopeIdentity.current = scopeIdentity;
    setDraft(null);
  }, [scopeIdentity]);

  const failure = resolveHcmQueryFailure(query.error);
  const blocksCachedData =
    failure?.kind === 'permission' ||
    failure?.kind === 'not-found' ||
    failure?.kind === 'context-changed';
  const blockingError = query.error && (!query.data || blocksCachedData) ? query.error : null;

  const personalGoals = useMemo(
    () => (query.data ? withDeclaredPerformanceProvenance(query.data, dataProvenance) : null),
    [dataProvenance, query.data]
  );
  const validation = draft ? validatePerformanceGoalDraft(draft) : 'UNCHANGED';
  const mayLoadLatest = draft?.saveFailure === 'CONFLICT' || draft?.saveFailure === 'NOT_FOUND';

  const openGoal = (goalId: string) => {
    const goal = personalGoals?.goals.find((item) => item.goalId === goalId);
    if (!goal || !isPerformanceGoalEditable(goal)) return;
    mutation.reset();
    setDraft(createPerformanceGoalDraft(goal));
  };

  const saveDraft = () => {
    if (!draft) return;
    const update = buildPerformanceGoalUpdate(draft);
    if (update) {
      const scopeVisit = scopeVisitRef.current;
      settlementGenerationRef.current += 1;
      const settlementGeneration = settlementGenerationRef.current;
      void queryClient.cancelQueries({ queryKey: talentQueryKey, exact: true });
      mutation.mutate({
        update,
        scopeIdentity: scopeVisit.identity,
        scopeGeneration: scopeVisit.generation,
        settlementGeneration,
        cacheKey: requestScope.cacheKey,
      });
    }
  };

  const loadLatest = async () => {
    const loadVisit = scopeVisitRef.current;
    const loadSettlementGeneration = settlementGenerationRef.current;
    const result = await query.refetch();
    if (
      !mountedRef.current ||
      !result.isSuccess ||
      !result.data ||
      scopeVisitRef.current !== loadVisit ||
      settlementGenerationRef.current !== loadSettlementGeneration
    )
      return;
    setDraft((current) =>
      current
        ? rebasePerformanceGoalDraft(
            current,
            result.data.goals.find((goal) => goal.goalId === current.goalId)
          )
        : current
    );
  };

  const requestLoading = !requestScope.ready || query.isLoading;

  return {
    ready: requestScope.ready,
    requestLoading,
    blockingError,
    personalGoals,
    error: query.error,
    isFetching: query.isFetching,
    refetch: () => query.refetch(),
    draft,
    setDraft,
    isSaving: mutation.isPending,
    validation,
    mayLoadLatest,
    openGoal,
    saveDraft,
    loadLatest,
  };
}
