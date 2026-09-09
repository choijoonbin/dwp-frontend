import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useWorkHubOperationOwner } from './use-work-hub-operation-owner';
import {
  loadWorkAssignmentHistory,
  WorkAssignmentHistoryChangedError,
} from './work-hub-assignment-history-model';
import { workAssignmentAccessDenied } from './use-work-hub-assignment-detail';

export function useWorkHubAssignmentHistory({
  assignmentId,
  taskVersion,
  onAccessDenied,
  onTaskChanged,
}: {
  assignmentId: string;
  taskVersion: number;
  onAccessDenied: () => void;
  onTaskChanged: () => void;
}) {
  const owner = useWorkHubOperationOwner();
  const callbacks = useRef({ onAccessDenied, onTaskChanged });
  callbacks.current = { onAccessDenied, onTaskChanged };
  const handledChanged = useRef<string | null>(null);
  const query = useQuery({
    queryKey: ['work-hub', 'work-assignment-history', owner, assignmentId, taskVersion],
    enabled: owner !== null,
    queryFn: async ({ signal }) => {
      const events = await loadWorkAssignmentHistory(assignmentId, signal);
      signal.throwIfAborted();
      const historyVersion = events.at(-1)?.version ?? -1;
      if (historyVersion !== taskVersion)
        throw new WorkAssignmentHistoryChangedError(
          historyVersion > taskVersion ? 'AHEAD' : 'BEHIND'
        );
      return events;
    },
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    meta: { accessSensitive: true, ownerFingerprint: owner },
  });
  useEffect(() => {
    if (workAssignmentAccessDenied(query.error)) {
      callbacks.current.onAccessDenied();
      return;
    }
    if (
      !(query.error instanceof WorkAssignmentHistoryChangedError) ||
      query.error.direction !== 'AHEAD'
    )
      return;
    const identity = `${owner ?? ''}:${assignmentId}:${taskVersion}`;
    if (handledChanged.current === identity) return;
    handledChanged.current = identity;
    callbacks.current.onTaskChanged();
  }, [assignmentId, owner, query.error, taskVersion]);
  return query;
}
