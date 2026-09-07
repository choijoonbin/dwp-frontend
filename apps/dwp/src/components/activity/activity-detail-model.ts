import type { WorkspaceActivityEvent } from '@dwp-frontend/shared-utils';

export type ActivityDetailKind = 'CHANGE' | 'EXECUTION_SNAPSHOT' | 'EXECUTION' | 'USAGE' | 'EVENT';

export type ActivityDetailField = {
  key: string;
  value: string;
};

export type ActivityAuditPresentation =
  'VERIFIED' | 'VERIFIED_RESTRICTED' | 'LEGACY_UNLINKED' | 'NOT_LINKED';

export type ActivityEventDetailModel = {
  kind: ActivityDetailKind;
  occurredAt: string;
  sourceObservedAt: string | null;
  updatedAt: string | null;
  workStatusAtChange: string | null;
  actorFields: ActivityDetailField[];
  objectFields: ActivityDetailField[];
  sourceFields: ActivityDetailField[];
  executionFields: ActivityDetailField[];
  traceFields: ActivityDetailField[];
  audit: {
    presentation: ActivityAuditPresentation;
    recordId: string | null;
  };
  legacy: boolean;
  canRefreshUnknownState: boolean;
};

export const activityQueryKeys = {
  root: ['workspace', 'activity'] as const,
  detail: (identity: string, id: string) =>
    ['workspace', 'activity', 'detail', identity, id] as const,
};

function presentString(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function optionalField(
  key: string,
  value: string | number | null | undefined
): ActivityDetailField | null {
  if (value === null || value === undefined || value === '') return null;
  return { key, value: String(value) };
}

function fields(...values: Array<ActivityDetailField | null>): ActivityDetailField[] {
  return values.filter((value): value is ActivityDetailField => value !== null);
}

export function activityEventDetailModel(event: WorkspaceActivityEvent): ActivityEventDetailModel {
  const kind: ActivityDetailKind = event.eventKind ?? 'EVENT';
  const verifiedAuditRecord =
    event.auditStatus === 'VERIFIED' ? presentString(event.auditRecordId) : null;
  const auditPresentation: ActivityAuditPresentation = verifiedAuditRecord
    ? event.auditAccess === 'RESTRICTED'
      ? 'VERIFIED_RESTRICTED'
      : 'VERIFIED'
    : event.auditStatus === 'LEGACY_UNLINKED'
      ? 'LEGACY_UNLINKED'
      : 'NOT_LINKED';

  return {
    kind,
    occurredAt: event.occurredAt,
    sourceObservedAt: presentString(event.sourceObservedAt),
    updatedAt: presentString(event.updatedAt),
    workStatusAtChange: kind === 'CHANGE' ? presentString(event.workStatus) : null,
    actorFields: fields(
      optionalField('actorName', event.actorName),
      optionalField('actorType', event.actor)
    ),
    objectFields: fields(
      optionalField('objectLabel', event.objectLabel),
      optionalField('objectType', event.objectType),
      optionalField('objectId', event.objectId)
    ),
    sourceFields: fields(
      optionalField('source', event.source),
      optionalField('tool', presentString(event.tool)),
      optionalField('sourceAccess', event.sourceAccess)
    ),
    executionFields: fields(
      optionalField('executionId', presentString(event.executionId)),
      optionalField('attempt', event.attempt),
      optionalField('executionVersion', event.executionVersion)
    ),
    traceFields: fields(
      optionalField('recordId', event.id),
      optionalField('sourceEventId', presentString(event.sourceEventId)),
      optionalField('correlationId', presentString(event.correlationId)),
      optionalField('dataProvenance', event.dataProvenance)
    ),
    audit: {
      presentation: auditPresentation,
      recordId: verifiedAuditRecord,
    },
    legacy: event.dataProvenance === 'LEGACY',
    canRefreshUnknownState: event.state === 'unknown',
  };
}

export function availableActivitySourceRoute(event: WorkspaceActivityEvent): string | null {
  const route = event.sourceRoute;
  if (event.sourceAccess !== 'AVAILABLE' || !route) return null;
  if (!/^\/(?!\/)/u.test(route) || /[\\\s]/u.test(route)) return null;
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(route, 'https://dwp.invalid').pathname);
  } catch {
    return null;
  }
  if (pathname === '/activity' || pathname.startsWith('/activity/')) return null;
  if (/[\\\s]/u.test(pathname) || pathname.startsWith('//')) return null;
  return route;
}

export function selectedActivityEvent(
  requestedId: string,
  event: WorkspaceActivityEvent | undefined
): WorkspaceActivityEvent | undefined {
  return requestedId && event?.id === requestedId ? event : undefined;
}
