import type {
  ApprovalIntegrationDelivery,
  ApprovalOperationSignal,
  ApprovalOperations,
  ApprovalPolicy,
  ApprovalPolicyVersion,
  ApprovalTask,
} from '@dwp-frontend/shared-utils';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export class ApprovalManagementProjectionError extends Error {
  constructor(readonly path: string) {
    super(`Invalid approval management projection at ${path}`);
    this.name = 'ApprovalManagementProjectionError';
  }
}

function invalid(path: string): never {
  throw new ApprovalManagementProjectionError(path);
}

function objectValue(raw: unknown, path: string): Record<string, unknown> {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) invalid(path);
  const prototype = Object.getPrototypeOf(raw);
  if (prototype !== Object.prototype && prototype !== null) invalid(path);
  const descriptors = Object.getOwnPropertyDescriptors(raw);
  if (
    Object.getOwnPropertySymbols(raw).length > 0 ||
    Object.values(descriptors).some(
      (descriptor) => !('value' in descriptor) || descriptor.enumerable !== true
    )
  ) {
    invalid(path);
  }
  return raw as Record<string, unknown>;
}

function allowedKeys(value: Record<string, unknown>, allowed: readonly string[], path: string) {
  if (Object.keys(value).some((key) => !allowed.includes(key))) invalid(path);
}

function stringValue(raw: unknown, path: string, allowBlank = false): string {
  if (typeof raw !== 'string' || (!allowBlank && raw.trim().length === 0)) invalid(path);
  return raw;
}

function dateValue(raw: unknown, path: string): string {
  const value = stringValue(raw, path);
  if (!Number.isFinite(Date.parse(value))) invalid(path);
  return value;
}

function integerValue(raw: unknown, path: string, minimum = 0): number {
  if (!Number.isSafeInteger(raw) || (raw as number) < minimum) invalid(path);
  return raw as number;
}

function booleanValue(raw: unknown, path: string): boolean {
  if (typeof raw !== 'boolean') invalid(path);
  return raw;
}

function nullableString(
  value: Record<string, unknown>,
  key: string,
  path: string,
  date = false
): string | null {
  const raw = value[key];
  if (raw === undefined || raw === null) return null;
  return date ? dateValue(raw, `${path}.${key}`) : stringValue(raw, `${path}.${key}`, true);
}

function nullableInteger(value: Record<string, unknown>, key: string, path: string): number | null {
  const raw = value[key];
  return raw === undefined || raw === null ? null : integerValue(raw, `${path}.${key}`);
}

function arrayValue(raw: unknown, path: string): unknown[] {
  if (!Array.isArray(raw)) invalid(path);
  return Array.from(raw);
}

function jsonValue(raw: unknown, path: string, depth = 0): JsonValue {
  if (depth > 32) invalid(path);
  if (raw === null || typeof raw === 'boolean' || typeof raw === 'string') return raw;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) invalid(path);
    return raw;
  }
  if (Array.isArray(raw)) {
    return Array.from(raw, (entry, index) => jsonValue(entry, `${path}[${index}]`, depth + 1));
  }
  const value = objectValue(raw, path);
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      jsonValue(entry, `${path}.${key}`, depth + 1),
    ])
  );
}

function jsonObject(raw: unknown, path: string): Record<string, unknown> {
  const value = jsonValue(raw, path);
  if (value === null || typeof value !== 'object' || Array.isArray(value)) invalid(path);
  return value;
}

const POLICY_COMMON_KEYS = [
  'policyId',
  'policyKey',
  'nameKo',
  'nameEn',
  'policyType',
  'enforcementMode',
  'severity',
  'lifecycleState',
  'version',
  'pendingReview',
  'pendingEnforcementMode',
  'pendingSeverity',
  'pendingLifecycleState',
  'pendingAt',
] as const;

export type ApprovalOversightPolicy = Readonly<{
  policyId: string;
  policyKey: string;
  nameKo: string;
  nameEn: string;
  policyType: string;
  enforcementMode: string;
  severity: string;
  lifecycleState: string;
  version: number;
  pendingReview: boolean;
  pendingEnforcementMode: string | null;
  pendingSeverity: string | null;
  pendingLifecycleState: string | null;
  pendingAt: string | null;
}>;

export type ApprovalPolicyProjection =
  | Readonly<{ kind: 'full'; policies: readonly ApprovalPolicy[] }>
  | Readonly<{ kind: 'oversight'; policies: readonly ApprovalOversightPolicy[] }>;

