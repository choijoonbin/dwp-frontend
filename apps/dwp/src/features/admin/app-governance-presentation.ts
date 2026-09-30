const DUTY_LABEL_KEYS: Record<string, string> = {
  APPROVAL_DESIGN_DRAFT: 'appGovernance.presentation.duties.approvalDesignDraft',
  APPROVAL_DESIGN_PUBLISH: 'appGovernance.presentation.duties.approvalDesignPublish',
  APPROVAL_POLICY_DRAFT: 'appGovernance.presentation.duties.approvalPolicyDraft',
  APPROVAL_POLICY_PUBLISH: 'appGovernance.presentation.duties.approvalPolicyPublish',
  APPROVAL_OPERATIONS_EXECUTE: 'appGovernance.presentation.duties.approvalOperationsExecute',
  APPROVAL_OPERATIONS_AUDIT: 'appGovernance.presentation.duties.approvalOperationsAudit',
  APPROVAL_SIGNATURE_READ: 'appGovernance.presentation.duties.approvalSignatureRead',
};

const REVIEW_REASON_LABEL_KEYS: Record<string, string> = {
  PRESET_WORKFLOW_REVIEW_REQUIRED:
    'appGovernance.presentation.reviewReasons.presetWorkflowReviewRequired',
};

const PRINCIPAL_TYPE_LABEL_KEYS: Record<string, string> = {
  USER: 'appGovernance.presentation.principalTypes.user',
  GROUP: 'appGovernance.presentation.principalTypes.group',
};

const REQUEST_CHANNEL_LABEL_KEYS: Record<string, string> = {
  SELF_SERVICE: 'appGovernance.presentation.requestChannels.selfService',
  GOVERNANCE: 'appGovernance.presentation.requestChannels.governance',
};

const ASSIGNMENT_STATES = new Set([
  'PENDING_APPROVAL',
  'APPROVED',
  'ACTIVE',
  'DENIED',
  'REVOKED',
  'EXPIRED',
]);
const REVIEW_STATES = new Set(['OPEN', 'RESOLVED', 'DISMISSED']);
const APP_RESPONSIBILITIES = new Set([
  'APP_OWNER',
  'APP_ACCESS_APPROVER',
  'APP_ACCESS_MANAGER',
  'APP_ACCESS_REVIEWER',
]);

export function isKnownAppResponsibility(value: string): boolean {
  return APP_RESPONSIBILITIES.has(value);
}

export function appResponsibilityLabelKey(value: string): string {
  return isKnownAppResponsibility(value)
    ? `appGovernance.responsibilities.${value}`
    : 'appGovernance.responsibilities.UNKNOWN';
}

export function appDutyLabelKey(code: string): string {
  return DUTY_LABEL_KEYS[code] ?? 'appGovernance.presentation.duties.managed';
}

export function appReviewReasonLabelKey(code: string): string {
  return REVIEW_REASON_LABEL_KEYS[code] ?? 'appGovernance.presentation.reviewReasons.managed';
}

export function appReviewEvidenceLabelKey(evidence: unknown): string {
  return evidence === null || evidence === undefined
    ? 'appGovernance.presentation.evidence.unavailable'
    : 'appGovernance.presentation.evidence.retained';
}

export function appPrincipalTypeLabelKey(type: string): string {
  return PRINCIPAL_TYPE_LABEL_KEYS[type] ?? 'appGovernance.presentation.principalTypes.managed';
}

export function appRequestChannelLabelKey(channel: string): string {
  return (
    REQUEST_CHANNEL_LABEL_KEYS[channel] ?? 'appGovernance.presentation.requestChannels.managed'
  );
}

export function appAssignmentStateLabelKey(state: string): string {
  return ASSIGNMENT_STATES.has(state)
    ? `appGovernance.states.${state}`
    : 'appGovernance.states.UNKNOWN';
}

export function appReviewStateLabelKey(state: string): string {
  return REVIEW_STATES.has(state)
    ? `appGovernance.presets.reviewStates.${state}`
    : 'appGovernance.presets.reviewStates.UNKNOWN';
}
