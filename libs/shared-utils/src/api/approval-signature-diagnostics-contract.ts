import {
  SIGNATURE_PROVIDER_KINDS,
  SIGNATURE_PROVIDER_ENVIRONMENTS,
  SIGNATURE_OBSERVATION_STATES,
  SIGNATURE_POLICY_SOURCE_STATES,
  SIGNATURE_PROVIDER_READINESS,
  SIGNATURE_GATE_STATES,
  SIGNATURE_PHASE_KINDS,
  SIGNATURE_KMS_BACKENDS,
  SIGNATURE_KEY_VERIFICATION_KINDS,
  SIGNATURE_OBJECT_LOCK_MODES,
  diagnosticFields,
  diagnosticText,
  diagnosticInteger,
  diagnosticBoolean,
  diagnosticEnum,
  diagnosticNullable,
  diagnosticList,
  diagnosticUnique,
  diagnosticId,
  diagnosticSha,
  diagnosticKey,
  diagnosticReasons,
  diagnosticInstant,
  diagnosticInterval,
  diagnosticEvidence,
  diagnosticSource,
  diagnosticSeconds,
  diagnosticOfficialLink,
  invalidSignatureDiagnostics,
  SIGNATURE_PROBE_STATES,
} from './approval-signature-diagnostics-primitives';

