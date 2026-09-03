import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const schemaUrl = new URL('./widget-command-completion.v1.schema.json', import.meta.url);
const goldenUrl = new URL('./widget-command-completion.v1.golden.json', import.meta.url);
const negativeUrl = new URL('./widget-command-completion.v1.negative.json', import.meta.url);
const manifestSchemaUrl = new URL('./widget-manifest.v1.schema.json', import.meta.url);

const schemaSource = readFileSync(schemaUrl, 'utf8');
const goldenSource = readFileSync(goldenUrl, 'utf8');
const negativeSource = readFileSync(negativeUrl, 'utf8');
const manifestSchemaSource = readFileSync(manifestSchemaUrl, 'utf8');

const anchors = Object.freeze({
  schemaFile: '840c4002bc67dc214b36057f274ca79a046ad54a4f7c085dee72f9de5d3c2139',
  goldenFile: 'b71455ce969ce19b13a6783c98cbad310f50355e6a15f78193df01fd32225941',
  negativeFile: '1b88e11b59e2d9f315bce8ff3229193017a7d33591beeb6a548bed12f72dddc9',
  positiveResponsesCanonical: 'aed088b1e21ad7b461ca3bb2c42392989eee3e64656504181e839928ee2f545d',
  trustedLedgerContextsCanonical:
    'c4a324f36bd61d2accaa2f1748aac261aa225205118a9b3ceb684ceda3071d43',
  completionCatalogCanonical: 'ecb0111dc58b181dd6399a2e812ac6e8992482a2d6193f48deb94b69ba94cbb4',
  negativeCatalogCanonical: '4a4cdabe668163a0f8c824eefaf984b94bf36e4d7b37aeaf411f01fe2087bb52',
});

const completionKeys = Object.freeze([
  'commandId',
  'commandType',
  'completedAt',
  'operationId',
  'outcome',
  'responseBody',
  'responseEtag',
  'responseHash',
  'responseStatus',
  'schemaVersion',
  'target',
]);

const completionMatrix = Object.freeze([
  Object.freeze({
    commandType: 'CREATE_DEFINITION',
    operationId: 'createWidgetDefinition',
    targetType: 'DEFINITION_KEY_HASH',
    targetIdKind: 'hash',
    targetBinding: 'DEFINITION_KEY_HASH',
    successStatus: 201,
    successBodyRef: 'widgetDefinitionResponse',
    successEtag: true,
  }),
  Object.freeze({
    commandType: 'CREATE_VERSION',
    operationId: 'createWidgetDefinitionVersion',
    targetType: 'DEFINITION_SEMVER_HASH',
    targetIdKind: 'hash',
    targetBinding: 'DEFINITION_SEMVER_HASH',
    successStatus: 201,
    successBodyRef: 'widgetVersionResponse',
    successEtag: true,
  }),
  Object.freeze({
    commandType: 'UPDATE_VERSION',
    operationId: 'updateWidgetDefinitionVersion',
    targetType: 'VERSION',
    targetIdKind: 'uuid',
    targetBinding: 'BODY_VERSION_ID',
    successStatus: 200,
    successBodyRef: 'widgetVersionResponse',
    successEtag: true,
  }),
  Object.freeze({
    commandType: 'VALIDATE',
    operationId: 'validateWidgetDefinitionVersion',
    targetType: 'VERSION',
    targetIdKind: 'uuid',
    targetBinding: 'BODY_VERSION_ID',
    successStatus: 200,
    successBodyRef: 'widgetValidationResponse',
    successEtag: false,
  }),
  Object.freeze({
    commandType: 'SUBMIT',
    operationId: 'submitWidgetDefinitionVersion',
    targetType: 'VERSION',
    targetIdKind: 'uuid',
    targetBinding: 'BODY_VERSION_ID',
    successStatus: 200,
    successBodyRef: 'widgetVersionResponse',
    successEtag: true,
  }),
  Object.freeze({
    commandType: 'DECIDE',
    operationId: 'decideWidgetDefinitionVersion',
    targetType: 'VERSION',
    targetIdKind: 'uuid',
    targetBinding: 'BODY_VERSION_ID',
    successStatus: 200,
    successBodyRef: 'widgetVersionResponse',
    successEtag: true,
  }),
  Object.freeze({
    commandType: 'REWORK',
    operationId: 'reworkWidgetDefinitionVersion',
    targetType: 'VERSION',
    targetIdKind: 'uuid',
    targetBinding: 'BODY_VERSION_ID',
    successStatus: 200,
    successBodyRef: 'widgetVersionResponse',
    successEtag: true,
  }),
  Object.freeze({
    commandType: 'RECORD_EVIDENCE',
    operationId: 'recordWidgetCertificationEvidence',
    targetType: 'VERSION',
    targetIdKind: 'uuid',
    targetBinding: 'BODY_VERSION_ID',
    successStatus: 201,
    successBodyRef: 'widgetEvidenceResponse',
    successEtag: false,
  }),
  Object.freeze({
    commandType: 'WAIVE_EVIDENCE',
    operationId: 'waiveWidgetCertificationEvidence',
    targetType: 'EVIDENCE',
    targetIdKind: 'uuid',
    targetBinding: 'WAIVED_EVIDENCE_ID',
    successStatus: 200,
    successBodyRef: 'widgetEvidenceResponse',
    successEtag: false,
  }),
  Object.freeze({
    commandType: 'PUBLISH',
    operationId: 'publishWidgetDefinitionVersion',
    targetType: 'VERSION',
    targetIdKind: 'uuid',
    targetBinding: 'BODY_VERSION_ID',
    successStatus: 200,
    successBodyRef: 'widgetVersionResponse',
    successEtag: true,
  }),
  Object.freeze({
    commandType: 'DEPRECATE',
    operationId: 'deprecateWidgetDefinitionVersion',
    targetType: 'VERSION',
    targetIdKind: 'uuid',
    targetBinding: 'BODY_VERSION_ID',
    successStatus: 200,
    successBodyRef: 'widgetVersionResponse',
    successEtag: true,
  }),
  Object.freeze({
    commandType: 'QUARANTINE',
    operationId: 'quarantineWidgetDefinitionVersion',
    targetType: 'VERSION',
    targetIdKind: 'uuid',
    targetBinding: 'BODY_VERSION_ID',
    successStatus: 200,
    successBodyRef: 'widgetVersionResponse',
    successEtag: true,
  }),
  Object.freeze({
    commandType: 'APPROVE_QUARANTINE_CLEARANCE',
    operationId: 'approveWidgetQuarantineClearance',
    targetType: 'VERSION',
    targetIdKind: 'uuid',
    targetBinding: 'BODY_VERSION_ID',
    successStatus: 200,
    successBodyRef: 'widgetClearanceApprovalResponse',
    successEtag: true,
  }),
  Object.freeze({
    commandType: 'CLEAR_QUARANTINE',
    operationId: 'clearWidgetVersionQuarantine',
    targetType: 'VERSION',
    targetIdKind: 'uuid',
    targetBinding: 'BODY_VERSION_ID',
    successStatus: 200,
    successBodyRef: 'widgetVersionResponse',
    successEtag: true,
  }),
  Object.freeze({
    commandType: 'REVOKE',
    operationId: 'revokeWidgetDefinitionVersion',
    targetType: 'VERSION',
    targetIdKind: 'uuid',
    targetBinding: 'BODY_VERSION_ID',
    successStatus: 200,
    successBodyRef: 'widgetVersionResponse',
    successEtag: true,
  }),
  Object.freeze({
    commandType: 'RETIRE',
    operationId: 'retireWidgetDefinition',
    targetType: 'DEFINITION',
    targetIdKind: 'uuid',
    targetBinding: 'BODY_DEFINITION_ID',
    successStatus: 200,
    successBodyRef: 'widgetDefinitionResponse',
    successEtag: true,
  }),
  Object.freeze({
    commandType: 'PROMOTE',
    operationId: 'promoteWidgetReleaseChannel',
    targetType: 'DEFINITION_CHANNEL_HASH',
    targetIdKind: 'hash',
    targetBinding: 'DEFINITION_CHANNEL_HASH',
    successStatus: 200,
    successBodyRef: 'widgetReleaseChannelResponse',
    successEtag: true,
  }),
  Object.freeze({
    commandType: 'ROLLBACK',
    operationId: 'rollbackWidgetReleaseChannel',
    targetType: 'DEFINITION_CHANNEL_HASH',
    targetIdKind: 'hash',
    targetBinding: 'DEFINITION_CHANNEL_HASH',
    successStatus: 200,
    successBodyRef: 'widgetReleaseChannelResponse',
    successEtag: true,
  }),
  Object.freeze({
    commandType: 'DISABLE_RUNTIME_CONTROL',
    operationId: 'disableWidgetRuntimeControl',
    targetType: 'RUNTIME_CONTROL_SCOPE_HASH',
    targetIdKind: 'hash',
    targetBinding: 'RUNTIME_CONTROL_SCOPE_HASH',
    successStatus: 201,
    successBodyRef: 'widgetRuntimeControlResponse',
    successEtag: true,
  }),
  Object.freeze({
    commandType: 'APPROVE_RUNTIME_CONTROL_ENABLE',
    operationId: 'approveWidgetRuntimeControlEnable',
    targetType: 'RUNTIME_CONTROL',
    targetIdKind: 'uuid',
    targetBinding: 'BODY_CONTROL_ID',
    successStatus: 201,
    successBodyRef: 'widgetRuntimeEnableApprovalResponse',
    successEtag: true,
  }),
  Object.freeze({
    commandType: 'ENABLE_RUNTIME_CONTROL',
    operationId: 'enableWidgetRuntimeControl',
    targetType: 'RUNTIME_CONTROL',
    targetIdKind: 'uuid',
    targetBinding: 'BODY_CONTROL_ID',
    successStatus: 201,
    successBodyRef: 'widgetRuntimeControlResponse',
    successEtag: true,
  }),
]);

