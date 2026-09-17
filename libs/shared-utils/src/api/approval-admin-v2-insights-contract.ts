import {
  adminV2Array,
  adminV2Boolean,
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
  ApprovalAdminV2Tone,
} from './approval-admin-v2-contract-core';

export type ApprovalAnalyticsInsightsSnapshot = Readonly<{
  meta: ApprovalAdminV2SnapshotMeta;
  metrics: readonly ApprovalAdminV2Metric[];
  coverageFacts: readonly ApprovalAdminV2Fact[];
  cohorts: readonly Readonly<{
    id: string;
    label: string;
    sampleLabel: string;
    cycleTimeLabel: string;
    slaLabel: string;
    conformanceLabel: string;
    suppressed: boolean;
    status: ApprovalAdminV2Status;
    facts: readonly ApprovalAdminV2Fact[];
  }>[];
  stages: readonly Readonly<{
    id: string;
    label: string;
    sequenceLabel: string;
    p50Label: string;
    p90Label: string;
    sampleLabel: string;
    tone: ApprovalAdminV2Tone;
  }>[];
  recommendations: readonly Readonly<{
    id: string;
    title: string;
    detail: string;
    evidence: string;
    status: ApprovalAdminV2Status;
  }>[];
}>;

export type ApprovalDeploymentSnapshot = Readonly<{
  meta: ApprovalAdminV2SnapshotMeta;
  metrics: readonly ApprovalAdminV2Metric[];
  packages: readonly Readonly<{
    id: string;
    name: string;
    description: string;
    versionLabel: string;
    environmentLabel: string;
    digestLabel: string;
    assetCountLabel: string;
    status: ApprovalAdminV2Status;
    validationStatus: ApprovalAdminV2Status;
    facts: readonly ApprovalAdminV2Fact[];
    dependencies: readonly ApprovalAdminV2TimelineItem[];
    command: ApprovalAdminV2CommandTarget;
  }>[];
  promotionPlan: Readonly<{
    id: string;
    packageId: string;
    title: string;
    description: string;
    sourceEnvironmentLabel: string;
    targetEnvironmentLabel: string;
    scheduledLabel: string;
    validationStatus: ApprovalAdminV2Status;
    reviewStatus: ApprovalAdminV2Status;
    facts: readonly ApprovalAdminV2Fact[];
    gates: readonly ApprovalAdminV2TimelineItem[];
    command: ApprovalAdminV2CommandTarget;
  }> | null;
  canaryEvidence: Readonly<{
    planId: string;
    status: ApprovalAdminV2Status;
    sampledAtLabel: string;
    sourceRevisionLabel: string;
    evidenceWindowLabel: string;
    metrics: readonly ApprovalAdminV2Metric[];
    observations: readonly ApprovalAdminV2TimelineItem[];
    command: ApprovalAdminV2CommandTarget;
  }> | null;
  rollbackAssessment: Readonly<{
    planId: string;
    status: ApprovalAdminV2Status;
    reversible: boolean;
    assessedAtLabel: string;
    sourceRevisionLabel: string;
    summary: string;
    facts: readonly ApprovalAdminV2Fact[];
    blockers: readonly Readonly<{
      id: string;
      title: string;
      detail: string;
      status: ApprovalAdminV2Status;
    }>[];
    command: ApprovalAdminV2CommandTarget;
  }> | null;
}>;

const TONES = ['neutral', 'info', 'success', 'warning', 'danger'] as const;

function parseMetrics(record: Record<string, unknown>, path: string) {
  return adminV2Array(record.metrics, `${path}.metrics`, parseAdminV2Metric, 20);
}

function parseFacts(record: Record<string, unknown>, path: string) {
  return adminV2Array(record.facts, `${path}.facts`, parseAdminV2Fact, 40);
}

export function parseApprovalAnalyticsInsightsSnapshot(
  value: unknown
): ApprovalAnalyticsInsightsSnapshot {
  const path = 'data';
  const record = adminV2Record(value, path);
  return {
    meta: parseAdminV2SnapshotMeta(record.meta),
    metrics: parseMetrics(record, path),
    coverageFacts: adminV2Array(
      record.coverageFacts,
      `${path}.coverageFacts`,
      parseAdminV2Fact,
      40
    ),
    cohorts: adminV2Array(record.cohorts, `${path}.cohorts`, parseCohort, 200),
    stages: adminV2Array(record.stages, `${path}.stages`, parseStage, 200),
    recommendations: adminV2Array(
      record.recommendations,
      `${path}.recommendations`,
      parseRecommendation,
      100
    ),
  };
}

