import type { PersonalWorkSource } from '@dwp-frontend/shared-utils/api/personal-work-contracts';
import {
  workHubReferenceKey,
  type WorkHubSnapshot,
  type WorkHubSourceId,
} from './work-hub-contracts';

const owners: Record<string, WorkHubSourceId[]> = {
  APPROVAL_TASK: ['approval-inbox', 'approval-completed'],
  APPROVAL_REQUEST: ['approval-needs-info'],
  SERVICE_REQUEST: ['services'],
  PERSONAL_TASK: ['personal'],
  WORKSPACE: ['workspace'],
};

/** An opaque bookmark is not access evidence. Only current owner reads may hydrate metadata. */
export function hydrateWorkSource(source: PersonalWorkSource | null, snapshot: WorkHubSnapshot) {
  if (!source) return { state: 'NONE' as const, source: null };
  if (source.availability === 'UNAVAILABLE') return { state: 'UNAVAILABLE' as const, source: null };
  if (source.availability === 'AVAILABLE') return { state: 'AVAILABLE' as const, source };
  const sourceSnapshots = snapshot.sources.filter((entry) =>
    owners[source.reference.sourceSystem]?.includes(entry.sourceId)
  );
  const verified = sourceSnapshots
    .filter((entry) => entry.state === 'READY')
    .flatMap((entry) => entry.items)
    .find((item) => item.key === workHubReferenceKey(source.reference));
  if (verified)
    return {
      state: 'AVAILABLE' as const,
      source: {
        ...source,
        availability: 'AVAILABLE' as const,
        title: verified.title,
        sourceRoute: verified.sourceRoute,
        status: verified.sourceStatus,
        dueAt: verified.dueAt,
      },
    };
  return {
    state: sourceSnapshots.some((entry) => entry.state === 'FORBIDDEN')
      ? ('FORBIDDEN' as const)
      : sourceSnapshots.some((entry) => entry.state === 'UNAVAILABLE')
        ? ('UNAVAILABLE' as const)
        : ('NOT_VERIFIED' as const),
    source: null,
  };
}