const rejectedCodesByStatus = Object.freeze({
  400: Object.freeze(['INVALID_INPUT_VALUE']),
  403: Object.freeze(['FORBIDDEN', 'SOD_CONFLICT', 'WIDGET_ACTION_DISABLED']),
  404: Object.freeze(['NOT_FOUND']),
  409: Object.freeze([
    'OBJECT_VERSION_CONFLICT',
    'DECISION_REVISION_CONFLICT',
    'MANIFEST_BINDING_REVISION_CHANGED',
    'INVALID_CATALOG_MODE_COMBINATION',
    'RESOURCE_CONFLICT',
  ]),
  422: Object.freeze([
    'EVIDENCE_GATE_FAILED',
    'MANIFEST_TOO_LARGE',
    'MANIFEST_OWNERSHIP_MISMATCH',
    'RESPONSE_CONTRACT_TOO_LARGE',
  ]),
});
const preReceiptOnlyCodes = Object.freeze(['COMMAND_AUTHORITY_STALE', 'COMMAND_BINDING_INVALID']);
const commandContextPolicies = Object.freeze({
  CREATE_DEFINITION: Object.freeze({
    targetKeys: ['targetId', 'targetType'],
    requestKeys: [
      'dataClassification',
      'definitionKey',
      'ownerProductKey',
      'ownerTeamKey',
      'riskTier',
    ],
  }),
  CREATE_VERSION: Object.freeze({
    targetKeys: ['definitionId', 'targetId', 'targetType'],
    requestKeys: ['manifest', 'semanticVersion'],
  }),
  UPDATE_VERSION: Object.freeze({
    targetKeys: ['targetId', 'targetType', 'versionId'],
    requestKeys: ['manifest'],
  }),
  VALIDATE: Object.freeze({
    targetKeys: ['targetId', 'targetType', 'versionId'],
    requestKeys: ['manifestHash'],
  }),
  SUBMIT: Object.freeze({
    targetKeys: ['targetId', 'targetType', 'versionId'],
    requestKeys: [],
  }),
  DECIDE: Object.freeze({
    targetKeys: ['targetId', 'targetType', 'versionId'],
    requestKeys: ['decision'],
  }),
  REWORK: Object.freeze({
    targetKeys: ['targetId', 'targetType', 'versionId'],
    requestKeys: ['rejectedDecisionId'],
  }),
  RECORD_EVIDENCE: Object.freeze({
    targetKeys: ['targetId', 'targetType', 'versionId'],
    requestKeys: [
      'decision',
      'evidenceRef',
      'evidenceSha256',
      'evidenceType',
      'expiresAt',
      'manifestHash',
    ],
  }),
  WAIVE_EVIDENCE: Object.freeze({
    targetKeys: ['evidenceId', 'targetId', 'targetType', 'versionId'],
    requestKeys: ['manifestHash', 'trackingTicketRef', 'waiverExpiresAt'],
  }),
  PUBLISH: Object.freeze({
    targetKeys: ['targetId', 'targetType', 'versionId'],
    requestKeys: ['manifestHash'],
  }),
  DEPRECATE: Object.freeze({
    targetKeys: ['targetId', 'targetType', 'versionId'],
    requestKeys: ['replacementVersionId'],
  }),
  QUARANTINE: Object.freeze({
    targetKeys: ['targetId', 'targetType', 'versionId'],
    requestKeys: [],
  }),
  APPROVE_QUARANTINE_CLEARANCE: Object.freeze({
    targetKeys: ['targetId', 'targetType', 'versionId'],
    requestKeys: ['evidenceRefs', 'quarantineEventId', 'reviewDecision'],
  }),
  CLEAR_QUARANTINE: Object.freeze({
    targetKeys: ['targetId', 'targetType', 'versionId'],
    requestKeys: ['clearanceApprovalId', 'quarantineEventId'],
  }),
  REVOKE: Object.freeze({
    targetKeys: ['targetId', 'targetType', 'versionId'],
    requestKeys: ['replacementVersionId'],
  }),
  RETIRE: Object.freeze({
    targetKeys: ['definitionId', 'targetId', 'targetType'],
    requestKeys: [],
  }),
  PROMOTE: Object.freeze({
    targetKeys: ['channel', 'definitionId', 'targetId', 'targetType'],
    requestKeys: ['versionId'],
  }),
  ROLLBACK: Object.freeze({
    targetKeys: ['channel', 'definitionId', 'targetId', 'targetType'],
    requestKeys: ['expectedCurrentVersionId', 'restoreVersionId'],
  }),
  DISABLE_RUNTIME_CONTROL: Object.freeze({
    targetKeys: ['controlScope', 'runtimeTargetId', 'runtimeTargetType', 'targetId', 'targetType'],
    requestKeys: ['expiresAt', 'publicReasonCode', 'scope', 'targetId', 'targetType'],
  }),
  APPROVE_RUNTIME_CONTROL_ENABLE: Object.freeze({
    targetKeys: ['controlId', 'targetId', 'targetType'],
    requestKeys: ['controlRevision', 'evidenceRefs'],
  }),
  ENABLE_RUNTIME_CONTROL: Object.freeze({
    targetKeys: ['controlId', 'targetId', 'targetType'],
    requestKeys: ['controlRevision', 'enableApprovalId'],
  }),
});

const completionByCommand = new Map(completionMatrix.map((entry) => [entry.commandType, entry]));
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;
const timestampPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.([0-9]{1,9}))?Z$/;

