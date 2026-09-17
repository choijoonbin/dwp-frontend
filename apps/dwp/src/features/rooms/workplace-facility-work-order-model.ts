import type {
  WorkplaceFacilityRequest,
  WorkplaceFacilityRequestPriority,
  WorkplaceFacilityRequestStatus,
} from '@dwp-frontend/shared-utils';

export type FacilityWorkOrderDraft = {
  status: WorkplaceFacilityRequestStatus;
  priority: WorkplaceFacilityRequestPriority;
  assignedTo: string;
  serviceProvider: string;
  externalWorkOrderReference: string;
  slaDueAt: string;
};

const pad = (value: number) => String(value).padStart(2, '0');

export function facilityDateTimeLocalValue(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function facilityDateTimeIsoValue(value: string): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/u.exec(value);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day, hour, minute);
  if (
    !Number.isFinite(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  )
    return null;
  return date.toISOString();
}

export function facilityWorkOrderDraft(request: WorkplaceFacilityRequest): FacilityWorkOrderDraft {
  return {
    status:
      request.status === 'OPEN'
        ? 'IN_PROGRESS'
        : request.status === 'IN_PROGRESS'
          ? 'RESOLVED'
          : 'OPEN',
    priority: request.priority,
    assignedTo: request.assignedTo ?? '',
    serviceProvider: request.serviceProvider ?? '',
    externalWorkOrderReference: request.externalWorkOrderReference ?? '',
    slaDueAt: facilityDateTimeLocalValue(request.slaDueAt),
  };
}

const normalized = (value: string | null | undefined) => value?.trim() || '';

export function facilityWorkOrderChanged(
  request: WorkplaceFacilityRequest,
  draft: FacilityWorkOrderDraft
): boolean {
  return (
    request.status !== draft.status ||
    request.priority !== draft.priority ||
    normalized(request.assignedTo) !== normalized(draft.assignedTo) ||
    normalized(request.serviceProvider) !== normalized(draft.serviceProvider) ||
    normalized(request.externalWorkOrderReference) !==
      normalized(draft.externalWorkOrderReference) ||
    facilityDateTimeLocalValue(request.slaDueAt) !== draft.slaDueAt
  );
}
