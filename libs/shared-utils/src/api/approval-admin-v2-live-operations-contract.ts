import {
  ApprovalAdminV2ContractError,
  adminV2Array,
  adminV2Boolean,
  adminV2Identifier,
  adminV2Instant,
  adminV2Number,
  adminV2Record,
  adminV2Text,
  adminV2Version,
  parseAdminV2Status,
} from './approval-admin-v2-contract-core';

import type {
  ApprovalAuditRecordsSnapshot,
  ApprovalConnectorAutomationSnapshot,
  ApprovalIncidentRecoverySnapshot,
} from './approval-admin-v2-operations-contract';
import type {
  ApprovalAdminV2Fact,
  ApprovalAdminV2SnapshotMeta,
} from './approval-admin-v2-contract-core';

function optionalText(value: unknown, path: string, max = 500): string | undefined {
  return value == null ? undefined : adminV2Text(value, path, { max });
}

function optionalInstant(value: unknown, path: string): string | undefined {
  return value == null ? undefined : adminV2Instant(value, path);
}

function optionalIdentifier(value: unknown, path: string): string | undefined {
  return value == null ? undefined : adminV2Identifier(value, path);
}

function fact(id: string, label: string, value: string): ApprovalAdminV2Fact {
  return { id, label, value };
}

function meta(
  version: number,
  generatedAt: string | null = null,
  sourceRevision: string | null = null
): ApprovalAdminV2SnapshotMeta {
  return { objectVersion: version, generatedAt, sourceRevision };
}

function jsonLabel(value: unknown, path: string): string {
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new ApprovalAdminV2ContractError(path);
  }
  if (serialized === undefined) throw new ApprovalAdminV2ContractError(path);
  return adminV2Text(serialized, path, { max: 4000 });
}

function mappingRows(value: unknown, path: string, prefix: string) {
  const record = adminV2Record(value, path);
  const entries = Object.entries(record);
  if (entries.length > 100) throw new ApprovalAdminV2ContractError(path);
  return entries.map(([key, item], index) => ({
    id: `${prefix}-${index}`,
    source: adminV2Text(key, `${path}.${key}.key`, { max: 200 }),
    target: prefix,
    transformation: jsonLabel(item, `${path}.${key}.value`),
    status: parseAdminV2Status('CONFIGURED', `${path}.${key}.status`),
  }));
}

function parseProbe(value: unknown, path: string) {
  const record = adminV2Record(value, path);
  const completedAt = optionalInstant(record.completedAt, `${path}.completedAt`);
  const validUntil = optionalInstant(record.validUntil, `${path}.validUntil`);
  return {
    id: adminV2Identifier(record.probeId, `${path}.probeId`),
    title: adminV2Text(record.probeKind, `${path}.probeKind`, { max: 80 }),
    detail:
      optionalText(record.evidenceRevision, `${path}.evidenceRevision`, 200) ?? 'NOT_REPORTED',
    ...(completedAt || validUntil
      ? { meta: [completedAt, validUntil].filter(Boolean).join(' · ') }
      : {}),
    status: parseAdminV2Status(record.state, `${path}.state`),
  };
}