class ContractError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function fail(code, message) {
  throw new ContractError(code, message);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalize(value) {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') {
    assert(value.normalize('NFC') === value, 'Canonical response strings must be NFC.');
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    assert(
      Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0),
      'Canonical completion numbers must be safe non-negative integers.'
    );
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  assert(value && typeof value === 'object', 'Completion contains non-JSON data.');
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
    .join(',')}}`;
}

function canonicalHash(value) {
  return sha256(Buffer.from(canonicalize(value), 'utf8'));
}

function deepEqual(left, right) {
  return canonicalize(left) === canonicalize(right);
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function exactKeys(value, expected, code, label) {
  if (!isPlainObject(value)) fail(code, `${label} must be an object.`);
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  if (
    actual.length !== sortedExpected.length ||
    actual.some((key, index) => key !== sortedExpected[index])
  ) {
    fail(code, `${label} keys are not closed.`);
  }
}

function containsAsciiControlCharacter(value) {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit <= 0x1f || codeUnit === 0x7f) return true;
  }
  return false;
}

function approvalEvidenceRefHashes(evidenceRefs) {
  if (
    !Array.isArray(evidenceRefs) ||
    evidenceRefs.length < 1 ||
    evidenceRefs.length > 64 ||
    new Set(evidenceRefs).size !== evidenceRefs.length
  ) {
    fail('APPROVAL_EVIDENCE_BINDING', 'Approval evidenceRefs must be a non-empty unique array.');
  }
  for (let index = 0; index < evidenceRefs.length; index += 1) {
    const evidenceRef = evidenceRefs[index];
    if (
      typeof evidenceRef !== 'string' ||
      evidenceRef.length < 1 ||
      evidenceRef.length > 128 ||
      containsAsciiControlCharacter(evidenceRef) ||
      evidenceRef.normalize('NFC') !== evidenceRef ||
      (index > 0 && evidenceRefs[index - 1] >= evidenceRef)
    ) {
      fail(
        'APPROVAL_EVIDENCE_BINDING',
        'Approval evidenceRefs must be canonical opaque refs in ascending ASCII order.'
      );
    }
  }
  return evidenceRefs.map((evidenceRef) => sha256(Buffer.from(evidenceRef, 'utf8'))).sort();
}

function resolveJsonPointer(root, pointer) {
  return pointer
    .slice(2)
    .split('/')
    .map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'))
    .reduce((current, part) => current[part], root);
}

function schemaErrors(value, node, root, path, externalSchemas) {
  const errors = [];
  if (!node || typeof node !== 'object') return errors;
  if (node.$ref) {
    let referenced;
    let referencedRoot = root;
    if (node.$ref.startsWith('#/')) {
      referenced = resolveJsonPointer(root, node.$ref);
    } else {
      const [schemaId, fragment] = node.$ref.split('#');
      referencedRoot = externalSchemas.get(schemaId);
      if (!referencedRoot) return [`${path}: unresolved schema ${schemaId}`];
      referenced = fragment ? resolveJsonPointer(referencedRoot, `#${fragment}`) : referencedRoot;
    }
    errors.push(...schemaErrors(value, referenced, referencedRoot, path, externalSchemas));
  }
  if (node.oneOf) {
    const matches = node.oneOf.filter(
      (candidate) => schemaErrors(value, candidate, root, path, externalSchemas).length === 0
    ).length;
    if (matches !== 1) errors.push(`${path}: expected exactly one oneOf branch, got ${matches}`);
  }
  if (node.allOf) {
    for (const candidate of node.allOf) {
      errors.push(...schemaErrors(value, candidate, root, path, externalSchemas));
    }
  }
  if (node.not && schemaErrors(value, node.not, root, path, externalSchemas).length === 0) {
    errors.push(`${path}: forbidden schema matched`);
  }
  if (node.const !== undefined && !deepEqual(value, node.const))
    errors.push(`${path}: const mismatch`);
  if (node.enum && !node.enum.some((candidate) => deepEqual(value, candidate))) {
    errors.push(`${path}: enum mismatch`);
  }
  if (node.type) {
    const validType =
      (node.type === 'object' && isPlainObject(value)) ||
      (node.type === 'array' && Array.isArray(value)) ||
      (node.type === 'string' && typeof value === 'string') ||
      (node.type === 'integer' && Number.isSafeInteger(value)) ||
      (node.type === 'null' && value === null) ||
      (node.type === 'boolean' && typeof value === 'boolean');
    if (!validType) return [...errors, `${path}: type ${node.type} mismatch`];
  }
  if (typeof value === 'string') {
    if (node.minLength !== undefined && [...value].length < node.minLength)
      errors.push(`${path}: too short`);
    if (node.maxLength !== undefined && [...value].length > node.maxLength)
      errors.push(`${path}: too long`);
    if (node.pattern && !new RegExp(node.pattern, 'u').test(value))
      errors.push(`${path}: pattern mismatch`);
    if (
      node.format === 'date-time' &&
      (!Number.isFinite(Date.parse(value)) || !value.endsWith('Z'))
    ) {
      errors.push(`${path}: invalid date-time`);
    }
  }
  if (typeof value === 'number') {
    if (node.minimum !== undefined && value < node.minimum) errors.push(`${path}: below minimum`);
    if (node.maximum !== undefined && value > node.maximum) errors.push(`${path}: above maximum`);
  }
  if (Array.isArray(value)) {
    if (node.minItems !== undefined && value.length < node.minItems)
      errors.push(`${path}: too few items`);
    if (node.maxItems !== undefined && value.length > node.maxItems)
      errors.push(`${path}: too many items`);
    if (node.uniqueItems && new Set(value.map(canonicalize)).size !== value.length) {
      errors.push(`${path}: duplicate items`);
    }
    if (node.items) {
      value.forEach((item, index) => {
        errors.push(...schemaErrors(item, node.items, root, `${path}/${index}`, externalSchemas));
      });
    }
  }
  if (isPlainObject(value)) {
    for (const required of node.required ?? []) {
      if (!Object.hasOwn(value, required)) errors.push(`${path}: missing ${required}`);
    }
    const properties = node.properties ?? {};
    for (const [key, child] of Object.entries(properties)) {
      if (Object.hasOwn(value, key)) {
        errors.push(...schemaErrors(value[key], child, root, `${path}/${key}`, externalSchemas));
      }
    }
    if (node.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.hasOwn(properties, key)) errors.push(`${path}: unknown ${key}`);
      }
    }
  }
  return errors;
}

function isGregorianTimestamp(value) {
  const match = timestampPattern.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (year === 0 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59)
    return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= daysInMonth;
}

function responseHash(response) {
  return canonicalHash({
    status: response.responseStatus,
    body: response.responseBody,
    etag: response.responseEtag,
  });
}

function validateSuccessTargetBinding(response, matrix) {
  const body = response.responseBody;
  let expectedTargetId;
  switch (matrix.targetBinding) {
    case 'DEFINITION_KEY_HASH':
      expectedTargetId = sha256(Buffer.from(body.definitionKey, 'utf8'));
      break;
    case 'DEFINITION_SEMVER_HASH':
      expectedTargetId = sha256(
        Buffer.from(`${body.definitionId}\n${body.semanticVersion}`, 'utf8')
      );
      break;
    case 'BODY_VERSION_ID':
      expectedTargetId = body.versionId;
      break;
    case 'WAIVED_EVIDENCE_ID':
      expectedTargetId = body.waivedEvidenceId;
      if (body.evidenceId === body.waivedEvidenceId) {
        fail(
          'TARGET_RESPONSE_BINDING',
          'A waiver must create a new evidence record distinct from the waived evidence.'
        );
      }
      break;
    case 'BODY_DEFINITION_ID':
      expectedTargetId = body.definitionId;
      break;
    case 'DEFINITION_CHANNEL_HASH':
      expectedTargetId = sha256(Buffer.from(`${body.definitionId}\n${body.channel}`, 'utf8'));
      break;
    case 'RUNTIME_CONTROL_SCOPE_HASH': {
      const runtimeTargetId = body.targetId ?? 'GLOBAL';
      expectedTargetId = sha256(
        Buffer.from(`${body.scope}\n${body.targetType}\n${runtimeTargetId}`, 'utf8')
      );
      break;
    }
    case 'BODY_CONTROL_ID':
      expectedTargetId = body.controlId;
      break;
    default:
      fail('FIXTURE_SHAPE', `Unknown completion target binding ${matrix.targetBinding}.`);
  }
  if (response.target.targetId !== expectedTargetId) {
    fail(
      'TARGET_RESPONSE_BINDING',
      `${response.commandType} response body does not bind the durable command target.`
    );
  }
}