export type SignatureProviderKind = (typeof SIGNATURE_PROVIDER_KINDS)[number];
export type SignatureObservationState = (typeof SIGNATURE_OBSERVATION_STATES)[number];
export type SignatureGateState = (typeof SIGNATURE_GATE_STATES)[number];
export type SignatureProviderScope = Readonly<{
  resourceSetKey: string;
  contextScopeKey: string;
  decisionRevision: string;
  registrySha256: string;
  sourceRevision: string;
  sourceSha256: string;
  evaluatedAt: string;
}>;
export type SignatureProviderPin = Readonly<{ sourceId: string; version: number; sha256: string }>;
export type SignatureProviderPolicySource = Readonly<{
  sourceState: (typeof SIGNATURE_POLICY_SOURCE_STATES)[number];
  pin: SignatureProviderPin | null;
  requiredProviderKinds: readonly SignatureProviderKind[] | null;
  maxProbeAgeSeconds: number | null;
  probeIntervalSeconds: number | null;
  retentionFloorSeconds: number | null;
}>;
export type SignatureProviderKpis = Readonly<{
  registeredProviderCount: number;
  configuredProviderCount: number;
  verifiedProductionProviderCount: number;
  requiredProviderCount: number | null;
  requiredProviderKinds: readonly SignatureProviderKind[] | null;
  externalGateState: SignatureGateState;
  gateReasonCodes: readonly string[];
  lastProbeAt: string | null;
  probeIntervalSeconds: number | null;
}>;
export type SignatureProviderCheck = Readonly<{
  checkKey: string;
  state: SignatureObservationState;
  reasonCodes: readonly string[];
  observedAt: string | null;
  validUntil: string | null;
  evidenceId: string | null;
  evidenceSha256: string | null;
}>;
export type SignatureProviderCard = Readonly<{
  providerId: string | null;
  kind: SignatureProviderKind;
  displayName: string;
  providerVersion: number | null;
  providerSha256: string | null;
  adapterInstalled: boolean;
  configurationRegistered: boolean;
  credentialRegistered: boolean;
  credentialVerified: boolean;
  requiredByPolicy: boolean | null;
  environment: (typeof SIGNATURE_PROVIDER_ENVIRONMENTS)[number];
  readiness: (typeof SIGNATURE_PROVIDER_READINESS)[number];
  gateReasonCodes: readonly string[];
  lastProbeAt: string | null;
  checks: readonly SignatureProviderCheck[];
}>;
export type SignatureProviderSettings = Readonly<{
  configuration: SignatureProviderPin | null;
  environment: (typeof SIGNATURE_PROVIDER_ENVIRONMENTS)[number];
  endpointOriginSha256: string | null;
  accountBindingSha256: string | null;
  credentialRegistered: boolean;
  callbackAuthenticationMode: string;
  configurationOwner: string;
}>;
export type SignatureProviderPhase = Readonly<{
  phaseKind: (typeof SIGNATURE_PHASE_KINDS)[number];
  gateState: SignatureGateState;
  reasonCodes: readonly string[];
  checkKeys: readonly string[];
  evidenceIds: readonly string[];
}>;
export type SignatureProviderGuide = Readonly<{
  sections: readonly Readonly<{
    sectionKey: string;
    stepKeys: readonly string[];
    officialDocumentationLinks: readonly string[];
  }>[];
}>;
export type SignatureProviderKms = Readonly<{
  backend: (typeof SIGNATURE_KMS_BACKENDS)[number];
  verificationKind: (typeof SIGNATURE_KEY_VERIFICATION_KINDS)[number];
  state: SignatureObservationState;
  algorithm: string | null;
  keySha256: string | null;
  source: string;
  checkedAt: string | null;
  validUntil: string | null;
  evidenceId: string | null;
  evidenceSha256: string | null;
  reasonCodes: readonly string[];
}>;
export type SignatureProviderWorm = Readonly<{
  state: SignatureObservationState;
  storageLocatorSha256: string | null;
  objectVersionSha256: string | null;
  objectLockMode: (typeof SIGNATURE_OBJECT_LOCK_MODES)[number];
  retainUntil: string | null;
  legalHold: boolean | null;
  policy: SignatureProviderPin | null;
  retentionFloorSeconds: number | null;
  checkedAt: string | null;
  validUntil: string | null;
  evidenceId: string | null;
  evidenceSha256: string | null;
  reasonCodes: readonly string[];
}>;
export type SignatureProviderOverview = Readonly<{
  scope: SignatureProviderScope;
  policy: SignatureProviderPolicySource;
  kpis: SignatureProviderKpis;
  providers: readonly SignatureProviderCard[];
  phases: readonly SignatureProviderPhase[];
  kms: SignatureProviderKms;
  worm: SignatureProviderWorm;
}>;
export type SignatureProviderDiagnostics = Readonly<{
  scope: SignatureProviderScope;
  policy: SignatureProviderPolicySource;
  provider: SignatureProviderCard;
  settings: SignatureProviderSettings;
  gateReasons: readonly string[];
  guide: SignatureProviderGuide;
  phases: readonly SignatureProviderPhase[];
  kms: SignatureProviderKms;
  worm: SignatureProviderWorm;
}>;
export type SignatureProviderDiagnosticHistory = Readonly<{
  scope: SignatureProviderScope;
  items: readonly Readonly<{
    probeRunId: string;
    providerId: string | null;
    sourceRevision: string;
    sourceSha256: string;
    state: (typeof SIGNATURE_PROBE_STATES)[number];
    occurredAt: string;
    reasonCodes: readonly string[];
    evidenceId: string | null;
    evidenceSha256: string | null;
  }>[];
  nextCursor: string | null;
  truncated: boolean;
}>;