function parseCohort(value: unknown, path: string) {
  const record = adminV2Record(value, path);
  return {
    id: adminV2Identifier(record.id, `${path}.id`),
    label: adminV2Text(record.label, `${path}.label`, { max: 200 }),
    sampleLabel: adminV2Text(record.sampleLabel, `${path}.sampleLabel`, { max: 120 }),
    cycleTimeLabel: adminV2Text(record.cycleTimeLabel, `${path}.cycleTimeLabel`, { max: 120 }),
    slaLabel: adminV2Text(record.slaLabel, `${path}.slaLabel`, { max: 120 }),
    conformanceLabel: adminV2Text(record.conformanceLabel, `${path}.conformanceLabel`, {
      max: 120,
    }),
    suppressed: adminV2Boolean(record.suppressed, `${path}.suppressed`),
    status: parseAdminV2Status(record.status, `${path}.status`),
    facts: parseFacts(record, path),
  };
}

function parseStage(value: unknown, path: string) {
  const record = adminV2Record(value, path);
  const tone = record.tone;
  if (typeof tone !== 'string' || !TONES.includes(tone as (typeof TONES)[number])) {
    throw new Error(`Invalid Approval administration response at ${path}.tone.`);
  }
  return {
    id: adminV2Identifier(record.id, `${path}.id`),
    label: adminV2Text(record.label, `${path}.label`, { max: 200 }),
    sequenceLabel: adminV2Text(record.sequenceLabel, `${path}.sequenceLabel`, { max: 120 }),
    p50Label: adminV2Text(record.p50Label, `${path}.p50Label`, { max: 120 }),
    p90Label: adminV2Text(record.p90Label, `${path}.p90Label`, { max: 120 }),
    sampleLabel: adminV2Text(record.sampleLabel, `${path}.sampleLabel`, { max: 120 }),
    tone: tone as ApprovalAdminV2Tone,
  };
}

function parseRecommendation(value: unknown, path: string) {
  const record = adminV2Record(value, path);
  return {
    id: adminV2Identifier(record.id, `${path}.id`),
    title: adminV2Text(record.title, `${path}.title`, { max: 200 }),
    detail: adminV2Text(record.detail, `${path}.detail`, { max: 1600 }),
    evidence: adminV2Text(record.evidence, `${path}.evidence`, { max: 1200 }),
    status: parseAdminV2Status(record.status, `${path}.status`),
  };
}

export function parseApprovalDeploymentSnapshot(value: unknown): ApprovalDeploymentSnapshot {
  const path = 'data';
  const record = adminV2Record(value, path);
  return {
    meta: parseAdminV2SnapshotMeta(record.meta),
    metrics: parseMetrics(record, path),
    packages: adminV2Array(record.packages, `${path}.packages`, parsePackage, 200),
    promotionPlan:
      record.promotionPlan === null
        ? null
        : parsePromotionPlan(record.promotionPlan, `${path}.promotionPlan`),
    canaryEvidence:
      record.canaryEvidence === null
        ? null
        : parseCanaryEvidence(record.canaryEvidence, `${path}.canaryEvidence`),
    rollbackAssessment:
      record.rollbackAssessment === null
        ? null
        : parseRollbackAssessment(record.rollbackAssessment, `${path}.rollbackAssessment`),
  };
}

function parsePackage(value: unknown, path: string) {
  const record = adminV2Record(value, path);
  return {
    id: adminV2Identifier(record.id, `${path}.id`),
    name: adminV2Text(record.name, `${path}.name`, { max: 200 }),
    description: adminV2Text(record.description, `${path}.description`, { max: 1600 }),
    versionLabel: adminV2Text(record.versionLabel, `${path}.versionLabel`, { max: 80 }),
    environmentLabel: adminV2Text(record.environmentLabel, `${path}.environmentLabel`, {
      max: 120,
    }),
    digestLabel: adminV2Text(record.digestLabel, `${path}.digestLabel`, { max: 300 }),
    assetCountLabel: adminV2Text(record.assetCountLabel, `${path}.assetCountLabel`, { max: 120 }),
    status: parseAdminV2Status(record.status, `${path}.status`),
    validationStatus: parseAdminV2Status(record.validationStatus, `${path}.validationStatus`),
    facts: parseFacts(record, path),
    dependencies: adminV2Array(
      record.dependencies,
      `${path}.dependencies`,
      parseAdminV2TimelineItem,
      200
    ),
    command: parseAdminV2CommandTarget(record.command, `${path}.command`),
  };
}

