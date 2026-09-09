import type {
  ApprovalTaskDetail,
  ApprovalTimelineEvent,
  ApprovalRequestDetail,
} from '@dwp-frontend/shared-utils/api/approval-api';
import type {
  ServiceRequestDetail,
  ServiceTimelineEvent,
} from '@dwp-frontend/shared-utils/api/service-center-api';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';

import type { WorkHubItem } from './work-hub-contracts';

export type WorkHubSourceDetailField = {
  key: string;
  labelKo: string | null;
  labelEn: string | null;
  value: string | number | boolean | null;
};

export type WorkHubSourceDetailProjection =
  | {
      kind: 'APPROVAL_TASK';
      fields: WorkHubSourceDetailField[];
      history: WorkHubSourceHistoryEvent[];
    }
  | {
      kind: 'APPROVAL_REQUEST';
      fields: WorkHubSourceDetailField[];
      requestedInformation: string | null;
      history: WorkHubSourceHistoryEvent[];
    }
  | {
      kind: 'SERVICE_REQUEST';
      fields: WorkHubSourceDetailField[];
      requestedInformation: string | null;
      history: WorkHubSourceHistoryEvent[];
    };

const approvalEvents = {
  REFERENCE_TASK_CREATED: 'created',
  DRAFT_CREATED: 'draftCreated',
  DRAFT_UPDATED: 'draftUpdated',
  REQUEST_DRAFTED: 'draftCreated',
  REQUEST_DRAFT_UPDATED: 'draftUpdated',
  REQUEST_CREATED: 'created',
  REQUEST_SUBMITTED: 'submitted',
  REQUEST_WITHDRAWN: 'withdrawn',
  TASK_CLAIMED: 'claimed',
  TASK_APPROVED: 'approved',
  TASK_REJECTED: 'rejected',
  TASK_INFO_REQUESTED: 'informationRequested',
  INFORMATION_REQUESTED: 'informationRequested',
  INFORMATION_RESPONDED: 'informationResponded',
  APPROVAL_STEP_STARTED: 'stepStarted',
} as const;
const serviceEvents = {
  DRAFT_CREATED: 'draftCreated',
  DRAFT_UPDATED: 'draftUpdated',
  REQUEST_SUBMITTED: 'submitted',
  REQUESTER_RESPONDED: 'informationResponded',
  REQUEST_CANCELLED: 'cancelled',
  STATUS_CHANGED: 'statusChanged',
  INFORMATION_REQUESTED: 'informationRequested',
} as const;
const historyActors = ['USER', 'AGENT', 'SYSTEM', 'SERVICE'] as const;
const historyOutcomes = ['SUCCESS', 'FAILURE', 'DENIED', 'PENDING'] as const;
const serviceStatuses = [
  'DRAFT',
  'SUBMITTED',
  'TRIAGED',
  'IN_PROGRESS',
  'AWAITING_REQUESTER',
  'RESOLVED',
  'CLOSED',
  'CANCELLED',
] as const;

export type WorkHubSourceHistoryEvent = {
  id: string;
  event:
    | (typeof approvalEvents)[keyof typeof approvalEvents]
    | (typeof serviceEvents)[keyof typeof serviceEvents];
  occurredAt: string;
  actor: (typeof historyActors)[number] | 'UNKNOWN';
  actorName: string | null;
  stepName: string | null;
  stepSequence: number | null;
  delegated: boolean;
  outcome: (typeof historyOutcomes)[number] | null;
  status: (typeof serviceStatuses)[number] | null;
  message: string | null;
};

function historyText(value: unknown, limit: number): string | null {
  if (typeof value !== 'string') return null;
  const text = [...value]
    .filter((character) => {
      const code = character.codePointAt(0)!;
      return (code >= 32 && code !== 127) || character === '\n' || character === '\t';
    })
    .join('')
    .trim();
  if (!text) return null;
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function historyTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u.exec(
      value
    );
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const [, year, month, day, hour, minute, second] = match.map(Number);
  return (
    month! >= 1 &&
    month! <= 12 &&
    day! >= 1 &&
    day! <= new Date(Date.UTC(year!, month!, 0)).getUTCDate() &&
    hour! < 24 &&
    minute! < 60 &&
    second! < 60
  );
}

/** The owner response is authorized; private/internal event types remain outside Work's projection. */
function sourceHistory(
  timeline: ApprovalTimelineEvent[] | ServiceTimelineEvent[],
  kind: 'approval' | 'service'
): WorkHubSourceHistoryEvent[] {
  if (!Array.isArray(timeline)) return [];
  const identities = new Map<string, number>();
  for (const entry of timeline) {
    if (entry && typeof entry.eventId === 'string') {
      const id = entry.eventId.trim();
      identities.set(id, (identities.get(id) ?? 0) + 1);
    }
  }
  const events = kind === 'approval' ? approvalEvents : serviceEvents;
  return timeline
    .flatMap((entry): WorkHubSourceHistoryEvent[] => {
      if (
        !entry ||
        typeof entry !== 'object' ||
        typeof entry.eventId !== 'string' ||
        !entry.eventId.trim() ||
        entry.eventId.length > 256 ||
        !Object.hasOwn(events, entry.eventType) ||
        !historyTimestamp(entry.occurredAt)
      )
        return [];
      const id = entry.eventId.trim();
      if (identities.get(id) !== 1) return [];
      const approval = kind === 'approval' ? (entry as ApprovalTimelineEvent) : null;
      const service = kind === 'service' ? (entry as ServiceTimelineEvent) : null;
      return [
        {
          id,
          event: events[entry.eventType as keyof typeof events],
          occurredAt: entry.occurredAt,
          actor: historyActors.find((actor) => actor === entry.actorType) ?? 'UNKNOWN',
          actorName: approval ? historyText(approval.actorDisplayName, 160) : null,
          stepName: approval ? historyText(approval.stepName, 240) : null,
          stepSequence:
            approval && Number.isSafeInteger(approval.stepSequence) && approval.stepSequence! > 0
              ? approval.stepSequence!
              : null,
          delegated: approval?.delegated === true,
          outcome: historyOutcomes.find((outcome) => outcome === approval?.outcome) ?? null,
          status: serviceStatuses.find((status) => status === service?.status) ?? null,
          message: historyText(approval ? approval.message : service?.note, 4000),
        },
      ];
    })
    .sort((left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt));
}

