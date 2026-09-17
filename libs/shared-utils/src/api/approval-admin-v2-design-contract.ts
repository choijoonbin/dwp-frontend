import {
  adminV2Array,
  adminV2Boolean,
  adminV2Identifier,
  adminV2Number,
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

export type ApprovalTemplateLibrarySnapshot = Readonly<{
  meta: ApprovalAdminV2SnapshotMeta;
  metrics: readonly ApprovalAdminV2Metric[];
  categories: readonly Readonly<{ id: string; label: string; count: number }>[];
  templates: readonly Readonly<{
    id: string;
    name: string;
    summary: string;
    categoryId: string;
    categoryLabel: string;
    ownerLabel: string;
    versionLabel: string;
    usageLabel: string;
    updatedLabel: string;
    status: ApprovalAdminV2Status;
    featured: boolean;
    installed: boolean;
    facts: readonly ApprovalAdminV2Fact[];
    dependencies: readonly Readonly<{
      id: string;
      name: string;
      detail: string;
      status: ApprovalAdminV2Status;
      meta?: string;
    }>[];
    releaseNotes: readonly string[];
    command: ApprovalAdminV2CommandTarget;
  }>[];
}>;

export type ApprovalFormStudioV3Snapshot = Readonly<{
  meta: ApprovalAdminV2SnapshotMeta;
  metrics: readonly ApprovalAdminV2Metric[];
  formId: string;
  formName: string;
  versionLabel: string;
  formStatus: ApprovalAdminV2Status;
  dirtyLabel?: string;
  schemaFacts: readonly ApprovalAdminV2Fact[];
  fields: readonly Readonly<{
    id: string;
    key: string;
    label: string;
    typeLabel: string;
    helpText?: string;
    required: boolean;
    spanLabel: string;
    classificationLabel: string;
    status: ApprovalAdminV2Status;
    facts: readonly ApprovalAdminV2Fact[];
  }>[];
  rules: readonly Readonly<{
    id: string;
    name: string;
    expression: string;
    explanation: string;
    scopeLabel: string;
    status: ApprovalAdminV2Status;
  }>[];
  validation: readonly Readonly<{
    id: string;
    title: string;
    detail: string;
    location: string;
    status: ApprovalAdminV2Status;
  }>[];
  reviewChanges: readonly Readonly<{
    id: string;
    label: string;
    beforeValue: string;
    afterValue: string;
    status: ApprovalAdminV2Status;
  }>[];
  validationScore: number;
  validationScoreLabel: string;
  command: ApprovalAdminV2CommandTarget;
}>;

export type ApprovalRoutingDirectorySnapshot = Readonly<{
  meta: ApprovalAdminV2SnapshotMeta;
  metrics: readonly ApprovalAdminV2Metric[];
  groups: readonly Readonly<{
    id: string;
    name: string;
    description: string;
    ownerLabel: string;
    scopeLabel: string;
    memberCountLabel: string;
    usageLabel: string;
    status: ApprovalAdminV2Status;
    facts: readonly ApprovalAdminV2Fact[];
    members: readonly Readonly<{
      id: string;
      name: string;
      roleLabel: string;
      sourceLabel: string;
      status: ApprovalAdminV2Status;
    }>[];
    command: ApprovalAdminV2CommandTarget;
  }>[];
  simulation: Readonly<{
    simulationId: string;
    title: string;
    description: string;
    status: ApprovalAdminV2Status;
    inputs: readonly ApprovalAdminV2Fact[];
    steps: readonly ApprovalAdminV2TimelineItem[];
    explanation: string;
    authorityLabel: string;
    expiresLabel: string;
  }> | null;
  exceptions: readonly Readonly<{
    id: string;
    title: string;
    description: string;
    status: ApprovalAdminV2Status;
    affectedWorkflowsLabel: string;
    detectedLabel: string;
    evidence: readonly ApprovalAdminV2Fact[];
    remediationLabel: string;
    command: ApprovalAdminV2CommandTarget;
  }>[];
}>;

export type ApprovalPolicyAutomationSnapshot = Readonly<{
  meta: ApprovalAdminV2SnapshotMeta;
  metrics: readonly ApprovalAdminV2Metric[];
  policies: readonly Readonly<{
    id: string;
    name: string;
    description: string;
    familyLabel: string;
    scopeLabel: string;
    versionLabel: string;
    status: ApprovalAdminV2Status;
    facts: readonly ApprovalAdminV2Fact[];
    impactFacts: readonly ApprovalAdminV2Fact[];
    highRisk: boolean;
    highRiskReason?: string;
    command: ApprovalAdminV2CommandTarget;
  }>[];
  providers: readonly Readonly<{
    id: string;
    name: string;
    channelLabel: string;
    lastVerifiedLabel: string;
    status: ApprovalAdminV2Status;
  }>[];
  calendars: readonly Readonly<{
    id: string;
    name: string;
    timezoneLabel: string;
    effectiveLabel: string;
    weekdaysLabel: string;
    holidayCountLabel: string;
    exceptionCountLabel: string;
    status: ApprovalAdminV2Status;
    facts: readonly ApprovalAdminV2Fact[];
  }>[];
  deliveryPreview: Readonly<{
    id: string;
    channelLabel: string;
    localeLabel: string;
    recipientLabel: string;
    subject: string;
    body: string;
    fallbackLabel: string;
    redactionLabel: string;
    status: ApprovalAdminV2Status;
  }> | null;
  escalationSteps: readonly ApprovalAdminV2TimelineItem[];
  delegations: readonly Readonly<{
    id: string;
    title: string;
    description: string;
    scopeLabel: string;
    effectiveLabel: string;
    auditLabel: string;
    status: ApprovalAdminV2Status;
    facts: readonly ApprovalAdminV2Fact[];
    command: ApprovalAdminV2CommandTarget;
  }>[];
  simulationCommand: ApprovalAdminV2CommandTarget;
}>;

function parseMetrics(record: Record<string, unknown>, path: string) {
  return adminV2Array(record.metrics, `${path}.metrics`, parseAdminV2Metric, 20);
}

function parseFacts(record: Record<string, unknown>, path: string) {
  return adminV2Array(record.facts, `${path}.facts`, parseAdminV2Fact, 40);
}

export function parseApprovalTemplateLibrarySnapshot(
  value: unknown
): ApprovalTemplateLibrarySnapshot {
  const path = 'data';
  const record = adminV2Record(value, path);
  return {
    meta: parseAdminV2SnapshotMeta(record.meta),
    metrics: parseMetrics(record, path),
    categories: adminV2Array(
      record.categories,
      `${path}.categories`,
      (item, itemPath) => {
        const entry = adminV2Record(item, itemPath);
        return {
          id: adminV2Identifier(entry.id, `${itemPath}.id`),
          label: adminV2Text(entry.label, `${itemPath}.label`, { max: 120 }),
          count: adminV2Number(entry.count, `${itemPath}.count`, {
            min: 0,
            max: 1_000_000,
            integer: true,
          }),
        };
      },
      100
    ),
    templates: adminV2Array(record.templates, `${path}.templates`, (item, itemPath) => {
      const entry = adminV2Record(item, itemPath);
      return {
        id: adminV2Identifier(entry.id, `${itemPath}.id`),
        name: adminV2Text(entry.name, `${itemPath}.name`, { max: 200 }),
        summary: adminV2Text(entry.summary, `${itemPath}.summary`, { max: 1200 }),
        categoryId: adminV2Identifier(entry.categoryId, `${itemPath}.categoryId`),
        categoryLabel: adminV2Text(entry.categoryLabel, `${itemPath}.categoryLabel`, { max: 120 }),
        ownerLabel: adminV2Text(entry.ownerLabel, `${itemPath}.ownerLabel`, { max: 200 }),
        versionLabel: adminV2Text(entry.versionLabel, `${itemPath}.versionLabel`, { max: 80 }),
        usageLabel: adminV2Text(entry.usageLabel, `${itemPath}.usageLabel`, { max: 120 }),
        updatedLabel: adminV2Text(entry.updatedLabel, `${itemPath}.updatedLabel`, { max: 160 }),
        status: parseAdminV2Status(entry.status, `${itemPath}.status`),
        featured: adminV2Boolean(entry.featured, `${itemPath}.featured`),
        installed: adminV2Boolean(entry.installed, `${itemPath}.installed`),
        facts: parseFacts(entry, itemPath),
        dependencies: adminV2Array(
          entry.dependencies,
          `${itemPath}.dependencies`,
          (dependency, dependencyPath) => {
            const source = adminV2Record(dependency, dependencyPath);
            const meta = adminV2Text(source.meta, `${dependencyPath}.meta`, {
              max: 300,
              optional: true,
            });
            return {
              id: adminV2Identifier(source.id, `${dependencyPath}.id`),
              name: adminV2Text(source.name, `${dependencyPath}.name`, { max: 200 }),
              detail: adminV2Text(source.detail, `${dependencyPath}.detail`, { max: 1200 }),
              status: parseAdminV2Status(source.status, `${dependencyPath}.status`),
              ...(meta ? { meta } : {}),
            };
          },
          100
        ),
        releaseNotes: adminV2Array(
          entry.releaseNotes,
          `${itemPath}.releaseNotes`,
          (note, notePath) => adminV2Text(note, notePath, { max: 1200 }),
          50
        ),
        command: parseAdminV2CommandTarget(entry.command, `${itemPath}.command`),
      };
    }),
  };
}

export function parseApprovalFormStudioV3Snapshot(value: unknown): ApprovalFormStudioV3Snapshot {
  const path = 'data';
  const record = adminV2Record(value, path);
  const dirtyLabel = adminV2Text(record.dirtyLabel, `${path}.dirtyLabel`, {
    max: 120,
    optional: true,
  });
  return {
    meta: parseAdminV2SnapshotMeta(record.meta),
    metrics: parseMetrics(record, path),
    formId: adminV2Identifier(record.formId, `${path}.formId`),
    formName: adminV2Text(record.formName, `${path}.formName`, { max: 200 }),
    versionLabel: adminV2Text(record.versionLabel, `${path}.versionLabel`, { max: 80 }),
    formStatus: parseAdminV2Status(record.formStatus, `${path}.formStatus`),
    ...(dirtyLabel ? { dirtyLabel } : {}),
    schemaFacts: adminV2Array(record.schemaFacts, `${path}.schemaFacts`, parseAdminV2Fact, 40),
    fields: adminV2Array(record.fields, `${path}.fields`, parseFormField, 300),
    rules: adminV2Array(record.rules, `${path}.rules`, parseFormRule, 200),
    validation: adminV2Array(record.validation, `${path}.validation`, parseValidation, 300),
    reviewChanges: adminV2Array(
      record.reviewChanges,
      `${path}.reviewChanges`,
      parseReviewChange,
      300
    ),
    validationScore: adminV2Number(record.validationScore, `${path}.validationScore`, {
      min: 0,
      max: 100,
    }),
    validationScoreLabel: adminV2Text(record.validationScoreLabel, `${path}.validationScoreLabel`, {
      max: 120,
    }),
    command: parseAdminV2CommandTarget(record.command, `${path}.command`),
  };
}

function parseFormField(value: unknown, path: string) {
  const record = adminV2Record(value, path);
  const helpText = adminV2Text(record.helpText, `${path}.helpText`, { max: 1200, optional: true });
  return {
    id: adminV2Identifier(record.id, `${path}.id`),
    key: adminV2Identifier(record.key, `${path}.key`),
    label: adminV2Text(record.label, `${path}.label`, { max: 200 }),
    typeLabel: adminV2Text(record.typeLabel, `${path}.typeLabel`, { max: 120 }),
    ...(helpText ? { helpText } : {}),
    required: adminV2Boolean(record.required, `${path}.required`),
    spanLabel: adminV2Text(record.spanLabel, `${path}.spanLabel`, { max: 120 }),
    classificationLabel: adminV2Text(record.classificationLabel, `${path}.classificationLabel`, {
      max: 160,
    }),
    status: parseAdminV2Status(record.status, `${path}.status`),
    facts: parseFacts(record, path),
  };
}

function parseFormRule(value: unknown, path: string) {
  const record = adminV2Record(value, path);
  return {
    id: adminV2Identifier(record.id, `${path}.id`),
    name: adminV2Text(record.name, `${path}.name`, { max: 200 }),
    expression: adminV2Text(record.expression, `${path}.expression`, { max: 4000 }),
    explanation: adminV2Text(record.explanation, `${path}.explanation`, { max: 2000 }),
    scopeLabel: adminV2Text(record.scopeLabel, `${path}.scopeLabel`, { max: 200 }),
    status: parseAdminV2Status(record.status, `${path}.status`),
  };
}

function parseValidation(value: unknown, path: string) {
  const record = adminV2Record(value, path);
  return {
    id: adminV2Identifier(record.id, `${path}.id`),
    title: adminV2Text(record.title, `${path}.title`, { max: 200 }),
    detail: adminV2Text(record.detail, `${path}.detail`, { max: 2000 }),
    location: adminV2Text(record.location, `${path}.location`, { max: 300 }),
    status: parseAdminV2Status(record.status, `${path}.status`),
  };
}

function parseReviewChange(value: unknown, path: string) {
  const record = adminV2Record(value, path);
  return {
    id: adminV2Identifier(record.id, `${path}.id`),
    label: adminV2Text(record.label, `${path}.label`, { max: 200 }),
    beforeValue: adminV2Text(record.beforeValue, `${path}.beforeValue`, { max: 2000 }),
    afterValue: adminV2Text(record.afterValue, `${path}.afterValue`, { max: 2000 }),
    status: parseAdminV2Status(record.status, `${path}.status`),
  };
}

export function parseApprovalRoutingDirectorySnapshot(
  value: unknown
): ApprovalRoutingDirectorySnapshot {
  const path = 'data';
  const record = adminV2Record(value, path);
  const simulation =
    record.simulation === null
      ? null
      : parseRoutingSimulation(record.simulation, `${path}.simulation`);
  return {
    meta: parseAdminV2SnapshotMeta(record.meta),
    metrics: parseMetrics(record, path),
    groups: adminV2Array(record.groups, `${path}.groups`, parseRoutingGroup, 200),
    simulation,
    exceptions: adminV2Array(record.exceptions, `${path}.exceptions`, parseRoutingException, 200),
  };
}

function parseRoutingGroup(value: unknown, path: string) {
  const record = adminV2Record(value, path);
  return {
    id: adminV2Identifier(record.id, `${path}.id`),
    name: adminV2Text(record.name, `${path}.name`, { max: 200 }),
    description: adminV2Text(record.description, `${path}.description`, { max: 1200 }),
    ownerLabel: adminV2Text(record.ownerLabel, `${path}.ownerLabel`, { max: 200 }),
    scopeLabel: adminV2Text(record.scopeLabel, `${path}.scopeLabel`, { max: 200 }),
    memberCountLabel: adminV2Text(record.memberCountLabel, `${path}.memberCountLabel`, {
      max: 120,
    }),
    usageLabel: adminV2Text(record.usageLabel, `${path}.usageLabel`, { max: 120 }),
    status: parseAdminV2Status(record.status, `${path}.status`),
    facts: parseFacts(record, path),
    members: adminV2Array(
      record.members,
      `${path}.members`,
      (member, memberPath) => {
        const source = adminV2Record(member, memberPath);
        return {
          id: adminV2Identifier(source.id, `${memberPath}.id`),
          name: adminV2Text(source.name, `${memberPath}.name`, { max: 200 }),
          roleLabel: adminV2Text(source.roleLabel, `${memberPath}.roleLabel`, { max: 160 }),
          sourceLabel: adminV2Text(source.sourceLabel, `${memberPath}.sourceLabel`, { max: 200 }),
          status: parseAdminV2Status(source.status, `${memberPath}.status`),
        };
      },
      500
    ),
    command: parseAdminV2CommandTarget(record.command, `${path}.command`),
  };
}

function parseRoutingSimulation(value: unknown, path: string) {
  const record = adminV2Record(value, path);
  return {
    simulationId: adminV2Identifier(record.simulationId, `${path}.simulationId`),
    title: adminV2Text(record.title, `${path}.title`, { max: 200 }),
    description: adminV2Text(record.description, `${path}.description`, { max: 1200 }),
    status: parseAdminV2Status(record.status, `${path}.status`),
    inputs: adminV2Array(record.inputs, `${path}.inputs`, parseAdminV2Fact, 40),
    steps: adminV2Array(record.steps, `${path}.steps`, parseAdminV2TimelineItem, 100),
    explanation: adminV2Text(record.explanation, `${path}.explanation`, { max: 4000 }),
    authorityLabel: adminV2Text(record.authorityLabel, `${path}.authorityLabel`, { max: 300 }),
    expiresLabel: adminV2Text(record.expiresLabel, `${path}.expiresLabel`, { max: 200 }),
  };
}

function parseRoutingException(value: unknown, path: string) {
  const record = adminV2Record(value, path);
  return {
    id: adminV2Identifier(record.id, `${path}.id`),
    title: adminV2Text(record.title, `${path}.title`, { max: 200 }),
    description: adminV2Text(record.description, `${path}.description`, { max: 1200 }),
    status: parseAdminV2Status(record.status, `${path}.status`),
    affectedWorkflowsLabel: adminV2Text(
      record.affectedWorkflowsLabel,
      `${path}.affectedWorkflowsLabel`,
      { max: 160 }
    ),
    detectedLabel: adminV2Text(record.detectedLabel, `${path}.detectedLabel`, { max: 160 }),
    evidence: adminV2Array(record.evidence, `${path}.evidence`, parseAdminV2Fact, 40),
    remediationLabel: adminV2Text(record.remediationLabel, `${path}.remediationLabel`, {
      max: 300,
    }),
    command: parseAdminV2CommandTarget(record.command, `${path}.command`),
  };
}

export function parseApprovalPolicyAutomationSnapshot(
  value: unknown
): ApprovalPolicyAutomationSnapshot {
  const path = 'data';
  const record = adminV2Record(value, path);
  return {
    meta: parseAdminV2SnapshotMeta(record.meta),
    metrics: parseMetrics(record, path),
    policies: adminV2Array(record.policies, `${path}.policies`, parsePolicy, 200),
    providers: adminV2Array(record.providers, `${path}.providers`, parseProvider, 100),
    calendars: adminV2Array(record.calendars, `${path}.calendars`, parseCalendar, 100),
    deliveryPreview:
      record.deliveryPreview === null
        ? null
        : parseDeliveryPreview(record.deliveryPreview, `${path}.deliveryPreview`),
    escalationSteps: adminV2Array(
      record.escalationSteps,
      `${path}.escalationSteps`,
      parseAdminV2TimelineItem,
      100
    ),
    delegations: adminV2Array(record.delegations, `${path}.delegations`, parseDelegation, 200),
    simulationCommand: parseAdminV2CommandTarget(
      record.simulationCommand,
      `${path}.simulationCommand`
    ),
  };
}

function parsePolicy(value: unknown, path: string) {
  const record = adminV2Record(value, path);
  const highRiskReason = adminV2Text(record.highRiskReason, `${path}.highRiskReason`, {
    max: 1200,
    optional: true,
  });
  return {
    id: adminV2Identifier(record.id, `${path}.id`),
    name: adminV2Text(record.name, `${path}.name`, { max: 200 }),
    description: adminV2Text(record.description, `${path}.description`, { max: 1200 }),
    familyLabel: adminV2Text(record.familyLabel, `${path}.familyLabel`, { max: 160 }),
    scopeLabel: adminV2Text(record.scopeLabel, `${path}.scopeLabel`, { max: 200 }),
    versionLabel: adminV2Text(record.versionLabel, `${path}.versionLabel`, { max: 80 }),
    status: parseAdminV2Status(record.status, `${path}.status`),
    facts: parseFacts(record, path),
    impactFacts: adminV2Array(record.impactFacts, `${path}.impactFacts`, parseAdminV2Fact, 40),
    highRisk: adminV2Boolean(record.highRisk, `${path}.highRisk`),
    ...(highRiskReason ? { highRiskReason } : {}),
    command: parseAdminV2CommandTarget(record.command, `${path}.command`),
  };
}

function parseProvider(value: unknown, path: string) {
  const record = adminV2Record(value, path);
  return {
    id: adminV2Identifier(record.id, `${path}.id`),
    name: adminV2Text(record.name, `${path}.name`, { max: 200 }),
    channelLabel: adminV2Text(record.channelLabel, `${path}.channelLabel`, { max: 120 }),
    lastVerifiedLabel: adminV2Text(record.lastVerifiedLabel, `${path}.lastVerifiedLabel`, {
      max: 200,
    }),
    status: parseAdminV2Status(record.status, `${path}.status`),
  };
}

function parseCalendar(value: unknown, path: string) {
  const record = adminV2Record(value, path);
  return {
    id: adminV2Identifier(record.id, `${path}.id`),
    name: adminV2Text(record.name, `${path}.name`, { max: 200 }),
    timezoneLabel: adminV2Text(record.timezoneLabel, `${path}.timezoneLabel`, { max: 120 }),
    effectiveLabel: adminV2Text(record.effectiveLabel, `${path}.effectiveLabel`, { max: 200 }),
    weekdaysLabel: adminV2Text(record.weekdaysLabel, `${path}.weekdaysLabel`, { max: 160 }),
    holidayCountLabel: adminV2Text(record.holidayCountLabel, `${path}.holidayCountLabel`, {
      max: 120,
    }),
    exceptionCountLabel: adminV2Text(record.exceptionCountLabel, `${path}.exceptionCountLabel`, {
      max: 120,
    }),
    status: parseAdminV2Status(record.status, `${path}.status`),
    facts: parseFacts(record, path),
  };
}

function parseDeliveryPreview(value: unknown, path: string) {
  const record = adminV2Record(value, path);
  return {
    id: adminV2Identifier(record.id, `${path}.id`),
    channelLabel: adminV2Text(record.channelLabel, `${path}.channelLabel`, { max: 120 }),
    localeLabel: adminV2Text(record.localeLabel, `${path}.localeLabel`, { max: 80 }),
    recipientLabel: adminV2Text(record.recipientLabel, `${path}.recipientLabel`, { max: 300 }),
    subject: adminV2Text(record.subject, `${path}.subject`, { max: 500 }),
    body: adminV2Text(record.body, `${path}.body`, { max: 4000 }),
    fallbackLabel: adminV2Text(record.fallbackLabel, `${path}.fallbackLabel`, { max: 300 }),
    redactionLabel: adminV2Text(record.redactionLabel, `${path}.redactionLabel`, { max: 300 }),
    status: parseAdminV2Status(record.status, `${path}.status`),
  };
}

function parseDelegation(value: unknown, path: string) {
  const record = adminV2Record(value, path);
  return {
    id: adminV2Identifier(record.id, `${path}.id`),
    title: adminV2Text(record.title, `${path}.title`, { max: 200 }),
    description: adminV2Text(record.description, `${path}.description`, { max: 1200 }),
    scopeLabel: adminV2Text(record.scopeLabel, `${path}.scopeLabel`, { max: 200 }),
    effectiveLabel: adminV2Text(record.effectiveLabel, `${path}.effectiveLabel`, { max: 200 }),
    auditLabel: adminV2Text(record.auditLabel, `${path}.auditLabel`, { max: 300 }),
    status: parseAdminV2Status(record.status, `${path}.status`),
    facts: parseFacts(record, path),
    command: parseAdminV2CommandTarget(record.command, `${path}.command`),
  };
}
