import type { TFunction } from 'i18next';
import type { ApprovalTimelineEvent } from '@dwp-frontend/shared-utils';

const SYSTEM_EVENT_TYPES = new Set([
  'REFERENCE_TASK_CREATED',
  'DRAFT_CREATED',
  'DRAFT_UPDATED',
  'REQUEST_DRAFTED',
  'REQUEST_DRAFT_UPDATED',
  'REQUEST_CREATED',
  'REQUEST_SUBMITTED',
  'REQUEST_WITHDRAWN',
  'TASK_CLAIMED',
  'APPROVAL_STEP_STARTED',
]);

export function approvalTimelineEventDetail(
  t: TFunction<'approvals'>,
  event: ApprovalTimelineEvent
) {
  const actor = t(`actorTypes.${event.actorType}`, { defaultValue: event.actorType });
  if (!SYSTEM_EVENT_TYPES.has(event.eventType)) return event.message || actor;
  return t(`eventDetails.${event.eventType}`, {
    defaultValue: event.message || actor,
  });
}

export function approvalTimelineEventContext(
  t: TFunction<'approvals'>,
  event: ApprovalTimelineEvent
) {
  const evidence: string[] = [];
  if (event.stepName && event.stepSequence != null) {
    evidence.push(
      t('timelineEvidence.step', {
        sequence: event.stepSequence,
        name: event.stepName,
      })
    );
  }
  evidence.push(
    event.actorDisplayName || t(`actorTypes.${event.actorType}`, { defaultValue: event.actorType })
  );
  if (event.delegated) evidence.push(t('timelineEvidence.delegated'));
  return evidence.join(' · ');
}