export function readSignatureProviderScope(value: unknown): SignatureProviderScope {
  const v = diagnosticFields(value, [
    'resourceSetKey',
    'contextScopeKey',
    'decisionRevision',
    'registrySha256',
    'sourceRevision',
    'sourceSha256',
    'evaluatedAt',
  ]);
  const resourceSetKey = diagnosticText(v.resourceSetKey, 80);
  const decisionRevision = diagnosticText(v.decisionRevision, 68);
  if (!/^RS_[A-Z0-9_]{1,76}$/.test(resourceSetKey) || !/^psr-[a-f0-9]{64}$/.test(decisionRevision))
    invalidSignatureDiagnostics();
  const sourceSha256 = diagnosticSha(v.sourceSha256);
  return Object.freeze({
    resourceSetKey,
    contextScopeKey: diagnosticText(v.contextScopeKey, 512),
    decisionRevision,
    registrySha256: diagnosticSha(v.registrySha256),
    sourceRevision: diagnosticSource(v.sourceRevision, sourceSha256),
    sourceSha256,
    evaluatedAt: diagnosticInstant(v.evaluatedAt),
  });
}
export function readSignatureProviderPin(value: unknown): SignatureProviderPin {
  const v = diagnosticFields(value, ['sourceId', 'version', 'sha256']);
  return Object.freeze({
    sourceId: diagnosticId(v.sourceId),
    version: diagnosticInteger(v.version),
    sha256: diagnosticSha(v.sha256),
  });
}
function providerKinds(value: unknown) {
  return diagnosticUnique(
    diagnosticList(value, (item) => diagnosticEnum(item, SIGNATURE_PROVIDER_KINDS), 10)
  );
}
export function readSignatureProviderPolicySource(value: unknown): SignatureProviderPolicySource {
  const v = diagnosticFields(value, [
    'sourceState',
    'pin',
    'requiredProviderKinds',
    'maxProbeAgeSeconds',
    'probeIntervalSeconds',
    'retentionFloorSeconds',
  ]);
  const result = Object.freeze({
    sourceState: diagnosticEnum(v.sourceState, SIGNATURE_POLICY_SOURCE_STATES),
    pin: diagnosticNullable(v.pin, readSignatureProviderPin),
    requiredProviderKinds: diagnosticNullable(v.requiredProviderKinds, providerKinds),
    maxProbeAgeSeconds: diagnosticNullable(v.maxProbeAgeSeconds, diagnosticSeconds),
    probeIntervalSeconds: diagnosticNullable(v.probeIntervalSeconds, diagnosticSeconds),
    retentionFloorSeconds: diagnosticNullable(v.retentionFloorSeconds, diagnosticSeconds),
  });
  const complete =
    result.pin !== null &&
    result.requiredProviderKinds !== null &&
    result.maxProbeAgeSeconds !== null &&
    result.probeIntervalSeconds !== null &&
    result.retentionFloorSeconds !== null;
  const empty =
    result.pin === null &&
    result.requiredProviderKinds === null &&
    result.maxProbeAgeSeconds === null &&
    result.probeIntervalSeconds === null &&
    result.retentionFloorSeconds === null;
  if (result.sourceState === 'AVAILABLE' ? !complete : !empty) invalidSignatureDiagnostics();
  return result;
}
export function readSignatureProviderKpis(value: unknown): SignatureProviderKpis {
  const v = diagnosticFields(value, [
    'registeredProviderCount',
    'configuredProviderCount',
    'verifiedProductionProviderCount',
    'requiredProviderCount',
    'requiredProviderKinds',
    'externalGateState',
    'gateReasonCodes',
    'lastProbeAt',
    'probeIntervalSeconds',
  ]);
  const result = Object.freeze({
    registeredProviderCount: diagnosticInteger(v.registeredProviderCount, 0, 10),
    configuredProviderCount: diagnosticInteger(v.configuredProviderCount, 0, 10),
    verifiedProductionProviderCount: diagnosticInteger(v.verifiedProductionProviderCount, 0, 10),
    requiredProviderCount: diagnosticNullable(v.requiredProviderCount, (item) =>
      diagnosticInteger(item, 0, 10)
    ),
    requiredProviderKinds: diagnosticNullable(v.requiredProviderKinds, providerKinds),
    externalGateState: diagnosticEnum(v.externalGateState, SIGNATURE_GATE_STATES),
    gateReasonCodes: diagnosticReasons(v.gateReasonCodes),
    lastProbeAt: diagnosticNullable(v.lastProbeAt, diagnosticInstant),
    probeIntervalSeconds: diagnosticNullable(v.probeIntervalSeconds, diagnosticSeconds),
  });
  if (
    result.configuredProviderCount > result.registeredProviderCount ||
    result.verifiedProductionProviderCount > result.configuredProviderCount ||
    (result.requiredProviderCount === null) !== (result.requiredProviderKinds === null) ||
    (result.requiredProviderKinds !== null &&
      result.requiredProviderCount !== result.requiredProviderKinds.length) ||
    (result.requiredProviderCount === null && result.externalGateState === 'ELIGIBLE')
  )
    invalidSignatureDiagnostics();
  return result;
}
export function readSignatureProviderCheck(value: unknown): SignatureProviderCheck {
  const v = diagnosticFields(value, [
    'checkKey',
    'state',
    'reasonCodes',
    'observedAt',
    'validUntil',
    'evidenceId',
    'evidenceSha256',
  ]);
  const result = Object.freeze({
    checkKey: diagnosticKey(v.checkKey),
    state: diagnosticEnum(v.state, SIGNATURE_OBSERVATION_STATES),
    reasonCodes: diagnosticReasons(v.reasonCodes),
    observedAt: diagnosticNullable(v.observedAt, diagnosticInstant),
    validUntil: diagnosticNullable(v.validUntil, diagnosticInstant),
    evidenceId: diagnosticNullable(v.evidenceId, diagnosticId),
    evidenceSha256: diagnosticNullable(v.evidenceSha256, diagnosticSha),
  });
  diagnosticInterval(result.observedAt, result.validUntil);
  diagnosticEvidence(result.evidenceId, result.evidenceSha256);
  if (
    (['PASS', 'FAIL'].includes(result.state) &&
      (result.observedAt === null || result.evidenceId === null)) ||
    (['NOT_CONFIGURED', 'NOT_OBSERVED'].includes(result.state) &&
      (result.observedAt !== null || result.evidenceId !== null))
  )
    invalidSignatureDiagnostics();
  return result;
}
function checks(value: unknown) {
  return diagnosticUnique(
    diagnosticList(value, readSignatureProviderCheck, 32),
    (check) => check.checkKey
  );
}
export function readSignatureProviderCard(value: unknown): SignatureProviderCard {
  const v = diagnosticFields(value, [
    'providerId',
    'kind',
    'displayName',
    'providerVersion',
    'providerSha256',
    'adapterInstalled',
    'configurationRegistered',
    'credentialRegistered',
    'credentialVerified',
    'requiredByPolicy',
    'environment',
    'readiness',
    'gateReasonCodes',
    'lastProbeAt',
    'checks',
  ]);
  const result = Object.freeze({
    providerId: diagnosticNullable(v.providerId, diagnosticId),
    kind: diagnosticEnum(v.kind, SIGNATURE_PROVIDER_KINDS),
    displayName: diagnosticText(v.displayName),
    providerVersion: diagnosticNullable(v.providerVersion, diagnosticInteger),
    providerSha256: diagnosticNullable(v.providerSha256, diagnosticSha),
    adapterInstalled: diagnosticBoolean(v.adapterInstalled),
    configurationRegistered: diagnosticBoolean(v.configurationRegistered),
    credentialRegistered: diagnosticBoolean(v.credentialRegistered),
    credentialVerified: diagnosticBoolean(v.credentialVerified),
    requiredByPolicy: diagnosticNullable(v.requiredByPolicy, diagnosticBoolean),
    environment: diagnosticEnum(v.environment, SIGNATURE_PROVIDER_ENVIRONMENTS),
    readiness: diagnosticEnum(v.readiness, SIGNATURE_PROVIDER_READINESS),
    gateReasonCodes: diagnosticReasons(v.gateReasonCodes),
    lastProbeAt: diagnosticNullable(v.lastProbeAt, diagnosticInstant),
    checks: checks(v.checks),
  });
  if (
    result.providerId === null
      ? result.kind === 'CUSTOM' ||
        result.providerVersion !== null ||
        result.providerSha256 !== null ||
        result.configurationRegistered ||
        result.credentialRegistered ||
        result.credentialVerified
      : result.providerVersion === null || result.providerSha256 === null
  )
    invalidSignatureDiagnostics();
  if (
    (result.credentialVerified &&
      (!result.credentialRegistered ||
        !result.configurationRegistered ||
        !result.adapterInstalled)) ||
    (result.readiness === 'MISSING_INTERNAL' && result.adapterInstalled) ||
    (result.readiness === 'VERIFIED_PRODUCTION' &&
      (result.kind === 'INTERNAL' ||
        result.environment !== 'PRODUCTION' ||
        !result.credentialVerified ||
        result.lastProbeAt === null)) ||
    (result.readiness === 'VERIFIED_SANDBOX' &&
      (result.environment !== 'SANDBOX' || !result.credentialVerified)) ||
    (result.readiness === 'VERIFIED_INTERNAL_KEY' &&
      (result.kind !== 'INTERNAL' || result.environment !== 'INTERNAL' || !result.adapterInstalled))
  )
    invalidSignatureDiagnostics();
  return result;
}
export function readSignatureProviderSettings(value: unknown): SignatureProviderSettings {
  const v = diagnosticFields(value, [
    'configuration',
    'environment',
    'endpointOriginSha256',
    'accountBindingSha256',
    'credentialRegistered',
    'callbackAuthenticationMode',
    'configurationOwner',
  ]);
  const result = Object.freeze({
    configuration: diagnosticNullable(v.configuration, readSignatureProviderPin),
    environment: diagnosticEnum(v.environment, SIGNATURE_PROVIDER_ENVIRONMENTS),
    endpointOriginSha256: diagnosticNullable(v.endpointOriginSha256, diagnosticSha),
    accountBindingSha256: diagnosticNullable(v.accountBindingSha256, diagnosticSha),
    credentialRegistered: diagnosticBoolean(v.credentialRegistered),
    callbackAuthenticationMode: diagnosticText(v.callbackAuthenticationMode, 80),
    configurationOwner: diagnosticText(v.configurationOwner),
  });
  if (
    result.configuration === null &&
    (result.credentialRegistered ||
      result.endpointOriginSha256 !== null ||
      result.accountBindingSha256 !== null)
  )
    invalidSignatureDiagnostics();
  return result;
}
export function readSignatureProviderPhase(value: unknown): SignatureProviderPhase {
  const v = diagnosticFields(value, [
    'phaseKind',
    'gateState',
    'reasonCodes',
    'checkKeys',
    'evidenceIds',
  ]);
  return Object.freeze({
    phaseKind: diagnosticEnum(v.phaseKind, SIGNATURE_PHASE_KINDS),
    gateState: diagnosticEnum(v.gateState, SIGNATURE_GATE_STATES),
    reasonCodes: diagnosticReasons(v.reasonCodes),
    checkKeys: diagnosticUnique(diagnosticList(v.checkKeys, diagnosticKey, 32)),
    evidenceIds: diagnosticUnique(diagnosticList(v.evidenceIds, diagnosticId, 32)),
  });
}
export function readSignatureProviderGuide(value: unknown): SignatureProviderGuide {
  const v = diagnosticFields(value, ['sections']);
  return Object.freeze({
    sections: diagnosticList(
      v.sections,
      (item) => {
        const s = diagnosticFields(item, ['sectionKey', 'stepKeys', 'officialDocumentationLinks']);
        return Object.freeze({
          sectionKey: diagnosticKey(s.sectionKey),
          stepKeys: diagnosticUnique(diagnosticList(s.stepKeys, diagnosticKey, 32)),
          officialDocumentationLinks: diagnosticUnique(
            diagnosticList(s.officialDocumentationLinks, diagnosticOfficialLink, 8)
          ),
        });
      },
      10
    ),
  });
}
export function readSignatureProviderKms(value: unknown): SignatureProviderKms {
  const v = diagnosticFields(value, [
    'backend',
    'verificationKind',
    'state',
    'algorithm',
    'keySha256',
    'source',
    'checkedAt',
    'validUntil',
    'evidenceId',
    'evidenceSha256',
    'reasonCodes',
  ]);
  const result = Object.freeze({
    backend: diagnosticEnum(v.backend, SIGNATURE_KMS_BACKENDS),
    verificationKind: diagnosticEnum(v.verificationKind, SIGNATURE_KEY_VERIFICATION_KINDS),
    state: diagnosticEnum(v.state, SIGNATURE_OBSERVATION_STATES),
    algorithm: diagnosticNullable(v.algorithm, (item) => diagnosticText(item, 80)),
    keySha256: diagnosticNullable(v.keySha256, diagnosticSha),
    source: diagnosticText(v.source),
    checkedAt: diagnosticNullable(v.checkedAt, diagnosticInstant),
    validUntil: diagnosticNullable(v.validUntil, diagnosticInstant),
    evidenceId: diagnosticNullable(v.evidenceId, diagnosticId),
    evidenceSha256: diagnosticNullable(v.evidenceSha256, diagnosticSha),
    reasonCodes: diagnosticReasons(v.reasonCodes),
  });
  diagnosticInterval(result.checkedAt, result.validUntil);
  diagnosticEvidence(result.evidenceId, result.evidenceSha256);
  if (
    (result.state === 'PASS' &&
      (result.backend === 'NONE' ||
        result.keySha256 === null ||
        result.algorithm === null ||
        result.checkedAt === null ||
        result.evidenceId === null ||
        result.verificationKind === 'NONE')) ||
    (result.verificationKind === 'HARDWARE_TOKEN' && result.backend !== 'PKCS11') ||
    (result.verificationKind === 'CONFIGURED_KMS' && result.backend !== 'AWS_KMS') ||
    (result.verificationKind === 'INTERNAL_KEY' && result.backend !== 'INTERNAL_JCA')
  )
    invalidSignatureDiagnostics();
  return result;
}
export function readSignatureProviderWorm(value: unknown): SignatureProviderWorm {
  const v = diagnosticFields(value, [
    'state',
    'storageLocatorSha256',
    'objectVersionSha256',
    'objectLockMode',
    'retainUntil',
    'legalHold',
    'policy',
    'retentionFloorSeconds',
    'checkedAt',
    'validUntil',
    'evidenceId',
    'evidenceSha256',
    'reasonCodes',
  ]);
  const result = Object.freeze({
    state: diagnosticEnum(v.state, SIGNATURE_OBSERVATION_STATES),
    storageLocatorSha256: diagnosticNullable(v.storageLocatorSha256, diagnosticSha),
    objectVersionSha256: diagnosticNullable(v.objectVersionSha256, diagnosticSha),
    objectLockMode: diagnosticEnum(v.objectLockMode, SIGNATURE_OBJECT_LOCK_MODES),
    retainUntil: diagnosticNullable(v.retainUntil, diagnosticInstant),
    legalHold: diagnosticNullable(v.legalHold, diagnosticBoolean),
    policy: diagnosticNullable(v.policy, readSignatureProviderPin),
    retentionFloorSeconds: diagnosticNullable(v.retentionFloorSeconds, diagnosticSeconds),
    checkedAt: diagnosticNullable(v.checkedAt, diagnosticInstant),
    validUntil: diagnosticNullable(v.validUntil, diagnosticInstant),
    evidenceId: diagnosticNullable(v.evidenceId, diagnosticId),
    evidenceSha256: diagnosticNullable(v.evidenceSha256, diagnosticSha),
    reasonCodes: diagnosticReasons(v.reasonCodes),
  });
  diagnosticInterval(result.checkedAt, result.validUntil);
  diagnosticEvidence(result.evidenceId, result.evidenceSha256);
  if (
    result.state === 'PASS' &&
    (result.storageLocatorSha256 === null ||
      result.objectVersionSha256 === null ||
      result.objectLockMode === 'NONE' ||
      result.retainUntil === null ||
      result.legalHold === null ||
      result.policy === null ||
      result.retentionFloorSeconds === null ||
      result.checkedAt === null ||
      result.evidenceId === null ||
      Date.parse(result.retainUntil) <
        Date.parse(result.checkedAt) + result.retentionFloorSeconds * 1000)
  )
    invalidSignatureDiagnostics();
  return result;
}
function phases(value: unknown) {
  return diagnosticList(value, readSignatureProviderPhase, 3);
}
export function readSignatureProviderOverview(value: unknown): SignatureProviderOverview {
  const v = diagnosticFields(value, [
    'scope',
    'policy',
    'kpis',
    'providers',
    'phases',
    'kms',
    'worm',
  ]);
  const result = Object.freeze({
    scope: readSignatureProviderScope(v.scope),
    policy: readSignatureProviderPolicySource(v.policy),
    kpis: readSignatureProviderKpis(v.kpis),
    providers: diagnosticList(v.providers, readSignatureProviderCard, 10),
    phases: phases(v.phases),
    kms: readSignatureProviderKms(v.kms),
    worm: readSignatureProviderWorm(v.worm),
  });
  if (
    result.policy.sourceState !== 'AVAILABLE' &&
    (result.kpis.requiredProviderCount !== null ||
      result.kpis.probeIntervalSeconds !== null ||
      result.providers.some((p) => p.requiredByPolicy !== null))
  )
    invalidSignatureDiagnostics();
  if (result.policy.sourceState === 'AVAILABLE') {
    const requirements = result.policy.requiredProviderKinds;
    const reported = result.kpis.requiredProviderKinds;
    if (
      requirements === null ||
      reported === null ||
      requirements.length !== reported.length ||
      requirements.some((kind) => !reported.includes(kind)) ||
      result.kpis.probeIntervalSeconds !== result.policy.probeIntervalSeconds
    )
      invalidSignatureDiagnostics();
  }
  return result;
}
export function readSignatureProviderDiagnostics(value: unknown): SignatureProviderDiagnostics {
  const v = diagnosticFields(value, [
    'scope',
    'policy',
    'provider',
    'settings',
    'gateReasons',
    'guide',
    'phases',
    'kms',
    'worm',
  ]);
  const result = Object.freeze({
    scope: readSignatureProviderScope(v.scope),
    policy: readSignatureProviderPolicySource(v.policy),
    provider: readSignatureProviderCard(v.provider),
    settings: readSignatureProviderSettings(v.settings),
    gateReasons: diagnosticReasons(v.gateReasons),
    guide: readSignatureProviderGuide(v.guide),
    phases: phases(v.phases),
    kms: readSignatureProviderKms(v.kms),
    worm: readSignatureProviderWorm(v.worm),
  });
  if (result.policy.sourceState !== 'AVAILABLE' && result.provider.requiredByPolicy !== null)
    invalidSignatureDiagnostics();
  return result;
}

