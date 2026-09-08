import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getVideoMeetingRecordBookmarks,
  setVideoMeetingRecordBookmark,
  type VideoMeetingRecordBookmark,
} from '@dwp-frontend/shared-utils/api/video-meeting-record-preferences-api';

type CommandState = {
  owner: string;
  pending: string | null;
  failed: boolean;
  denied: boolean;
};
type AuthorityState = { scope: string; blocked: boolean; pending: boolean };
const denied = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'status' in error &&
  [401, 403, 404, 410].includes(Number(error.status));

/** Bookmarks are per-person metadata, never evidence of access to a meeting. */
export function useMeetingRecordBookmarks(
  scope: string,
  meetingIds: readonly string[],
  enabled: boolean
) {
  const client = useQueryClient();
  const owner = JSON.stringify([scope, meetingIds, enabled]);
  const fence = useRef({ owner, alive: true });
  fence.current.owner = owner;
  const command = useRef<AbortController | null>(null);
  const revalidation = useRef<AbortController | null>(null);
  const [state, setState] = useState<CommandState | null>(null);
  const [authority, setAuthority] = useState<AuthorityState | null>(null);
  const current = state?.owner === owner ? state : null;
  const currentAuthority = authority?.scope === scope ? authority : null;
  const queryKey = ['meetings', 'record-bookmarks', scope, ...meetingIds];
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => getVideoMeetingRecordBookmarks(meetingIds, signal),
    enabled: enabled && meetingIds.length > 0,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    meta: { accessSensitive: true },
  });
  const queryDenied = query.isError && denied(query.error);
  const accessDenied =
    queryDenied || Boolean(current?.denied) || Boolean(currentAuthority?.blocked);
  useEffect(() => {
    if (queryDenied)
      setAuthority((previous) =>
        previous?.scope === scope && previous.blocked
          ? previous
          : { scope, blocked: true, pending: false }
      );
  }, [queryDenied, scope]);
  useEffect(() => {
    const currentFence = fence.current;
    currentFence.alive = true;
    return () => {
      currentFence.alive = false;
      command.current?.abort();
      command.current = null;
      revalidation.current?.abort();
      revalidation.current = null;
    };
  }, [owner]);

  async function toggle(bookmark: VideoMeetingRecordBookmark) {
    if (
      !enabled ||
      command.current ||
      query.isError ||
      query.isFetching ||
      accessDenied ||
      revalidation.current ||
      !query.data?.some(
        (item) =>
          item.meetingId === bookmark.meetingId &&
          item.version === bookmark.version &&
          item.favorite === bookmark.favorite
      )
    )
      return;
    const controller = new AbortController();
    command.current = controller;
    const isCurrent = () =>
      fence.current.alive && fence.current.owner === owner && !controller.signal.aborted;
    setState({ owner, pending: bookmark.meetingId, failed: false, denied: false });
    try {
      await setVideoMeetingRecordBookmark(
        bookmark.meetingId,
        !bookmark.favorite,
        bookmark.version,
        crypto.randomUUID(),
        controller.signal
      );
      if (!isCurrent()) return;
      // No optimistic authority or favorite projection. Re-read totals and the current page.
      await Promise.all([
        client.invalidateQueries({ queryKey: ['meetings', 'history', scope] }),
        client.invalidateQueries({ queryKey }),
      ]);
      if (isCurrent()) setState({ owner, pending: null, failed: false, denied: false });
    } catch (error) {
      if (!isCurrent()) return;
      setState({ owner, pending: null, failed: true, denied: denied(error) });
      if (denied(error)) {
        setAuthority({ scope, blocked: true, pending: false });
        await client.cancelQueries({ queryKey: ['meetings', 'history', scope] });
      } else {
        // A lost response or CAS conflict must be revalidated before another command.
        await client.invalidateQueries({ queryKey });
      }
    } finally {
      if (command.current === controller) command.current = null;
    }
  }

  async function refresh() {
    if (!enabled || revalidation.current || command.current) return;
    const controller = new AbortController();
    revalidation.current = controller;
    const isCurrent = () =>
      fence.current.alive && fence.current.owner === owner && !controller.signal.aborted;
    const historyFilter = { queryKey: ['meetings', 'history', scope], type: 'active' as const };
    const historyQueries = client.getQueryCache().findAll(historyFilter);
    const bookmarkQuery = client.getQueryCache().find({ queryKey, exact: true });
    const snapshots = [
      ...historyQueries,
      ...(meetingIds.length > 0 && bookmarkQuery ? [bookmarkQuery] : []),
    ].map((entry) => ({ entry, updates: entry.state.dataUpdateCount }));
    setAuthority({ scope, blocked: accessDenied, pending: true });
    try {
      // A resolved invalidation promise alone does not prove a successful authorized read.
      // Keep denial latched until both exact current-page reads have actually advanced.
      if (historyQueries.length === 0 || (meetingIds.length > 0 && !bookmarkQuery))
        throw new Error('The current record page is unavailable for revalidation.');
      await Promise.all([
        ...(meetingIds.length > 0 ? [query.refetch({ throwOnError: true })] : []),
        client.refetchQueries(historyFilter, { throwOnError: true }),
      ]);
      if (!isCurrent()) return;
      if (
        snapshots.some(
          ({ entry, updates }) =>
            client.getQueryCache().find({ queryKey: entry.queryKey, exact: true }) !== entry ||
            entry.state.status !== 'success' ||
            entry.state.fetchStatus !== 'idle' ||
            entry.state.isInvalidated ||
            entry.state.dataUpdateCount <= updates
        )
      )
        throw new Error('The current record page was not freshly authorized.');
      setState({ owner, pending: null, failed: false, denied: false });
      setAuthority({ scope, blocked: false, pending: false });
    } catch (error) {
      if (!isCurrent()) return;
      const blocked = accessDenied || denied(error);
      setState({ owner, pending: null, failed: true, denied: blocked });
      setAuthority({ scope, blocked, pending: false });
    } finally {
      if (revalidation.current === controller) revalidation.current = null;
    }
  }

  return {
    items: enabled && !query.isError && !accessDenied ? (query.data ?? []) : [],
    busy: query.isFetching || Boolean(current?.pending) || Boolean(currentAuthority?.pending),
    failed: query.isError || Boolean(current?.failed),
    accessDenied,
    toggle,
    refresh,
  };
}
