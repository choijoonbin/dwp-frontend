import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Ajv = require('ajv');

const urls = Object.freeze({
  schema: new URL('./widget-rollout-operation.v1.schema.json', import.meta.url),
  golden: new URL('./widget-rollout-operation.v1.golden.json', import.meta.url),
  negative: new URL('./widget-rollout-operation.v1.negative.json', import.meta.url),
  bootstrapSchema: new URL('./widget-bootstrap-prerequisite.v1.schema.json', import.meta.url),
  evidenceSchema: new URL('./widget-rollout-evidence.v1.schema.json', import.meta.url),
});

const sources = Object.fromEntries(
  Object.entries(urls).map(([key, url]) => [key, readFileSync(url, 'utf8')])
);

const anchors = Object.freeze({
  schemaFile: 'a00164c1bc42a51c60187b548d302f3a4d3b21274c4ad8d22772fd1ffc51b093',
  goldenFile: 'e2707a1b81724c4b6a98437039e0b59c0329f4f22a9bfe0b97a395dd80473ca7',
  negativeFile: '9c53f7a2d6bb39cce450d6671668dd522929c361be42702b4fbd9d341d06d70a',
  bootstrapSchemaFile: 'abb40678362b5522cc200e1c6644036f22a3a8d5e18b53a6da091fcaeef652b6',
  evidenceSchemaFile: '607f7dc49953800e043113394e9f11590192e6055ce8dd4eb8f4205832dd7b20',
  goldenCanonical: '5a9ec9408b7b7e5cf2ba4d0f1c89525a390bc289b3113da69c515817ea762ca6',
  negativeCanonical: 'd41cf97bd316f1bec32d8b87d4edbb6a7c3de96e18b3531e7ec9b038a0540757',
});

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

class ContractError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function fail(code, message) {
  throw new ContractError(code, message);
}

