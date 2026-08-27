import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { createPlaneCachePurger } from './query-cache-plane-boundary';

describe('identity-plane query cache transition', () => {
  it('retains only entries selected by the injected owning-plane predicate', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(['provider', 'estate'], { retained: true });
    queryClient.setQueryData(['tenant', 'branding'], { retained: false });
    const purge = createPlaneCachePurger((query) => query.queryKey[0] === 'provider');

    await purge(queryClient);

    expect(queryClient.getQueryData(['provider', 'estate'])).toEqual({ retained: true });
    expect(queryClient.getQueryData(['tenant', 'branding'])).toBeUndefined();
  });
});