function assertRequestBinding(condition, message) {
  if (!condition) fail('REQUEST_RESPONSE_BINDING', message);
}

function assertSuccessState(condition, message) {
  if (!condition) fail('SUCCESS_STATE_BINDING', message);
}

function assertChildApprovalBinding(condition, message) {
  if (!condition) fail('CHILD_APPROVAL_BINDING', message);
}

function validateActiveApprovalShape(approval, identityKeys, revisionKey, label, extraKeys = []) {
  exactKeys(
    approval,
    [
      'approvalId',
      'consumedAt',
      'consumedByCommandId',
      'expiresAt',
      revisionKey,
      'state',
      ...identityKeys,
      ...extraKeys,
    ],
    'FIXTURE_SHAPE',
    label
  );
  if (
    !uuidPattern.test(approval.approvalId) ||
    !Number.isSafeInteger(approval[revisionKey]) ||
    approval[revisionKey] < 0 ||
    !isGregorianTimestamp(approval.expiresAt) ||
    !['ACTIVE', 'CONSUMED', 'REVOKED', 'EXPIRED'].includes(approval.state) ||
    (approval.consumedAt !== null && !isGregorianTimestamp(approval.consumedAt)) ||
    (approval.consumedByCommandId !== null && !uuidPattern.test(approval.consumedByCommandId))
  ) {
    fail('FIXTURE_SHAPE', `${label} is malformed.`);
  }
  for (const key of identityKeys) {
    if (!uuidPattern.test(approval[key])) fail('FIXTURE_SHAPE', `${label}.${key} is malformed.`);
  }
}

function validateApprovalIsExecutable(approval, completedAt, label) {
  assertChildApprovalBinding(
    approval.state === 'ACTIVE' &&
      approval.consumedAt === null &&
      approval.consumedByCommandId === null,
    `${label} must be ACTIVE and unconsumed before execution.`
  );
  assertChildApprovalBinding(
    Date.parse(approval.expiresAt) > Date.parse(completedAt),
    `${label} must remain unexpired at command completion.`
  );
}

function validateApprovalConsumption(before, after, response, label) {
  assertChildApprovalBinding(
    deepEqual(
      {
        ...before,
        state: 'CONSUMED',
        consumedAt: response.completedAt,
        consumedByCommandId: response.commandId,
      },
      after
    ),
    `${label} post-mutation projection must consume the exact child approval with this completion commandId.`
  );
}

function validateTrustedLedgerBinding(response, context, matrix) {
  const bindsApprovalConsumption = ['CLEAR_QUARANTINE', 'ENABLE_RUNTIME_CONTROL'].includes(
    response.commandType
  );
  exactKeys(
    context,
    [
      'currentTargetProjection',
      'ledgerBinding',
      ...(bindsApprovalConsumption ? ['postMutationApprovalProjection'] : []),
      'requestProjection',
    ],
    'FIXTURE_SHAPE',
    'completion verification context'
  );
  exactKeys(
    context.ledgerBinding,
    ['commandId', 'commandType', 'fullTarget', 'operationId'],
    'FIXTURE_SHAPE',
    'trusted command ledger binding'
  );
  const ledger = context.ledgerBinding;
  if (
    ledger.commandId !== response.commandId ||
    ledger.operationId !== response.operationId ||
    ledger.commandType !== response.commandType
  ) {
    fail('LEDGER_BINDING', 'Completion identity differs from the trusted durable command ledger.');
  }
  const policy = commandContextPolicies[response.commandType];
  if (!policy) fail('FIXTURE_SHAPE', 'Trusted context policy is missing for the command.');
  exactKeys(ledger.fullTarget, policy.targetKeys, 'FIXTURE_SHAPE', 'trusted full command target');
  exactKeys(
    context.requestProjection,
    policy.requestKeys,
    'FIXTURE_SHAPE',
    'trusted request projection'
  );
  if (
    ledger.fullTarget.targetType !== response.target.targetType ||
    ledger.fullTarget.targetId !== response.target.targetId ||
    ledger.fullTarget.targetType !== matrix.targetType
  ) {
    fail('LEDGER_BINDING', 'Completion target differs from the trusted full command target.');
  }
  if (response.commandType === 'REWORK' && response.outcome === 'SUCCEEDED') {
    exactKeys(
      context.currentTargetProjection,
      ['currentReviewDecisionId', 'versionId', 'workflowState'],
      'FIXTURE_SHAPE',
      'trusted rejected version projection'
    );
    const current = context.currentTargetProjection;
    if (
      !uuidPattern.test(current.versionId) ||
      !uuidPattern.test(current.currentReviewDecisionId) ||
      current.workflowState !== 'REJECTED'
    ) {
      fail('FIXTURE_SHAPE', 'Trusted rejected version projection is malformed.');
    }
  } else if (response.commandType === 'WAIVE_EVIDENCE' && response.outcome === 'SUCCEEDED') {
    exactKeys(
      context.currentTargetProjection,
      ['evidenceId', 'evidenceRef', 'evidenceSha256', 'evidenceType', 'manifestHash', 'versionId'],
      'FIXTURE_SHAPE',
      'trusted current source evidence'
    );
    const source = context.currentTargetProjection;
    if (
      !uuidPattern.test(source.evidenceId) ||
      !uuidPattern.test(source.versionId) ||
      !sha256Pattern.test(source.manifestHash) ||
      !sha256Pattern.test(source.evidenceSha256) ||
      !['MANIFEST', 'SECURITY', 'PRIVACY', 'A11Y', 'PERFORMANCE', 'LOCALIZATION'].includes(
        source.evidenceType
      ) ||
      typeof source.evidenceRef !== 'string' ||
      source.evidenceRef.length < 1 ||
      source.evidenceRef.length > 128 ||
      containsAsciiControlCharacter(source.evidenceRef) ||
      source.evidenceRef.normalize('NFC') !== source.evidenceRef
    ) {
      fail('FIXTURE_SHAPE', 'Trusted source evidence projection is malformed.');
    }
  } else if (response.commandType === 'CLEAR_QUARANTINE') {
    exactKeys(
      context.currentTargetProjection,
      [
        'currentQuarantineEventId',
        'latestClearanceApproval',
        'quarantineRevision',
        'safetyState',
        'versionId',
      ],
      'FIXTURE_SHAPE',
      'trusted current quarantined version'
    );
    const current = context.currentTargetProjection;
    if (
      !uuidPattern.test(current.versionId) ||
      !uuidPattern.test(current.currentQuarantineEventId) ||
      !Number.isSafeInteger(current.quarantineRevision) ||
      current.quarantineRevision < 0 ||
      !['CLEAR', 'QUARANTINED', 'REVOKED'].includes(current.safetyState)
    ) {
      fail('FIXTURE_SHAPE', 'Trusted current quarantined version is malformed.');
    }
    validateActiveApprovalShape(
      current.latestClearanceApproval,
      ['quarantineEventId', 'versionId'],
      'quarantineRevision',
      'trusted current clearance approval'
    );
    validateActiveApprovalShape(
      context.postMutationApprovalProjection,
      ['quarantineEventId', 'versionId'],
      'quarantineRevision',
      'trusted consumed clearance approval'
    );
  } else if (response.commandType === 'ENABLE_RUNTIME_CONTROL') {
    exactKeys(
      context.currentTargetProjection,
      ['controlId', 'latestEnableApproval', 'revision', 'scope', 'state', 'targetId', 'targetType'],
      'FIXTURE_SHAPE',
      'trusted current runtime control'
    );
    const current = context.currentTargetProjection;
    if (
      !uuidPattern.test(current.controlId) ||
      !Number.isSafeInteger(current.revision) ||
      current.revision < 0 ||
      !['CATALOG_MUTATIONS', 'CATALOG_DISCOVERY', 'RUNTIME_RENDER', 'RUNTIME_ACTION'].includes(
        current.scope
      ) ||
      !['ENABLED', 'DISABLED'].includes(current.state) ||
      !['GLOBAL', 'DEFINITION', 'VERSION'].includes(current.targetType) ||
      (current.targetType === 'GLOBAL'
        ? current.targetId !== null
        : !uuidPattern.test(current.targetId))
    ) {
      fail('FIXTURE_SHAPE', 'Trusted current runtime control is malformed.');
    }
    validateActiveApprovalShape(
      current.latestEnableApproval,
      ['controlId'],
      'controlRevision',
      'trusted current runtime enable approval',
      ['scope', 'targetId', 'targetType']
    );
    const currentApproval = current.latestEnableApproval;
    if (
      !['CATALOG_MUTATIONS', 'CATALOG_DISCOVERY', 'RUNTIME_RENDER', 'RUNTIME_ACTION'].includes(
        currentApproval.scope
      ) ||
      !['GLOBAL', 'DEFINITION', 'VERSION'].includes(currentApproval.targetType) ||
      (currentApproval.targetType === 'GLOBAL'
        ? currentApproval.targetId !== null
        : !uuidPattern.test(currentApproval.targetId))
    ) {
      fail('FIXTURE_SHAPE', 'Trusted current runtime enable approval target is malformed.');
    }
    validateActiveApprovalShape(
      context.postMutationApprovalProjection,
      ['controlId'],
      'controlRevision',
      'trusted consumed runtime enable approval',
      ['scope', 'targetId', 'targetType']
    );
    const consumedApproval = context.postMutationApprovalProjection;
    if (
      !['CATALOG_MUTATIONS', 'CATALOG_DISCOVERY', 'RUNTIME_RENDER', 'RUNTIME_ACTION'].includes(
        consumedApproval.scope
      ) ||
      !['GLOBAL', 'DEFINITION', 'VERSION'].includes(consumedApproval.targetType) ||
      (consumedApproval.targetType === 'GLOBAL'
        ? consumedApproval.targetId !== null
        : !uuidPattern.test(consumedApproval.targetId))
    ) {
      fail('FIXTURE_SHAPE', 'Trusted consumed runtime enable approval target is malformed.');
    }
  } else if (context.currentTargetProjection !== null) {
    fail('FIXTURE_SHAPE', 'Unexpected trusted current-target projection.');
  }
}