export function parseLiveConnectors(
  connectorsValue: unknown,
  selectedDetailValue?: unknown
): ApprovalConnectorAutomationSnapshot {
  let detailConnectorId: string | undefined;
  let probes: readonly ReturnType<typeof parseProbe>[] = [];
  if (selectedDetailValue !== undefined) {
    const detail = adminV2Record(selectedDetailValue, 'connectorDetail');
    const connector = adminV2Record(detail.connector, 'connectorDetail.connector');
    detailConnectorId = adminV2Identifier(
      connector.connectorId,
      'connectorDetail.connector.connectorId'
    );
    probes = adminV2Array(detail.probes, 'connectorDetail.probes', parseProbe, 100);
  }
  const connectors = adminV2Array(
    connectorsValue,
    'connectors',
    (item, path) => {
      const record = adminV2Record(item, path);
      const id = adminV2Identifier(record.connectorId, `${path}.connectorId`);
      const version = adminV2Version(record.version, `${path}.version`);
      const draftRevisionId = optionalIdentifier(record.draftRevisionId, `${path}.draftRevisionId`);
      const definitionSha256 = optionalText(
        record.definitionSha256,
        `${path}.definitionSha256`,
        64
      );
      const endpoint = optionalText(record.endpointUri, `${path}.endpointUri`, 500);
      const currentProbes = id === detailConnectorId ? probes : [];
      const probeReady =
        version > 0 && Boolean(draftRevisionId) && /^[a-f0-9]{64}$/u.test(definitionSha256 ?? '');
      return {
        id,
        name: adminV2Text(record.displayName, `${path}.displayName`, { max: 200 }),
        summary: endpoint ?? adminV2Text(record.connectorKey, `${path}.connectorKey`, { max: 120 }),
        typeLabel: adminV2Text(record.connectorType, `${path}.connectorType`, { max: 80 }),
        lifecycle: parseAdminV2Status(record.lifecycle, `${path}.lifecycle`),
        versionLabel: `v${version}`,
        updatedLabel:
          optionalText(record.definitionSha256, `${path}.definitionSha256`, 128) ?? `v${version}`,
        facts: [
          fact(
            'timeout',
            'Timeout',
            String(
              adminV2Number(record.timeoutMillis, `${path}.timeoutMillis`, {
                min: 0,
                integer: true,
              })
            )
          ),
          fact(
            'rateLimit',
            'Rate limit',
            String(
              adminV2Number(record.rateLimitPerMinute, `${path}.rateLimitPerMinute`, {
                min: 0,
                integer: true,
              })
            )
          ),
          fact(
            'idempotency',
            'Idempotency',
            adminV2Text(record.idempotencyMode, `${path}.idempotencyMode`, { max: 80 })
          ),
          fact(
            'signing',
            'Signing',
            adminV2Text(record.signingMode, `${path}.signingMode`, { max: 80 })
          ),
        ],
        mappings: [
          ...mappingRows(record.requestMapping, `${path}.requestMapping`, 'REQUEST'),
          ...mappingRows(record.responseMapping, `${path}.responseMapping`, 'RESPONSE'),
        ],
        probes: currentProbes,
        probeCommand: { targetId: id, expectedVersion: version, commandReady: probeReady },
        // Publication also needs an independently supplied review-evidence digest. The
        // connector read contract intentionally does not manufacture that evidence.
        publishCommand: {
          targetId: id,
          expectedVersion: version,
          commandReady: false,
        },
      };
    },
    300
  );
  return {
    meta: meta(Math.max(0, ...connectors.map((item) => item.probeCommand.expectedVersion))),
    metrics: [
      { id: 'connectors', label: 'Connectors', value: String(connectors.length) },
      {
        id: 'verifiedProbes',
        label: 'Verified probes',
        value: String(probes.filter((probe) => probe.status.label === 'VERIFIED').length),
      },
    ],
    connectors,
  };
}

function parseIncidentSummary(value: unknown, path: string) {
  const record = adminV2Record(value, path);
  return {
    id: adminV2Identifier(record.incidentId, `${path}.incidentId`),
    key: adminV2Text(record.incidentKey, `${path}.incidentKey`, { max: 120 }),
    title: adminV2Text(record.title, `${path}.title`, { max: 300 }),
    severity: adminV2Text(record.severity, `${path}.severity`, { max: 80 }),
    status: adminV2Text(record.status, `${path}.status`, { max: 80 }),
    sourceKind: adminV2Text(record.sourceKind, `${path}.sourceKind`, { max: 80 }),
    sourceReference: adminV2Text(record.sourceReference, `${path}.sourceReference`, { max: 500 }),
    version: adminV2Version(record.version, `${path}.version`),
    openedAt: adminV2Instant(record.openedAt, `${path}.openedAt`),
    updatedAt: adminV2Instant(record.updatedAt, `${path}.updatedAt`),
  };
}