export class WorkHubSourceDetailMismatchError extends Error {
  constructor() {
    super('Source detail does not match the selected work snapshot');
    this.name = 'WorkHubSourceDetailMismatchError';
  }
}

export function workHubSourceDetailInvalid(error: unknown) {
  return (
    error instanceof WorkHubSourceDetailMismatchError ||
    (error instanceof HttpError && [401, 403, 404, 409].includes(error.status))
  );
}

function scalar(value: unknown): WorkHubSourceDetailField['value'] {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  return typeof value === 'boolean' ? value : null;
}

function fieldsFromSchema(
  fields: Array<{ key: string; labelKo?: string | null; labelEn?: string | null }>,
  values: Record<string, unknown>
): WorkHubSourceDetailField[] {
  const seen = new Set<string>();
  return fields.flatMap((field) => {
    const key = field.key.trim();
    const labelKo = field.labelKo?.trim() || null;
    const labelEn = field.labelEn?.trim() || null;
    if (!key || seen.has(key) || (!labelKo && !labelEn)) return [];
    seen.add(key);
    return [{ key, labelKo, labelEn, value: scalar(values[key]) }];
  });
}

export function projectApprovalSourceDetail(
  item: WorkHubItem,
  detail: ApprovalTaskDetail
): WorkHubSourceDetailProjection | null {
  const context = item.sourceContext;
  if (
    context?.kind !== 'APPROVAL_TASK' ||
    item.reference.sourceSystem !== 'APPROVAL_TASK' ||
    detail.task.taskId !== item.reference.sourceReference ||
    detail.task.requestId !== context.requestId ||
    detail.task.stepKey !== context.currentStep.key ||
    (item.reference.obligationKey !== undefined &&
      detail.task.stepKey !== item.reference.obligationKey) ||
    (item.displayId !== undefined && detail.task.requestNumber !== item.displayId) ||
    detail.task.status !== item.sourceStatus ||
    detail.task.version !== item.version ||
    (item.dataClassification !== null && detail.task.dataClassification !== item.dataClassification)
  ) {
    return null;
  }
  return {
    kind: 'APPROVAL_TASK',
    fields: fieldsFromSchema(detail.formSchema?.fields ?? [], detail.payload),
    history: sourceHistory(detail.timeline, 'approval'),
  };
}

export function projectServiceSourceDetail(
  item: WorkHubItem,
  detail: ServiceRequestDetail
): WorkHubSourceDetailProjection | null {
  const context = item.sourceContext;
  if (
    context?.kind !== 'SERVICE_REQUEST' ||
    item.reference.sourceSystem !== 'SERVICE_REQUEST' ||
    detail.request.requestId !== item.reference.sourceReference ||
    detail.request.serviceKey !== context.serviceKey ||
    (item.displayId !== undefined && detail.request.requestNumber !== item.displayId) ||
    detail.request.status !== item.sourceStatus ||
    detail.request.version !== item.version ||
    (item.dataClassification !== null && detail.dataClassification !== item.dataClassification)
  ) {
    return null;
  }
  const history = sourceHistory(detail.timeline, 'service');
  const requestedInformation = [...history]
    .reverse()
    .find(
      (event) =>
        (event.event === 'informationRequested' ||
          (event.event === 'statusChanged' && event.status === 'AWAITING_REQUESTER')) &&
        event.message
    )?.message;
  return {
    kind: 'SERVICE_REQUEST',
    fields: fieldsFromSchema(detail.requestSchema.fields, detail.values),
    requestedInformation: requestedInformation || null,
    history,
  };
}

export function projectApprovalRequestSourceDetail(
  item: WorkHubItem,
  detail: ApprovalRequestDetail
): WorkHubSourceDetailProjection | null {
  const context = item.sourceContext;
  const request = detail.request;
  if (
    context?.kind !== 'APPROVAL_REQUEST' ||
    item.reference.sourceSystem !== 'APPROVAL_REQUEST' ||
    item.reference.obligationKey !== 'REQUEST_INFORMATION' ||
    request.requestId !== item.reference.sourceReference ||
    request.requestNumber !== item.displayId ||
    request.status !== item.sourceStatus ||
    request.version !== item.version ||
    request.dataClassification !== item.dataClassification ||
    (request.currentStepKey ?? null) !== context.currentStep.key ||
    (request.currentStepName ?? null) !== context.currentStep.name ||
    (request.currentStepSequence ?? null) !== context.currentStep.sequence ||
    request.totalSteps !== context.currentStep.totalSteps ||
    request.workflowNameKo !== context.workflowNameKo ||
    request.workflowNameEn !== context.workflowNameEn
  )
    return null;
  return {
    kind: 'APPROVAL_REQUEST',
    fields: fieldsFromSchema(detail.formSchema?.fields ?? [], detail.payload),
    requestedInformation: historyText(request.latestInformationRequest, 4000),
    history: sourceHistory(detail.timeline, 'approval'),
  };
}
