import {
  adminV2Array,
  adminV2Identifier,
  adminV2Record,
  adminV2Text,
  parseAdminV2CommandTarget,
  parseAdminV2Fact,
  parseAdminV2Metric,
  parseAdminV2SnapshotMeta,
  parseAdminV2Status,
  parseAdminV2TimelineItem,
} from './approval-admin-v2-contract-core';

import type {
  ApprovalAdminV2CommandTarget,
  ApprovalAdminV2Fact,
  ApprovalAdminV2Metric,
  ApprovalAdminV2SnapshotMeta,
  ApprovalAdminV2Status,
  ApprovalAdminV2TimelineItem,
} from './approval-admin-v2-contract-core';

export type ApprovalConnectorAutomationSnapshot = Readonly<{
  meta: ApprovalAdminV2SnapshotMeta;
  metrics: readonly ApprovalAdminV2Metric[];
  connectors: readonly Readonly<{
    id: string;
    name: string;
    summary: string;
    typeLabel: string;
    lifecycle: ApprovalAdminV2Status;
    versionLabel: string;
    updatedLabel: string;
    facts: readonly ApprovalAdminV2Fact[];
    mappings: readonly Readonly<{
      id: string;
      source: string;
      target: string;
      transformation: string;
      status: ApprovalAdminV2Status;
    }>[];
    probes: readonly ApprovalAdminV2TimelineItem[];
    probeCommand: ApprovalAdminV2CommandTarget;
    publishCommand: ApprovalAdminV2CommandTarget;
  }>[];
}>;

export type ApprovalIncidentRecoverySnapshot = Readonly<{
  meta: ApprovalAdminV2SnapshotMeta;
  metrics: readonly ApprovalAdminV2Metric[];
  incidents: readonly Readonly<{
    id: string;
    title: string;
    description: string;
    severityLabel: string;
    detectedLabel: string;
    affectedLabel: string;
    correlationLabel: string;
    status: ApprovalAdminV2Status;
    sourceStatus: ApprovalAdminV2Status;
    facts: readonly ApprovalAdminV2Fact[];
    evidence: readonly ApprovalAdminV2TimelineItem[];
    command: ApprovalAdminV2CommandTarget;
  }>[];
  recoveryPlan: Readonly<{
    incidentId: string;
    planId: string;
    planRevisionLabel: string;
    createdAtLabel: string;
    dryRunStatus: ApprovalAdminV2Status;
    executionStatus: ApprovalAdminV2Status;
    eligibilityFacts: readonly ApprovalAdminV2Fact[];
    steps: readonly ApprovalAdminV2TimelineItem[];
    redactedPayloadLabel: string;
    redactedPayloadPreview: string;
    command: ApprovalAdminV2CommandTarget;
  }> | null;
  queues: readonly Readonly<{
    id: string;
    name: string;
    description: string;
    depthLabel: string;
    oldestLabel: string;
    sourceRevisionLabel: string;
    status: ApprovalAdminV2Status;
    command: ApprovalAdminV2CommandTarget;
  }>[];
}>;

export type ApprovalAuditRecordsSnapshot = Readonly<{
  meta: ApprovalAdminV2SnapshotMeta;
  metrics: readonly ApprovalAdminV2Metric[];
  events: readonly Readonly<{
    id: string;
    title: string;
    description: string;
    eventTimeLabel: string;
    actorLabel: string;
    targetLabel: string;
    correlationLabel: string;
    classificationLabel: string;
    status: ApprovalAdminV2Status;
    integrityStatus: ApprovalAdminV2Status;
  }>[];
  evidenceBundle: Readonly<{
    eventId: string;
    requestId: string;
    bundleId: string;
    title: string;
    description: string;
    generatedAtLabel: string;
    sourceRevisionLabel: string;
    integrityStatus: ApprovalAdminV2Status;
    archiveStatus: ApprovalAdminV2Status;
    integrityStatement: string;
    facts: readonly ApprovalAdminV2Fact[];
    timeline: readonly ApprovalAdminV2TimelineItem[];
    manifests: readonly Readonly<{
      id: string;
      name: string;
      digestLabel: string;
      sourceLabel: string;
      status: ApprovalAdminV2Status;
    }>[];
    verifyCommand: ApprovalAdminV2CommandTarget;
    exportCommand: ApprovalAdminV2CommandTarget;
  }> | null;
  retentionRecords: readonly Readonly<{
    id: string;
    title: string;
    description: string;
    retainUntilLabel: string;
    legalHoldLabel: string;
    purgeStageLabel: string;
    foreignCopyLabel: string;
    status: ApprovalAdminV2Status;
    evidenceStatus: ApprovalAdminV2Status;
    facts: readonly ApprovalAdminV2Fact[];
    command: ApprovalAdminV2CommandTarget;
  }>[];
}>;

