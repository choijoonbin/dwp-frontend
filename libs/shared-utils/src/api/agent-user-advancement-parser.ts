import { HttpError } from '../http-error';
import { isAgentDate, isAgentRecord } from './agent-governed-api';

import type {
  DwaionAttachmentCapabilities,
  DwaionAttachmentCitation,
  DwaionAttachmentEvidence,
  DwaionAttachmentEvidenceEvent,
  DwaionAttachmentStage,
  DwaionAttachmentStageKey,
  DwaionAttachmentStageState,
  DwaionAttachmentState,
  DwaionAttachmentUploadTicket,
  DwaionProposalHandoff,
  DwaionProposalHandoffState,
  DwaionResearchDelivery,
  DwaionResearchDeliveryState,
  DwaionResearchDeliveryType,
  DwaionResearchCapabilities,
  DwaionResearchDeliverableType,
  DwaionResearchPlan,
  DwaionResearchPlanDefinition,
  DwaionResearchPlanState,
  DwaionResearchProgress,
  DwaionResearchResult,
  DwaionResearchRun,
  DwaionResearchRunState,
  DwaionSecureAttachment,
  DwaionWorkflowCapability,
} from './agent-user-advancement-contract';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256 = /^[0-9a-f]{64}$/u;
const SAFE_CODE = /^[A-Z][A-Z0-9_.-]{1,127}$/u;
const SOURCE_KEY = /^[A-Z][A-Z0-9_.:-]{0,127}$/u;

export function parseDwaionSecureAttachment(value: unknown): DwaionSecureAttachment {
  if (
    !isAgentRecord(value) ||
    !uuid(value.attachmentId) ||
    !(value.conversationId === null || uuid(value.conversationId)) ||
    !boundedString(value.fileName, 1, 255) ||
    /[/\\\0]/u.test(value.fileName) ||
    !boundedString(value.mediaType, 3, 120) ||
    !integer(value.sizeBytes, 1, 104_857_600) ||
    typeof value.sourceSha256 !== 'string' ||
    !SHA256.test(value.sourceSha256) ||
    !integer(value.revision, 1) ||
    !ATTACHMENT_STATES.has(value.state as DwaionAttachmentState) ||
    !Array.isArray(value.stages) ||
    value.stages.length > 6 ||
    !value.stages.every(isAttachmentStage) ||
    new Set(value.stages.map((stage) => stage.key)).size !== value.stages.length ||
    !Array.isArray(value.citations) ||
    value.citations.length > 2_000 ||
    !value.citations.every(isAttachmentCitation) ||
    !isAgentDate(value.retentionExpiresAt) ||
    !isAttachmentCapabilities(value.capabilities) ||
    !(value.uploadTicket === null || isUploadTicket(value.uploadTicket)) ||
    !isAgentDate(value.createdAt) ||
    !isAgentDate(value.updatedAt) ||
    !(value.deletedAt === null || isAgentDate(value.deletedAt)) ||
    !(value.deletionAttemptCount === undefined || integer(value.deletionAttemptCount, 0)) ||
    !(
      value.deletionLastErrorCode === undefined ||
      value.deletionLastErrorCode === null ||
      safeCode(value.deletionLastErrorCode)
    ) ||
    !(
      value.deletionReceiptId === undefined ||
      value.deletionReceiptId === null ||
      boundedString(value.deletionReceiptId, 1, 240)
    )
  ) {
    throw invalid('Secure attachment response is invalid.', value);
  }
  const attachment = value as unknown as DwaionSecureAttachment;
  const normalized: DwaionSecureAttachment = {
    ...attachment,
    deletionAttemptCount: value.deletionAttemptCount ?? 0,
    deletionLastErrorCode: value.deletionLastErrorCode ?? null,
    deletionReceiptId: value.deletionReceiptId ?? null,
  };
  if (
    (normalized.state === 'DELETED') !== (normalized.deletedAt !== null) ||
    (normalized.state === 'UPLOADING') !== (normalized.uploadTicket !== null) ||
    (normalized.state === 'DELETED') !== (normalized.deletionReceiptId !== null)
  ) {
    throw invalid('Secure attachment lifecycle is inconsistent.', value);
  }
  return normalized as DwaionSecureAttachment;
}