function parsePlan(value: unknown, path: string) {
  const record = adminV2Record(value, path);
  const incidentId = adminV2Identifier(record.incidentId, `${path}.incidentId`);
  const planId = adminV2Identifier(record.planId, `${path}.planId`);
  const version = adminV2Version(record.version, `${path}.version`);
  const state = adminV2Text(record.state, `${path}.state`, { max: 80 });
  const stages = adminV2Array(record.stages, `${path}.stages`, (item, itemPath) => {
    const source = adminV2Record(item, itemPath);
    const stage = adminV2Number(source.stageNumber, `${itemPath}.stageNumber`, {
      min: 1,
      integer: true,
    });
    const action = adminV2Text(source.actionKind, `${itemPath}.actionKind`, { max: 80 });
    return {
      id: `${planId}-${stage}`,
      title: `${stage}. ${action}`,
      detail: `${adminV2Text(source.targetType, `${itemPath}.targetType`, { max: 80 })} · ${adminV2Identifier(source.targetId, `${itemPath}.targetId`)}`,
      meta: optionalText(source.evidenceSha256, `${itemPath}.evidenceSha256`, 128),
      status: parseAdminV2Status(source.state, `${itemPath}.state`),
    };
  });
  return {
    incidentId,
    planId,
    planRevisionLabel: `v${version}`,
    createdAtLabel: optionalInstant(record.completedAt, `${path}.completedAt`) ?? 'NOT_COMPLETED',
    dryRunStatus: parseAdminV2Status(
      record.dryRunEvidenceSha256 ? 'OBSERVED' : 'NOT_VERIFIED',
      `${path}.dryRunStatus`
    ),
    executionStatus: parseAdminV2Status(state, `${path}.state`),
    eligibilityFacts: [
      fact(
        'targetSha256',
        'Target digest',
        optionalText(record.targetSha256, `${path}.targetSha256`, 128) ?? 'NOT_REPORTED'
      ),
    ],
    steps: stages,
    redactedPayloadLabel: 'Server-redacted target snapshot',
    redactedPayloadPreview: jsonLabel(record.targetSnapshot, `${path}.targetSnapshot`),
    command: {
      targetId: planId,
      expectedVersion: version,
      commandReady:
        ['DRY_RUN_PASSED', 'EXECUTING'].includes(state) &&
        stages.some((stage) => stage.status.label === 'PENDING'),
    },
  };
}

export function parseLiveIncidents(
  incidentsValue: unknown,
  selectedDetailValue?: unknown,
  expectedIncidentId?: string
): ApprovalIncidentRecoverySnapshot {
  let detailIncidentId: string | undefined;
  let evidence: readonly {
    id: string;
    title: string;
    detail: string;
    meta?: string;
    status: ReturnType<typeof parseAdminV2Status>;
  }[] = [];
  let recoveryPlan: ReturnType<typeof parsePlan> | null = null;
  if (selectedDetailValue !== undefined) {
    const detail = adminV2Record(selectedDetailValue, 'incidentDetail');
    const incident = parseIncidentSummary(detail.incident, 'incidentDetail.incident');
    if (expectedIncidentId !== undefined && incident.id !== expectedIncidentId) {
      throw new ApprovalAdminV2ContractError('incidentDetail.incident.incidentId');
    }
    detailIncidentId = incident.id;
    evidence = adminV2Array(detail.timeline, 'incidentDetail.timeline', (item, path) => {
      const record = adminV2Record(item, path);
      return {
        id: String(adminV2Number(record.sequence, `${path}.sequence`, { min: 0, integer: true })),
        title: adminV2Text(record.eventType, `${path}.eventType`, { max: 120 }),
        detail: adminV2Text(record.summary, `${path}.summary`, { max: 1200 }),
        meta: adminV2Instant(record.occurredAt, `${path}.occurredAt`),
        status: parseAdminV2Status(record.statusAfter ?? 'OBSERVED', `${path}.statusAfter`),
      };
    });
    const plans = adminV2Array(
      detail.recoveryPlans,
      'incidentDetail.recoveryPlans',
      parsePlan,
      100
    );
    if (plans.some((plan) => plan.incidentId !== incident.id)) {
      throw new ApprovalAdminV2ContractError('incidentDetail.recoveryPlans.incidentId');
    }
    recoveryPlan = plans[0] ?? null;
  }
  const incidents = adminV2Array(incidentsValue, 'incidents', parseIncidentSummary, 300).map(
    (item) => ({
      id: item.id,
      title: item.title,
      description: `${item.sourceKind} · ${item.sourceReference}`,
      severityLabel: item.severity,
      detectedLabel: item.openedAt,
      affectedLabel: item.key,
      correlationLabel: item.sourceReference,
      status: parseAdminV2Status(item.status, `incident.${item.id}.status`),
      sourceStatus: parseAdminV2Status('SERVER_REPORTED', `incident.${item.id}.sourceStatus`),
      facts: [
        fact('version', 'Version', String(item.version)),
        fact('updatedAt', 'Updated', item.updatedAt),
      ],
      evidence: item.id === detailIncidentId ? evidence : [],
      command: { targetId: item.id, expectedVersion: item.version, commandReady: false },
    })
  );
  return {
    meta: meta(Math.max(0, ...incidents.map((item) => item.command.expectedVersion))),
    metrics: [
      { id: 'incidents', label: 'Incidents', value: String(incidents.length) },
      {
        id: 'critical',
        label: 'Critical',
        value: String(incidents.filter((item) => item.severityLabel === 'CRITICAL').length),
        tone: 'danger',
      },
    ],
    incidents,
    recoveryPlan,
    queues: [],
  };
}