function validateOperationSuccessSemantics(response, context) {
  const body = response.responseBody;
  const target = context.ledgerBinding.fullTarget;
  const request = context.requestProjection;

  if (Object.hasOwn(body, 'manifest')) {
    if (body.manifestHash !== canonicalHash(body.manifest)) {
      fail(
        'BODY_INTERNAL_BINDING',
        'WidgetVersion manifestHash differs from its canonical manifest.'
      );
    }
  }

  switch (response.commandType) {
    case 'CREATE_DEFINITION':
      for (const field of [
        'definitionKey',
        'ownerProductKey',
        'ownerTeamKey',
        'riskTier',
        'dataClassification',
      ]) {
        assertRequestBinding(
          body[field] === request[field],
          `${field} differs from create request.`
        );
      }
      assertSuccessState(body.definitionState === 'ACTIVE', 'Created definition must be ACTIVE.');
      break;
    case 'CREATE_VERSION':
      assertRequestBinding(body.definitionId === target.definitionId, 'Definition ID drifted.');
      assertRequestBinding(
        body.semanticVersion === request.semanticVersion,
        'Semantic version drifted.'
      );
      assertRequestBinding(deepEqual(body.manifest, request.manifest), 'Created manifest drifted.');
      assertSuccessState(
        body.workflowState === 'DRAFT' &&
          body.releaseState === 'UNPUBLISHED' &&
          body.safetyState === 'CLEAR',
        'Created version must be DRAFT/UNPUBLISHED/CLEAR.'
      );
      break;
    case 'UPDATE_VERSION':
      assertRequestBinding(deepEqual(body.manifest, request.manifest), 'Updated manifest drifted.');
      assertSuccessState(body.workflowState === 'DRAFT', 'Updated version must remain DRAFT.');
      break;
    case 'VALIDATE':
      assertRequestBinding(
        body.manifestHash === request.manifestHash,
        'Validated manifest drifted.'
      );
      assertSuccessState(
        (body.status === 'PASS' && body.errors.length === 0) ||
          (body.status === 'FAIL' && body.errors.length > 0),
        'Validation status and errors disagree.'
      );
      break;
    case 'SUBMIT':
      assertSuccessState(body.workflowState === 'SUBMITTED', 'Submit must return SUBMITTED.');
      break;
    case 'DECIDE': {
      const expectedState = request.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      assertRequestBinding(body.workflowState === expectedState, 'Review decision result drifted.');
      assertSuccessState(
        request.decision === 'REJECT'
          ? uuidPattern.test(body.currentReviewDecisionId)
          : body.currentReviewDecisionId === null,
        'Review decision identity does not match the successful workflow transition.'
      );
      break;
    }
    case 'REWORK': {
      const current = context.currentTargetProjection;
      assertRequestBinding(
        current.versionId === target.versionId &&
          current.workflowState === 'REJECTED' &&
          current.currentReviewDecisionId === request.rejectedDecisionId,
        'Rework must bind the exact current rejected decision.'
      );
      assertSuccessState(
        body.workflowState === 'DRAFT' &&
          body.attestation === 'PENDING' &&
          body.certificationStatus === 'NOT_RUN' &&
          body.currentReviewDecisionId === null,
        'Rework must reset the version to DRAFT/PENDING/NOT_RUN.'
      );
      break;
    }
    case 'RECORD_EVIDENCE':
      for (const field of [
        'evidenceType',
        'manifestHash',
        'evidenceRef',
        'evidenceSha256',
        'expiresAt',
      ]) {
        assertRequestBinding(
          body[field] === request[field],
          `${field} differs from evidence request.`
        );
      }
      assertRequestBinding(body.status === request.decision, 'Evidence decision result drifted.');
      break;
    case 'WAIVE_EVIDENCE':
      if (
        context.currentTargetProjection.evidenceId !== target.evidenceId ||
        context.currentTargetProjection.versionId !== target.versionId ||
        context.currentTargetProjection.manifestHash !== request.manifestHash ||
        body.waivedEvidenceId !== context.currentTargetProjection.evidenceId ||
        body.versionId !== context.currentTargetProjection.versionId ||
        body.manifestHash !== context.currentTargetProjection.manifestHash ||
        body.evidenceType !== context.currentTargetProjection.evidenceType ||
        body.evidenceRef !== context.currentTargetProjection.evidenceRef ||
        body.evidenceSha256 !== context.currentTargetProjection.evidenceSha256 ||
        body.expiresAt !== request.waiverExpiresAt ||
        body.trackingTicketRef !== request.trackingTicketRef
      ) {
        fail(
          'EVIDENCE_PROVENANCE_BINDING',
          'Waiver response must bind the authoritative source evidence and waiver request.'
        );
      }
      assertSuccessState(body.status === 'WAIVED', 'Waiver must return WAIVED evidence.');
      break;
    case 'PUBLISH':
      assertRequestBinding(
        body.manifestHash === request.manifestHash,
        'Published manifest drifted.'
      );
      assertSuccessState(
        body.workflowState === 'APPROVED' &&
          body.releaseState === 'PUBLISHED' &&
          body.safetyState === 'CLEAR',
        'Publish must return APPROVED/PUBLISHED/CLEAR.'
      );
      break;
    case 'DEPRECATE':
      assertRequestBinding(
        body.replacementVersionId === request.replacementVersionId,
        'Deprecation replacement drifted.'
      );
      assertSuccessState(body.releaseState === 'DEPRECATED', 'Deprecate must return DEPRECATED.');
      break;
    case 'QUARANTINE':
      assertSuccessState(body.safetyState === 'QUARANTINED', 'Quarantine must return QUARANTINED.');
      break;
    case 'APPROVE_QUARANTINE_CLEARANCE':
      if (request.reviewDecision !== 'APPROVE') {
        fail('CLEARANCE_DECISION_BINDING', 'Quarantine clearance completion is approval-only.');
      }
      assertRequestBinding(
        body.versionId === target.versionId &&
          body.quarantineEventId === request.quarantineEventId &&
          body.reviewDecision === request.reviewDecision,
        'Clearance approval result drifted.'
      );
      assertSuccessState(
        body.state === 'ACTIVE' && body.consumedAt === null,
        'New clearance approval must be ACTIVE and unconsumed.'
      );
      if (!deepEqual(body.evidenceRefHashes, approvalEvidenceRefHashes(request.evidenceRefs))) {
        fail(
          'APPROVAL_EVIDENCE_BINDING',
          'Clearance evidenceRefHashes differ from the canonical request evidenceRefs.'
        );
      }
      break;
    case 'CLEAR_QUARANTINE': {
      const current = context.currentTargetProjection;
      const approval = current.latestClearanceApproval;
      assertChildApprovalBinding(
        target.versionId === current.versionId &&
          request.clearanceApprovalId === approval.approvalId &&
          request.quarantineEventId === current.currentQuarantineEventId &&
          request.quarantineEventId === approval.quarantineEventId &&
          current.versionId === approval.versionId &&
          current.quarantineRevision === approval.quarantineRevision,
        'Clearance request, target, current incident, and child approval tuple drifted.'
      );
      assertChildApprovalBinding(
        current.safetyState === 'QUARANTINED',
        'Clearance requires the exact current quarantined version head.'
      );
      validateApprovalIsExecutable(approval, response.completedAt, 'Clearance approval');
      validateApprovalConsumption(
        approval,
        context.postMutationApprovalProjection,
        response,
        'Clearance approval'
      );
      assertRequestBinding(
        body.versionId === current.versionId && body.currentQuarantineEventId === null,
        'Cleared version does not consume the bound current quarantine incident.'
      );
      assertSuccessState(body.safetyState === 'CLEAR', 'Clearance must return CLEAR.');
      break;
    }
    case 'REVOKE':
      assertRequestBinding(
        body.replacementVersionId === request.replacementVersionId,
        'Revocation replacement drifted.'
      );
      assertSuccessState(body.safetyState === 'REVOKED', 'Revoke must return REVOKED.');
      break;
    case 'RETIRE':
      assertSuccessState(body.definitionState === 'RETIRED', 'Retire must return RETIRED.');
      break;
    case 'PROMOTE':
      assertRequestBinding(
        body.definitionId === target.definitionId &&
          body.channel === target.channel &&
          body.currentVersionId === request.versionId,
        'Promoted channel head drifted.'
      );
      break;
    case 'ROLLBACK':
      assertRequestBinding(
        body.definitionId === target.definitionId &&
          body.channel === target.channel &&
          body.currentVersionId === request.restoreVersionId &&
          body.previousVersionId === request.expectedCurrentVersionId,
        'Rolled-back channel heads drifted.'
      );
      break;
    case 'DISABLE_RUNTIME_CONTROL':
      assertRequestBinding(
        target.controlScope === request.scope &&
          target.runtimeTargetType === request.targetType &&
          target.runtimeTargetId === request.targetId &&
          body.scope === request.scope &&
          body.targetType === request.targetType &&
          body.targetId === request.targetId &&
          body.expiresAt === request.expiresAt &&
          body.publicReasonCode === request.publicReasonCode,
        'Disabled runtime control projection drifted.'
      );
      assertSuccessState(body.state === 'DISABLED', 'Disable must return DISABLED.');
      break;
    case 'APPROVE_RUNTIME_CONTROL_ENABLE':
      assertRequestBinding(
        body.controlId === target.controlId && body.controlRevision === request.controlRevision,
        'Runtime enable approval head drifted.'
      );
      assertSuccessState(
        body.state === 'ACTIVE' && body.consumedAt === null,
        'New runtime enable approval must be ACTIVE and unconsumed.'
      );
      if (!deepEqual(body.evidenceRefHashes, approvalEvidenceRefHashes(request.evidenceRefs))) {
        fail(
          'APPROVAL_EVIDENCE_BINDING',
          'Runtime enable evidenceRefHashes differ from the canonical request evidenceRefs.'
        );
      }
      break;
    case 'ENABLE_RUNTIME_CONTROL': {
      const current = context.currentTargetProjection;
      const approval = current.latestEnableApproval;
      assertChildApprovalBinding(
        target.controlId === current.controlId &&
          target.controlId === approval.controlId &&
          request.enableApprovalId === approval.approvalId &&
          request.controlRevision === current.revision &&
          request.controlRevision === approval.controlRevision &&
          current.scope === approval.scope &&
          current.targetType === approval.targetType &&
          current.targetId === approval.targetId,
        'Runtime enable request, target, current head, and child approval tuple drifted.'
      );
      assertChildApprovalBinding(
        current.state === 'DISABLED',
        'Runtime enable requires the exact current DISABLED control head.'
      );
      validateApprovalIsExecutable(approval, response.completedAt, 'Runtime enable approval');
      validateApprovalConsumption(
        approval,
        context.postMutationApprovalProjection,
        response,
        'Runtime enable approval'
      );
      assertRequestBinding(
        body.controlId === target.controlId &&
          body.scope === current.scope &&
          body.targetType === current.targetType &&
          body.targetId === current.targetId &&
          body.revision === current.revision + 1,
        'Enabled runtime control head or scope drifted.'
      );
      assertSuccessState(body.state === 'ENABLED', 'Enable must return ENABLED.');
      break;
    }
    default:
      fail('FIXTURE_SHAPE', `Missing success semantics for ${response.commandType}.`);
  }
}