export function parseDwaionAttachmentEvidence(value: unknown): DwaionAttachmentEvidence {
  if (
    !isAgentRecord(value) ||
    !uuid(value.attachmentId) ||
    typeof value.sourceSha256 !== 'string' ||
    !SHA256.test(value.sourceSha256) ||
    !(value.deletionAttemptCount === undefined || integer(value.deletionAttemptCount, 0)) ||
    !(
      value.deletionLastErrorCode === undefined ||
      value.deletionLastErrorCode === null ||
      safeCode(value.deletionLastErrorCode)
    ) ||
    !(
      value.deletionReceiptId === undefined ||
      value.deletionReceiptId === null ||
      boundedString(value.deletionReceiptId, 1, 240)
    ) ||
    !Array.isArray(value.stages) ||
    value.stages.length > 6 ||
    !value.stages.every(isAttachmentStage) ||
    new Set(value.stages.map((stage) => stage.key)).size !== value.stages.length ||
    !Array.isArray(value.citations) ||
    value.citations.length > 2_000 ||
    !value.citations.every(isAttachmentCitation) ||
    !evidenceEvents(value.inspectionLog) ||
    !evidenceEvents(value.maskingHistory) ||
    !Array.isArray(value.ocrEvidence) ||
    !value.ocrEvidence.every(isAttachmentCitation)
  ) {
    throw invalid('Secure attachment evidence response is invalid.', value);
  }
  const inspectionIds = new Set(value.inspectionLog.map((event) => event.eventId));
  const citationIds = new Set(value.citations.map((citation) => citation.citationId));
  const ocrPassed = value.stages.some((stage) => stage.key === 'OCR' && stage.state === 'PASSED');
  if (
    value.maskingHistory.some(
      (event) => !inspectionIds.has(event.eventId) || !event.eventType.includes('MASK')
    ) ||
    (!ocrPassed && value.ocrEvidence.length > 0) ||
    value.ocrEvidence.some((citation) => !citationIds.has(citation.citationId))
  ) {
    throw invalid('Secure attachment evidence binding is invalid.', value);
  }
  return {
    ...value,
    deletionAttemptCount: value.deletionAttemptCount ?? 0,
    deletionLastErrorCode: value.deletionLastErrorCode ?? null,
    deletionReceiptId: value.deletionReceiptId ?? null,
  } as DwaionAttachmentEvidence;
}

export function parseDwaionResearchPlan(value: unknown): DwaionResearchPlan {
  if (
    !isAgentRecord(value) ||
    !uuid(value.planId) ||
    !RESEARCH_PLAN_STATES.has(value.state as DwaionResearchPlanState) ||
    !integer(value.revision, 1) ||
    !isResearchPlanDefinition(value.definition) ||
    !isAgentDate(value.createdAt) ||
    !isAgentDate(value.updatedAt)
  ) {
    throw invalid('Deep research plan response is invalid.', value);
  }
  return value as DwaionResearchPlan;
}

export function parseDwaionResearchCapabilities(value: unknown): DwaionResearchCapabilities {
  const delivery = isAgentRecord(value) && isAgentRecord(value.delivery) ? value.delivery : null;
  if (
    !isAgentRecord(value) ||
    !RESEARCH_CAPABILITY_KEYS.every((key) => isWorkflowCapability(value[key])) ||
    delivery === null ||
    !RESEARCH_DELIVERY_CAPABILITY_KEYS.every((key) => isWorkflowCapability(delivery[key]))
  ) {
    throw invalid('Deep research capabilities response is invalid.', value);
  }
  return value as unknown as DwaionResearchCapabilities;
}

export function parseDwaionResearchRun(value: unknown): DwaionResearchRun {
  if (
    !isAgentRecord(value) ||
    !uuid(value.runId) ||
    !uuid(value.planId) ||
    !integer(value.planRevision, 1) ||
    !RESEARCH_RUN_STATES.has(value.state as DwaionResearchRunState) ||
    !integer(value.version, 1) ||
    !isResearchProgress(value.progress) ||
    !(value.result === null || isResearchResult(value.result)) ||
    !(value.receiptId === null || uuid(value.receiptId)) ||
    !(value.safeErrorCode === null || safeCode(value.safeErrorCode)) ||
    !(value.startedAt === null || isAgentDate(value.startedAt)) ||
    !isAgentDate(value.createdAt) ||
    !isAgentDate(value.updatedAt) ||
    !(value.completedAt === null || isAgentDate(value.completedAt))
  ) {
    throw invalid('Deep research run response is invalid.', value);
  }
  const state = value.state as DwaionResearchRunState;
  const completed = state === 'COMPLETED';
  if (
    (state !== 'QUEUED' && value.startedAt === null) ||
    (completed &&
      (value.result === null || value.receiptId === null || value.completedAt === null)) ||
    (!completed && value.result !== null) ||
    (state === 'QUEUED' && value.progress.completedSteps !== 0)
  ) {
    throw invalid('Deep research run lifecycle is inconsistent.', value);
  }
  return value as DwaionResearchRun;
}