function parseMetrics(record: Record<string, unknown>, path: string) {
  return adminV2Array(record.metrics, `${path}.metrics`, parseAdminV2Metric, 20);
}

function parseFacts(record: Record<string, unknown>, path: string) {
  return adminV2Array(record.facts, `${path}.facts`, parseAdminV2Fact, 40);
}

export function parseApprovalConnectorAutomationSnapshot(
  value: unknown
): ApprovalConnectorAutomationSnapshot {
  const path = 'data';
  const record = adminV2Record(value, path);
  return {
    meta: parseAdminV2SnapshotMeta(record.meta),
    metrics: parseMetrics(record, path),
    connectors: adminV2Array(record.connectors, `${path}.connectors`, parseConnector, 200),
  };
}

function parseConnector(value: unknown, path: string) {
  const record = adminV2Record(value, path);
  return {
    id: adminV2Identifier(record.id, `${path}.id`),
    name: adminV2Text(record.name, `${path}.name`, { max: 200 }),
    summary: adminV2Text(record.summary, `${path}.summary`, { max: 1200 }),
    typeLabel: adminV2Text(record.typeLabel, `${path}.typeLabel`, { max: 120 }),
    lifecycle: parseAdminV2Status(record.lifecycle, `${path}.lifecycle`),
    versionLabel: adminV2Text(record.versionLabel, `${path}.versionLabel`, { max: 80 }),
    updatedLabel: adminV2Text(record.updatedLabel, `${path}.updatedLabel`, { max: 160 }),
    facts: parseFacts(record, path),
    mappings: adminV2Array(
      record.mappings,
      `${path}.mappings`,
      (mapping, mappingPath) => {
        const source = adminV2Record(mapping, mappingPath);
        return {
          id: adminV2Identifier(source.id, `${mappingPath}.id`),
          source: adminV2Text(source.source, `${mappingPath}.source`, { max: 300 }),
          target: adminV2Text(source.target, `${mappingPath}.target`, { max: 300 }),
          transformation: adminV2Text(source.transformation, `${mappingPath}.transformation`, {
            max: 1000,
          }),
          status: parseAdminV2Status(source.status, `${mappingPath}.status`),
        };
      },
      300
    ),
    probes: adminV2Array(record.probes, `${path}.probes`, parseAdminV2TimelineItem, 100),
    probeCommand: parseAdminV2CommandTarget(record.probeCommand, `${path}.probeCommand`),
    publishCommand: parseAdminV2CommandTarget(record.publishCommand, `${path}.publishCommand`),
  };
}

export function parseApprovalIncidentRecoverySnapshot(
  value: unknown
): ApprovalIncidentRecoverySnapshot {
  const path = 'data';
  const record = adminV2Record(value, path);
  return {
    meta: parseAdminV2SnapshotMeta(record.meta),
    metrics: parseMetrics(record, path),
    incidents: adminV2Array(record.incidents, `${path}.incidents`, parseIncident, 200),
    recoveryPlan:
      record.recoveryPlan === null
        ? null
        : parseRecoveryPlan(record.recoveryPlan, `${path}.recoveryPlan`),
    queues: adminV2Array(record.queues, `${path}.queues`, parseQueue, 100),
  };
}

