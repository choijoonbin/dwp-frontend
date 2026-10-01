const SEVERITIES = new Set(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const OUTCOMES = new Set(['SUCCESS', 'DENIED', 'FAILED']);
const CATEGORIES = new Set([
  'ADMIN_CHANGE',
  'AUTHENTICATION',
  'AUTHORIZATION',
  'DATA_ACCESS',
  'DATA_EXPORT',
  'PROVISIONING',
  'AI_ACTION',
  'POLICY_DENIED',
  'SYSTEM_EVENT',
]);
const DOMAINS = new Set([
  'IDENTITY_ACCESS',
  'PEOPLE_WORKFORCE',
  'PLATFORM_WORKSPACE',
  'PROVIDER_OPERATIONS',
  'AI_AUTOMATION',
  'DATA_GOVERNANCE',
]);
const CLASSIFICATIONS = new Set(['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED']);
const FINDING_STATES = new Set(['OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED', 'DISMISSED']);
const CASE_STATES = new Set(['OPEN', 'INVESTIGATING', 'CONTAINED', 'RESOLVED', 'CLOSED']);
const SLA_STATES = new Set(['ON_TRACK', 'AT_RISK', 'BREACHED', 'COMPLETED']);
const ACTIVITY_TYPES = new Set([
  'CASE_CREATED',
  'CASE_UPDATED',
  'STATUS_CHANGED',
  'ASSIGNMENT_CHANGED',
  'FINDING_LINKED',
  'EVIDENCE_LINKED',
  'NOTE_ADDED',
  'TASK_CREATED',
  'TASK_UPDATED',
  'RESOLUTION_RECORDED',
]);
const SOURCE_SERVICES: Record<string, string> = {
  'dwp-auth-server': 'AUTH',
  'dwp-platform-server': 'PLATFORM',
  'dwp-provider-server': 'PROVIDER',
  'dwp-gateway': 'GATEWAY',
  'dwp-notification-server': 'NOTIFICATION',
  'dwp-agent-runtime': 'AUTOMATION',
};
const ENTITY_RELATIONSHIPS = new Set(['ACTOR', 'TARGET', 'SOURCE']);

export function auditSeverityLabelKey(value: string): string {
  return `auditControl.severity.${SEVERITIES.has(value) ? value : 'UNKNOWN'}`;
}

export function auditOutcomeLabelKey(value: string): string {
  return `auditControl.outcome.${OUTCOMES.has(value) ? value : 'UNKNOWN'}`;
}

export function auditCategoryLabelKey(value: string): string {
  return `auditControl.category.${CATEGORIES.has(value) ? value : 'UNKNOWN'}`;
}

export function auditDomainLabelKey(value: string): string {
  return `auditControl.correlation.domain.${DOMAINS.has(value) ? value : 'UNKNOWN'}`;
}

export function auditClassificationLabelKey(value: string): string {
  return `auditControl.correlation.classification.${
    CLASSIFICATIONS.has(value) ? value : 'UNKNOWN'
  }`;
}

export function auditFindingStateLabelKey(value: string): string {
  return `auditControl.findingStatus.${FINDING_STATES.has(value) ? value : 'UNKNOWN'}`;
}

export function auditCaseStateLabelKey(value: string): string {
  return `auditControl.caseStatus.${CASE_STATES.has(value) ? value : 'UNKNOWN'}`;
}

export function auditSlaLabelKey(value: string): string {
  return `auditControl.sla.${SLA_STATES.has(value) ? value : 'UNKNOWN'}`;
}

export function auditActivityLabelKey(value: string): string {
  return `auditControl.activity.${ACTIVITY_TYPES.has(value) ? value : 'UNKNOWN'}`;
}

export function auditSourceServiceLabelKey(value: string): string {
  return `auditControl.sourceServices.${SOURCE_SERVICES[value] ?? 'UNKNOWN'}`;
}

export function auditEntityRelationshipLabelKey(value: string): string {
  return `auditControl.entity.relationship.${ENTITY_RELATIONSHIPS.has(value) ? value : 'UNKNOWN'}`;
}

export function auditSlaColor(value: string): 'success' | 'warning' | 'error' | 'default' {
  if (value === 'BREACHED') return 'error';
  if (value === 'AT_RISK') return 'warning';
  if (value === 'ON_TRACK' || value === 'COMPLETED') return 'success';
  return 'default';
}

export function strongestAuditClassification(values: readonly string[]): string {
  if (values.includes('RESTRICTED')) return 'RESTRICTED';
  if (values.includes('CONFIDENTIAL')) return 'CONFIDENTIAL';
  if (values.includes('INTERNAL')) return 'INTERNAL';
  return 'UNKNOWN';
}

export function auditActorLabel(
  actor: {
    actorDisplayName?: string | null;
    actorPrincipal?: string | null;
    actorId?: string | null;
  },
  unavailableLabel: string
): string {
  return actor.actorDisplayName || actor.actorPrincipal || actor.actorId || unavailableLabel;
}
