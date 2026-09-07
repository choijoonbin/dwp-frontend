import type { MailActionProposal, MailProposalType } from '@dwp-frontend/shared-utils';

export type MailProposalTone = 'calendar' | 'draft' | 'leave' | 'notification' | 'task';

export type MailProposalField = {
  key:
    | 'assignee'
    | 'attendees'
    | 'channel'
    | 'dateRange'
    | 'durationDays'
    | 'durationMinutes'
    | 'language'
    | 'location'
    | 'priority'
    | 'project'
    | 'provider'
    | 'schedule'
    | 'timeZone'
    | 'tone'
    | 'urgency';
  value: number | string | string[];
  format: 'date' | 'datetime' | 'durationDays' | 'durationMinutes' | 'list' | 'text';
};

export type MailProposalReviewBlock =
  'expired' | 'handled' | 'policyMismatch' | 'unsupportedType' | 'unsupportedVersion';

export type MailProposalPresentation = {
  actionKey: string;
  fields: MailProposalField[];
  reviewBlock: MailProposalReviewBlock | null;
  sourceSummary: string | null;
  targetKey: 'calendar' | 'hr' | 'mail' | 'notifications' | 'work';
  tone: MailProposalTone;
  typeKey: 'calendarEvent' | 'leaveRequest' | 'notification' | 'replyDraft' | 'task';
};

type ProposalDescriptor = Omit<
  MailProposalPresentation,
  'fields' | 'reviewBlock' | 'sourceSummary'
> & {
  contractVersion: number;
  minimumRisk: MailActionProposal['riskLevel'];
  permissionCode: string;
  requiredPayloadFields: string[];
  resourceKey: string;
  routePrefix: string;
  fields: (payload: Record<string, unknown>) => MailProposalField[];
};

const descriptors: Record<MailProposalType, ProposalDescriptor> = {
  DRAFT_REPLY: {
    actionKey: 'MAIL.DRAFT.CREATE',
    contractVersion: 1,
    minimumRisk: 'LOW',
    permissionCode: 'CREATE',
    requiredPayloadFields: ['tone', 'language', 'requiresConfirmation'],
    resourceKey: 'APP.MAIL',
    routePrefix: '/mail/',
    targetKey: 'mail',
    tone: 'draft',
    typeKey: 'replyDraft',
    fields: (payload) =>
      compactFields([textField('tone', payload.tone), textField('language', payload.language)]),
  },
  CREATE_CALENDAR_EVENT: {
    actionKey: 'CALENDAR.EVENT.CREATE',
    contractVersion: 1,
    minimumRisk: 'MEDIUM',
    permissionCode: 'CREATE',
    requiredPayloadFields: ['durationMinutes', 'timeZone', 'requiresConfirmation'],
    resourceKey: 'APP.CALENDAR',
    routePrefix: '/calendar/',
    targetKey: 'calendar',
    tone: 'calendar',
    typeKey: 'calendarEvent',
    fields: (payload) =>
      compactFields([
        datetimeField('schedule', payload.startsAt),
        numberField('durationMinutes', payload.durationMinutes, 'durationMinutes'),
        textField('location', payload.location),
        listField('attendees', payload.attendees),
        textField('timeZone', payload.timeZone),
      ]),
  },
  CREATE_LEAVE_REQUEST: {
    actionKey: 'HR.LEAVE.REQUEST.PREPARE',
    contractVersion: 1,
    minimumRisk: 'HIGH',
    permissionCode: 'VIEW',
    requiredPayloadFields: ['durationDays', 'requiresConfirmation'],
    resourceKey: 'APP.HCM',
    routePrefix: '/hr/',
    targetKey: 'hr',
    tone: 'leave',
    typeKey: 'leaveRequest',
    fields: (payload) =>
      compactFields([
        dateRangeField(payload.startsOn, payload.endsOn),
        numberField('durationDays', payload.durationDays, 'durationDays'),
      ]),
  },
  CREATE_TASK: {
    actionKey: 'WORK.TASK.CREATE',
    contractVersion: 1,
    minimumRisk: 'MEDIUM',
    permissionCode: 'UPDATE',
    requiredPayloadFields: ['priority', 'requiresConfirmation'],
    resourceKey: 'APP.WORK',
    routePrefix: '/work',
    targetKey: 'work',
    tone: 'task',
    typeKey: 'task',
    fields: (payload) =>
      compactFields([
        textField('provider', payload.provider ?? payload.targetSystem),
        textField('project', payload.projectName ?? payload.projectKey),
        textField('assignee', payload.assigneeName ?? payload.assignee),
        datetimeField('schedule', payload.dueAt ?? payload.dueDate),
        textField('priority', payload.priority),
      ]),
  },
  ESCALATE_NOTIFICATION: {
    actionKey: 'NOTIFICATION.ESCALATE',
    contractVersion: 1,
    minimumRisk: 'LOW',
    permissionCode: 'UPDATE',
    requiredPayloadFields: ['channel', 'urgency', 'requiresConfirmation'],
    resourceKey: 'APP.MAIL',
    routePrefix: '/mail/',
    targetKey: 'notifications',
    tone: 'notification',
    typeKey: 'notification',
    fields: (payload) =>
      compactFields([textField('channel', payload.channel), textField('urgency', payload.urgency)]),
  },
};