function parsePromotionPlan(value: unknown, path: string) {
  const record = adminV2Record(value, path);
  return {
    id: adminV2Identifier(record.id, `${path}.id`),
    packageId: adminV2Identifier(record.packageId, `${path}.packageId`),
    title: adminV2Text(record.title, `${path}.title`, { max: 200 }),
    description: adminV2Text(record.description, `${path}.description`, { max: 1600 }),
    sourceEnvironmentLabel: adminV2Text(
      record.sourceEnvironmentLabel,
      `${path}.sourceEnvironmentLabel`,
      { max: 120 }
    ),
    targetEnvironmentLabel: adminV2Text(
      record.targetEnvironmentLabel,
      `${path}.targetEnvironmentLabel`,
      { max: 120 }
    ),
    scheduledLabel: adminV2Text(record.scheduledLabel, `${path}.scheduledLabel`, { max: 160 }),
    validationStatus: parseAdminV2Status(record.validationStatus, `${path}.validationStatus`),
    reviewStatus: parseAdminV2Status(record.reviewStatus, `${path}.reviewStatus`),
    facts: parseFacts(record, path),
    gates: adminV2Array(record.gates, `${path}.gates`, parseAdminV2TimelineItem, 100),
    command: parseAdminV2CommandTarget(record.command, `${path}.command`),
  };
}

function parseCanaryEvidence(value: unknown, path: string) {
  const record = adminV2Record(value, path);
  return {
    planId: adminV2Identifier(record.planId, `${path}.planId`),
    status: parseAdminV2Status(record.status, `${path}.status`),
    sampledAtLabel: adminV2Text(record.sampledAtLabel, `${path}.sampledAtLabel`, { max: 160 }),
    sourceRevisionLabel: adminV2Text(record.sourceRevisionLabel, `${path}.sourceRevisionLabel`, {
      max: 200,
    }),
    evidenceWindowLabel: adminV2Text(record.evidenceWindowLabel, `${path}.evidenceWindowLabel`, {
      max: 160,
    }),
    metrics: parseMetrics(record, path),
    observations: adminV2Array(
      record.observations,
      `${path}.observations`,
      parseAdminV2TimelineItem,
      100
    ),
    command: parseAdminV2CommandTarget(record.command, `${path}.command`),
  };
}

function parseRollbackAssessment(value: unknown, path: string) {
  const record = adminV2Record(value, path);
  return {
    planId: adminV2Identifier(record.planId, `${path}.planId`),
    status: parseAdminV2Status(record.status, `${path}.status`),
    reversible: adminV2Boolean(record.reversible, `${path}.reversible`),
    assessedAtLabel: adminV2Text(record.assessedAtLabel, `${path}.assessedAtLabel`, { max: 160 }),
    sourceRevisionLabel: adminV2Text(record.sourceRevisionLabel, `${path}.sourceRevisionLabel`, {
      max: 200,
    }),
    summary: adminV2Text(record.summary, `${path}.summary`, { max: 2000 }),
    facts: parseFacts(record, path),
    blockers: adminV2Array(
      record.blockers,
      `${path}.blockers`,
      (blocker, blockerPath) => {
        const source = adminV2Record(blocker, blockerPath);
        return {
          id: adminV2Identifier(source.id, `${blockerPath}.id`),
          title: adminV2Text(source.title, `${blockerPath}.title`, { max: 200 }),
          detail: adminV2Text(source.detail, `${blockerPath}.detail`, { max: 1600 }),
          status: parseAdminV2Status(source.status, `${blockerPath}.status`),
        };
      },
      100
    ),
    command: parseAdminV2CommandTarget(record.command, `${path}.command`),
  };
}