function expectedResponseEtag(response) {
  const version = response.responseBody.version ?? response.responseBody.revision;
  if (!Number.isInteger(version) || version < 0) {
    fail('BODY_INTERNAL_BINDING', 'ETag-bearing response lacks a non-negative version/revision.');
  }
  return `"v${version}"`;
}

function validateCompletion(response, schema, externalSchemas, context) {
  exactKeys(response, completionKeys, 'SCHEMA_VALIDATION', 'completion response');
  if (
    response.commandType === 'APPROVE_QUARANTINE_CLEARANCE' &&
    context.requestProjection?.reviewDecision !== 'APPROVE'
  ) {
    fail(
      'CLEARANCE_DECISION_BINDING',
      'Trusted clearance request projection must be approval-only.'
    );
  }
  if (
    response.outcome === 'REJECTED' &&
    preReceiptOnlyCodes.includes(response.responseBody?.code)
  ) {
    fail(
      'LEDGER_INTEGRITY',
      `${response.responseBody.code} is a pre-receipt rejection and cannot be durable completion.`
    );
  }
  const errors = schemaErrors(response, schema, schema, '$', externalSchemas);
  if (errors.length > 0) fail('SCHEMA_VALIDATION', errors.slice(0, 4).join('; '));
  if (!isGregorianTimestamp(response.completedAt))
    fail('TIMESTAMP', 'completedAt is not a real UTC date.');
  const matrix = completionByCommand.get(response.commandType);
  if (
    !matrix ||
    response.operationId !== matrix.operationId ||
    response.target.targetType !== matrix.targetType
  ) {
    fail('COMMAND_BINDING', 'Completion command identity does not match the closed matrix.');
  }
  if (!uuidPattern.test(response.commandId)) fail('SCHEMA_VALIDATION', 'commandId is not a UUID.');
  const targetPattern = matrix.targetIdKind === 'hash' ? sha256Pattern : uuidPattern;
  if (!targetPattern.test(response.target.targetId))
    fail('SCHEMA_VALIDATION', 'targetId kind mismatch.');
  validateTrustedLedgerBinding(response, context, matrix);

  if (response.outcome === 'SUCCEEDED') {
    if (response.responseStatus !== matrix.successStatus) {
      fail('OUTCOME_BINDING', 'Success HTTP status does not match the operation.');
    }
    if (matrix.successEtag !== (response.responseEtag !== null)) {
      fail('OUTCOME_BINDING', 'Success ETag nullability does not match the operation.');
    }
    validateSuccessTargetBinding(response, matrix);
    validateOperationSuccessSemantics(response, context);
    if (matrix.successEtag && response.responseEtag !== expectedResponseEtag(response)) {
      fail('ETAG_BINDING', 'Success ETag is not derived from the response version/revision.');
    }
  } else if (response.outcome === 'REJECTED') {
    const codes = rejectedCodesByStatus[response.responseStatus];
    if (!codes?.includes(response.responseBody.code) || response.responseEtag !== null) {
      fail('OUTCOME_BINDING', 'Rejected status/code/ETag combination is invalid.');
    }
  } else if (
    response.responseStatus !== 503 ||
    response.responseBody.code !== 'COMMAND_NOT_EXECUTED' ||
    response.responseBody.message !== 'The command was sealed without target execution.' ||
    response.responseEtag !== null
  ) {
    fail('OUTCOME_BINDING', 'NOT_EXECUTED is not the exact terminal 503 response.');
  }

  if (Buffer.byteLength(canonicalize(response.responseBody), 'utf8') > 65536) {
    fail('RESPONSE_SIZE', 'Canonical response body exceeds the durable ledger limit.');
  }
  if (response.responseHash !== responseHash(response))
    fail('RESPONSE_HASH', 'responseHash mismatch.');
  return matrix;
}