export function readSignatureProviderDiagnosticHistory(
  value: unknown
): SignatureProviderDiagnosticHistory {
  const v = diagnosticFields(value, ['scope', 'items', 'nextCursor', 'truncated']);
  const result = Object.freeze({
    scope: readSignatureProviderScope(v.scope),
    items: diagnosticList(
      v.items,
      (item) => {
        const r = diagnosticFields(item, [
          'probeRunId',
          'providerId',
          'sourceRevision',
          'sourceSha256',
          'state',
          'occurredAt',
          'reasonCodes',
          'evidenceId',
          'evidenceSha256',
        ]);
        const sourceSha256 = diagnosticSha(r.sourceSha256);
        const record = Object.freeze({
          probeRunId: diagnosticId(r.probeRunId),
          providerId: diagnosticNullable(r.providerId, diagnosticId),
          sourceRevision: diagnosticSource(r.sourceRevision, sourceSha256),
          sourceSha256,
          state: diagnosticEnum(r.state, SIGNATURE_PROBE_STATES),
          occurredAt: diagnosticInstant(r.occurredAt),
          reasonCodes: diagnosticReasons(r.reasonCodes),
          evidenceId: diagnosticNullable(r.evidenceId, diagnosticId),
          evidenceSha256: diagnosticNullable(r.evidenceSha256, diagnosticSha),
        });
        diagnosticEvidence(record.evidenceId, record.evidenceSha256);
        return record;
      },
      50
    ),
    nextCursor: diagnosticNullable(v.nextCursor, (item) => diagnosticText(item, 4096)),
    truncated: diagnosticBoolean(v.truncated),
  });
  if (result.truncated !== (result.nextCursor !== null)) invalidSignatureDiagnostics();
  return result;
}
