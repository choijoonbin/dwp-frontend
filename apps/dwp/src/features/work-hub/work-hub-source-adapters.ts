import type { ApprovalRequest, ApprovalTask } from '@dwp-frontend/shared-utils/api/approval-api';
import type { ServiceRequestSummary } from '@dwp-frontend/shared-utils/api/service-center-api';
import type { PersonalWorkTask } from '@dwp-frontend/shared-utils/api/personal-work-contracts';
import type { WorkspaceWorkItem } from '@dwp-frontend/shared-utils/api/workspace-api';
import {
  canChangeWorkspaceWorkStatus,
  workspaceWorkItemReference,
  workspaceWorkItemRoute,
  workspaceWorkSourceRoute,
} from '@dwp-frontend/shared-utils/api/workspace-work-policy';
import { workHubReferenceKey, type WorkHubItem, type WorkHubSourceId } from './work-hub-contracts';

function canonical(item: Omit<WorkHubItem, 'key'>): WorkHubItem {
  return { ...item, key: workHubReferenceKey(item.reference) };
}

export function workspaceWorkToHub(item: WorkspaceWorkItem): WorkHubItem {
  const review = item.type === 'Review' && workspaceWorkItemReference(item);
  const native = ['WORKSPACE', 'DWP_WORKSPACE'].includes(item.sourceSystem) && item.type === 'Task';
  const knownOwner =
    ['APPROVAL_TASK', 'APPROVAL_REQUEST', 'SERVICE_REQUEST', 'PERSONAL_TASK'].includes(
      item.sourceSystem
    ) && item.sourceReference;
  const reference = review
    ? { sourceSystem: 'IDENTITY_GOVERNANCE', sourceReference: review }
    : native
      ? { sourceSystem: 'WORKSPACE', sourceReference: item.workItemId }
      : knownOwner
        ? {
            sourceSystem: item.sourceSystem,
            sourceReference: knownOwner,
            obligationKey: item.obligationKey,
          }
        : { sourceSystem: 'LEGACY_PROJECTION', sourceReference: item.workItemId };
  const sourceRoute = review ? workspaceWorkItemRoute(item) : workspaceWorkSourceRoute(item);
  const terminal = ['completed', 'cancelled', 'archived'].includes(item.status);
  const actions: WorkHubItem['actions'] = sourceRoute
    ? [{ kind: 'OPEN_SOURCE', availability: 'AVAILABLE' }]
    : [];
  if (review) actions.push({ kind: 'ACCESS_REVIEW_DECIDE', availability: 'DETAIL_REQUIRED' });
  if (canChangeWorkspaceWorkStatus(item, 'IN_PROGRESS'))
    actions.push({ kind: 'WORKSPACE_START', availability: 'AVAILABLE' });
  if (canChangeWorkspaceWorkStatus(item, 'COMPLETED'))
    actions.push({ kind: 'WORKSPACE_COMPLETE', availability: 'AVAILABLE' });
  return canonical({
    reference,
    sourceId: 'workspace',
    title: item.title,
    summary: item.summary ?? null,
    lifecycle:
      item.status === 'completed'
        ? 'COMPLETED'
        : item.status === 'cancelled'
          ? 'CANCELLED'
          : item.status === 'archived'
            ? 'ARCHIVED'
            : item.status === 'in-progress'
              ? 'IN_PROGRESS'
              : item.status === 'waiting'
                ? 'WAITING'
                : 'OPEN',
    sourceStatus: item.status,
    originSystem: item.sourceSystem,
    priority: item.priority === 'medium' ? 'NORMAL' : item.priority === 'high' ? 'HIGH' : 'LOW',
    dueAt: item.dueAt ?? null,
    waitingFor: terminal ? 'NONE' : item.status === 'waiting' ? 'UNKNOWN' : 'ME',
    sourceRoute,
    version: item.version,
    updatedAt: item.updatedAt,
    reason: item.reason ?? null,
    dataClassification: item.dataClassification ?? null,
    actions,
    legacyItem: item,
  });
}

export function approvalTaskToHub(task: ApprovalTask, sourceId: WorkHubSourceId): WorkHubItem {
  const open = task.status === 'PENDING' || task.status === 'CLAIMED';
  const waiting = task.status === 'INFO_REQUESTED';
  return canonical({
    reference: {
      sourceSystem: 'APPROVAL_TASK',
      sourceReference: task.taskId,
      obligationKey: task.stepKey,
    },
    sourceId,
    title: task.title,
    summary: task.summary,
    lifecycle: open
      ? task.status === 'CLAIMED'
        ? 'IN_PROGRESS'
        : 'OPEN'
      : waiting
        ? 'WAITING'
        : task.status === 'CANCELLED'
          ? 'CANCELLED'
          : 'COMPLETED',
    sourceStatus: task.status,
    originSystem: 'APPROVAL_TASK',
    priority: task.priority,
    dueAt: task.dueAt ?? null,
    waitingFor: open ? 'ME' : waiting ? 'OTHERS' : 'NONE',
    sourceRoute: `/approvals/${open || waiting ? 'inbox' : 'completed'}?task=${encodeURIComponent(task.taskId)}`,
    version: task.version,
    updatedAt: null,
    reason: null,
    dataClassification: task.dataClassification,
    actions: [
      { kind: 'OPEN_SOURCE', availability: 'AVAILABLE' },
      ...(open
        ? [
            { kind: 'APPROVAL_CLAIM' as const, availability: 'DETAIL_REQUIRED' as const },
            { kind: 'APPROVAL_DECIDE' as const, availability: 'DETAIL_REQUIRED' as const },
          ]
        : []),
    ],
  });
}