function decodePointer(pointer) {
  if (!pointer.startsWith('/')) fail('FIXTURE_SHAPE', `Invalid mutation pointer ${pointer}.`);
  return pointer
    .slice(1)
    .split('/')
    .map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'));
}

function applyMutation(candidate, mutation) {
  const expectedKeys = mutation.op === 'remove' ? ['op', 'path'] : ['op', 'path', 'value'];
  exactKeys(mutation, expectedKeys, 'FIXTURE_SHAPE', 'completion mutation');
  if (!['add', 'replace', 'remove'].includes(mutation.op))
    fail('FIXTURE_SHAPE', 'Unknown mutation op.');
  const parts = decodePointer(mutation.path);
  const leaf = parts.pop();
  let parent = candidate;
  for (const part of parts) {
    if (!isPlainObject(parent) || !Object.hasOwn(parent, part)) {
      fail('FIXTURE_SHAPE', `Mutation parent ${mutation.path} is absent.`);
    }
    parent = parent[part];
  }
  if (mutation.op === 'remove') {
    if (!Object.hasOwn(parent, leaf))
      fail('FIXTURE_SHAPE', `Mutation leaf ${mutation.path} is absent.`);
    delete parent[leaf];
  } else {
    if (mutation.op === 'replace' && !Object.hasOwn(parent, leaf)) {
      fail('FIXTURE_SHAPE', `Mutation leaf ${mutation.path} is absent.`);
    }
    parent[leaf] = structuredClone(mutation.value);
  }
}

function pin(actual, expected, label) {
  assert(actual === expected, `${label} changed: expected ${expected}, actual ${actual}`);
}

pin(sha256(schemaSource), anchors.schemaFile, 'Completion schema bytes');
pin(sha256(goldenSource), anchors.goldenFile, 'Completion golden bytes');
pin(sha256(negativeSource), anchors.negativeFile, 'Completion negative bytes');

const schema = JSON.parse(schemaSource);
const golden = JSON.parse(goldenSource);
const negative = JSON.parse(negativeSource);
const manifestSchema = JSON.parse(manifestSchemaSource);
const externalSchemas = new Map([[manifestSchema.$id, manifestSchema]]);

assert(
  schema.$id.endsWith('/widget-command-completion.v1.schema.json'),
  'Unexpected completion schema ID.'
);
assert(
  schema.type === 'object' && schema.additionalProperties === false,
  'Completion envelope must be closed.'
);
assert(
  JSON.stringify([...schema.required].sort()) === JSON.stringify(completionKeys),
  'Completion required fields drifted.'
);
assert(completionMatrix.length === 21, 'Independent completion matrix must have 21 commands.');
assert(
  new Set(completionMatrix.map((entry) => entry.commandType)).size === 21,
  'Command types duplicate.'
);
assert(
  new Set(completionMatrix.map((entry) => entry.operationId)).size === 21,
  'Operation IDs duplicate.'
);
assert(
  deepEqual(
    Object.keys(commandContextPolicies).sort(),
    completionMatrix.map((entry) => entry.commandType).sort()
  ),
  'Trusted command context policies must cover exactly 21 commands.'
);
const identityBranches = schema.allOf[0].oneOf;
const outcomeBranches = schema.allOf[1].oneOf;
assert(identityBranches.length === 21, 'Schema identity matrix must have 21 branches.');
assert(
  outcomeBranches.length === 23,
  'Schema outcome matrix must have 21 success + rejected + not executed.'
);
for (const [index, matrix] of completionMatrix.entries()) {
  const identity = identityBranches[index].properties;
  assert(
    identity.commandType.const === matrix.commandType,
    `${matrix.commandType}: identity type drifted.`
  );
  assert(
    identity.operationId.const === matrix.operationId,
    `${matrix.commandType}: identity operation drifted.`
  );
  assert(
    identity.target.properties.targetType.const === matrix.targetType,
    `${matrix.commandType}: target drifted.`
  );
  assert(
    identity.target.$ref ===
      `#/$defs/${matrix.targetIdKind === 'hash' ? 'targetHash' : 'targetUuid'}`,
    `${matrix.commandType}: target ID kind drifted.`
  );
  const success = outcomeBranches[index].properties;
  assert(
    success.operationId.const === matrix.operationId,
    `${matrix.commandType}: success operation drifted.`
  );
  assert(success.outcome.const === 'SUCCEEDED', `${matrix.commandType}: success outcome drifted.`);
  assert(
    success.responseStatus.const === matrix.successStatus,
    `${matrix.commandType}: status drifted.`
  );
  assert(
    success.responseBody.$ref === `#/$defs/${matrix.successBodyRef}`,
    `${matrix.commandType}: Success DTO drifted.`
  );
  assert(
    matrix.successEtag
      ? success.responseEtag.$ref === '#/$defs/etag'
      : success.responseEtag.type === 'null',
    `${matrix.commandType}: ETag nullability drifted.`
  );
  assert(
    schema.$defs[matrix.successBodyRef].additionalProperties === false,
    `${matrix.commandType}: DTO open.`
  );
}
assert(
  deepEqual(schema['x-dwp-responseHashContract'], {
    algorithm: 'SHA-256',
    encoding: 'UTF-8',
    canonicalization: 'RFC8785-JCS',
    fields: ['status', 'body', 'etag'],
  }),
  'responseHash contract drifted.'
);
assert(
  deepEqual(
    schema['x-dwp-successTargetBindings'],
    Object.fromEntries(completionMatrix.map((entry) => [entry.commandType, entry.targetBinding]))
  ),
  'Success target-to-response binding catalog drifted.'
);
assert(
  deepEqual(schema['x-dwp-successSemanticContract'], {
    trustedInputs: [
      'durableCommandLedger.fullTarget',
      'durableCommandLedger.requestProjection',
      'currentTargetProjection',
      'postMutationApprovalProjection',
    ],
    manifestHash: 'SHA-256(RFC8785-JCS(responseBody.manifest))',
    approvalEvidenceRefHashes:
      'ascending(SHA-256(UTF-8(each durableCommandLedger.requestProjection.evidenceRefs)))',
    clearanceExecutionApproval:
      'durable request clearanceApprovalId/quarantineEventId exactly bind the locked current quarantined Version and its ACTIVE unconsumed unexpired child approval; the same transaction consumes it with response.commandId',
    runtimeEnableApproval:
      'durable request enableApprovalId/controlRevision exactly bind the locked current Runtime Control head and its ACTIVE unconsumed unexpired child approval; the same transaction consumes it with response.commandId',
    waivedEvidenceSource:
      'responseBody type/ref/hash exactly equal currentTargetProjection bound to command target/version/manifest',
    etag: 'strong ETag "v" + decimal(responseBody.version ?? responseBody.revision)',
    enforcement: 'verify-command-completion-contract.mjs',
  }),
  'Success semantic contract annotation drifted.'
);
assert(
  preReceiptOnlyCodes.every(
    (code) =>
      !schema.$defs.error400.properties.code.enum.includes(code) &&
      !schema.$defs.error403.properties.code.enum.includes(code)
  ),
  'Pre-receipt-only failures must not be durable REJECTED codes.'
);
assert(
  deepEqual(schema.$defs.widgetEvidenceResponse.oneOf, [
    {
      required: ['waivedEvidenceId', 'trackingTicketRef', 'expiresAt'],
      properties: { status: { const: 'WAIVED' } },
    },
    {
      properties: { status: { enum: ['NOT_RUN', 'PASS', 'FAIL', 'EXPIRED'] } },
      allOf: [
        { not: { required: ['waivedEvidenceId'] } },
        { not: { required: ['trackingTicketRef'] } },
      ],
    },
  ]),
  'Evidence waiver status/field projection drifted.'
);
const clearanceSuccessBranch = outcomeBranches.find(
  (branch) => branch.properties.operationId.const === 'approveWidgetQuarantineClearance'
);
assert(
  clearanceSuccessBranch?.properties.responseBody.properties?.reviewDecision?.const === 'APPROVE',
  'Clearance completion response must be approval-only.'
);