export function parseDwaionResearchDelivery(value: unknown): DwaionResearchDelivery {
  if (
    !isAgentRecord(value) ||
    !uuid(value.deliveryId) ||
    !uuid(value.runId) ||
    !DELIVERY_TYPES.has(value.deliveryType as DwaionResearchDeliveryType) ||
    !DELIVERY_STATES.has(value.state as DwaionResearchDeliveryState) ||
    !(value.receiptId === null || uuid(value.receiptId)) ||
    !isAgentDate(value.createdAt) ||
    !isAgentDate(value.updatedAt) ||
    !(value.completedAt === null || isAgentDate(value.completedAt))
  ) {
    throw invalid('Deep research delivery response is invalid.', value);
  }
  if (
    !(value.receipt === undefined || value.receipt === null || isAgentRecord(value.receipt)) ||
    !(
      value.safeErrorCode === undefined ||
      value.safeErrorCode === null ||
      safeCode(value.safeErrorCode)
    ) ||
    !(
      value.recoveryHint === undefined ||
      value.recoveryHint === null ||
      boundedString(value.recoveryHint, 1, 500)
    )
  ) {
    throw invalid('Deep research delivery evidence is invalid.', value);
  }
  const completed = value.state === 'COMPLETED';
  const incomplete = value.state === 'PARTIAL' || value.state === 'FAILED';
  if (
    (completed &&
      (value.receiptId === null || value.completedAt === null || !isAgentRecord(value.receipt))) ||
    (!completed && value.receipt != null) ||
    (incomplete &&
      (!safeCode(value.safeErrorCode) || !boundedString(value.recoveryHint, 1, 500))) ||
    (!incomplete && (value.safeErrorCode != null || value.recoveryHint != null))
  ) {
    throw invalid('Deep research delivery lifecycle evidence is inconsistent.', value);
  }
  return {
    ...value,
    receipt: value.receipt ?? null,
    safeErrorCode: value.safeErrorCode ?? null,
    recoveryHint: value.recoveryHint ?? null,
  } as DwaionResearchDelivery;
}

export function parseDwaionProposalHandoff(value: unknown): DwaionProposalHandoff {
  if (
    !isAgentRecord(value) ||
    !uuid(value.handoffId) ||
    !uuid(value.proposalId) ||
    !safeCode(value.actionKey) ||
    !HANDOFF_STATES.has(value.state as DwaionProposalHandoffState) ||
    !integer(value.version, 1) ||
    !boundedString(value.targetRoute, 1, 1_000) ||
    !value.targetRoute.startsWith('/') ||
    typeof value.approvalRequired !== 'boolean' ||
    !(value.receiptId === null || uuid(value.receiptId)) ||
    !isAgentDate(value.createdAt) ||
    !isAgentDate(value.updatedAt)
  ) {
    throw invalid('Proposal handoff response is invalid.', value);
  }
  if (value.state === 'COMPLETED' && value.receiptId === null)
    throw invalid('Completed proposal handoff lacks a receipt.', value);
  return value as DwaionProposalHandoff;
}

function isResearchPlanDefinition(value: unknown): value is DwaionResearchPlanDefinition {
  if (
    !isAgentRecord(value) ||
    !boundedString(value.goal, 10, 4_000) ||
    !boundedString(value.question, 10, 4_000)
  )
    return false;
  if (
    !Array.isArray(value.successCriteria) ||
    value.successCriteria.length < 1 ||
    value.successCriteria.length > 20 ||
    !value.successCriteria.every((item) => boundedString(item, 1, 1_000)) ||
    new Set(value.successCriteria).size !== value.successCriteria.length ||
    !Array.isArray(value.deliverableTypes) ||
    value.deliverableTypes.length < 1 ||
    value.deliverableTypes.length > 10 ||
    !value.deliverableTypes.every((item) =>
      RESEARCH_DELIVERABLE_TYPES.has(item as DwaionResearchDeliverableType)
    ) ||
    new Set(value.deliverableTypes).size !== value.deliverableTypes.length ||
    !Array.isArray(value.sourcePolicies) ||
    value.sourcePolicies.length < 1 ||
    value.sourcePolicies.length > 100 ||
    !value.sourcePolicies.every(
      (item) =>
        isAgentRecord(item) &&
        typeof item.sourceKey === 'string' &&
        SOURCE_KEY.test(item.sourceKey) &&
        typeof item.allowed === 'boolean' &&
        boundedString(item.scope, 1, 500)
    ) ||
    new Set(value.sourcePolicies.map((item) => item.sourceKey)).size !==
      value.sourcePolicies.length ||
    typeof value.requireAllAllowedSources !== 'boolean' ||
    !isAgentRecord(value.budget) ||
    !integer(value.budget.maximumMinutes, 1, 240) ||
    !integer(value.budget.maximumSources, 1, 500) ||
    !integer(value.budget.maximumTokens, 128, 2_000_000)
  ) {
    return false;
  }
  return true;
}