function policyMetadata(value: Record<string, unknown>, path: string): ApprovalOversightPolicy {
  return Object.freeze({
    policyId: stringValue(value.policyId, `${path}.policyId`),
    policyKey: stringValue(value.policyKey, `${path}.policyKey`),
    nameKo: stringValue(value.nameKo, `${path}.nameKo`),
    nameEn: stringValue(value.nameEn, `${path}.nameEn`),
    policyType: stringValue(value.policyType, `${path}.policyType`),
    enforcementMode: stringValue(value.enforcementMode, `${path}.enforcementMode`),
    severity: stringValue(value.severity, `${path}.severity`),
    lifecycleState: stringValue(value.lifecycleState, `${path}.lifecycleState`),
    version: integerValue(value.version, `${path}.version`),
    pendingReview: booleanValue(value.pendingReview, `${path}.pendingReview`),
    pendingEnforcementMode: nullableString(value, 'pendingEnforcementMode', path),
    pendingSeverity: nullableString(value, 'pendingSeverity', path),
    pendingLifecycleState: nullableString(value, 'pendingLifecycleState', path),
    pendingAt: nullableString(value, 'pendingAt', path, true),
  });
}

function fullPolicy(value: Record<string, unknown>, path: string): ApprovalPolicy {
  allowedKeys(
    value,
    [...POLICY_COMMON_KEYS, 'rule', 'pendingRule', 'pendingChangeReason', 'pendingBy'],
    path
  );
  return Object.freeze({
    ...policyMetadata(value, path),
    rule: jsonObject(value.rule, `${path}.rule`),
    pendingRule: jsonObject(value.pendingRule, `${path}.pendingRule`),
    pendingChangeReason: nullableString(value, 'pendingChangeReason', path),
    pendingBy: nullableInteger(value, 'pendingBy', path),
  });
}

function oversightPolicy(value: Record<string, unknown>, path: string): ApprovalOversightPolicy {
  allowedKeys(value, POLICY_COMMON_KEYS, path);
  return policyMetadata(value, path);
}

export function parseApprovalPolicyProjection(
  raw: unknown,
  emptyKind: ApprovalPolicyProjection['kind'] = 'oversight'
): ApprovalPolicyProjection {
  const rows = arrayValue(raw, 'policies');
  if (rows.length === 0) {
    return emptyKind === 'full'
      ? Object.freeze({ kind: 'full', policies: Object.freeze([]) })
      : Object.freeze({ kind: 'oversight', policies: Object.freeze([]) });
  }
  const records = rows.map((row, index) => objectValue(row, `policies[${index}]`));
  const kinds = new Set(
    records.map((value) =>
      Object.hasOwn(value, 'rule') || Object.hasOwn(value, 'pendingRule') ? 'full' : 'oversight'
    )
  );
  if (kinds.size !== 1) invalid('policies');
  if (kinds.has('full')) {
    return Object.freeze({
      kind: 'full',
      policies: Object.freeze(
        records.map((value, index) => fullPolicy(value, `policies[${index}]`))
      ),
    });
  }
  return Object.freeze({
    kind: 'oversight',
    policies: Object.freeze(
      records.map((value, index) => oversightPolicy(value, `policies[${index}]`))
    ),
  });
}

export type ApprovalOversightPolicyVersion = Readonly<{
  policyVersionId: string;
  versionNumber: number;
  enforcementMode: string;
  severity: string;
  lifecycleState: string;
  submittedAt: string | null;
  publishedAt: string;
}>;

export type ApprovalPolicyVersionProjection =
  | Readonly<{ kind: 'full'; versions: readonly ApprovalPolicyVersion[] }>
  | Readonly<{ kind: 'oversight'; versions: readonly ApprovalOversightPolicyVersion[] }>;

const POLICY_VERSION_COMMON_KEYS = [
  'policyVersionId',
  'versionNumber',
  'enforcementMode',
  'severity',
  'lifecycleState',
  'submittedAt',
  'publishedAt',
] as const;

function oversightPolicyVersion(
  value: Record<string, unknown>,
  path: string
): ApprovalOversightPolicyVersion {
  allowedKeys(value, POLICY_VERSION_COMMON_KEYS, path);
  return Object.freeze({
    policyVersionId: stringValue(value.policyVersionId, `${path}.policyVersionId`),
    versionNumber: integerValue(value.versionNumber, `${path}.versionNumber`, 1),
    enforcementMode: stringValue(value.enforcementMode, `${path}.enforcementMode`),
    severity: stringValue(value.severity, `${path}.severity`),
    lifecycleState: stringValue(value.lifecycleState, `${path}.lifecycleState`),
    submittedAt: nullableString(value, 'submittedAt', path, true),
    publishedAt: dateValue(value.publishedAt, `${path}.publishedAt`),
  });
}