export function parseLiveIncidentDetail(
  selectedDetailValue: unknown,
  expectedIncidentId: string
): ApprovalIncidentRecoverySnapshot {
  const detail = adminV2Record(selectedDetailValue, 'incidentDetail');
  return parseLiveIncidents([detail.incident], selectedDetailValue, expectedIncidentId);
}

function retentionRecord(event: Record<string, unknown>, path: string) {
  const retention = adminV2Record(event.retention, `${path}.retention`);
  const eventId = adminV2Identifier(event.eventId, `${path}.eventId`);
  const retainUntil = optionalInstant(retention.retainUntil, `${path}.retention.retainUntil`);
  const legalHoldActive = adminV2Boolean(
    retention.legalHoldActive,
    `${path}.retention.legalHoldActive`
  );
  const legalHoldPending = adminV2Boolean(
    retention.legalHoldPending,
    `${path}.retention.legalHoldPending`
  );
  return {
    id: eventId,
    title: adminV2Text(event.requestNumber, `${path}.requestNumber`, { max: 120 }),
    description: adminV2Text(event.eventType, `${path}.eventType`, { max: 120 }),
    retainUntilLabel: retainUntil ?? 'NOT_REPORTED',
    legalHoldLabel: legalHoldActive ? 'ACTIVE' : legalHoldPending ? 'PENDING' : 'INACTIVE',
    purgeStageLabel: adminV2Text(retention.status, `${path}.retention.status`, { max: 80 }),
    foreignCopyLabel: 'NOT_REPORTED',
    status: parseAdminV2Status(retention.status, `${path}.retention.status`),
    evidenceStatus: parseAdminV2Status(
      legalHoldActive ? 'VERIFIED' : legalHoldPending ? 'PENDING' : 'NOT_APPLICABLE',
      `${path}.retention.evidenceStatus`
    ),
    facts: [],
    command: { targetId: eventId, expectedVersion: 0, commandReady: false },
  };
}

function parseSavedViews(value: unknown) {
  return adminV2Array(
    value,
    'savedViews',
    (item, path) => {
      const record = adminV2Record(item, path);
      return {
        id: adminV2Identifier(record.savedViewId, `${path}.savedViewId`),
        name: adminV2Text(record.name, `${path}.name`, { max: 120 }),
        visibility: adminV2Text(record.visibility, `${path}.visibility`, { max: 80 }),
        version: adminV2Version(record.version, `${path}.version`),
        updatedAt: adminV2Instant(record.updatedAt, `${path}.updatedAt`),
      };
    },
    200
  );
}