function isResearchProgress(value: unknown): value is DwaionResearchProgress {
  return (
    isAgentRecord(value) &&
    integer(value.completedSteps, 0) &&
    integer(value.totalSteps, 0) &&
    Number(value.completedSteps) <= Number(value.totalSteps) &&
    integer(value.discoveredSources, 0) &&
    integer(value.verifiedCitations, 0) &&
    !(
      Number(value.verifiedCitations) > Number(value.discoveredSources) &&
      Number(value.discoveredSources) > 0
    ) &&
    Array.isArray(value.failedSources) &&
    value.failedSources.length <= 100 &&
    value.failedSources.every((item) => typeof item === 'string' && SOURCE_KEY.test(item)) &&
    new Set(value.failedSources).size === value.failedSources.length &&
    (value.recoveryHint === null || boundedString(value.recoveryHint, 1, 500))
  );
}

function isResearchResult(value: unknown): value is DwaionResearchResult {
  return (
    isAgentRecord(value) &&
    boundedString(value.reportMarkdown, 1, 1_000_000) &&
    Array.isArray(value.citations) &&
    value.citations.length >= 1 &&
    value.citations.length <= 5_000 &&
    value.citations.every(isAttachmentCitation) &&
    typeof value.resultSha256 === 'string' &&
    SHA256.test(value.resultSha256)
  );
}

function isAttachmentStage(value: unknown): value is DwaionAttachmentStage {
  return (
    isAgentRecord(value) &&
    ATTACHMENT_STAGE_KEYS.has(value.key as DwaionAttachmentStageKey) &&
    ATTACHMENT_STAGE_STATES.has(value.state as DwaionAttachmentStageState) &&
    (value.providerCode === null || boundedString(value.providerCode, 1, 80)) &&
    (value.observedAt === null || isAgentDate(value.observedAt)) &&
    (value.safeErrorCode === null || safeCode(value.safeErrorCode)) &&
    (value.recoveryHint === null || boundedString(value.recoveryHint, 1, 500))
  );
}

function isAttachmentCitation(value: unknown): value is DwaionAttachmentCitation {
  return (
    isAgentRecord(value) &&
    boundedString(value.citationId, 1, 160) &&
    boundedString(value.locator, 1, 500) &&
    boundedString(value.label, 1, 240) &&
    typeof value.contentSha256 === 'string' &&
    SHA256.test(value.contentSha256)
  );
}

function evidenceEvents(value: unknown): value is DwaionAttachmentEvidenceEvent[] {
  return (
    Array.isArray(value) &&
    value.length <= 10_000 &&
    value.every(
      (event) =>
        isAgentRecord(event) &&
        uuid(event.eventId) &&
        safeCode(event.eventType) &&
        (event.previousState === null ||
          ATTACHMENT_STATES.has(event.previousState as DwaionAttachmentState)) &&
        ATTACHMENT_STATES.has(event.currentState as DwaionAttachmentState) &&
        integer(event.revision, 1) &&
        (event.safeErrorCode === null || safeCode(event.safeErrorCode)) &&
        isAgentDate(event.occurredAt)
    ) &&
    new Set(value.map((event) => event.eventId)).size === value.length &&
    value.every(
      (event, index) =>
        index === 0 ||
        Date.parse(value[index - 1].occurredAt) < Date.parse(event.occurredAt) ||
        (value[index - 1].occurredAt === event.occurredAt &&
          value[index - 1].eventId.localeCompare(event.eventId) < 0)
    )
  );
}