export function approvalRequestToHub(request: ApprovalRequest): WorkHubItem {
  return canonical({
    reference: {
      sourceSystem: 'APPROVAL_REQUEST',
      sourceReference: request.requestId,
      obligationKey: 'REQUEST_INFORMATION',
    },
    sourceId: 'approval-needs-info',
    title: request.title,
    summary: request.latestInformationRequest ?? request.summary,
    lifecycle: request.status === 'NEEDS_INFO' ? 'OPEN' : 'WAITING',
    sourceStatus: request.status,
    originSystem: 'APPROVAL_REQUEST',
    priority: request.priority,
    dueAt: request.dueAt ?? null,
    waitingFor: request.status === 'NEEDS_INFO' ? 'ME' : 'OTHERS',
    sourceRoute: `/approvals/requests/${encodeURIComponent(request.requestId)}`,
    version: request.version,
    updatedAt: null,
    reason: request.latestInformationRequest ?? null,
    dataClassification: request.dataClassification,
    actions: [{ kind: 'OPEN_SOURCE', availability: 'AVAILABLE' }],
  });
}

export function serviceRequestToHub(request: ServiceRequestSummary): WorkHubItem {
  const terminal = ['RESOLVED', 'CLOSED', 'CANCELLED'].includes(request.status);
  const myTurn = request.status === 'AWAITING_REQUESTER' || request.status === 'DRAFT';
  return canonical({
    reference: { sourceSystem: 'SERVICE_REQUEST', sourceReference: request.requestId },
    sourceId: 'services',
    title: request.summary || request.serviceNameKo,
    summary: request.serviceNameEn,
    lifecycle:
      request.status === 'CANCELLED'
        ? 'CANCELLED'
        : terminal
          ? 'COMPLETED'
          : myTurn
            ? 'OPEN'
            : 'WAITING',
    sourceStatus: request.status,
    originSystem: 'SERVICE_REQUEST',
    priority: request.priority,
    dueAt: request.slaDueAt ?? null,
    waitingFor: terminal ? 'NONE' : myTurn ? 'ME' : 'OTHERS',
    sourceRoute: `/services/requests/${encodeURIComponent(request.requestId)}`,
    version: request.version,
    updatedAt: request.updatedAt,
    reason: null,
    dataClassification: request.dataClassification ?? null,
    actions: [{ kind: 'OPEN_SOURCE', availability: 'AVAILABLE' }],
  });
}

export function personalWorkToHub(task: PersonalWorkTask, canUpdate = false): WorkHubItem {
  const active = !['COMPLETED', 'ARCHIVED'].includes(task.status);
  const actions: WorkHubItem['actions'] = [];
  if (active && canUpdate) {
    if (task.status !== 'IN_PROGRESS')
      actions.push({ kind: 'PERSONAL_START', availability: 'AVAILABLE' });
    if (task.status !== 'WAITING')
      actions.push({ kind: 'PERSONAL_WAIT', availability: 'AVAILABLE' });
    actions.push({ kind: 'PERSONAL_COMPLETE', availability: 'AVAILABLE' });
  }
  if (canUpdate && (task.status === 'COMPLETED' || task.status === 'ARCHIVED'))
    actions.push({ kind: 'PERSONAL_REOPEN', availability: 'AVAILABLE' });
  if (canUpdate && task.status !== 'ARCHIVED')
    actions.push({ kind: 'PERSONAL_ARCHIVE', availability: 'AVAILABLE' });
  const sourceRoute =
    task.source?.availability === 'AVAILABLE' ? workspaceWorkSourceRoute(task.source) : null;
  if (sourceRoute) actions.push({ kind: 'OPEN_SOURCE', availability: 'AVAILABLE' });
  return canonical({
    reference: { sourceSystem: 'PERSONAL_TASK', sourceReference: task.taskId },
    sourceId: 'personal',
    title: task.title,
    summary: task.description,
    lifecycle: task.status,
    sourceStatus: task.status,
    originSystem: 'PERSONAL_TASK',
    priority: task.priority,
    dueAt: task.dueAt,
    waitingFor: !active ? 'NONE' : task.status === 'WAITING' ? 'UNKNOWN' : 'ME',
    sourceRoute,
    version: task.version,
    updatedAt: task.updatedAt,
    reason: null,
    dataClassification: 'INTERNAL',
    actions,
  });
}
