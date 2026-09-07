import { HttpError } from '../http-error';

import type { WorkspaceActivityEvent, WorkspaceActivityFeed } from './workspace-api';

export type ActivitySource = 'WORKSPACE' | 'DWAI_ON';
export type ActivitySourceState = {
  sourceScope: ActivitySource;
  status: 'AVAILABLE' | 'FORBIDDEN' | 'UNAVAILABLE';
  generatedAt?: string;
};
export type SourceActivityEvent = WorkspaceActivityEvent & { resumeCursor?: string | null };
export type SourceActivityPage = WorkspaceActivityFeed & {
  startCursor?: string | null;
  snapshotAt?: string;
  events: SourceActivityEvent[];
};
export type ActivityPage = SourceActivityPage & {
  partial: boolean;
  sourceStates: ActivitySourceState[];
};
type Positions = Partial<Record<ActivitySource, string | null>>;
type CompositeCursor = { version: 1; positions: Positions };

const SOURCES: ActivitySource[] = ['WORKSPACE', 'DWAI_ON'];
const PREFIX = 'activity-v1.';

// Composite cursors contain only source-issued cursors, never cached rows or identities.
// Each source revalidates its token against the current principal, permissions and query.
export function readActivitySourceCursors(cursor?: string): Positions {
  if (!cursor) return {};
  if (!cursor.startsWith(PREFIX) || cursor.length > 16_384) {
    throw new HttpError('Invalid activity cursor.', 400);
  }
  try {
    const data = JSON.parse(
      atob(cursor.slice(PREFIX.length).replaceAll('-', '+').replaceAll('_', '/'))
    ) as CompositeCursor;
    if (
      data.version !== 1 ||
      !data.positions ||
      typeof data.positions !== 'object' ||
      Array.isArray(data.positions)
    )
      throw new Error();
    for (const [source, value] of Object.entries(data.positions)) {
      if (
        !SOURCES.includes(source as ActivitySource) ||
        (value !== null && (typeof value !== 'string' || value.length > 7_500))
      )
        throw new Error();
    }
    return data.positions;
  } catch {
    throw new HttpError('Invalid activity cursor.', 400);
  }
}

function writeCursor(positions: Positions): string {
  return (
    PREFIX +
    btoa(JSON.stringify({ version: 1, positions }))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replaceAll('=', '')
  );
}

function instantNanos(value: string): bigint {
  const millis = Date.parse(value);
  if (!Number.isFinite(millis)) throw new HttpError('Invalid activity source timestamp.', 502);
  const fraction = /\.(\d+)(?:Z|[+-]\d{2}:\d{2})$/u.exec(value)?.[1] ?? '';
  return BigInt(millis) * 1_000_000n + BigInt(fraction.padEnd(9, '0').slice(3, 9));
}

export function oldestActivityTimestamp(values: string[]): string {
  return values.reduce(
    (oldest, value) => (!oldest || instantNanos(value) < instantNanos(oldest) ? value : oldest),
    ''
  );
}

export function withActivitySourceId(
  source: ActivitySource,
  event: SourceActivityEvent
): SourceActivityEvent {
  return source === 'DWAI_ON' ? { ...event, id: `dwaion:${event.id}` } : event;
}

export function mergeActivitySourcePages(
  pages: Partial<Record<ActivitySource, SourceActivityPage>>,
  sourceStates: ActivitySourceState[],
  positions: Positions,
  limit: number
): ActivityPage {
  const rows = SOURCES.flatMap((source) =>
    (pages[source]?.events ?? []).map((event) => ({ source, event }))
  );
  rows.sort((left, right) => {
    const time = instantNanos(right.event.occurredAt) - instantNanos(left.event.occurredAt);
    if (time) return time > 0n ? 1 : -1;
    const leftKey = `${left.source}:${left.event.id}`;
    const rightKey = `${right.source}:${right.event.id}`;
    return leftKey === rightKey ? 0 : leftKey < rightKey ? 1 : -1;
  });
  const selected = rows.slice(0, limit);
  const partial =
    sourceStates.some((source) => source.status === 'UNAVAILABLE') ||
    Object.values(pages).some((page) => !page.coverage || typeof page.hasMore !== 'boolean');
  const nextPositions = { ...positions };
  let more = false;
  let resumable = true;
  for (const source of SOURCES) {
    const page = pages[source];
    if (!page) continue;
    const consumed = selected.filter((row) => row.source === source);
    const last = consumed.at(-1)?.event;
    more ||= consumed.length < page.events.length || page.hasMore === true;
    if (last) nextPositions[source] = last.resumeCursor ?? null;
    else nextPositions[source] = positions[source] ?? page.startCursor ?? null;
    resumable &&= Boolean(nextPositions[source]) || (page.events.length === 0 && !page.hasMore);
  }
  const hasMore = more && resumable && !partial;
  const available = Object.values(pages);
  const generatedAt = oldestActivityTimestamp(available.map((page) => page.generatedAt));
  return {
    events: selected.map(({ source, event }) => withActivitySourceId(source, event)),
    generatedAt,
    snapshotAt: oldestActivityTimestamp(
      available.map((page) => page.snapshotAt ?? page.generatedAt)
    ),
    hasMore,
    nextCursor: hasMore ? writeCursor(nextPositions) : null,
    partial: partial || (more && !resumable),
    sourceStates,
    coverage: {
      supportedObjectTypes: [
        ...new Set(available.flatMap((page) => page.coverage?.supportedObjectTypes ?? [])),
      ],
      excludedProvenance: [
        ...new Set(available.flatMap((page) => page.coverage?.excludedProvenance ?? [])),
      ],
      includesUsage: available.some((page) => page.coverage?.includesUsage),
    },
  };
}
