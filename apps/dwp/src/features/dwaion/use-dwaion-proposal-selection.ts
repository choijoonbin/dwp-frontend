import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SetURLSearchParams } from 'react-router-dom';
import { getDwaionProposals, type DwaionProposal } from '@dwp-frontend/shared-utils';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const selectionKey = (id: string | null) => ['dwaion', 'proposals', 'selection', id] as const;

// The public contract exposes a scoped, paginated inbox, not a get-by-id endpoint.
// Search that inbox without substituting an unrelated item or sending body text in a URL.
async function findProposal(id: string): Promise<DwaionProposal | null> {
  const cursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await getDwaionProposals('ALL', 100, cursor);
    const proposal = page.items.find((item) => item.proposalId.toLowerCase() === id);
    if (proposal) return proposal;
    if (!page.nextCursor) return null;
    if (cursors.has(page.nextCursor)) throw new Error('Proposal inbox cursor did not advance.');
    cursors.add(page.nextCursor);
    cursor = page.nextCursor;
  } while (cursor);
  return null;
}

export function useDwaionProposalSelection(params: URLSearchParams, setParams: SetURLSearchParams) {
  const queryClient = useQueryClient();
  const raw = params.get('proposal');
  const id =
    raw && params.getAll('proposal').length === 1 && UUID.test(raw) ? raw.toLowerCase() : null;
  const query = useQuery({
    queryKey: selectionKey(id),
    queryFn: () => findProposal(id!),
    enabled: Boolean(id),
    staleTime: 15_000,
    retry: false,
    refetchInterval: 60_000,
    meta: { accessSensitive: true },
  });
  const receive = (proposal: DwaionProposal) => {
    queryClient.setQueryData(selectionKey(proposal.proposalId.toLowerCase()), proposal);
  };
  return {
    proposal: id && !query.isError ? (query.data ?? null) : null,
    pending: Boolean(id) && query.isPending,
    unavailable: params.has('proposal') && (!id || query.isError || query.data === null),
    receive,
    refresh: () => (id ? query.refetch() : Promise.resolve()),
    clearCached: async () => {
      const filter = { queryKey: ['dwaion', 'proposals', 'selection'] };
      await queryClient.cancelQueries(filter);
      queryClient.setQueriesData(filter, null);
    },
    select: (proposal: DwaionProposal) => {
      receive(proposal);
      setParams((previous) => {
        const next = new URLSearchParams(previous);
        next.set('proposal', proposal.proposalId);
        return next;
      });
    },
    close: () =>
      setParams((previous) => {
        const next = new URLSearchParams(previous);
        next.delete('proposal');
        return next;
      }),
  };
}