function parseIncident(value: unknown, path: string) {
  const record = adminV2Record(value, path);
  return {
    id: adminV2Identifier(record.id, `${path}.id`),
    title: adminV2Text(record.title, `${path}.title`, { max: 200 }),
    description: adminV2Text(record.description, `${path}.description`, { max: 1600 }),
    severityLabel: adminV2Text(record.severityLabel, `${path}.severityLabel`, { max: 120 }),
    detectedLabel: adminV2Text(record.detectedLabel, `${path}.detectedLabel`, { max: 160 }),
    affectedLabel: adminV2Text(record.affectedLabel, `${path}.affectedLabel`, { max: 200 }),
    correlationLabel: adminV2Text(record.correlationLabel, `${path}.correlationLabel`, {
      max: 240,
    }),
    status: parseAdminV2Status(record.status, `${path}.status`),
    sourceStatus: parseAdminV2Status(record.sourceStatus, `${path}.sourceStatus`),
    facts: parseFacts(record, path),
    evidence: adminV2Array(record.evidence, `${path}.evidence`, parseAdminV2TimelineItem, 100),
    command: parseAdminV2CommandTarget(record.command, `${path}.command`),
  };
}

function parseRecoveryPlan(value: unknown, path: string) {
  const record = adminV2Record(value, path);
  return {
    incidentId: adminV2Identifier(record.incidentId, `${path}.incidentId`),
    planId: adminV2Identifier(record.planId, `${path}.planId`),
    planRevisionLabel: adminV2Text(record.planRevisionLabel, `${path}.planRevisionLabel`, {
      max: 160,
    }),
    createdAtLabel: adminV2Text(record.createdAtLabel, `${path}.createdAtLabel`, { max: 160 }),
    dryRunStatus: parseAdminV2Status(record.dryRunStatus, `${path}.dryRunStatus`),
    executionStatus: parseAdminV2Status(record.executionStatus, `${path}.executionStatus`),
    eligibilityFacts: adminV2Array(
      record.eligibilityFacts,
      `${path}.eligibilityFacts`,
      parseAdminV2Fact,
      40
    ),
    steps: adminV2Array(record.steps, `${path}.steps`, parseAdminV2TimelineItem, 100),
    redactedPayloadLabel: adminV2Text(record.redactedPayloadLabel, `${path}.redactedPayloadLabel`, {
      max: 200,
    }),
    redactedPayloadPreview: adminV2Text(
      record.redactedPayloadPreview,
      `${path}.redactedPayloadPreview`,
      { max: 8000 }
    ),
    command: parseAdminV2CommandTarget(record.command, `${path}.command`),
  };
}

function parseQueue(value: unknown, path: string) {
  const record = adminV2Record(value, path);
  return {
    id: adminV2Identifier(record.id, `${path}.id`),
    name: adminV2Text(record.name, `${path}.name`, { max: 200 }),
    description: adminV2Text(record.description, `${path}.description`, { max: 1200 }),
    depthLabel: adminV2Text(record.depthLabel, `${path}.depthLabel`, { max: 120 }),
    oldestLabel: adminV2Text(record.oldestLabel, `${path}.oldestLabel`, { max: 160 }),
    sourceRevisionLabel: adminV2Text(record.sourceRevisionLabel, `${path}.sourceRevisionLabel`, {
      max: 200,
    }),
    status: parseAdminV2Status(record.status, `${path}.status`),
    command: parseAdminV2CommandTarget(record.command, `${path}.command`),
  };
}

export function parseApprovalAuditRecordsSnapshot(value: unknown): ApprovalAuditRecordsSnapshot {
  const path = 'data';
  const record = adminV2Record(value, path);
  return {
    meta: parseAdminV2SnapshotMeta(record.meta),
    metrics: parseMetrics(record, path),
    events: adminV2Array(record.events, `${path}.events`, parseAuditEvent, 500),
    evidenceBundle:
      record.evidenceBundle === null
        ? null
        : parseEvidenceBundle(record.evidenceBundle, `${path}.evidenceBundle`),
    retentionRecords: adminV2Array(
      record.retentionRecords,
      `${path}.retentionRecords`,
      parseRetentionRecord,
      300
    ),
  };
}