function isAttachmentCapabilities(value: unknown): value is DwaionAttachmentCapabilities {
  return (
    isAgentRecord(value) &&
    [
      'upload',
      'antivirus',
      'dlp',
      'parser',
      'ocr',
      'index',
      'deletion',
      'detachAll',
      'inspectionLog',
      'maskingHistory',
      'ocrViewer',
      'signedAuditReport',
    ].every((key) => isWorkflowCapability(value[key])) &&
    integer(value.maximumFileBytes, 1, 104_857_600) &&
    Array.isArray(value.allowedMediaTypes) &&
    value.allowedMediaTypes.every((item) => boundedString(item, 3, 120))
  );
}

function isWorkflowCapability(value: unknown): value is DwaionWorkflowCapability {
  return (
    isAgentRecord(value) &&
    typeof value.available === 'boolean' &&
    typeof value.configured === 'boolean' &&
    (value.reasonCode === null || safeCode(value.reasonCode)) &&
    (value.recoveryHint === null || boundedString(value.recoveryHint, 1, 500)) &&
    (!value.available || value.configured)
  );
}

function isUploadTicket(value: unknown): value is DwaionAttachmentUploadTicket {
  return (
    isAgentRecord(value) &&
    value.method === 'PUT' &&
    boundedString(value.uploadUrl, 8, 8_192) &&
    boundedString(value.uploadReference, 8, 1_000) &&
    !/[?:#]/u.test(value.uploadReference) &&
    isAgentDate(value.expiresAt) &&
    Date.parse(value.expiresAt) > Date.now()
  );
}

function uuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

function safeCode(value: unknown): value is string {
  return typeof value === 'string' && SAFE_CODE.test(value);
}

function boundedString(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string' && value.trim().length >= min && value.length <= max;
}

function integer(value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): value is number {
  return Number.isInteger(value) && Number(value) >= min && Number(value) <= max;
}

function invalid(message: string, value: unknown): HttpError {
  return new HttpError(message, 502, value);
}

const ATTACHMENT_STATES = new Set<DwaionAttachmentState>([
  'UPLOADING',
  'SCANNING',
  'READY',
  'PARTIAL',
  'BLOCKED',
  'FAILED',
  'CANCELLED',
  'DELETION_PENDING',
  'DELETED',
]);
const ATTACHMENT_STAGE_KEYS = new Set<DwaionAttachmentStageKey>([
  'UPLOAD',
  'AV',
  'DLP',
  'PARSER',
  'OCR',
  'INDEX',
]);
const ATTACHMENT_STAGE_STATES = new Set<DwaionAttachmentStageState>([
  'PENDING',
  'RUNNING',
  'PASSED',
  'BLOCKED',
  'FAILED',
  'NOT_REQUIRED',
  'NOT_CONFIGURED',
]);
const RESEARCH_PLAN_STATES = new Set<DwaionResearchPlanState>(['DRAFT', 'READY', 'ARCHIVED']);
const RESEARCH_DELIVERABLE_TYPES = new Set<DwaionResearchDeliverableType>([
  'REPORT',
  'EXECUTIVE_SUMMARY',
  'COMPARISON',
  'SOURCE_MAP',
]);
const RESEARCH_RUN_STATES = new Set<DwaionResearchRunState>([
  'QUEUED',
  'RUNNING',
  'PAUSED',
  'PARTIAL',
  'CONFLICT',
  'CANCELLING',
  'CANCELLED',
  'FAILED',
  'COMPLETED',
]);
const DELIVERY_TYPES = new Set<DwaionResearchDeliveryType>([
  'ARTIFACT',
  'PROPOSAL',
  'EXPORT',
  'HANDOFF',
  'SHARE',
  'ROUTINE',
]);
const DELIVERY_STATES = new Set<DwaionResearchDeliveryState>([
  'QUEUED',
  'AWAITING_APPROVAL',
  'RUNNING',
  'PARTIAL',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);
const RESEARCH_CAPABILITY_KEYS = [
  'rawExport',
  'pdfExport',
  'receiptDownload',
  'auditDownload',
  'fork',
  'merge',
  'keepLocal',
  'sensitivityRecalculation',
  'cacheFallback',
] as const;
const RESEARCH_DELIVERY_CAPABILITY_KEYS = [
  'artifact',
  'proposal',
  'export',
  'handoff',
  'share',
  'routine',
] as const;
const HANDOFF_STATES = new Set<DwaionProposalHandoffState>([
  'REVIEW_REQUIRED',
  'AWAITING_APPROVAL',
  'HANDED_OFF',
  'RUNNING',
  'PARTIAL',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'COMPENSATING',
  'COMPENSATED',
]);
