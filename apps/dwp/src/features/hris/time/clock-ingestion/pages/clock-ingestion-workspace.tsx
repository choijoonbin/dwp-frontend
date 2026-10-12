import { useEffect, useState } from 'react';

import { ClockIngestionCommandCenter } from '../components/clock-ingestion-command-center';
import { useClockIngestionWorkspace } from '../hooks/use-clock-ingestion-workspace';

import type { ClockIngestionDataSource } from '../api/clock-ingestion-api';
import type { ClockEvidenceFilter } from '../components/clock-ingestion-command-center';
import type { ClockEvent, ClockIngestionScope } from '../model/clock-ingestion-model';
import type { ClockIngestionCopy } from '../model/clock-ingestion-copy';

export type ClockIngestionOwnerBinding = Readonly<{
  dataSource: ClockIngestionDataSource;
  canIngest: boolean;
  canVoid: boolean;
  onIngest: () => void;
  onVoid: (event: ClockEvent) => void;
}>;

export type ClockIngestionWorkspaceProps = Readonly<{
  scope: ClockIngestionScope;
  copy: ClockIngestionCopy;
  ownerBinding?: ClockIngestionOwnerBinding;
}>;

/**
 * Route-neutral runtime. Control mounts it only after all four generated route bindings exist;
 * without an exact owner binding it stays closed and performs no owner I/O.
 */
export function ClockIngestionWorkspace({
  scope,
  copy,
  ownerBinding,
}: ClockIngestionWorkspaceProps) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ClockEvidenceFilter>('ALL');
  const { workspace, reload } = useClockIngestionWorkspace(ownerBinding?.dataSource ?? null, scope);

  useEffect(() => {
    if (
      selectedEventId &&
      !workspace.events.some((event) => event.clockEventId === selectedEventId)
    ) {
      setSelectedEventId(null);
    }
  }, [selectedEventId, workspace.events]);

  return (
    <ClockIngestionCommandCenter
      workspace={workspace}
      copy={copy}
      selectedEventId={selectedEventId}
      filter={filter}
      canIngest={ownerBinding?.canIngest ?? false}
      canVoid={ownerBinding?.canVoid ?? false}
      onSelect={setSelectedEventId}
      onFilterChange={setFilter}
      onRefresh={ownerBinding ? reload : undefined}
      onIngest={ownerBinding?.onIngest}
      onVoid={ownerBinding?.onVoid}
    />
  );
}