export function mailProposalPresentation(
  proposal: MailActionProposal,
  now = Date.now()
): MailProposalPresentation {
  const descriptor = descriptors[proposal.type];
  if (!descriptor) {
    return {
      actionKey: 'UNSUPPORTED',
      fields: [],
      reviewBlock: 'unsupportedType',
      sourceSummary: evidenceSummary(proposal.evidence),
      targetKey: 'work',
      tone: 'task',
      typeKey: 'task',
    };
  }

  return {
    actionKey: descriptor.actionKey,
    fields: descriptor.fields(proposal.proposedPayload).slice(0, 4),
    reviewBlock: reviewBlock(proposal, descriptor, now),
    sourceSummary: evidenceSummary(proposal.evidence),
    targetKey: descriptor.targetKey,
    tone: descriptor.tone,
    typeKey: descriptor.typeKey,
  };
}

function reviewBlock(
  proposal: MailActionProposal,
  descriptor: ProposalDescriptor,
  now: number
): MailProposalReviewBlock | null {
  if (proposal.status !== 'PROPOSED') return 'handled';
  if (proposal.actionContractVersion !== descriptor.contractVersion) return 'unsupportedVersion';
  const expiresAt = proposal.expiresAt ? Date.parse(proposal.expiresAt) : null;
  if (expiresAt !== null && (!Number.isFinite(expiresAt) || expiresAt <= now)) return 'expired';
  const proposalRisk = riskRank[proposal.riskLevel];
  if (
    proposal.requiredResourceKey !== descriptor.resourceKey ||
    proposal.requiredPermissionCode !== descriptor.permissionCode ||
    !matchesRoutePrefix(proposal.targetRoute, descriptor.routePrefix) ||
    proposal.proposedPayload.requiresConfirmation !== true ||
    !Number.isFinite(proposalRisk) ||
    proposalRisk < riskRank[descriptor.minimumRisk] ||
    descriptor.requiredPayloadFields.some(
      (field) => !Object.prototype.hasOwnProperty.call(proposal.proposedPayload, field)
    )
  ) {
    return 'policyMismatch';
  }
  return null;
}

function matchesRoutePrefix(targetRoute: string | null | undefined, routePrefix: string) {
  if (!targetRoute) return false;
  if (routePrefix.endsWith('/')) return targetRoute.startsWith(routePrefix);
  return (
    targetRoute === routePrefix ||
    targetRoute.startsWith(`${routePrefix}/`) ||
    targetRoute.startsWith(`${routePrefix}?`)
  );
}

const riskRank: Record<MailActionProposal['riskLevel'], number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
};

function evidenceSummary(evidence: Array<Record<string, unknown>>): string | null {
  for (const item of evidence) {
    const value = safeText(item.label ?? item.rationale ?? item.sourceLabel);
    if (value) return value;
  }
  return null;
}

function textField(key: MailProposalField['key'], value: unknown): MailProposalField | null {
  const text = safeText(value);
  return text ? { key, value: text, format: 'text' } : null;
}

function datetimeField(key: MailProposalField['key'], value: unknown): MailProposalField | null {
  const text = safeText(value);
  return text && Number.isFinite(Date.parse(text))
    ? { key, value: text, format: 'datetime' }
    : null;
}

function dateRangeField(startValue: unknown, endValue: unknown): MailProposalField | null {
  const start = safeText(startValue);
  const end = safeText(endValue);
  const dates = [start, end].filter((value): value is string =>
    Boolean(value && Number.isFinite(Date.parse(value)))
  );
  return dates.length ? { key: 'dateRange', value: dates, format: 'date' } : null;
}

function numberField(
  key: MailProposalField['key'],
  value: unknown,
  format: 'durationDays' | 'durationMinutes'
): MailProposalField | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 10_000
    ? { key, value, format }
    : null;
}

function listField(key: MailProposalField['key'], value: unknown): MailProposalField | null {
  if (!Array.isArray(value)) return null;
  const values = value
    .map(safeText)
    .filter((item): item is string => Boolean(item))
    .slice(0, 8);
  return values.length ? { key, value: values, format: 'list' } : null;
}

function safeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized && normalized.length <= 240 ? normalized : null;
}

function compactFields(fields: Array<MailProposalField | null>): MailProposalField[] {
  return fields.filter((field): field is MailProposalField => field !== null);
}