function fullPolicyVersion(value: Record<string, unknown>, path: string): ApprovalPolicyVersion {
  allowedKeys(
    value,
    [
      ...POLICY_VERSION_COMMON_KEYS,
      'rule',
      'changeReason',
      'submittedBy',
      'publishedBy',
      'reviewComment',
    ],
    path
  );
  const metadata = oversightPolicyVersion(
    Object.fromEntries(POLICY_VERSION_COMMON_KEYS.map((key) => [key, value[key]])),
    path
  );
  return Object.freeze({
    ...metadata,
    rule: jsonObject(value.rule, `${path}.rule`),
    changeReason: stringValue(value.changeReason, `${path}.changeReason`, true),
    submittedBy: nullableInteger(value, 'submittedBy', path),
    publishedBy: nullableInteger(value, 'publishedBy', path),
    reviewComment: stringValue(value.reviewComment, `${path}.reviewComment`, true),
  });
}

export function parseApprovalPolicyVersionProjection(
  raw: unknown,
  expected: ApprovalPolicyProjection['kind']
): ApprovalPolicyVersionProjection {
  const rows = arrayValue(raw, 'policyVersions');
  const records = rows.map((row, index) => objectValue(row, `policyVersions[${index}]`));
  if (expected === 'full') {
    return Object.freeze({
      kind: 'full',
      versions: Object.freeze(
        records.map((value, index) => fullPolicyVersion(value, `policyVersions[${index}]`))
      ),
    });
  }
  return Object.freeze({
    kind: 'oversight',
    versions: Object.freeze(
      records.map((value, index) => oversightPolicyVersion(value, `policyVersions[${index}]`))
    ),
  });
}

export type ApprovalAuditorOperationSignal = Readonly<{
  key: string;
  state: string;
  count: number;
}>;

export type ApprovalOversightOperationSignal = ApprovalAuditorOperationSignal &
  Readonly<{ titleKo: string; titleEn: string }>;

export type ApprovalAuditorIntegrationDelivery = Readonly<{
  eventType: string;
  status: string;
  attemptCount: number;
  manualRetryCount: number;
  availableAt: string;
  publishedAt: string | null;
}>;

export type ApprovalOversightIntegrationDelivery = ApprovalAuditorIntegrationDelivery &
  Readonly<{
    outboxId: string;
    createdAt: string;
    lastRetriedAt: string | null;
  }>;

export type ApprovalOperationsProjection =
  | Readonly<{ kind: 'full'; data: ApprovalOperations }>
  | Readonly<{
      kind: 'auditor';
      data: Readonly<{
        generatedAt: string;
        signals: readonly ApprovalAuditorOperationSignal[];
        integrationDeliveries: readonly ApprovalAuditorIntegrationDelivery[];
      }>;
    }>
  | Readonly<{
      kind: 'oversight';
      data: Readonly<{
        generatedAt: string;
        signals: readonly ApprovalOversightOperationSignal[];
        integrationDeliveries: readonly ApprovalOversightIntegrationDelivery[];
      }>;
    }>;

function operationSignal(value: Record<string, unknown>, path: string): ApprovalOperationSignal {
  allowedKeys(value, ['key', 'state', 'titleKo', 'titleEn', 'detailKo', 'detailEn', 'count'], path);
  return Object.freeze({
    key: stringValue(value.key, `${path}.key`),
    state: stringValue(value.state, `${path}.state`),
    titleKo: stringValue(value.titleKo, `${path}.titleKo`),
    titleEn: stringValue(value.titleEn, `${path}.titleEn`),
    detailKo: stringValue(value.detailKo, `${path}.detailKo`, true),
    detailEn: stringValue(value.detailEn, `${path}.detailEn`, true),
    count: integerValue(value.count, `${path}.count`),
  });
}

function auditorSignal(
  value: Record<string, unknown>,
  path: string
): ApprovalAuditorOperationSignal {
  allowedKeys(value, ['key', 'state', 'count'], path);
  return Object.freeze({
    key: stringValue(value.key, `${path}.key`),
    state: stringValue(value.state, `${path}.state`),
    count: integerValue(value.count, `${path}.count`),
  });
}

function oversightSignal(
  value: Record<string, unknown>,
  path: string
): ApprovalOversightOperationSignal {
  allowedKeys(value, ['key', 'state', 'titleKo', 'titleEn', 'count'], path);
  return Object.freeze({
    ...auditorSignal(
      Object.fromEntries(['key', 'state', 'count'].map((key) => [key, value[key]])),
      path
    ),
    titleKo: stringValue(value.titleKo, `${path}.titleKo`),
    titleEn: stringValue(value.titleEn, `${path}.titleEn`),
  });
}