function parseAuditEvent(value: unknown, path: string, accessLevel: string) {
  const record = adminV2Record(value, path);
  const actor = adminV2Record(record.actor, `${path}.actor`);
  const id = adminV2Identifier(record.eventId, `${path}.eventId`);
  const requestId = adminV2Identifier(record.requestId, `${path}.requestId`);
  const outcome = adminV2Text(record.outcome, `${path}.outcome`, { max: 80 });
  const actorIdentifier = optionalText(actor.identifier, `${path}.actor.identifier`, 200);
  const message = optionalText(record.message, `${path}.message`, 1600);
  const eventType = adminV2Text(record.eventType, `${path}.eventType`, { max: 120 });
  const occurredAt = adminV2Instant(record.occurredAt, `${path}.occurredAt`);
  const actorType = adminV2Text(actor.type, `${path}.actor.type`, { max: 80 });
  adminV2Boolean(actor.pseudonymized, `${path}.actor.pseudonymized`);
  adminV2Record(record.evidence, `${path}.evidence`);
  return {
    record,
    id,
    requestId,
    eventType,
    outcome,
    occurredAt,
    actorLabel: actorIdentifier ? `${actorType}:${actorIdentifier}` : actorType,
    message: message ?? 'METADATA_ONLY',
    view: {
      id,
      title: eventType,
      description: message ?? 'METADATA_ONLY',
      eventTimeLabel: occurredAt,
      actorLabel: actorIdentifier ? `${actorType}:${actorIdentifier}` : actorType,
      targetLabel: adminV2Text(record.requestNumber, `${path}.requestNumber`, { max: 120 }),
      correlationLabel: requestId,
      classificationLabel: accessLevel,
      status: parseAdminV2Status(outcome, `${path}.outcome`),
      integrityStatus: parseAdminV2Status('SERVER_RECORDED', `${path}.integrityStatus`),
    },
  };
}

function parseRetentionLinkage(value: unknown | undefined, requestId: string) {
  if (value === undefined) return undefined;
  const linkage = adminV2Record(value, 'retentionLinkage');
  const linkedRequestId = adminV2Identifier(linkage.requestId, 'retentionLinkage.requestId');
  if (linkedRequestId !== requestId)
    throw new ApprovalAdminV2ContractError('retentionLinkage.requestId');
  const retention = adminV2Record(linkage.retention, 'retentionLinkage.retention');
  return {
    authority: adminV2Text(linkage.legalHoldAuthority, 'retentionLinkage.legalHoldAuthority', {
      max: 300,
    }),
    path: adminV2Text(linkage.canonicalLegalHoldPath, 'retentionLinkage.canonicalLegalHoldPath', {
      max: 500,
    }),
    evaluatedAt: adminV2Instant(linkage.evaluatedAt, 'retentionLinkage.evaluatedAt'),
    status: adminV2Text(retention.status, 'retentionLinkage.retention.status', { max: 80 }),
    legalHoldActive: adminV2Boolean(
      retention.legalHoldActive,
      'retentionLinkage.retention.legalHoldActive'
    ),
    legalHoldPending: adminV2Boolean(
      retention.legalHoldPending,
      'retentionLinkage.retention.legalHoldPending'
    ),
    retainUntil: optionalInstant(retention.retainUntil, 'retentionLinkage.retention.retainUntil'),
  };
}