function canonicalize(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    assert(Number.isSafeInteger(value), 'Canonical contract numbers must be safe integers.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  assert(value && typeof value === 'object', 'Contract contains non-JSON data.');
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
    .join(',')}}`;
}

function canonicalDigest(value) {
  return sha256(Buffer.from(canonicalize(value), 'utf8'));
}

function same(valueA, valueB) {
  return canonicalize(valueA) === canonicalize(valueB);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sanitizeExternalSchema(source) {
  const schema = JSON.parse(source);
  delete schema.$schema;
  return schema;
}

for (const [key, expected] of [
  ['schema', anchors.schemaFile],
  ['golden', anchors.goldenFile],
  ['negative', anchors.negativeFile],
  ['bootstrapSchema', anchors.bootstrapSchemaFile],
  ['evidenceSchema', anchors.evidenceSchemaFile],
]) {
  assert(sha256(sources[key]) === expected, `${key} bytes changed.`);
}

const schema = JSON.parse(sources.schema);
const golden = JSON.parse(sources.golden);
const negative = JSON.parse(sources.negative);

assert(canonicalDigest(golden) === anchors.goldenCanonical, 'Golden canonical digest changed.');
assert(
  canonicalDigest(negative) === anchors.negativeCanonical,
  'Negative canonical digest changed.'
);
assert(
  schema.$id === 'https://dwp.example/schemas/widget-rollout-operation.v1.schema.json',
  'Unexpected rollout operation schema ID.'
);
assert(
  schema.definitions.widgetCatalogRolloutStateResponse.oneOf.length === 3,
  'State response must close STATIC, BOOTSTRAP, and SHADOW with oneOf.'
);
assert(
  schema.definitions.widgetCatalogRolloutApprovalResponse.oneOf.length === 2,
  'Approval response must close BOOTSTRAP and PROMOTION with oneOf.'
);
assert(
  schema.definitions.operationExample.oneOf.length === 7,
  'Operation fixture must cover approve x2, activate x2, stop, expiry, and evidence read.'
);
assert(
  same(schema.definitions.rolloutExpiryEvaluationRequest.properties.clockSource, {
    const: 'DATABASE',
  }) &&
    same(schema.definitions.rolloutExpiryEvaluationRequest.properties.failureMode, {
      const: 'STOP_FAIL_CLOSED',
    }),
  'Expiry evaluation must use DB clock and fail closed.'
);
assert(
  schema.definitions.rolloutStoppedResponse.oneOf.some(
    (branch) => branch.properties.cause.const === 'APPROVAL_EXPIRED'
  ),
  'STOPPED response must distinguish APPROVAL_EXPIRED.'
);
for (const field of ['rolloutRevision', 'ring']) {
  assert(
    schema.definitions.widgetCatalogRolloutEvidenceResponse.required.includes(field),
    `Evidence response must expose ${field}.`
  );
}

const promotionGatePolicy = Object.freeze({
  windowDurationSeconds: 86400,
  totalSamplesMinimum: 100000,
  placementSamplesMinimum: 1000,
  diffCountMaximum: 0,
  unsafeAllowCountMaximum: 0,
  maxRolling15MinuteRejectionRateBps: 10,
  maxRolling15MinuteEvaluationErrorRateBps: 50,
  maxRolling15MinuteDurationP99Milliseconds: 150,
  maxOneMinuteRejectionRateBps: 100,
  maxOneMinuteEvaluationErrorRateBps: 200,
  maxOneMinuteDurationP99Milliseconds: 250,
  depth230ConsecutiveSecondsMaximumExclusive: 300,
  oldestUnpublishedAgeMillisecondsMaximum: 30000,
  maxFiveMinuteDeliveryErrorRateBps: 100,
  deadLetterIncreaseMaximum: 0,
  controlDecisionP99MillisecondsMaximum: 30000,
  wouldDecisionMaximumMilliseconds: 60000,
  legacyMismatchCountMaximum: 0,
  rateRounding: 'CEIL',
  countRounding: 'FLOOR',
  sampleTotalFormula: 'CLASSIC_PERSONAL+FLOW_PERSONAL+FLOW_GOVERNED',
  evidenceFreshnessMaximumSeconds: 600,
  approvalActivationBudgetSeconds: 600,
  approvalExpiryMinimumExclusiveSeconds: 86400,
  approvalExpiryMaximumInclusiveSeconds: 93600,
});
assert(
  same(golden.promotionGate, promotionGatePolicy),
  'Promotion Gate fixture drifted from the independent policy.'
);
assert(
  same(
    Object.fromEntries(
      Object.entries(schema.definitions.promotionGatePolicy.properties).map(([key, value]) => [
        key,
        value.const,
      ])
    ),
    promotionGatePolicy
  ),
  'Promotion Gate Schema constants drifted.'
);

const ajv = new Ajv({
  allErrors: true,
  jsonPointers: true,
  schemaId: 'auto',
});
ajv.addSchema(sanitizeExternalSchema(sources.bootstrapSchema));
ajv.addSchema(sanitizeExternalSchema(sources.evidenceSchema));
const validateSchema = ajv.compile(schema);

function schemaErrors() {
  return (validateSchema.errors ?? [])
    .map((error) => `${error.dataPath || '/'} ${error.message}`)
    .join('; ');
}

assert(validateSchema(golden), `Golden examples failed JSON Schema: ${schemaErrors()}`);

const attestationKeyPins = Object.freeze({
  CI_BOOTSTRAP: Object.freeze({
    issuer: 'dwp-ci-attestation-authority',
    kid: 'ci-widget-bootstrap-2026-08',
    publicKeyFingerprint: 'dc8fd8ed454e0b4ba28919436c4b417b4e5e2ff665d53feacbe0fd84b4bc0201',
  }),
  EVIDENCE_AUTHORITY: Object.freeze({
    issuer: 'dwp-release-approval-authority',
    kid: 'evidence-widget-rollout-2026-08',
    publicKeyFingerprint: '5555555555555555555555555555555555555555555555555555555555555555',
  }),
});

// The fixture digest above anchors this as the immutable server-side verification table. Requests
// carry only its opaque ID and the digest of the compact JWS that the pinned-key verifier consumed.
const immutableAttestationRecords = new Map(
  golden.examples
    .filter((example) => example.operation === 'APPROVE')
    .map((example) => [
      example.trustedAttestationVerification.verificationRecordId,
      deepClone(example.trustedAttestationVerification),
    ])
);
assert(
  immutableAttestationRecords.size ===
    golden.examples.filter((example) => example.operation === 'APPROVE').length,
  'Trusted attestation verification IDs must be unique.'
);
assert(
  new Set([...immutableAttestationRecords.values()].map((record) => `${record.kind}:${record.jti}`))
    .size === immutableAttestationRecords.size,
  'Trusted attestation kind/JTI pairs must be unique.'
);

const expectedExampleIds = [
  'activate-bootstrap',
  'activate-shadow',
  'approve-bootstrap',
  'approve-promotion',
  'approve-promotion-shadow-to-shadow',
  'expire-approval',
  'read-promotion-evidence',
  'read-shadow-promotion-evidence',
  'stop-safety',
].sort();

function indexExamples(fixture) {
  const entries = fixture.examples;
  const byId = new Map(entries.map((entry) => [entry.exampleId, entry]));
  if (byId.size !== entries.length) fail('DUPLICATE_EXAMPLE', 'Example IDs must be unique.');
  const actual = [...byId.keys()].sort();
  if (!same(actual, expectedExampleIds)) {
    fail('EXAMPLE_COVERAGE', `Expected exact example set ${expectedExampleIds.join(', ')}.`);
  }
  return byId;
}

function expectedProvenance(example) {
  if (example.operation === 'APPROVE') {
    return {
      environment: example.response.environment,
      rolloutRevision: example.response.rolloutRevision,
      ring: example.response.kind === 'BOOTSTRAP' ? 'STAGING_BOOTSTRAP' : 'STAGING_SHADOW',
      ringBps: example.response.toRingBps,
    };
  }
  if (example.operation === 'ACTIVATE') {
    return {
      environment: example.response.environment,
      rolloutRevision: example.response.rolloutRevision,
      ring: example.response.phase === 'BOOTSTRAP' ? 'STAGING_BOOTSTRAP' : 'STAGING_SHADOW',
      ringBps: example.response.ringBps,
    };
  }
  if (example.operation === 'STOP' || example.operation === 'EXPIRE') {
    return {
      environment: example.response.state.environment,
      rolloutRevision: example.response.state.rolloutRevision,
      ring: 'STATIC',
      ringBps: 0,
    };
  }
  return {
    environment: 'STAGING',
    rolloutRevision: example.response.rolloutRevision,
    ring: example.response.ring,
    ringBps: example.response.ringBps,
  };
}

function validateProvenance(example) {
  const { clockSource, evaluatedAt, ...routingProvenance } = example.provenance;
  if (clockSource !== 'DATABASE') {
    fail('PROVENANCE_CLOCK', `${example.exampleId}: provenance clock must be DATABASE.`);
  }
  utcEpoch(evaluatedAt);
  if (!same(routingProvenance, expectedProvenance(example))) {
    fail('PROVENANCE_MISMATCH', `${example.exampleId}: rolloutRevision/ring provenance drifted.`);
  }
}

function validateActors(request) {
  const [first, second] = request.approverRefs;
  if (new Set([request.proposerRef, first, second]).size !== 3) {
    fail('SOD_VIOLATION', 'Proposer and both approvers must be different actors.');
  }
  if (first.localeCompare(second) >= 0) {
    fail('ACTOR_ORDER', 'Approver references must be unique and lexicographically sorted.');
  }
}

function utcEpoch(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/.exec(value);
  if (!match) fail('EVIDENCE_TIME', `Invalid UTC timestamp ${value}.`);
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (
    year < 1000 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > days[month - 1] ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    fail('EVIDENCE_TIME', `Invalid Gregorian UTC timestamp ${value}.`);
  }
  return Date.UTC(year, month - 1, day, hour, minute, second);
}

function ceilBasisPoints(numerator, denominator) {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator)) {
    fail('EVIDENCE_INTEGER_RANGE', 'Rate counts must be JSON safe integers.');
  }
  if (denominator <= 0) {
    fail('EVIDENCE_DENOMINATOR', 'Rate denominators must be greater than zero.');
  }
  if (numerator < 0 || numerator > denominator) {
    fail('EVIDENCE_COUNT_RANGE', 'Rate numerators must be between zero and denominator.');
  }
  const numeratorBigInt = BigInt(numerator);
  const denominatorBigInt = BigInt(denominator);
  return Number((10000n * numeratorBigInt + denominatorBigInt - 1n) / denominatorBigInt);
}

function exactIntegerSum(values, code, message) {
  if (values.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    fail('EVIDENCE_INTEGER_RANGE', 'Evidence counts must be non-negative JSON safe integers.');
  }
  const total = values.reduce((sum, value) => sum + BigInt(value), 0n);
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) fail(code, message);
  return Number(total);
}

function validatePromotionEvidence(evidence, verifiedAtValue, approvalCreatedAtValue) {
  if (evidence.revisions.rolloutRevision < 1) {
    fail('EVIDENCE_PROVENANCE', 'Promotion evidence rolloutRevision must be positive.');
  }
  const start = utcEpoch(evidence.window.startAt);
  const end = utcEpoch(evidence.window.endAt);
  const collected = utcEpoch(evidence.source.collectedAt);
  const verified = utcEpoch(verifiedAtValue);
  const approvalCreated = utcEpoch(approvalCreatedAtValue);
  if (
    end - start !== promotionGatePolicy.windowDurationSeconds * 1000 ||
    evidence.window.durationSeconds !== promotionGatePolicy.windowDurationSeconds
  ) {
    fail('EVIDENCE_TIME', 'Promotion evidence requires an exact prior 86,400-second UTC window.');
  }
  if (collected < end || verified < collected) {
    fail('EVIDENCE_TIME', 'Evidence must satisfy windowEnd <= collectedAt <= verifiedAt.');
  }
  if (collected > approvalCreated || verified > approvalCreated) {
    fail(
      'EVIDENCE_FUTURE',
      'Evidence collection and verification cannot follow Approval creation.'
    );
  }
  if (approvalCreated - end > promotionGatePolicy.evidenceFreshnessMaximumSeconds * 1000) {
    fail('EVIDENCE_STALE', 'Evidence window is stale for Approval creation.');
  }
  if (evidence.window.missingSampleBuckets !== 0) {
    fail('TELEMETRY_INCOMPLETE', 'Any missing telemetry bucket fails the Promotion Gate closed.');
  }

  const contexts = Object.values(evidence.samples.placementContexts);
  if (
    exactIntegerSum(
      contexts,
      'EVIDENCE_SAMPLE_TOTAL',
      'Placement sample sum exceeds the JSON safe integer range.'
    ) !== evidence.samples.total
  ) {
    fail('EVIDENCE_ROUNDING', 'Sample total must equal the three placement counts.');
  }
  if (evidence.samples.total <= 0) {
    fail('TELEMETRY_INCOMPLETE', 'Promotion evidence requires at least one exact sample.');
  }
  const ratePairs = [
    [evidence.queue.rejectionCount, evidence.queue.enqueueAttemptCount],
    [evidence.queue.evaluationErrorCount, evidence.queue.evaluationCount],
    [evidence.outbox.deliveryErrorCount, evidence.outbox.deliveryAttemptCount],
  ];
  for (const [numerator, denominator] of ratePairs) ceilBasisPoints(numerator, denominator);
  if (
    evidence.queue.rejectionRateBps !==
      ceilBasisPoints(evidence.queue.rejectionCount, evidence.queue.enqueueAttemptCount) ||
    evidence.queue.evaluationErrorRateBps !==
      ceilBasisPoints(evidence.queue.evaluationErrorCount, evidence.queue.evaluationCount)
  ) {
    fail('EVIDENCE_ROUNDING', '24-hour rates must use conservative integer CEIL basis points.');
  }

  const diffTotal = Object.values(evidence.diffCounts).reduce((total, value) => total + value, 0);
  const queue = evidence.queue;
  const outbox = evidence.outbox;
  const drill = evidence.drill;
  const gatePassed =
    evidence.samples.total >= promotionGatePolicy.totalSamplesMinimum &&
    contexts.every((value) => value >= promotionGatePolicy.placementSamplesMinimum) &&
    diffTotal <= promotionGatePolicy.diffCountMaximum &&
    evidence.unsafeAllowCount <= promotionGatePolicy.unsafeAllowCountMaximum &&
    queue.maxRolling15MinuteRejectionRateBps <=
      promotionGatePolicy.maxRolling15MinuteRejectionRateBps &&
    queue.maxRolling15MinuteEvaluationErrorRateBps <=
      promotionGatePolicy.maxRolling15MinuteEvaluationErrorRateBps &&
    queue.maxRolling15MinuteDurationP99Milliseconds <=
      promotionGatePolicy.maxRolling15MinuteDurationP99Milliseconds &&
    queue.maxOneMinuteRejectionRateBps <= promotionGatePolicy.maxOneMinuteRejectionRateBps &&
    queue.maxOneMinuteEvaluationErrorRateBps <=
      promotionGatePolicy.maxOneMinuteEvaluationErrorRateBps &&
    queue.maxOneMinuteDurationP99Milliseconds <=
      promotionGatePolicy.maxOneMinuteDurationP99Milliseconds &&
    queue.maximumConsecutiveSecondsAboveDepth230 <
      promotionGatePolicy.depth230ConsecutiveSecondsMaximumExclusive &&
    outbox.oldestUnpublishedAgeMillisecondsMax <=
      promotionGatePolicy.oldestUnpublishedAgeMillisecondsMaximum &&
    outbox.maxFiveMinuteDeliveryErrorRateBps <=
      promotionGatePolicy.maxFiveMinuteDeliveryErrorRateBps &&
    outbox.deadLetterIncrease <= promotionGatePolicy.deadLetterIncreaseMaximum &&
    drill.killDecisionP99Milliseconds <=
      promotionGatePolicy.controlDecisionP99MillisecondsMaximum &&
    drill.quarantineDecisionP99Milliseconds <=
      promotionGatePolicy.controlDecisionP99MillisecondsMaximum &&
    drill.wouldDenyMaximumMilliseconds <= promotionGatePolicy.wouldDecisionMaximumMilliseconds &&
    drill.wouldStopDataMaximumMilliseconds <=
      promotionGatePolicy.wouldDecisionMaximumMilliseconds &&
    drill.legacyPayloadMismatchCount <= promotionGatePolicy.legacyMismatchCountMaximum &&
    drill.legacyDataMismatchCount <= promotionGatePolicy.legacyMismatchCountMaximum;
  if (!gatePassed)
    fail('PROMOTION_GATE', 'Promotion evidence failed an inclusive release threshold.');
}

function approvalRequestDigest(request) {
  const digestInput = deepClone(request);
  delete digestInput.ciAttestation;
  delete digestInput.evidenceAuthorityAttestation;
  return canonicalDigest(digestInput);
}

function validateTrustedAttestation(example) {
  const { request, response, trustedAttestationVerification: record } = example;
  const reference =
    request.kind === 'BOOTSTRAP' ? request.ciAttestation : request.evidenceAuthorityAttestation;
  const expectedKind = request.kind === 'BOOTSTRAP' ? 'CI_BOOTSTRAP' : 'EVIDENCE_AUTHORITY';
  const pinnedKey = attestationKeyPins[expectedKind];
  const immutableRecord = immutableAttestationRecords.get(reference.verificationRecordId);
  if (!immutableRecord) {
    fail(
      'ATTESTATION_REFERENCE',
      'Attestation verification ID must resolve in the immutable server-side verification table.'
    );
  }
  if (
    reference.verificationRecordId !== record.verificationRecordId ||
    reference.assertionSha256 !== record.assertionSha256
  ) {
    fail(
      'ATTESTATION_REFERENCE',
      'Request attestation reference must bind the immutable verification ID and compact-JWS hash.'
    );
  }
  if (
    record.kind !== expectedKind ||
    record.result !== 'SUCCESS' ||
    record.issuer !== pinnedKey.issuer ||
    record.kid !== pinnedKey.kid ||
    record.publicKeyFingerprint !== pinnedKey.publicKeyFingerprint
  ) {
    fail(
      'ATTESTATION_KEY',
      'Attestation requires SUCCESS under the exact issuer, kid, and pinned ES256 public key.'
    );
  }
  const createdAt = utcEpoch(response.createdAt);
  if (utcEpoch(record.verifiedAt) > createdAt || createdAt >= utcEpoch(record.expiresAt)) {
    fail(
      'ATTESTATION_TIME',
      'Attestation must already be verified and unexpired at Approval creation.'
    );
  }

  const expectedBindings = {
    environment: request.environment,
    rolloutRevision: request.rolloutRevision,
    selectorKeyId: request.selectorKeyId,
    ...(request.kind === 'BOOTSTRAP'
      ? {
          prerequisiteId: request.bootstrapPrerequisite.prerequisiteId,
          prerequisiteDigest: canonicalDigest(request.bootstrapPrerequisite),
        }
      : {
          evidenceId: request.rolloutEvidence.evidenceId,
          evidenceDigest: canonicalDigest(request.rolloutEvidence),
          querySetRevision: request.rolloutEvidence.source.querySetRevision,
          immutableSnapshotRefHash: request.rolloutEvidence.source.immutableSnapshotRefHash,
        }),
    requestDigest: approvalRequestDigest(request),
  };
  if (!same(record.bindings, expectedBindings)) {
    fail(
      'ATTESTATION_CLAIMS',
      'Verified attestation claims must exactly bind the closed Approval request and evidence.'
    );
  }
  const responseJti =
    request.kind === 'BOOTSTRAP' ? response.ciAttestationJti : response.evidenceAttestationJti;
  if (responseJti !== record.jti) {
    fail('ATTESTATION_JTI', 'Approval JTI must come from the trusted verification row.');
  }
  if (!same(record, immutableRecord)) {
    fail(
      'ATTESTATION_RECORD_DRIFT',
      'Attestation verification must equal the immutable server-side verification row.'
    );
  }
}

function transitionEvaluatedAt(example) {
  return utcEpoch(example.provenance.evaluatedAt);
}

function validatePredecessorAuthority(example, byId) {
  const { request, response, trustedCurrentHead } = example;
  const approvalCreatedAt = utcEpoch(response.createdAt);
  const windowStart = utcEpoch(request.rolloutEvidence.window.startAt);
  const windowEnd = utcEpoch(request.rolloutEvidence.window.endAt);
  const matchingActivations = [...byId.values()].filter(
    (candidate) =>
      candidate.operation === 'ACTIVATE' && same(candidate.response, trustedCurrentHead)
  );
  if (matchingActivations.length !== 1) {
    fail(
      'TRUSTED_HEAD_DRIFT',
      'Promotion trustedCurrentHead must be an exact committed ACTIVATE projection.'
    );
  }
  const predecessorActivation = matchingActivations[0];
  const activatedAt = transitionEvaluatedAt(predecessorActivation);
  if (utcEpoch(example.trustedHeadActivatedAt) !== activatedAt || activatedAt > windowStart) {
    fail(
      'EVIDENCE_ACTIVE_WINDOW',
      'The exact predecessor must already be ACTIVE when the evidence window starts.'
    );
  }
  if (utcEpoch(trustedCurrentHead.activeApprovalExpiresAt) <= windowEnd) {
    fail(
      'EVIDENCE_ACTIVE_WINDOW',
      'The predecessor Approval must remain active beyond the complete evidence window.'
    );
  }
  let previousCommittedAt = activatedAt;
  let previousHeadVersion = trustedCurrentHead.headVersion;
  let previousRolloutRevision = trustedCurrentHead.rolloutRevision;
  for (const transition of example.committedTransitionsAfterTrustedHead) {
    const committedAt = utcEpoch(transition.committedAt);
    if (
      committedAt <= previousCommittedAt ||
      committedAt > approvalCreatedAt ||
      transition.headVersion <= previousHeadVersion ||
      transition.rolloutRevision < previousRolloutRevision
    ) {
      fail(
        'TRANSITION_LEDGER_ORDER',
        'Authoritative transitions must be strictly ordered, monotonic, and known at Approval time.'
      );
    }
    if (committedAt <= windowEnd) {
      fail(
        'EVIDENCE_ACTIVE_WINDOW',
        'STOP, EXPIRE, or reactivation breaks the predecessor continuous-ACTIVE evidence window.'
      );
    }
    previousCommittedAt = committedAt;
    previousHeadVersion = transition.headVersion;
    previousRolloutRevision = transition.rolloutRevision;
  }

  const authoritativeTransition = example.committedTransitionsAfterTrustedHead.at(-1);
  if (authoritativeTransition && authoritativeTransition.operation !== 'ACTIVATE') {
    fail(
      'CURRENT_HEAD_NOT_ACTIVE',
      'The latest committed ACTIVATE/STOP/EXPIRE transition is STATIC; Promotion is forbidden.'
    );
  }
  if (authoritativeTransition) {
    fail(
      'TRUSTED_HEAD_DRIFT',
      'A later committed ACTIVATE means trustedCurrentHead is no longer the authoritative Head.'
    );
  }
}

function validateApprovalClockInvariants(example) {
  const { response } = example;
  const createdAt = utcEpoch(response.createdAt);
  const activationDeadline = utcEpoch(response.activationDeadline);
  const expiresAt = utcEpoch(response.expiresAt);
  const evaluatedAt = utcEpoch(example.provenance.evaluatedAt);
  if (evaluatedAt !== createdAt) {
    fail('APPROVAL_CREATED_AT', 'Approval DB evaluatedAt must equal immutable createdAt.');
  }
  if (
    activationDeadline - createdAt !==
    promotionGatePolicy.approvalActivationBudgetSeconds * 1000
  ) {
    fail('APPROVAL_DEADLINE', 'activationDeadline must equal createdAt plus ten minutes.');
  }
  const expirySeconds = (expiresAt - createdAt) / 1000;
  if (
    expirySeconds <= promotionGatePolicy.approvalExpiryMinimumExclusiveSeconds ||
    expirySeconds > promotionGatePolicy.approvalExpiryMaximumInclusiveSeconds
  ) {
    fail(
      'APPROVAL_EXPIRY',
      'expiresAt must be greater than 24h and no more than 26h after createdAt.'
    );
  }
}

function validateApproval(example, byId) {
  const { request, response } = example;
  if (response.state !== 'ACTIVE') {
    fail('APPROVAL_NOT_ACTIVE', 'New Rollout Approvals must be created in ACTIVE state.');
  }
  validateApprovalClockInvariants(example);
  if (request.kind !== response.kind) fail('APPROVAL_BINDING', 'Approval kind mismatch.');
  if (request.kind === 'PROMOTION' && request.fromRingBps >= request.toRingBps) {
    fail('RING_ORDER', 'Promotion toRingBps must be greater than fromRingBps.');
  }
  validateActors(request);
  let trustedHead = null;
  if (request.kind === 'PROMOTION') {
    trustedHead = example.trustedCurrentHead;
    const approvalCreatedAt = utcEpoch(response.createdAt);
    const evidenceRead = [...byId.values()].find(
      (candidate) =>
        candidate.operation === 'READ_EVIDENCE' &&
        candidate.response.evidenceId === request.rolloutEvidence.evidenceId
    );
    if (!evidenceRead) fail('EVIDENCE_BINDING', 'Promotion evidence read projection is missing.');
    validatePromotionEvidence(
      request.rolloutEvidence,
      evidenceRead.response.verifiedAt,
      response.createdAt
    );
    validatePredecessorAuthority(example, byId);
    if (approvalCreatedAt >= utcEpoch(trustedHead.activeApprovalExpiresAt)) {
      fail('CURRENT_HEAD_BINDING', 'Promotion current Head Approval is already expired.');
    }
    if (
      request.expectedHeadVersion !== trustedHead.headVersion ||
      request.rolloutRevision !== trustedHead.rolloutRevision + 1 ||
      request.fromRingBps !== trustedHead.ringBps ||
      request.selectorKeyId !== trustedHead.selectorKeyId
    ) {
      fail(
        'CURRENT_HEAD_BINDING',
        'Promotion request must bind current Head version, next revision, from-ring, and selector.'
      );
    }
  }
  for (const field of [
    'environment',
    'rolloutRevision',
    'fromRingBps',
    'toRingBps',
    'selectorKeyId',
    'expiresAt',
  ]) {
    if (request[field] !== response[field]) {
      fail('APPROVAL_BINDING', `Approval request/response ${field} mismatch.`);
    }
  }
  if (request.expectedHeadVersion !== response.headVersion) {
    fail('APPROVAL_BINDING', 'Approval must preserve the locked Head version.');
  }

  if (request.kind === 'BOOTSTRAP') {
    const digest = canonicalDigest(request.bootstrapPrerequisite);
    if (
      digest !== response.bootstrapPrerequisiteDigest ||
      request.bootstrapPrerequisite.prerequisiteId !== response.bootstrapPrerequisiteId
    ) {
      fail('BOOTSTRAP_DIGEST', 'Bootstrap prerequisite ID/canonical digest mismatch.');
    }
    validateTrustedAttestation(example);
    return;
  }

  const evidence = request.rolloutEvidence;
  const expectedEvidenceRing =
    trustedHead.phase === 'BOOTSTRAP' ? 'staging-bootstrap' : 'staging-shadow';
  if (
    evidence.revisions.rolloutRevision !== trustedHead.rolloutRevision ||
    evidence.revisions.ringBps !== trustedHead.ringBps ||
    evidence.revisions.selectorKeyId !== trustedHead.selectorKeyId ||
    evidence.revisions.ring !== expectedEvidenceRing ||
    request.fromRingBps <= 100 !== (evidence.revisions.ring === 'staging-bootstrap')
  ) {
    fail(
      'EVIDENCE_PROVENANCE',
      'Promotion evidence must bind the immediately prior rollout and from-ring.'
    );
  }
  for (const field of [
    'selectorKeyId',
    'bootstrapPrerequisiteId',
    'bootstrapPrerequisiteDigest',
    'ciAttestationJti',
  ]) {
    if (response[field] !== trustedHead[field]) {
      fail('CURRENT_HEAD_BINDING', `Promotion Approval must carry forward current Head ${field}.`);
    }
  }
  if (
    response.headVersion !== trustedHead.headVersion ||
    response.rolloutRevision !== trustedHead.rolloutRevision + 1 ||
    response.fromRingBps !== trustedHead.ringBps
  ) {
    fail('CURRENT_HEAD_BINDING', 'Promotion Approval revision/from-ring/headVersion drifted.');
  }
  const evidenceDigest = canonicalDigest(evidence);
  if (
    evidence.evidenceId !== response.rolloutEvidenceId ||
    evidenceDigest !== response.rolloutEvidenceDigest
  ) {
    fail('EVIDENCE_DIGEST', 'Promotion evidence ID/canonical digest mismatch.');
  }
  validateTrustedAttestation(example);
}

function validateActivationClock(example, byId) {
  const approvalExample = [...byId.values()].find(
    (candidate) =>
      candidate.operation === 'APPROVE' &&
      candidate.response.approvalId === example.response.activeApprovalId
  );
  if (!approvalExample) fail('ACTIVATION_BINDING', 'Activation Approval fixture is missing.');
  const approval = approvalExample.response;
  const evaluatedAt = utcEpoch(example.provenance.evaluatedAt);
  const createdAt = utcEpoch(approval.createdAt);
  const activationDeadline = utcEpoch(approval.activationDeadline);
  const expiresAt = utcEpoch(approval.expiresAt);
  if (evaluatedAt < createdAt) {
    fail('ACTIVATION_BEFORE_CREATED', 'Activation cannot precede Approval creation.');
  }
  if (evaluatedAt >= expiresAt) {
    fail('ACTIVATION_EXPIRED', 'Activation must fail closed at Approval expiry.');
  }
  if (evaluatedAt > activationDeadline) {
    fail('ACTIVATION_DEADLINE', 'Activation DB clock exceeded activationDeadline.');
  }
  return approvalExample;
}

function validateActivation(example, byId) {
  const approvalExample = validateActivationClock(example, byId);
  const approval = approvalExample.response;
  const { request, response } = example;
  if (example.lockedApprovalState !== 'ACTIVE') {
    fail(
      'ACTIVATION_APPROVAL_NOT_ACTIVE',
      'Activation must lock an Approval row whose current state is ACTIVE.'
    );
  }
  if (example.lockedApprovalState !== approval.state) {
    fail(
      'ACTIVATION_APPROVAL_STATE_DRIFT',
      'Activation locked Approval state must equal the authoritative Approval row.'
    );
  }
  if (
    request.approvalId !== approval.approvalId ||
    request.approvalRevision !== approval.approvalRevision ||
    request.expectedHeadVersion !== approval.headVersion
  ) {
    fail('ACTIVATION_BINDING', 'Activation must bind the exact active Approval and locked Head.');
  }
  if (
    response.headVersion !== request.expectedHeadVersion + 1 ||
    response.rolloutRevision !== approval.rolloutRevision ||
    response.ringBps !== approval.toRingBps
  ) {
    fail('ACTIVATION_TRANSITION', 'Activation Head transition is inconsistent.');
  }
  const fieldPairs = [
    ['selectorKeyId', 'selectorKeyId'],
    ['activeApprovalId', 'approvalId'],
    ['activeApprovalRevision', 'approvalRevision'],
    ['activeApprovalExpiresAt', 'expiresAt'],
    ['bootstrapPrerequisiteId', 'bootstrapPrerequisiteId'],
    ['bootstrapPrerequisiteDigest', 'bootstrapPrerequisiteDigest'],
    ['ciAttestationJti', 'ciAttestationJti'],
    ['activeRolloutEvidenceId', 'rolloutEvidenceId'],
    ['activeRolloutEvidenceDigest', 'rolloutEvidenceDigest'],
  ];
  for (const [stateField, approvalField] of fieldPairs) {
    if (response[stateField] !== approval[approvalField]) {
      fail('ACTIVATION_BINDING', `Activation ${stateField} must match Approval.`);
    }
  }
}

function validateStopped(example, byId) {
  const { request, response } = example;
  const state = response.state;
  if (
    request.expectedHeadVersion + 1 !== state.headVersion ||
    byId.get('activate-shadow').response.rolloutRevision + 1 !== state.rolloutRevision
  ) {
    fail('STOP_TRANSITION', 'STOPPED must increment Head and rollout revision exactly once.');
  }
  if (
    response.transitionIdempotencyTarget !== 'ROLLOUT_HEAD:STAGING' ||
    response.idempotencyPolicy !== 'RETURN_STORED_RESULT'
  ) {
    fail(
      'IDEMPOTENCY_INTENT',
      'STOPPED transition must replay the stored result for the Head target.'
    );
  }

  if (example.operation === 'STOP') {
    if (example.provenance.evaluatedAt !== response.evaluatedAt) {
      fail('STOP_TIME', 'STOPPED provenance must bind the DB evaluatedAt response.');
    }
    if (
      response.cause !== 'SAFETY_STOP' ||
      response.terminalApprovalState !== 'REVOKED' ||
      response.transitionIntent !== 'REVOKE_ACTIVE_APPROVAL_AND_RESET_HEAD'
    ) {
      fail('STOP_CAUSE', 'Safety stop must revoke the active Approval.');
    }
    return;
  }

  const active = byId.get('activate-shadow').response;
  if (
    request.activeApprovalId !== active.activeApprovalId ||
    request.activeApprovalRevision !== active.activeApprovalRevision ||
    request.activeApprovalExpiresAt !== active.activeApprovalExpiresAt ||
    request.expectedHeadVersion !== active.headVersion
  ) {
    fail('EXPIRY_BINDING', 'Expiry evaluation must bind the exact active Approval and Head.');
  }
  if (Date.parse(request.evaluatedAt) < Date.parse(request.activeApprovalExpiresAt)) {
    fail('EXPIRY_NOT_REACHED', 'DB clock has not reached Approval expiresAt.');
  }
  if (
    request.clockSource !== 'DATABASE' ||
    request.failureMode !== 'STOP_FAIL_CLOSED' ||
    request.transitionIntent !== 'EXPIRE_ACTIVE_APPROVAL_AND_RESET_HEAD' ||
    request.idempotencyPolicy !== 'RETURN_STORED_RESULT' ||
    response.cause !== 'APPROVAL_EXPIRED' ||
    response.terminalApprovalState !== 'EXPIRED' ||
    response.transitionIntent !== request.transitionIntent ||
    response.evaluatedAt !== request.evaluatedAt
  ) {
    fail(
      'EXPIRY_TRANSITION',
      'Approval expiry must execute the fail-closed idempotent STOPPED transition.'
    );
  }
  if (example.provenance.evaluatedAt !== response.evaluatedAt) {
    fail('EXPIRY_TRANSITION', 'Expiry provenance must bind the DB evaluatedAt response.');
  }
}

function validateEvidence(example, byId) {
  const response = example.response;
  const promotion = [...byId.values()].find(
    (candidate) =>
      candidate.operation === 'APPROVE' &&
      candidate.request.kind === 'PROMOTION' &&
      candidate.request.rolloutEvidence.evidenceId === response.evidenceId
  );
  if (!promotion) fail('EVIDENCE_BINDING', 'Evidence response has no Promotion Approval.');
  const evidence = promotion.request.rolloutEvidence;
  const expected = {
    evidenceId: evidence.evidenceId,
    evidenceDigest: canonicalDigest(evidence),
    rolloutRevision: evidence.revisions.rolloutRevision,
    ring: evidence.revisions.ring === 'staging-bootstrap' ? 'STAGING_BOOTSTRAP' : 'STAGING_SHADOW',
    querySetRevision: evidence.source.querySetRevision,
    immutableSnapshotRefHash: evidence.source.immutableSnapshotRefHash,
    windowStart: evidence.window.startAt,
    windowEnd: evidence.window.endAt,
    deploymentBuildDigest: evidence.revisions.deploymentBuildDigest,
    catalogRevision: evidence.revisions.catalogRevision,
    bindingCatalogRevision: evidence.revisions.bindingCatalogRevision,
    policyRevision: evidence.revisions.policyRevision,
    safetyRevision: evidence.revisions.safetyRevision,
    selectorKeyId: evidence.revisions.selectorKeyId,
    ringBps: evidence.revisions.ringBps,
  };
  if (example.request.evidenceId !== evidence.evidenceId) {
    fail('EVIDENCE_BINDING', 'Evidence path ID must bind the immutable evidence row.');
  }
  for (const [field, value] of Object.entries(expected)) {
    if (response[field] !== value) {
      fail('EVIDENCE_BINDING', `Evidence response ${field} mismatch.`);
    }
  }
  const verifiedAt = utcEpoch(response.verifiedAt);
  const collectedAt = utcEpoch(evidence.source.collectedAt);
  if (
    response.evidenceAttestationJti !== promotion.response.evidenceAttestationJti ||
    verifiedAt < collectedAt
  ) {
    fail('EVIDENCE_TIME', 'Evidence verification must follow immutable collection.');
  }
}

function validateSemantics(fixture) {
  if (!same(fixture.promotionGate, promotionGatePolicy)) {
    fail('PROMOTION_POLICY', 'Promotion Gate policy fixture drifted.');
  }
  const byId = indexExamples(fixture);
  for (const example of fixture.examples) validateProvenance(example);
  for (const example of fixture.examples.filter((candidate) => candidate.operation === 'APPROVE')) {
    validateApprovalClockInvariants(example);
  }
  for (const example of fixture.examples.filter(
    (candidate) => candidate.operation === 'ACTIVATE'
  )) {
    validateActivationClock(example, byId);
  }
  for (const example of fixture.examples) {
    if (example.operation === 'APPROVE') validateApproval(example, byId);
    if (example.operation === 'ACTIVATE') validateActivation(example, byId);
    if (example.operation === 'STOP' || example.operation === 'EXPIRE')
      validateStopped(example, byId);
    if (example.operation === 'READ_EVIDENCE') validateEvidence(example, byId);
  }
  const stoppedCauses = new Set(
    fixture.examples
      .filter((example) => ['STOP', 'EXPIRE'].includes(example.operation))
      .map((example) => example.response.cause)
  );
  if (!stoppedCauses.has('SAFETY_STOP') || !stoppedCauses.has('APPROVAL_EXPIRED')) {
    fail('STOP_CAUSE_COVERAGE', 'Both safety and Approval-expiry STOPPED paths are required.');
  }
}

validateSemantics(golden);

function validateNegativeFixtureShape(fixture) {
  assert(
    same(Object.keys(fixture).sort(), ['cases', 'fixtureVersion']),
    'Negative root keys must be closed.'
  );
  assert(fixture.fixtureVersion === 1, 'Negative fixtureVersion must be 1.');
  assert(Array.isArray(fixture.cases) && fixture.cases.length > 0, 'Negative cases are required.');
  const caseIds = new Set();
  const validateMutationShape = (caseId, mutation) => {
    assert(['add', 'remove', 'replace'].includes(mutation.op), `${caseId}: bad mutation op.`);
    const expectedMutationKeys =
      mutation.op === 'remove' ? ['op', 'path'] : ['op', 'path', 'value'];
    assert(
      same(Object.keys(mutation).sort(), expectedMutationKeys.sort()),
      `${caseId}: mutation keys must be closed.`
    );
    assert(
      typeof mutation.path === 'string' && mutation.path.startsWith('/'),
      `${caseId}: mutation path must be a JSON Pointer.`
    );
  };
  for (const entry of fixture.cases) {
    const hasSingle = Object.prototype.hasOwnProperty.call(entry, 'mutation');
    const hasBatch = Object.prototype.hasOwnProperty.call(entry, 'mutations');
    assert(hasSingle !== hasBatch, `${entry.caseId}: exactly one mutation form is required.`);
    const expectedEntryKeys = hasSingle
      ? ['baseExampleId', 'caseId', 'expectedCode', 'mutation']
      : ['baseExampleId', 'caseId', 'expectedCode', 'mutations'];
    if (Object.prototype.hasOwnProperty.call(entry, 'precondition')) {
      expectedEntryKeys.push('precondition');
      assert(
        ['EVIDENCE_DIGEST_REHASHED', 'STALE_TUPLE_RESIGNED_REHASHED'].includes(entry.precondition),
        `${entry.caseId}: unknown mutation precondition.`
      );
    }
    assert(
      same(Object.keys(entry).sort(), expectedEntryKeys.sort()),
      `${entry.caseId}: negative case keys must be closed.`
    );
    assert(!caseIds.has(entry.caseId), `${entry.caseId}: duplicate case ID.`);
    caseIds.add(entry.caseId);
    assert(
      expectedExampleIds.includes(entry.baseExampleId),
      `${entry.caseId}: unknown base example.`
    );
    const mutations = hasSingle ? [entry.mutation] : entry.mutations;
    assert(
      Array.isArray(mutations) && mutations.length >= 1 && mutations.length <= 32,
      `${entry.caseId}: mutation batch size must be 1..32.`
    );
    for (const mutation of mutations) validateMutationShape(entry.caseId, mutation);
    assert(
      typeof entry.expectedCode === 'string' && entry.expectedCode.length > 0,
      'expectedCode is required.'
    );
  }
}

function applyMutation(target, mutation) {
  const parts = mutation.path
    .slice(1)
    .split('/')
    .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));
  let parent = target;
  for (const part of parts.slice(0, -1)) {
    assert(
      parent && Object.prototype.hasOwnProperty.call(parent, part),
      `Unknown mutation path ${mutation.path}.`
    );
    parent = parent[part];
  }
  const key = parts.at(-1);
  if (mutation.op === 'add') {
    assert(
      !Object.prototype.hasOwnProperty.call(parent, key),
      `Add target already exists: ${mutation.path}.`
    );
    parent[key] = deepClone(mutation.value);
    return;
  }
  assert(
    Object.prototype.hasOwnProperty.call(parent, key),
    `Unknown mutation target ${mutation.path}.`
  );
  if (mutation.op === 'remove') {
    delete parent[key];
    return;
  }
  parent[key] = deepClone(mutation.value);
}

function validateMutationPrecondition(entry, example, originalExample) {
  if (!entry.precondition) return;
  const request = example.request;
  const response = example.response;
  const evidence = request.rolloutEvidence;
  assert(
    canonicalDigest(evidence) === response.rolloutEvidenceDigest,
    `${entry.caseId}: mutated Evidence digest was not independently rehashed.`
  );
  if (entry.precondition !== 'STALE_TUPLE_RESIGNED_REHASHED') return;
  assert(
    response.rolloutRevision === request.rolloutRevision &&
      response.fromRingBps === request.fromRingBps &&
      response.headVersion === request.expectedHeadVersion &&
      response.selectorKeyId === request.selectorKeyId &&
      evidence.revisions.rolloutRevision === request.rolloutRevision - 1 &&
      evidence.revisions.ringBps === request.fromRingBps &&
      evidence.revisions.selectorKeyId === request.selectorKeyId &&
      evidence.revisions.ring ===
        (request.fromRingBps <= 100 ? 'staging-bootstrap' : 'staging-shadow'),
    `${entry.caseId}: stale request, Approval, and Evidence tuple is not self-consistent.`
  );
  assert(
    request.evidenceAuthorityAttestation !== originalExample.request.evidenceAuthorityAttestation &&
      response.evidenceAttestationJti !== originalExample.response.evidenceAttestationJti,
    `${entry.caseId}: stale tuple must carry a distinct re-signing artifact.`
  );
}

validateNegativeFixtureShape(negative);
for (const entry of negative.cases) {
  const mutated = deepClone(golden);
  const example = mutated.examples.find((candidate) => candidate.exampleId === entry.baseExampleId);
  for (const mutation of entry.mutation ? [entry.mutation] : entry.mutations) {
    applyMutation(example, mutation);
  }
  const originalExample = golden.examples.find(
    (candidate) => candidate.exampleId === entry.baseExampleId
  );
  validateMutationPrecondition(entry, example, originalExample);
  let actualCode = null;
  if (!validateSchema(mutated)) {
    actualCode = 'SCHEMA_INVALID';
  } else {
    try {
      validateSemantics(mutated);
    } catch (error) {
      if (!(error instanceof ContractError)) throw error;
      actualCode = error.code;
    }
  }
  assert(
    actualCode === entry.expectedCode,
    `${entry.caseId}: expected ${entry.expectedCode}, received ${actualCode ?? 'VALID'}.`
  );
}

process.stdout.write(`schemaFileDigest ${sha256(sources.schema)}\n`);
process.stdout.write(`goldenCanonicalDigest ${canonicalDigest(golden)}\n`);
process.stdout.write(`negativeCanonicalDigest ${canonicalDigest(negative)}\n`);
process.stdout.write(`positiveExamples ${golden.examples.length}\n`);
process.stdout.write(`negativeCases ${negative.cases.length}\n`);
process.stdout.write(
  `negativeMutations ${negative.cases.reduce(
    (total, entry) => total + (entry.mutation ? 1 : entry.mutations.length),
    0
  )}\n`
);
process.stdout.write('rollout-operation-contract ok\n');