function task(value: Record<string, unknown>, path: string): ApprovalTask {
  allowedKeys(
    value,
    [
      'taskId',
      'requestId',
      'requestNumber',
      'title',
      'summary',
      'workflowNameKo',
      'workflowNameEn',
      'stepKey',
      'stepName',
      'stepSequence',
      'requesterName',
      'requesterOrgName',
      'status',
      'priority',
      'dataClassification',
      'riskScore',
      'submittedAt',
      'dueAt',
      'version',
    ],
    path
  );
  const status = stringValue(value.status, `${path}.status`);
  const priority = stringValue(value.priority, `${path}.priority`);
  if (
    ![
      'PENDING',
      'CLAIMED',
      'APPROVED',
      'REJECTED',
      'INFO_REQUESTED',
      'REASSIGNED',
      'SKIPPED',
      'CANCELLED',
    ].includes(status) ||
    !['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(priority)
  ) {
    invalid(path);
  }
  return Object.freeze({
    taskId: stringValue(value.taskId, `${path}.taskId`),
    requestId: stringValue(value.requestId, `${path}.requestId`),
    requestNumber: stringValue(value.requestNumber, `${path}.requestNumber`),
    title: stringValue(value.title, `${path}.title`),
    summary: stringValue(value.summary, `${path}.summary`, true),
    workflowNameKo: stringValue(value.workflowNameKo, `${path}.workflowNameKo`),
    workflowNameEn: stringValue(value.workflowNameEn, `${path}.workflowNameEn`),
    stepKey: stringValue(value.stepKey, `${path}.stepKey`),
    stepName: stringValue(value.stepName, `${path}.stepName`),
    stepSequence: integerValue(value.stepSequence, `${path}.stepSequence`, 1),
    requesterName: nullableString(value, 'requesterName', path),
    requesterOrgName: nullableString(value, 'requesterOrgName', path),
    status: status as ApprovalTask['status'],
    priority: priority as ApprovalTask['priority'],
    dataClassification: stringValue(value.dataClassification, `${path}.dataClassification`),
    riskScore: integerValue(value.riskScore, `${path}.riskScore`),
    submittedAt: nullableString(value, 'submittedAt', path, true),
    dueAt: nullableString(value, 'dueAt', path, true),
    version: integerValue(value.version, `${path}.version`),
  });
}

function retryEligibility(
  raw: unknown,
  path: string
): NonNullable<ApprovalIntegrationDelivery['retryEligibility']> {
  const value = objectValue(raw, path);
  allowedKeys(value, ['eligible', 'reason', 'expectedVersion', 'evaluatedAt'], path);
  const reason = stringValue(value.reason, `${path}.reason`);
  if (
    ![
      'ELIGIBLE',
      'STATUS_NOT_RETRYABLE',
      'AUDITOR_ASSIGNMENT_NOT_READY',
      'SCOPE_EVIDENCE_MISMATCH',
      'RECOVERY_EVIDENCE_INCOMPLETE',
      'SEPARATION_OF_DUTIES',
    ].includes(reason)
  ) {
    invalid(`${path}.reason`);
  }
  return Object.freeze({
    eligible: booleanValue(value.eligible, `${path}.eligible`),
    reason: reason as NonNullable<ApprovalIntegrationDelivery['retryEligibility']>['reason'],
    expectedVersion: integerValue(value.expectedVersion, `${path}.expectedVersion`),
    evaluatedAt: dateValue(value.evaluatedAt, `${path}.evaluatedAt`),
  });
}

const AUDITOR_DELIVERY_KEYS = [
  'eventType',
  'status',
  'attemptCount',
  'manualRetryCount',
  'availableAt',
  'publishedAt',
] as const;

function auditorDelivery(
  value: Record<string, unknown>,
  path: string
): ApprovalAuditorIntegrationDelivery {
  allowedKeys(value, AUDITOR_DELIVERY_KEYS, path);
  return Object.freeze({
    eventType: stringValue(value.eventType, `${path}.eventType`),
    status: stringValue(value.status, `${path}.status`),
    attemptCount: integerValue(value.attemptCount, `${path}.attemptCount`),
    manualRetryCount: integerValue(value.manualRetryCount, `${path}.manualRetryCount`),
    availableAt: dateValue(value.availableAt, `${path}.availableAt`),
    publishedAt: nullableString(value, 'publishedAt', path, true),
  });
}

function oversightDelivery(
  value: Record<string, unknown>,
  path: string
): ApprovalOversightIntegrationDelivery {
  allowedKeys(value, [...AUDITOR_DELIVERY_KEYS, 'outboxId', 'createdAt', 'lastRetriedAt'], path);
  return Object.freeze({
    ...auditorDelivery(
      Object.fromEntries(AUDITOR_DELIVERY_KEYS.map((key) => [key, value[key]])),
      path
    ),
    outboxId: stringValue(value.outboxId, `${path}.outboxId`),
    createdAt: dateValue(value.createdAt, `${path}.createdAt`),
    lastRetriedAt: nullableString(value, 'lastRetriedAt', path, true),
  });
}

function fullDelivery(value: Record<string, unknown>, path: string): ApprovalIntegrationDelivery {
  allowedKeys(
    value,
    [
      ...AUDITOR_DELIVERY_KEYS,
      'outboxId',
      'eventId',
      'requestId',
      'lastError',
      'createdAt',
      'lastRetriedAt',
      'version',
      'retryEligibility',
    ],
    path
  );
  return Object.freeze({
    ...auditorDelivery(
      Object.fromEntries(AUDITOR_DELIVERY_KEYS.map((key) => [key, value[key]])),
      path
    ),
    outboxId: stringValue(value.outboxId, `${path}.outboxId`),
    eventId: stringValue(value.eventId, `${path}.eventId`),
    requestId: nullableString(value, 'requestId', path),
    lastError: nullableString(value, 'lastError', path),
    createdAt: dateValue(value.createdAt, `${path}.createdAt`),
    lastRetriedAt: nullableString(value, 'lastRetriedAt', path, true),
    version: integerValue(value.version, `${path}.version`),
    ...(value.retryEligibility === undefined
      ? {}
      : { retryEligibility: retryEligibility(value.retryEligibility, `${path}.retryEligibility`) }),
  });
}

export function parseApprovalOperationsProjection(raw: unknown): ApprovalOperationsProjection {
  const value = objectValue(raw, 'operations');
  allowedKeys(
    value,
    ['generatedAt', 'signals', 'breachedTasks', 'integrationDeliveries'],
    'operations'
  );
  const generatedAt = dateValue(value.generatedAt, 'operations.generatedAt');
  const signals = arrayValue(value.signals, 'operations.signals');
  const deliveries = arrayValue(value.integrationDeliveries, 'operations.integrationDeliveries');
  if (Object.hasOwn(value, 'breachedTasks')) {
    return Object.freeze({
      kind: 'full',
      data: Object.freeze({
        generatedAt,
        signals: signals.map((entry, index) =>
          operationSignal(
            objectValue(entry, `operations.signals[${index}]`),
            `operations.signals[${index}]`
          )
        ),
        breachedTasks: arrayValue(value.breachedTasks, 'operations.breachedTasks').map(
          (entry, index) =>
            task(
              objectValue(entry, `operations.breachedTasks[${index}]`),
              `operations.breachedTasks[${index}]`
            )
        ),
        integrationDeliveries: deliveries.map((entry, index) =>
          fullDelivery(
            objectValue(entry, `operations.integrationDeliveries[${index}]`),
            `operations.integrationDeliveries[${index}]`
          )
        ),
      }),
    });
  }
  const oversight =
    signals.some((entry, index) =>
      Object.hasOwn(objectValue(entry, `operations.signals[${index}]`), 'titleKo')
    ) ||
    deliveries.some((entry, index) =>
      Object.hasOwn(objectValue(entry, `operations.integrationDeliveries[${index}]`), 'outboxId')
    );
  if (oversight) {
    return Object.freeze({
      kind: 'oversight',
      data: Object.freeze({
        generatedAt,
        signals: signals.map((entry, index) =>
          oversightSignal(
            objectValue(entry, `operations.signals[${index}]`),
            `operations.signals[${index}]`
          )
        ),
        integrationDeliveries: deliveries.map((entry, index) =>
          oversightDelivery(
            objectValue(entry, `operations.integrationDeliveries[${index}]`),
            `operations.integrationDeliveries[${index}]`
          )
        ),
      }),
    });
  }
  return Object.freeze({
    kind: 'auditor',
    data: Object.freeze({
      generatedAt,
      signals: signals.map((entry, index) =>
        auditorSignal(
          objectValue(entry, `operations.signals[${index}]`),
          `operations.signals[${index}]`
        )
      ),
      integrationDeliveries: deliveries.map((entry, index) =>
        auditorDelivery(
          objectValue(entry, `operations.integrationDeliveries[${index}]`),
          `operations.integrationDeliveries[${index}]`
        )
      ),
    }),
  });
}