exactKeys(
  golden,
  ['fixtureVersion', 'canonicalization', 'completions'],
  'FIXTURE_SHAPE',
  'golden fixture'
);
assert(golden.fixtureVersion === 1, 'Golden fixture version must be 1.');
assert(
  deepEqual(golden.canonicalization, {
    algorithm: 'RFC8785-JCS',
    encoding: 'UTF-8',
    hash: 'SHA-256',
    responseHashInput: ['status', 'body', 'etag'],
  }),
  'Golden canonicalization declaration drifted.'
);
assert(golden.completions.length === 23, 'Expected 21 success and two terminal outcome vectors.');
assert(
  new Set(golden.completions.map((entry) => entry.caseId)).size === 23,
  'Golden case IDs duplicate.'
);
for (const entry of golden.completions) {
  exactKeys(
    entry,
    ['caseId', 'response', 'verificationContext'],
    'FIXTURE_SHAPE',
    `golden ${entry.caseId}`
  );
  validateCompletion(entry.response, schema, externalSchemas, entry.verificationContext);
}
const rejectDecisionVector = golden.completions.find((entry) => entry.caseId === 'success-decide');
assert(
  rejectDecisionVector?.verificationContext.requestProjection.decision === 'REJECT' &&
    rejectDecisionVector.response.outcome === 'SUCCEEDED' &&
    rejectDecisionVector.response.responseBody.workflowState === 'REJECTED',
  'A review REJECT must be modeled as a successful command that transitions workflow state.'
);
const approveDecisionRegression = structuredClone(rejectDecisionVector);
approveDecisionRegression.verificationContext.requestProjection.decision = 'APPROVE';
approveDecisionRegression.response.responseBody.workflowState = 'APPROVED';
approveDecisionRegression.response.responseBody.currentReviewDecisionId = null;
approveDecisionRegression.response.responseHash = responseHash(approveDecisionRegression.response);
validateCompletion(
  approveDecisionRegression.response,
  schema,
  externalSchemas,
  approveDecisionRegression.verificationContext
);
const reworkVector = golden.completions.find((entry) => entry.caseId === 'success-rework');
assert(
  reworkVector?.verificationContext.requestProjection.rejectedDecisionId ===
    rejectDecisionVector.response.responseBody.currentReviewDecisionId,
  'REWORK must continue from the exact successful REJECT decision identity.'
);
const successVectors = golden.completions.filter((entry) => entry.response.outcome === 'SUCCEEDED');
assert(successVectors.length === 21, 'Every command needs one success vector.');
assert(
  new Set(successVectors.map((entry) => entry.response.commandType)).size === 21,
  'Success vectors miss or duplicate command types.'
);
assert(
  golden.completions.filter((entry) => entry.response.outcome === 'REJECTED').length === 1 &&
    golden.completions.filter((entry) => entry.response.outcome === 'NOT_EXECUTED').length === 1,
  'Terminal outcome vectors are incomplete.'
);
pin(
  canonicalHash(golden.completions.map((entry) => entry.response)),
  anchors.positiveResponsesCanonical,
  'Completion positive canonical digest'
);
pin(
  canonicalHash(golden.completions.map((entry) => entry.verificationContext)),
  anchors.trustedLedgerContextsCanonical,
  'Completion trusted ledger contexts canonical digest'
);
pin(
  canonicalHash({
    completionMatrix,
    rejectedCodesByStatus,
    preReceiptOnlyCodes,
    commandContextPolicies,
  }),
  anchors.completionCatalogCanonical,
  'Completion catalog canonical digest'
);

exactKeys(negative, ['fixtureVersion', 'cases'], 'FIXTURE_SHAPE', 'negative fixture');
assert(negative.fixtureVersion === 1, 'Negative fixture version must be 1.');
assert(
  new Set(negative.cases.map((entry) => entry.caseId)).size === negative.cases.length,
  'Negative IDs duplicate.'
);
const goldenById = new Map(golden.completions.map((entry) => [entry.caseId, entry]));
for (const negativeCase of negative.cases) {
  const optionalKeys = Object.hasOwn(negativeCase, 'recomputeResponseHash')
    ? ['recomputeResponseHash']
    : [];
  exactKeys(
    negativeCase,
    ['caseId', 'baseCaseId', 'mutations', 'expectedError', ...optionalKeys],
    'FIXTURE_SHAPE',
    `negative ${negativeCase.caseId}`
  );
  const base = goldenById.get(negativeCase.baseCaseId);
  assert(base, `${negativeCase.caseId}: unknown base ${negativeCase.baseCaseId}.`);
  assert(
    Array.isArray(negativeCase.mutations) && negativeCase.mutations.length > 0,
    'Mutation list is empty.'
  );
  const candidate = structuredClone(base);
  for (const mutation of negativeCase.mutations) applyMutation(candidate, mutation);
  if (negativeCase.recomputeResponseHash === true) {
    candidate.response.responseHash = responseHash(candidate.response);
  }
  let actualError = null;
  try {
    validateCompletion(candidate.response, schema, externalSchemas, candidate.verificationContext);
  } catch (error) {
    if (!(error instanceof ContractError)) throw error;
    actualError = error.code;
  }
  assert(
    actualError === negativeCase.expectedError,
    `${negativeCase.caseId}: expected ${negativeCase.expectedError}, got ${actualError ?? 'PASS'}.`
  );
}
pin(
  canonicalHash(
    negative.cases.map((entry) => ({
      caseId: entry.caseId,
      baseCaseId: entry.baseCaseId,
      expectedError: entry.expectedError,
    }))
  ),
  anchors.negativeCatalogCanonical,
  'Completion negative catalog canonical digest'
);

console.log(
  `Widget Command Completion contract verification passed: ${completionMatrix.length} command identities, ` +
    `${successVectors.length} operation-specific success vectors, 2 terminal outcomes, ` +
    `${negative.cases.length} negative mutations.`
);
