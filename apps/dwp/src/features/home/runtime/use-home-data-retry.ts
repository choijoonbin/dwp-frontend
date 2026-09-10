import { useCallback, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';

type HomeDataRetrySource = () => Promise<unknown>;

export async function retryHomeDataSources(sources: readonly HomeDataRetrySource[]): Promise<void> {
  const results = await Promise.allSettled(sources.map((retry) => Promise.resolve().then(retry)));
  const failures = results.flatMap((result) =>
    result.status === 'rejected' ? [result.reason] : []
  );

  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) {
    throw new AggregateError(failures, 'Multiple home data sources failed to retry.');
  }
}

export function useHomeDataRetry(
  scope: readonly unknown[],
  sources: readonly HomeDataRetrySource[]
): Readonly<{ retry: () => void; retrying: boolean }> {
  const retryInFlightRef = useRef(false);
  const { isPending, mutate } = useMutation({
    mutationKey: ['home-data-retry', ...scope],
    mutationFn: () => retryHomeDataSources(sources),
    onSettled: () => {
      retryInFlightRef.current = false;
    },
  });
  const retry = useCallback(() => {
    if (retryInFlightRef.current) return;
    retryInFlightRef.current = true;
    mutate();
  }, [mutate]);

  return { retry, retrying: isPending };
}
