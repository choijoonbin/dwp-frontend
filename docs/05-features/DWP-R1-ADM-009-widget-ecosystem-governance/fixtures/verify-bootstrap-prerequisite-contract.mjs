import { createHash, createPublicKey, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';

import '../operations/verify-shadow-alert-contract.mjs';

const schemaUrl = new URL('./widget-bootstrap-prerequisite.v1.schema.json', import.meta.url);
const fixtureUrl = new URL('./widget-bootstrap-prerequisite.v1.golden.json', import.meta.url);
const negativeUrl = new URL('./widget-bootstrap-prerequisite.v1.negative.json', import.meta.url);
const jwksUrl = new URL('./widget-bootstrap-ci-jwks.v1.json', import.meta.url);
const schemaSource = readFileSync(schemaUrl, 'utf8');
const fixtureSource = readFileSync(fixtureUrl, 'utf8');
const negativeSource = readFileSync(negativeUrl, 'utf8');
const jwksSource = readFileSync(jwksUrl, 'utf8');

const anchors = Object.freeze({
  schemaFile: 'abb40678362b5522cc200e1c6644036f22a3a8d5e18b53a6da091fcaeef652b6',
  fixtureFile: 'b6ba3b7062b839282666d191fb98261fd2e79d9a409a98867db6a14ad403f757',
  negativeFile: '09089807841a989d33901c17d582ba1be68ae7337f72aaa3466bd147d00d1bd5',
  jwksFile: '4ffbccf45c0bdc68c0a577a678bc91f27458a2fc5572a3c7dd5742cc5370b0df',
  prerequisiteDigest: '1bf687bd39eb1296370e4d00e413db534b5b7658388df74fd681857ccd99db6b',
});

class ContractError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function fail(code, message) {
  throw new ContractError(code, message);
}

function assert(condition, code, message) {
  if (!condition) fail(code, message);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalize(value, path = '$') {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    if (typeof value === 'string')
      assert(value === value.normalize('NFC'), 'CANONICAL_NFC', `${path} is not NFC.`);
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    assert(
      Number.isSafeInteger(value) && !Object.is(value, -0),
      'CANONICAL_NUMBER',
      `${path} is not a safe canonical integer.`
    );
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item, index) => canonicalize(item, `${path}[${index}]`)).join(',')}]`;
  }
  assert(value && typeof value === 'object', 'CANONICAL_JSON', `${path} is not JSON.`);
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key], `${path}.${key}`)}`)
    .join(',')}}`;
}

const schema = JSON.parse(schemaSource);

function resolveRef(ref) {
  assert(ref.startsWith('#/$defs/'), 'SCHEMA_REF', `Unsupported schema ref ${ref}.`);
  const resolved = schema.$defs[ref.slice('#/$defs/'.length)];
  assert(resolved, 'SCHEMA_REF', `Unknown schema ref ${ref}.`);
  return resolved;
}

function validateSchema(value, node, path = '$') {
  if (node.$ref) return validateSchema(value, resolveRef(node.$ref), path);
  if (Object.hasOwn(node, 'const')) {
    assert(
      value === node.const,
      'SCHEMA_CONST',
      `${path} must equal ${JSON.stringify(node.const)}.`
    );
  }
  if (node.enum) {
    assert(node.enum.includes(value), 'SCHEMA_ENUM', `${path} is outside the closed enum.`);
  }
  if (node.type === 'object') {
    assert(
      value && typeof value === 'object' && !Array.isArray(value),
      'SCHEMA_TYPE',
      `${path} must be an object.`
    );
    for (const key of node.required ?? []) {
      assert(Object.hasOwn(value, key), 'SCHEMA_REQUIRED', `${path}.${key} is required.`);
    }
    if (node.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        assert(
          Object.hasOwn(node.properties ?? {}, key),
          'SCHEMA_UNKNOWN_FIELD',
          `${path}.${key} is unknown.`
        );
      }
    }
    for (const [key, child] of Object.entries(node.properties ?? {})) {
      if (Object.hasOwn(value, key)) validateSchema(value[key], child, `${path}.${key}`);
    }
  } else if (node.type === 'array') {
    assert(Array.isArray(value), 'SCHEMA_TYPE', `${path} must be an array.`);
    assert(value.length >= (node.minItems ?? 0), 'SCHEMA_MIN_ITEMS', `${path} has too few items.`);
    assert(
      value.length <= (node.maxItems ?? Number.MAX_SAFE_INTEGER),
      'SCHEMA_MAX_ITEMS',
      `${path} has too many items.`
    );
    if (node.uniqueItems) {
      const values = value.map((item) => canonicalize(item));
      assert(
        new Set(values).size === values.length,
        'SCHEMA_UNIQUE',
        `${path} contains duplicates.`
      );
    }
    if (node.items && typeof node.items === 'object') {
      value.forEach((item, index) => validateSchema(item, node.items, `${path}[${index}]`));
    }
  } else if (node.type === 'string') {
    assert(typeof value === 'string', 'SCHEMA_TYPE', `${path} must be a string.`);
    assert(value.length >= (node.minLength ?? 0), 'SCHEMA_MIN_LENGTH', `${path} is too short.`);
    assert(
      value.length <= (node.maxLength ?? Number.MAX_SAFE_INTEGER),
      'SCHEMA_MAX_LENGTH',
      `${path} is too long.`
    );
    if (node.pattern)
      assert(
        new RegExp(node.pattern).test(value),
        'SCHEMA_PATTERN',
        `${path} does not match ${node.pattern}.`
      );
  } else if (node.type === 'integer') {
    assert(Number.isSafeInteger(value), 'SCHEMA_TYPE', `${path} must be an integer.`);
    assert(
      value >= (node.minimum ?? Number.MIN_SAFE_INTEGER),
      'SCHEMA_MINIMUM',
      `${path} is below minimum.`
    );
    assert(
      value <= (node.maximum ?? Number.MAX_SAFE_INTEGER),
      'SCHEMA_MAXIMUM',
      `${path} exceeds maximum.`
    );
  } else if (node.type === 'null') {
    assert(value === null, 'SCHEMA_TYPE', `${path} must be null.`);
  }
}

const expectedRunbookPaths = Object.freeze({
  shadowStop: 'docs/07-runbooks/widget-shadow-stop.md',
  catalogKill: 'docs/07-runbooks/widget-catalog-kill.md',
  quarantine: 'docs/07-runbooks/widget-quarantine.md',
  channelRollback: 'docs/07-runbooks/widget-channel-rollback.md',
  policyRollback: 'docs/07-runbooks/widget-policy-rollback.md',
  outboxReplay: 'docs/07-runbooks/widget-outbox-replay.md',
  commandReconciliation: 'docs/07-runbooks/widget-command-reconciliation.md',
  bindingCatalogRelease: 'docs/07-runbooks/widget-binding-catalog-release.md',
  authoritativeRecovery: 'docs/07-runbooks/widget-authoritative-recovery.md',
});

const verificationArtifactNames = Object.freeze([
  'manifestGolden',
  'bindingCatalogGolden',
  'tenantPolicyGolden',
  'rolloutQuerySet',
  'migrationTest',
  'contractTest',
  'negativeContractTest',
  'flagsOffRegressionTest',
  'nonInjectionDependencyTest',
]);

const featureRoot = 'docs/05-features/DWP-R1-ADM-009-widget-ecosystem-governance';
const repositoryRootUrl = new URL('../../../../', import.meta.url);
const localVerificationArtifactFiles = Object.freeze({
  manifestGolden: `${featureRoot}/fixtures/widget-manifests.v1.golden.json`,
  bindingCatalogGolden: `${featureRoot}/fixtures/widget-binding-catalog.v1.golden.json`,
  tenantPolicyGolden: `${featureRoot}/fixtures/widget-tenant-policy-seeds.v1.golden.json`,
  rolloutQuerySet: `${featureRoot}/fixtures/widget-rollout-query-set.v1.golden.json`,
});

function defaultArtifactReader(path) {
  return readFileSync(new URL(path, repositoryRootUrl), 'utf8');
}

function parseCompactJws(compactJws) {
  assert(typeof compactJws === 'string', 'CI_COMPACT_INVALID', 'CI compact JWS must be a string.');
  const segments = compactJws.split('.');
  assert(
    segments.length === 3 && segments.every(Boolean),
    'CI_COMPACT_INVALID',
    'CI compact JWS must have three segments.'
  );
  let protectedHeader;
  let claims;
  try {
    protectedHeader = JSON.parse(Buffer.from(segments[0], 'base64url').toString('utf8'));
    claims = JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf8'));
  } catch {
    fail('CI_COMPACT_INVALID', 'CI compact JWS contains invalid JSON or base64url.');
  }
  const signature = Buffer.from(segments[2], 'base64url');
  assert(
    signature.length === 64,
    'CI_SIGNATURE_INVALID',
    'ES256 JWS signature must be 64 raw bytes.'
  );
  return {
    protectedHeader,
    claims,
    signingInput: Buffer.from(`${segments[0]}.${segments[1]}`, 'ascii'),
    signature,
  };
}

const pinnedJwks = JSON.parse(jwksSource);

function validateContract(candidate, seenJtis = new Set(), options = {}) {
  const artifactReader = options.artifactReader ?? defaultArtifactReader;
  validateSchema(candidate.prerequisite, schema, '$.prerequisite');
  validateSchema(
    candidate.ciAttestation.protectedHeader,
    schema.$defs.ciAttestationProtectedHeaderV1,
    '$.ciAttestation.protectedHeader'
  );
  validateSchema(
    candidate.ciAttestation.claims,
    schema.$defs.ciAttestationClaimsV1,
    '$.ciAttestation.claims'
  );

  const prerequisite = candidate.prerequisite;
  const claims = candidate.ciAttestation.claims;
  const actualDigest = sha256(Buffer.from(canonicalize(prerequisite), 'utf8'));
  assert(
    actualDigest === candidate.expectedPrerequisiteDigest,
    'PREREQUISITE_DIGEST_MISMATCH',
    'Golden prerequisite digest changed.'
  );
  assert(
    actualDigest === claims.prerequisiteDigest,
    'CI_PREREQUISITE_BINDING_MISMATCH',
    'CI prerequisite digest is not bound.'
  );
  assert(
    prerequisite.prerequisiteId === claims.prerequisiteId,
    'CI_PREREQUISITE_BINDING_MISMATCH',
    'CI prerequisite ID is not bound.'
  );
  assert(
    prerequisite.environment === claims.environment,
    'CI_PREREQUISITE_BINDING_MISMATCH',
    'CI environment is not bound.'
  );

  for (const field of ['sourceCommitSha', 'deploymentBuildDigest', 'workflowDigest']) {
    assert(
      prerequisite.source[field] === claims[field],
      'CI_SOURCE_BINDING_MISMATCH',
      `CI ${field} is not bound.`
    );
  }
  for (const artifactName of verificationArtifactNames) {
    assert(
      prerequisite.verificationArtifacts[artifactName].contentDigest ===
        claims.verificationArtifactDigests[artifactName],
      'CI_ARTIFACT_BINDING_MISMATCH',
      `CI artifact ${artifactName} is not bound.`
    );
  }

  const ttl = claims.exp - claims.iat;
  assert(ttl > 0 && ttl <= 600, 'CI_TTL_INVALID', 'CI attestation TTL must be in 1..600 seconds.');
  assert(
    claims.nbf <= claims.iat && claims.iat - claims.nbf <= 30,
    'CI_TIME_INVALID',
    'CI nbf must be within the 30-second skew window.'
  );
  assert(
    Number.isSafeInteger(candidate.verificationTimeEpochSeconds) &&
      candidate.verificationTimeEpochSeconds >= 0,
    'CI_TIME_INVALID',
    'Fixture verification time must be a non-negative epoch second.'
  );
  assert(
    candidate.verificationTimeEpochSeconds >= claims.nbf - 30,
    'CI_ATTESTATION_NOT_YET_VALID',
    'CI attestation is not yet valid at verification time.'
  );
  assert(
    candidate.verificationTimeEpochSeconds <= claims.exp + 30,
    'CI_ATTESTATION_EXPIRED',
    'CI attestation is expired at verification time.'
  );
  const pinnedKey = pinnedJwks.keys.find(
    (key) =>
      key.kid === candidate.ciAttestation.protectedHeader.kid &&
      key.alg === 'ES256' &&
      key.kty === 'EC' &&
      key.crv === 'P-256' &&
      key.use === 'sig'
  );
  assert(pinnedKey, 'CI_KID_UNPINNED', 'CI kid is not present in the pinned ES256 JWKS.');
  for (const [name, expectedPath] of Object.entries(expectedRunbookPaths)) {
    assert(
      prerequisite.operationalArtifacts.runbooks[name].path === expectedPath,
      'PREREQUISITE_RUNBOOK_PATH_MISMATCH',
      `${name} is bound to the wrong runbook path.`
    );
  }
  const immutableRefs = [];
  for (const artifact of Object.values(prerequisite.verificationArtifacts))
    immutableRefs.push(artifact.immutableRefHash);
  immutableRefs.push(prerequisite.operationalArtifacts.dashboard.immutableRefHash);
  immutableRefs.push(prerequisite.operationalArtifacts.alerts.immutableRefHash);
  for (const artifact of Object.values(prerequisite.operationalArtifacts.runbooks))
    immutableRefs.push(artifact.immutableRefHash);
  assert(
    new Set(immutableRefs).size === immutableRefs.length,
    'PREREQUISITE_REF_COLLISION',
    'Immutable artifact refs must be unique.'
  );

  function readRequiredArtifact(path) {
    try {
      return artifactReader(path);
    } catch {
      fail(
        'PREREQUISITE_ARTIFACT_MISSING',
        `${path} is missing from the immutable artifact source.`
      );
    }
  }

  for (const [artifactName, path] of Object.entries(localVerificationArtifactFiles)) {
    const source = readRequiredArtifact(path);
    assert(
      prerequisite.verificationArtifacts[artifactName].contentDigest === sha256(source),
      'PREREQUISITE_LOCAL_ARTIFACT_MISMATCH',
      `${artifactName} does not match the pinned local fixture bytes.`
    );
  }
  for (const [name, artifact] of Object.entries({
    dashboard: prerequisite.operationalArtifacts.dashboard,
    alerts: prerequisite.operationalArtifacts.alerts,
    ...prerequisite.operationalArtifacts.runbooks,
  })) {
    const source = readRequiredArtifact(artifact.path);
    assert(
      artifact.contentDigest === sha256(source),
      'PREREQUISITE_LOCAL_ARTIFACT_MISMATCH',
      `${name} does not match the pinned operational artifact bytes.`
    );
  }

  const dashboard = JSON.parse(
    readRequiredArtifact(prerequisite.operationalArtifacts.dashboard.path)
  );
  const alerts = JSON.parse(readRequiredArtifact(prerequisite.operationalArtifacts.alerts.path));
  const queryFixture = JSON.parse(
    readFileSync(new URL('./widget-rollout-query-set.v1.golden.json', import.meta.url), 'utf8')
  );
  const expectedDashboardQueryIds = queryFixture.querySet.queries
    .map((query) => query.queryId)
    .sort();
  assert(
    dashboard.schemaVersion === 1 &&
      dashboard.environment === 'STAGING' &&
      dashboard.querySetRevision === prerequisite.revisions.rolloutQuerySetRevision &&
      dashboard.queryIds.length === expectedDashboardQueryIds.length &&
      new Set(dashboard.queryIds).size === expectedDashboardQueryIds.length &&
      dashboard.queryIds
        .slice()
        .sort()
        .every((queryId, index) => queryId === expectedDashboardQueryIds[index]),
    'PREREQUISITE_OPERATIONAL_ARTIFACT_INVALID',
    'Dashboard is not bound to the closed 24-query rollout set.'
  );
  assert(
    alerts.schemaVersion === 1 &&
      alerts.environment === 'STAGING' &&
      alerts.evaluationCadenceSeconds === 60 &&
      JSON.stringify(alerts.ringValues) ===
        JSON.stringify(['staging-bootstrap', 'staging-shadow']) &&
      Array.isArray(alerts.rules) &&
      alerts.rules.length === 10,
    'PREREQUISITE_OPERATIONAL_ARTIFACT_INVALID',
    'Alert artifact is not bound to the closed ten-rule staging stop matrix.'
  );
  const bindingFixture = JSON.parse(
    readFileSync(new URL('./widget-binding-catalog.v1.golden.json', import.meta.url), 'utf8')
  );
  const tenantFixture = JSON.parse(
    readFileSync(new URL('./widget-tenant-policy-seeds.v1.golden.json', import.meta.url), 'utf8')
  );
  assert(
    prerequisite.revisions.manifestFixtureRevision ===
      prerequisite.verificationArtifacts.manifestGolden.contentDigest,
    'PREREQUISITE_REVISION_MISMATCH',
    'Manifest fixture revision is not bound.'
  );
  assert(
    prerequisite.revisions.bindingCatalogRevision === bindingFixture.expected.catalogRevisionId,
    'PREREQUISITE_REVISION_MISMATCH',
    'Binding catalog revision is not bound.'
  );
  assert(
    prerequisite.revisions.tenantPolicyFixtureRevision === tenantFixture.expectedBaselineDigest,
    'PREREQUISITE_REVISION_MISMATCH',
    'Tenant policy fixture revision is not bound.'
  );
  assert(
    prerequisite.revisions.rolloutQuerySetRevision === queryFixture.expectedQuerySetRevision,
    'PREREQUISITE_REVISION_MISMATCH',
    'Rollout query-set revision is not bound.'
  );

  const compact = parseCompactJws(candidate.ciAttestation.compactJws);
  assert(
    canonicalize(compact.protectedHeader) ===
      canonicalize(candidate.ciAttestation.protectedHeader) &&
      canonicalize(compact.claims) === canonicalize(candidate.ciAttestation.claims),
    'CI_COMPACT_BINDING_MISMATCH',
    'Compact JWS header/claims differ from the inspected contract fields.'
  );
  const publicKey = createPublicKey({ key: pinnedKey, format: 'jwk' });
  assert(
    verify(
      'sha256',
      compact.signingInput,
      { key: publicKey, dsaEncoding: 'ieee-p1363' },
      compact.signature
    ),
    'CI_SIGNATURE_INVALID',
    'CI compact JWS signature is invalid.'
  );
  const replayKey = `${claims.iss}:${claims.jti}`;
  assert(!seenJtis.has(replayKey), 'CI_JTI_REPLAYED', 'CI attestation JTI was already consumed.');
  seenJtis.add(replayKey);
  return actualDigest;
}

assert(
  sha256(schemaSource) === anchors.schemaFile,
  'ANCHOR_MISMATCH',
  'Bootstrap schema bytes changed.'
);
assert(
  sha256(fixtureSource) === anchors.fixtureFile,
  'ANCHOR_MISMATCH',
  'Bootstrap fixture bytes changed.'
);
assert(
  sha256(negativeSource) === anchors.negativeFile,
  'ANCHOR_MISMATCH',
  'Bootstrap negative bytes changed.'
);
assert(
  sha256(jwksSource) === anchors.jwksFile,
  'ANCHOR_MISMATCH',
  'Bootstrap pinned JWKS bytes changed.'
);
assert(
  schema.$id.endsWith('/widget-bootstrap-prerequisite.v1.schema.json'),
  'SCHEMA_ID',
  'Unexpected Bootstrap schema ID.'
);
assert(
  pinnedJwks.schemaVersion === 1 &&
    pinnedJwks.issuer === 'dwp-ci-attestation-authority' &&
    Array.isArray(pinnedJwks.keys) &&
    pinnedJwks.keys.length === 1,
  'CI_JWKS_INVALID',
  'Pinned CI JWKS must contain one closed issuer key.'
);

const fixture = JSON.parse(fixtureSource);
assert(
  JSON.stringify(Object.keys(fixture).sort()) ===
    JSON.stringify([
      'ciAttestation',
      'expectedPrerequisiteDigest',
      'fixtureVersion',
      'prerequisite',
      'verificationTimeEpochSeconds',
    ]),
  'SCHEMA_UNKNOWN_FIELD',
  'Bootstrap fixture wrapper keys changed.'
);
assert(fixture.fixtureVersion === 1, 'SCHEMA_CONST', 'Bootstrap fixture version must be 1.');
assert(
  JSON.stringify(Object.keys(fixture.ciAttestation).sort()) ===
    JSON.stringify(['claims', 'compactJws', 'protectedHeader']),
  'SCHEMA_UNKNOWN_FIELD',
  'CI attestation wrapper keys changed.'
);
const digest = validateContract(structuredClone(fixture));
assert(
  digest === anchors.prerequisiteDigest,
  'ANCHOR_MISMATCH',
  'Independent Bootstrap prerequisite digest changed.'
);

const negativeFixture = JSON.parse(negativeSource);
const expectedMutations = new Set([
  'ADD_UNKNOWN_ROOT',
  'REMOVE_NON_INJECTION',
  'FAILED_CONTRACT_TEST',
  'HS256_HEADER',
  'WRONG_AUDIENCE',
  'TTL_TOO_LONG',
  'DIGEST_MISMATCH',
  'ARTIFACT_DIGEST_MISMATCH',
  'SOURCE_COMMIT_MISMATCH',
  'SWAP_RUNBOOK_PATHS',
  'REPLAYED_JTI',
  'INVALID_MIGRATION_VERSION',
  'FORGED_SIGNATURE',
  'FORGED_THEN_VALID_SAME_JTI',
  'UNKNOWN_KID',
  'EXPIRED_AT_VERIFICATION',
  'NOT_YET_VALID_AT_VERIFICATION',
  'MISSING_LOCAL_ARTIFACT',
  'LOCAL_ARTIFACT_CONTENT_MISMATCH',
]);
assert(
  negativeFixture.cases.length === expectedMutations.size,
  'NEGATIVE_COVERAGE',
  'Bootstrap negative case count changed.'
);
assert(
  new Set(negativeFixture.cases.map((entry) => entry.mutation)).size === expectedMutations.size,
  'NEGATIVE_COVERAGE',
  'Bootstrap negative mutations are duplicated.'
);

for (const testCase of negativeFixture.cases) {
  assert(
    expectedMutations.has(testCase.mutation),
    'NEGATIVE_COVERAGE',
    `Unknown mutation ${testCase.mutation}.`
  );
  const candidate = structuredClone(fixture);
  const seenJtis = new Set();
  let validationOptions = {};
  switch (testCase.mutation) {
    case 'ADD_UNKNOWN_ROOT':
      candidate.prerequisite.debug = true;
      break;
    case 'REMOVE_NON_INJECTION':
      delete candidate.prerequisite.verificationArtifacts.nonInjectionDependencyTest;
      break;
    case 'FAILED_CONTRACT_TEST':
      candidate.prerequisite.verificationArtifacts.contractTest.conclusion = 'FAILURE';
      break;
    case 'HS256_HEADER':
      candidate.ciAttestation.protectedHeader.alg = 'HS256';
      break;
    case 'WRONG_AUDIENCE':
      candidate.ciAttestation.claims.aud = 'dwp-platform';
      break;
    case 'TTL_TOO_LONG':
      candidate.ciAttestation.claims.exp = candidate.ciAttestation.claims.iat + 601;
      break;
    case 'DIGEST_MISMATCH':
      candidate.ciAttestation.claims.prerequisiteDigest = '0'.repeat(64);
      break;
    case 'ARTIFACT_DIGEST_MISMATCH':
      candidate.ciAttestation.claims.verificationArtifactDigests.contractTest = '0'.repeat(64);
      break;
    case 'SOURCE_COMMIT_MISMATCH':
      candidate.ciAttestation.claims.sourceCommitSha = '0'.repeat(40);
      break;
    case 'SWAP_RUNBOOK_PATHS': {
      const runbooks = candidate.prerequisite.operationalArtifacts.runbooks;
      [runbooks.shadowStop.path, runbooks.catalogKill.path] = [
        runbooks.catalogKill.path,
        runbooks.shadowStop.path,
      ];
      break;
    }
    case 'REPLAYED_JTI':
      seenJtis.add(`${candidate.ciAttestation.claims.iss}:${candidate.ciAttestation.claims.jti}`);
      break;
    case 'INVALID_MIGRATION_VERSION':
      candidate.prerequisite.migrations.platform.latestVersion = 'v200';
      break;
    case 'FORGED_SIGNATURE': {
      const segments = candidate.ciAttestation.compactJws.split('.');
      segments[2] = `${segments[2][0] === 'A' ? 'B' : 'A'}${segments[2].slice(1)}`;
      candidate.ciAttestation.compactJws = segments.join('.');
      break;
    }
    case 'FORGED_THEN_VALID_SAME_JTI': {
      const segments = candidate.ciAttestation.compactJws.split('.');
      segments[2] = `${segments[2][0] === 'A' ? 'B' : 'A'}${segments[2].slice(1)}`;
      candidate.ciAttestation.compactJws = segments.join('.');
      break;
    }
    case 'UNKNOWN_KID':
      candidate.ciAttestation.protectedHeader.kid = 'ci-widget-bootstrap-unknown';
      break;
    case 'EXPIRED_AT_VERIFICATION':
      candidate.verificationTimeEpochSeconds = candidate.ciAttestation.claims.exp + 31;
      break;
    case 'NOT_YET_VALID_AT_VERIFICATION':
      candidate.verificationTimeEpochSeconds = candidate.ciAttestation.claims.nbf - 31;
      break;
    case 'MISSING_LOCAL_ARTIFACT':
      validationOptions = {
        artifactReader: (path) => {
          if (path === candidate.prerequisite.operationalArtifacts.dashboard.path) {
            throw new Error('simulated missing artifact');
          }
          return defaultArtifactReader(path);
        },
      };
      break;
    case 'LOCAL_ARTIFACT_CONTENT_MISMATCH':
      validationOptions = {
        artifactReader: (path) => {
          const source = defaultArtifactReader(path);
          return path === candidate.prerequisite.operationalArtifacts.alerts.path
            ? `${source}\nTAMPERED`
            : source;
        },
      };
      break;
    default:
      fail('NEGATIVE_COVERAGE', `Unhandled mutation ${testCase.mutation}.`);
  }

  if (testCase.mutation === 'SWAP_RUNBOOK_PATHS') {
    const mutatedDigest = sha256(Buffer.from(canonicalize(candidate.prerequisite), 'utf8'));
    candidate.expectedPrerequisiteDigest = mutatedDigest;
    candidate.ciAttestation.claims.prerequisiteDigest = mutatedDigest;
  }

  if (testCase.mutation === 'FORGED_THEN_VALID_SAME_JTI') {
    let forgedCode = null;
    try {
      validateContract(candidate, seenJtis, validationOptions);
    } catch (error) {
      if (error instanceof ContractError) forgedCode = error.code;
      else throw error;
    }
    assert(
      forgedCode === testCase.expectedCode,
      'NEGATIVE_EXPECTATION',
      `${testCase.caseId}: forged attempt expected ${testCase.expectedCode}, received ${forgedCode}.`
    );
    assert(seenJtis.size === 0, 'CI_JTI_POISONED', 'Failed signature consumed the shared JTI.');
    validateContract(structuredClone(fixture), seenJtis, validationOptions);
    assert(
      seenJtis.size === 1,
      'CI_JTI_NOT_CONSUMED',
      'Valid signature did not consume the shared JTI.'
    );
    let replayCode = null;
    try {
      validateContract(structuredClone(fixture), seenJtis, validationOptions);
    } catch (error) {
      if (error instanceof ContractError) replayCode = error.code;
      else throw error;
    }
    assert(
      replayCode === 'CI_JTI_REPLAYED',
      'NEGATIVE_EXPECTATION',
      `${testCase.caseId}: second valid attempt must be rejected as replay.`
    );
    process.stdout.write(`${testCase.caseId} rejected ${forgedCode}; valid consumed once\n`);
    continue;
  }

  let actualCode = null;
  try {
    validateContract(candidate, seenJtis, validationOptions);
  } catch (error) {
    if (error instanceof ContractError) actualCode = error.code;
    else throw error;
  }
  assert(
    actualCode === testCase.expectedCode,
    'NEGATIVE_EXPECTATION',
    `${testCase.caseId}: expected ${testCase.expectedCode}, received ${actualCode}.`
  );
  process.stdout.write(`${testCase.caseId} rejected ${actualCode}\n`);
}

process.stdout.write(`bootstrapPrerequisiteDigest ${digest}\n`);
process.stdout.write(`bootstrapNegativeCases ${negativeFixture.cases.length}\n`);
process.stdout.write('bootstrap-prerequisite-contract ok\n');