function parseAuditEvent(value: unknown, path: string) {
  const record = adminV2Record(value, path);
  return {
    id: adminV2Identifier(record.id, `${path}.id`),
    title: adminV2Text(record.title, `${path}.title`, { max: 200 }),
    description: adminV2Text(record.description, `${path}.description`, { max: 1600 }),
    eventTimeLabel: adminV2Text(record.eventTimeLabel, `${path}.eventTimeLabel`, { max: 160 }),
    actorLabel: adminV2Text(record.actorLabel, `${path}.actorLabel`, { max: 240 }),
    targetLabel: adminV2Text(record.targetLabel, `${path}.targetLabel`, { max: 300 }),
    correlationLabel: adminV2Text(record.correlationLabel, `${path}.correlationLabel`, {
      max: 240,
    }),
    classificationLabel: adminV2Text(record.classificationLabel, `${path}.classificationLabel`, {
      max: 160,
    }),
    status: parseAdminV2Status(record.status, `${path}.status`),
    integrityStatus: parseAdminV2Status(record.integrityStatus, `${path}.integrityStatus`),
  };
}

function parseEvidenceBundle(value: unknown, path: string) {
  const record = adminV2Record(value, path);
  return {
    eventId: adminV2Identifier(record.eventId, `${path}.eventId`),
    requestId: adminV2Identifier(record.requestId, `${path}.requestId`),
    bundleId: adminV2Identifier(record.bundleId, `${path}.bundleId`),
    title: adminV2Text(record.title, `${path}.title`, { max: 200 }),
    description: adminV2Text(record.description, `${path}.description`, { max: 1600 }),
    generatedAtLabel: adminV2Text(record.generatedAtLabel, `${path}.generatedAtLabel`, {
      max: 160,
    }),
    sourceRevisionLabel: adminV2Text(record.sourceRevisionLabel, `${path}.sourceRevisionLabel`, {
      max: 200,
    }),
    integrityStatus: parseAdminV2Status(record.integrityStatus, `${path}.integrityStatus`),
    archiveStatus: parseAdminV2Status(record.archiveStatus, `${path}.archiveStatus`),
    integrityStatement: adminV2Text(record.integrityStatement, `${path}.integrityStatement`, {
      max: 3000,
    }),
    facts: parseFacts(record, path),
    timeline: adminV2Array(record.timeline, `${path}.timeline`, parseAdminV2TimelineItem, 100),
    manifests: adminV2Array(
      record.manifests,
      `${path}.manifests`,
      (manifest, manifestPath) => {
        const source = adminV2Record(manifest, manifestPath);
        return {
          id: adminV2Identifier(source.id, `${manifestPath}.id`),
          name: adminV2Text(source.name, `${manifestPath}.name`, { max: 240 }),
          digestLabel: adminV2Text(source.digestLabel, `${manifestPath}.digestLabel`, { max: 300 }),
          sourceLabel: adminV2Text(source.sourceLabel, `${manifestPath}.sourceLabel`, { max: 300 }),
          status: parseAdminV2Status(source.status, `${manifestPath}.status`),
        };
      },
      200
    ),
    verifyCommand: parseAdminV2CommandTarget(record.verifyCommand, `${path}.verifyCommand`),
    exportCommand: parseAdminV2CommandTarget(record.exportCommand, `${path}.exportCommand`),
  };
}

function parseRetentionRecord(value: unknown, path: string) {
  const record = adminV2Record(value, path);
  return {
    id: adminV2Identifier(record.id, `${path}.id`),
    title: adminV2Text(record.title, `${path}.title`, { max: 200 }),
    description: adminV2Text(record.description, `${path}.description`, { max: 1600 }),
    retainUntilLabel: adminV2Text(record.retainUntilLabel, `${path}.retainUntilLabel`, {
      max: 160,
    }),
    legalHoldLabel: adminV2Text(record.legalHoldLabel, `${path}.legalHoldLabel`, { max: 160 }),
    purgeStageLabel: adminV2Text(record.purgeStageLabel, `${path}.purgeStageLabel`, { max: 160 }),
    foreignCopyLabel: adminV2Text(record.foreignCopyLabel, `${path}.foreignCopyLabel`, {
      max: 240,
    }),
    status: parseAdminV2Status(record.status, `${path}.status`),
    evidenceStatus: parseAdminV2Status(record.evidenceStatus, `${path}.evidenceStatus`),
    facts: parseFacts(record, path),
    command: parseAdminV2CommandTarget(record.command, `${path}.command`),
  };
}