export function parseLiveAuditEvents(
  value: unknown,
  savedViewsValue: unknown,
  selectedEventValue?: unknown,
  retentionLinkageValue?: unknown,
  expectedEventId?: string
): ApprovalAuditRecordsSnapshot {
  const page = adminV2Record(value, 'auditPage');
  const generatedAt = adminV2Instant(page.generatedAt, 'auditPage.generatedAt');
  const accessLevel = adminV2Text(page.accessLevel, 'auditPage.accessLevel', { max: 80 });
  const rawEvents = adminV2Array(
    page.events,
    'auditPage.events',
    (item, path) => parseAuditEvent(item, path, accessLevel),
    500
  );
  const savedViews = parseSavedViews(savedViewsValue);
  const selected =
    selectedEventValue === undefined
      ? undefined
      : parseAuditEvent(selectedEventValue, 'selectedEvent', accessLevel);
  if (selected && expectedEventId !== undefined && selected.id !== expectedEventId) {
    throw new ApprovalAdminV2ContractError('selectedEvent.eventId');
  }
  if (selected && !rawEvents.some((event) => event.id === selected.id)) {
    throw new ApprovalAdminV2ContractError('selectedEvent.eventId');
  }
  const linkage = selected
    ? parseRetentionLinkage(retentionLinkageValue, selected.requestId)
    : undefined;
  const evidenceBundle = selected
    ? {
        eventId: selected.id,
        requestId: selected.requestId,
        bundleId: selected.id,
        title: selected.eventType,
        description: selected.message,
        generatedAtLabel: selected.occurredAt,
        sourceRevisionLabel: 'NOT_REPORTED',
        integrityStatus: parseAdminV2Status('SERVER_RECORDED', 'selectedEvent.integrityStatus'),
        archiveStatus: parseAdminV2Status(
          linkage?.status ?? 'NOT_REPORTED',
          'selectedEvent.archiveStatus'
        ),
        integrityStatement: 'Server event projection; no external integrity attestation reported.',
        facts: [
          fact('requestId', 'Request ID', selected.requestId),
          ...(linkage
            ? [
                fact('legalHoldAuthority', 'Legal-hold authority', linkage.authority),
                fact('legalHoldPath', 'Legal-hold path', linkage.path),
                fact('evaluatedAt', 'Evaluated', linkage.evaluatedAt),
              ]
            : []),
        ],
        timeline: [
          {
            id: selected.id,
            title: selected.eventType,
            detail: selected.message,
            meta: selected.occurredAt,
            status: parseAdminV2Status(selected.outcome, 'selectedEvent.outcome'),
          },
        ],
        manifests: [],
        verifyCommand: { targetId: selected.id, expectedVersion: 0, commandReady: false },
        exportCommand: { targetId: selected.id, expectedVersion: 0, commandReady: true },
      }
    : null;
  return {
    meta: meta(0, generatedAt),
    metrics: [
      { id: 'events', label: 'Events', value: String(rawEvents.length) },
      { id: 'savedViews', label: 'Saved views', value: String(savedViews.length) },
      { id: 'accessLevel', label: 'Access level', value: accessLevel },
    ],
    events: rawEvents.map((event) => event.view),
    evidenceBundle,
    retentionRecords: rawEvents.map((event, index) => {
      const record = retentionRecord(event.record, `auditPage.events[${index}]`);
      if (!linkage || event.id !== selected?.id) return record;
      return {
        ...record,
        retainUntilLabel: linkage.retainUntil ?? record.retainUntilLabel,
        legalHoldLabel: linkage.legalHoldActive
          ? 'ACTIVE'
          : linkage.legalHoldPending
            ? 'PENDING'
            : 'INACTIVE',
        purgeStageLabel: linkage.status,
        facts: [
          fact('legalHoldAuthority', 'Legal-hold authority', linkage.authority),
          fact('legalHoldPath', 'Legal-hold path', linkage.path),
        ],
      };
    }),
  };
}

export function parseLiveAuditEventDetail(
  selectedEventValue: unknown,
  retentionLinkageValue: unknown,
  expectedEventId: string
): ApprovalAuditRecordsSnapshot {
  const event = adminV2Record(selectedEventValue, 'selectedEvent');
  const occurredAt = adminV2Instant(event.occurredAt, 'selectedEvent.occurredAt');
  return parseLiveAuditEvents(
    {
      generatedAt: occurredAt,
      accessLevel: 'METADATA',
      events: [selectedEventValue],
    },
    [],
    selectedEventValue,
    retentionLinkageValue,
    expectedEventId
  );
}
