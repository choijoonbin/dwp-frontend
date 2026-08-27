import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  recordHomeRecommendationFeedback,
  useToast,
  type HomeOverview,
  type HomeRecommendation,
} from '@dwp-frontend/shared-utils';

type HiddenRecommendation = Readonly<{ recommendation: HomeRecommendation; index: number }>;

/** Optimistically hides and restores recommendations across Classic and Flow Home. */
export function useHomeRecommendationFeedback(queryKey: readonly unknown[]) {
  const { t } = useTranslation('home');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [hidden, setHidden] = useState<HiddenRecommendation | null>(null);
  const dismissMutation = useMutation({
    mutationFn: (recommendation: HomeRecommendation) =>
      recordHomeRecommendationFeedback(recommendation.key, 'NOT_RELEVANT'),
    onSuccess: async (_, recommendation) => {
      const current = queryClient.getQueryData<HomeOverview>(queryKey);
      const index = Math.max(
        0,
        current?.recommendations.data?.findIndex(
          (candidate) => candidate.key === recommendation.key
        ) ?? 0
      );
      setHidden({ recommendation, index });
      queryClient.setQueryData<HomeOverview | undefined>(queryKey, (value) =>
        value
          ? {
              ...value,
              recommendations: {
                ...value.recommendations,
                data: (value.recommendations.data ?? []).filter(
                  (candidate) => candidate.key !== recommendation.key
                ),
              },
            }
          : value
      );
      await queryClient.invalidateQueries({ queryKey: ['admin', 'audit-events'] });
    },
    onError: () => toast.error(t('page.recommendationFeedbackError')),
  });
  const undoMutation = useMutation({
    mutationFn: ({ recommendation }: HiddenRecommendation) =>
      recordHomeRecommendationFeedback(recommendation.key, 'HELPFUL'),
    onSuccess: async (_, restored) => {
      queryClient.setQueryData<HomeOverview | undefined>(queryKey, (value) => {
        if (!value) return value;
        const recommendations = value.recommendations.data ?? [];
        if (recommendations.some((candidate) => candidate.key === restored.recommendation.key)) {
          return value;
        }
        const next = [...recommendations];
        next.splice(Math.min(restored.index, next.length), 0, restored.recommendation);
        return { ...value, recommendations: { ...value.recommendations, data: next } };
      });
      setHidden(null);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'audit-events'] });
      toast.success(t('page.recommendationRestored'));
    },
    onError: () => toast.error(t('page.recommendationFeedbackError')),
  });
  return {
    hidden,
    busy: dismissMutation.isPending || undoMutation.isPending,
    undoBusy: undoMutation.isPending,
    dismiss: (recommendation: HomeRecommendation) => dismissMutation.mutate(recommendation),
    undo: () => hidden && undoMutation.mutate(hidden),
    clear: () => setHidden(null),
  };
}
