#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import prettier from 'prettier';

const root = process.cwd();
const snapshot = path.join(root, 'architecture/pilot-fixtures.v1.generated.json');
const authorizationSnapshot = path.join(root, 'architecture/product-surface-authorization.v1.json');
const generatedTarget = path.join(
  root,
  'libs/shared-utils/src/test-utils/pilot-authorization-fixtures.generated.ts'
);
const SHA_256 = /^[a-f0-9]{64}$/;
const EXPECTED_GROUP_COUNTS = { GUARD: 17, CANARY: 12, APPROVALS: 18, HCM: 24 };
const EXPECTED_CONTEXT_CASES = new Set([
  'FX-C-MULTI-WINDOW',
  'FX-C-SUPPORT-EXCLUSIVE',
  'FX-C-SOURCE-REVISION',
]);
const EXPECTED_RESERVED_CONTRACTS = new Set([
  'hcm.reference.publish',
  'hcm.integration.rotate-secret',
]);
const EXPECTED_REGISTRY_VERSIONS = [1, 2, 3, 4, 5];
const PRESERVED_AUTHORIZATION_CHECKSUMS = Object.freeze({
  1: 'bc34f47b0ad783d27aa7979f25f75e2fdf29506a12a23c0088f94837abad0b67',
  2: '5b634a35472ef98ecdd5ca9efe7a716020d8f3ae0d8f5025d76bbf072692c12c',
  3: 'f90c4e3a734204a4619ae77d3476ebc7cc802c43ed8574fcf4f3fc85def67a8e',
  4: 'a9cd08260fd9a11dd7c612f2db6f03bb312f1e7843a2eb10b4082660da151137',
});
const EXPECTED_STEP_UP_CHALLENGES = { approval: 4, people: 5 };
const STEP_UP_CONTEXT_KEYS = Object.freeze({
  STEPUP_HIGH_WORKFLOW_PUBLISH_1: 'approval-management',
  STEPUP_HIGH_FORM_PUBLISH_1: 'approval-management',
  STEPUP_HIGH_POLICY_PUBLISH_1: 'approval-management',
  STEPUP_HIGH_RECOVERY_1: 'approval-management',
  STEPUP_HIGH_ORG_PUBLISH_1: 'hcm-management',
  STEPUP_HIGH_INTEGRATION_EXECUTE_1: 'hcm-management',
  STEPUP_CRITICAL_FRESH_1: 'hcm-management',
  STEPUP_CRITICAL_EXPORT_RETRY_1: 'hcm-management',
  STEPUP_CRITICAL_CONSUMED_1: 'hcm-management',
});
const authorizationCounts = (
  capabilities,
  accessPolicies,
  entitlementExpressions,
  predicates,
  routes
) => ({
  capabilities,
  accessPolicies,
  entitlementExpressions,
  predicatePolicies: predicates,
  routes,
});
const EXPECTED_AUTHORIZATION_COUNTS = Object.freeze({
  1: authorizationCounts(10, 5, 2, 6, 35),
  2: authorizationCounts(34, 6, 3, 13, 76),
  3: authorizationCounts(62, 14, 8, 25, 129),
  4: authorizationCounts(71, 22, 16, 33, 155),
  5: authorizationCounts(72, 22, 16, 33, 160),
});
const STEP_UP_HEADER_FIELDS = ['alg', 'kid', 'typ'];
const STEP_UP_CLAIM_FIELDS = [
  'acr',
  'activation_policy',
  'amr',
  'aud',
  'auth_time',
  'capability_contract_key',
  'command_contract_key',
  'command_method',
  'command_path',
  'command_sha256',
  'context_key',
  'decision_revision',
  'exp',
  'iat',
  'idempotency_key',
  'iss',
  'jti',
  'nbf',
  'nonce',
  'owner_service_key',
  'payload_sha256',
  'scope_ref',
  'sub',
  'target_id',
  'target_type',
  'target_version',
  'tenant_id',
];
const AUTHORIZATION_SNAPSHOT_FIELDS = [
  'bundles',
  'index',
  'latestAlias',
  'rolloutInventory',
  'schemaVersion',
  'snapshotKey',
];
const AUTHORIZATION_BUNDLE_FIELDS = new Set([
  'accessPolicies',
  'authorityEndpoints',
  'bundleKey',
  'bundleStatus',
  'capabilities',
  'checksum',
  'checksumAlgorithm',
  'entitlementExpressions',
  'owner',
  'predicatePolicies',
  'routes',
  'schemaVersion',
  'version',
]);
const AUTHORIZATION_INDEX_VERSION_FIELDS = [
  'artifact',
  'authSeedArtifact',
  'bundleStatus',
  'checksum',
  'counts',
  'version',
];
const EXPECTED_ROLLOUT_PRODUCTS = [
  'approvals',
  'calendar',
  'communications',
  'dwaion',
  'hcm',
  'mail',
  'meetings',
  'messaging',
  'notifications',
  'services',
  'spaces',
  'workplace',
];
const FIXTURE_BUNDLE_FIELDS = [
  'catalogs',
  'components',
  'contextCases',
  'fixedClock',
  'fixtureBundleKey',
  'fixtureChecksum',
  'fixtureChecksumAlgorithm',
  'negativeCases',
  'normalValidUntil',
  'registryLineage',
  'reservedContracts',
  'riskPolicies',
  'schemaVersion',
  'sourceRevisions',
  'stepUpVerification',
  'testCases',
];
const STEP_UP_CHALLENGE_BASE_FIELDS = [
  'acr',
  'actorUserId',
  'algorithm',
  'amr',
  'audience',
  'authenticatedAt',
  'capabilityContractKey',
  'challengeId',
  'commandContractKey',
  'commandSha256',
  'compactToken',
  'contextKey',
  'decisionRevision',
  'expectedObjectVersionName',
  'expectedObjectVersionSource',
  'expiresAt',
  'idempotencyKey',
  'issuedAt',
  'issuer',
  'key',
  'keyId',
  'method',
  'nonce',
  'ownerServiceKey',
  'path',
  'payload',
  'payloadSha256',
  'policy',
  'requiredRegistryRef',
  'scopeRef',
  'state',
  'stepUpCommandBindingKey',
  'targetId',
  'targetIdSource',
  'targetType',
  'targetVersion',
  'tenantId',
];
const STEP_UP_VERIFICATION_FIELDS = [
  'algorithm',
  'audienceByOwnerService',
  'issuer',
  'keyId',
  'publicKeyPem',
  'requiredAcr',
];
const STEP_UP_PUBLIC_KEY_SHA256 =
  '5b5a90532d7db5dc49d2f0db81acd3ec5a5582e04a8212796722a3da95abc8be';
const CATALOG_NAMES = [
  'scopes',
  'targetPopulations',
  'objects',
  'payloads',
  'relationships',
  'supportSessions',
  'stepUpChallenges',
];

function fail(message) {
  throw new Error(`Product authorization fixture contract error: ${message}`);
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value, label) {
  if (!isRecord(value)) fail(`${label} must be an object`);
  return value;
}

function requireArray(value, label) {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  return value;
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.length === 0) fail(`${label} must be a non-empty string`);
  return value;
}

function requireUnique(values, label) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) fail(`duplicate ${label}: ${value}`);
    seen.add(value);
  }
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])])
  );
}

function sha256(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

function sha256Text(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function readJson(sourcePath, label) {
  if (!fs.existsSync(sourcePath)) fail(`${label} is missing: ${sourcePath}`);
  try {
    return JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  } catch (error) {
    fail(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function bundleChecksum(bundle) {
  const payload = structuredClone(bundle);
  delete payload.checksum;
  delete payload.bundleStatus;
  return sha256(payload);
}

function readAuthorizationRegistry(sourcePath) {
  const stats = fs.statSync(sourcePath, { throwIfNoEntry: false });
  if (!stats) fail(`authorization registry is missing: ${sourcePath}`);
  const source = stats.isDirectory()
    ? (() => {
        const expectedBundles = EXPECTED_REGISTRY_VERSIONS.map(
          (version) => `product-surfaces-v1.bundle-v${version}.json`
        );
        const packagedBundles = fs
          .readdirSync(sourcePath)
          .filter((fileName) =>
            /^product-surfaces-v1\.bundle-v\d+(?:\.generated)?\.json$/u.test(fileName)
          )
          .sort();
        if (JSON.stringify(packagedBundles) !== JSON.stringify(expectedBundles)) {
          fail(
            `authorization registry directory must contain exactly immutable bundle v1-v${EXPECTED_REGISTRY_VERSIONS.at(-1)} files`
          );
        }
        const aliasPath = path.join(sourcePath, 'product-surfaces-v1.json');
        const latestPath = path.join(
          sourcePath,
          `product-surfaces-v1.bundle-v${EXPECTED_REGISTRY_VERSIONS.at(-1)}.json`
        );
        if (
          !fs.statSync(aliasPath, { throwIfNoEntry: false })?.isFile() ||
          !fs.readFileSync(aliasPath).equals(fs.readFileSync(latestPath))
        ) {
          fail(
            `authorization registry latest alias must be byte-identical to bundle v${EXPECTED_REGISTRY_VERSIONS.at(-1)}`
          );
        }
        return {
          index: readJson(
            path.join(sourcePath, 'product-surfaces-v1.index.json'),
            'authorization registry index'
          ),
          bundles: EXPECTED_REGISTRY_VERSIONS.map((version) =>
            readJson(
              path.join(sourcePath, `product-surfaces-v1.bundle-v${version}.json`),
              `authorization registry bundle v${version}`
            )
          ),
          latestAlias: readJson(aliasPath, 'authorization registry latest alias'),
          rolloutInventory: readJson(
            path.join(sourcePath, 'product-surface-rollout-inventory.v1.generated.json'),
            'product surface rollout inventory'
          ),
        };
      })()
    : readJson(sourcePath, 'authorization snapshot');
  if (
    !stats.isDirectory() &&
    (JSON.stringify(Object.keys(source).sort()) !== JSON.stringify(AUTHORIZATION_SNAPSHOT_FIELDS) ||
      source.schemaVersion !== 1 ||
      source.snapshotKey !== 'product-surface-authorization.v1')
  ) {
    fail('authorization snapshot contains an unknown field or active pointer');
  }
  const index = requireRecord(source.index, 'authorization registry index');
  const bundles = requireArray(source.bundles, 'authorization registry bundles');
  const indexVersions = requireArray(index.versions, 'authorization registry index versions');
  const expectedIndexFields = [
    'bundleKey',
    'indexChecksum',
    'indexChecksumAlgorithm',
    'latestArtifact',
    'latestAuthSeedArtifact',
    'latestChecksum',
    'latestVersion',
    'schemaVersion',
    'versions',
  ];
  if (
    JSON.stringify(Object.keys(index).sort()) !== JSON.stringify(expectedIndexFields) ||
    index.schemaVersion !== 1 ||
    index.bundleKey !== 'product-surfaces' ||
    index.indexChecksumAlgorithm !== 'SHA-256' ||
    index.latestVersion !== EXPECTED_REGISTRY_VERSIONS.at(-1) ||
    index.latestArtifact !==
      `product-surfaces-v1.bundle-v${EXPECTED_REGISTRY_VERSIONS.at(-1)}.json` ||
    index.latestAuthSeedArtifact !==
      `product-surfaces-v1.bundle-v${EXPECTED_REGISTRY_VERSIONS.at(-1)}.generated.json` ||
    bundles.length !== EXPECTED_REGISTRY_VERSIONS.length ||
    indexVersions.length !== EXPECTED_REGISTRY_VERSIONS.length ||
    !SHA_256.test(index.indexChecksum)
  ) {
    fail(
      `authorization registry must close over product-surfaces v1-v${EXPECTED_REGISTRY_VERSIONS.at(-1)} exactly`
    );
  }
  const indexChecksumInput = structuredClone(index);
  delete indexChecksumInput.indexChecksum;
  if (sha256(indexChecksumInput) !== index.indexChecksum) {
    fail('authorization registry index checksum is invalid');
  }
  const bundlesByVersion = new Map();
  for (const [arrayIndex, version] of EXPECTED_REGISTRY_VERSIONS.entries()) {
    const bundle = requireRecord(bundles[arrayIndex], `authorization registry bundle v${version}`);
    const indexEntry = indexVersions[arrayIndex];
    const expectedBundleFields = [...AUTHORIZATION_BUNDLE_FIELDS].filter(
      (field) => field !== 'authorityEndpoints' || version >= 2
    );
    if (
      JSON.stringify(Object.keys(bundle).sort()) !== JSON.stringify(expectedBundleFields.sort()) ||
      bundle.schemaVersion !== 1 ||
      bundle.bundleKey !== 'product-surfaces' ||
      bundle.version !== version ||
      bundle.bundleStatus !== 'DRAFT' ||
      bundle.checksumAlgorithm !== 'SHA-256' ||
      !SHA_256.test(bundle.checksum) ||
      bundleChecksum(bundle) !== bundle.checksum ||
      !indexEntry ||
      indexEntry.version !== version ||
      JSON.stringify(Object.keys(indexEntry).sort()) !==
        JSON.stringify(AUTHORIZATION_INDEX_VERSION_FIELDS) ||
      indexEntry.artifact !== `product-surfaces-v1.bundle-v${version}.json` ||
      indexEntry.authSeedArtifact !== `product-surfaces-v1.bundle-v${version}.generated.json` ||
      indexEntry.bundleStatus !== 'DRAFT' ||
      indexEntry.checksum !== bundle.checksum ||
      JSON.stringify(canonicalize(indexEntry.counts)) !==
        JSON.stringify(canonicalize(EXPECTED_AUTHORIZATION_COUNTS[version]))
    ) {
      fail(`authorization registry bundle v${version} is not closed over its index`);
    }
    if (
      PRESERVED_AUTHORIZATION_CHECKSUMS[version] !== undefined &&
      bundle.checksum !== PRESERVED_AUTHORIZATION_CHECKSUMS[version]
    )
      fail(`preserved v${version} checksum changed`);
    bundlesByVersion.set(version, bundle);
  }
  if (index.latestChecksum !== bundlesByVersion.get(index.latestVersion)?.checksum) {
    fail(
      `authorization registry latest checksum differs from bundle v${EXPECTED_REGISTRY_VERSIONS.at(-1)}`
    );
  }
  const rolloutInventory = requireRecord(
    source.rolloutInventory,
    'product surface rollout inventory'
  );
  const expectedRolloutFields = [
    'checksum',
    'checksumAlgorithm',
    'inventoryKey',
    'products',
    'schemaVersion',
  ];
  const rolloutPayload = structuredClone(rolloutInventory);
  delete rolloutPayload.checksum;
  if (
    JSON.stringify(Object.keys(rolloutInventory).sort()) !==
      JSON.stringify(expectedRolloutFields) ||
    rolloutInventory.schemaVersion !== 1 ||
    rolloutInventory.inventoryKey !== 'product-surface-rollout-products.v1' ||
    rolloutInventory.checksumAlgorithm !== 'SHA-256' ||
    !SHA_256.test(rolloutInventory.checksum) ||
    JSON.stringify(rolloutInventory.products) !== JSON.stringify(EXPECTED_ROLLOUT_PRODUCTS) ||
    sha256(rolloutPayload) !== rolloutInventory.checksum
  ) {
    fail('product surface rollout inventory is invalid');
  }
  if (
    JSON.stringify(canonicalize(source.latestAlias)) !==
    JSON.stringify(canonicalize(bundlesByVersion.get(index.latestVersion)))
  ) {
    fail(
      `authorization snapshot latest alias differs from bundle v${EXPECTED_REGISTRY_VERSIONS.at(-1)}`
    );
  }
  return { index, bundlesByVersion };
}

function validateCatalogs(bundle) {
  const catalogs = requireRecord(bundle.catalogs, 'catalogs');
  const keys = new Set();
  for (const catalogName of CATALOG_NAMES) {
    const records = requireArray(catalogs[catalogName], `catalogs.${catalogName}`);
    const catalogKeys = records.map((record, index) =>
      requireString(
        requireRecord(record, `catalogs.${catalogName}[${index}]`).key,
        `catalogs.${catalogName}[${index}].key`
      )
    );
    requireUnique(catalogKeys, `catalogs.${catalogName} key`);
    for (const key of catalogKeys) {
      if (keys.has(key)) fail(`catalog keys must be globally unique: ${key}`);
      keys.add(key);
    }
  }
  return keys;
}

function validateStepUpVerification(bundle) {
  const verification = requireRecord(bundle.stepUpVerification, 'stepUpVerification');
  if (
    JSON.stringify(Object.keys(verification).sort()) !== JSON.stringify(STEP_UP_VERIFICATION_FIELDS)
  ) {
    fail('stepUpVerification field set is not exact');
  }
  if (verification.algorithm !== 'RS256') {
    fail('stepUpVerification.algorithm must be RS256');
  }
  if (verification.keyId !== 'fixture-approval-step-up-rs256-v1') {
    fail('stepUpVerification.keyId differs from the immutable fixture key contract');
  }
  const issuer = requireString(verification.issuer, 'stepUpVerification.issuer');
  try {
    const parsedIssuer = new URL(issuer);
    if (parsedIssuer.protocol !== 'https:') {
      fail('stepUpVerification.issuer must use HTTPS');
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Product authorization fixture')) {
      throw error;
    }
    fail('stepUpVerification.issuer must be an absolute URI');
  }
  if (issuer !== 'https://auth.fixture.dwp.test') {
    fail('stepUpVerification.issuer differs from the immutable fixture issuer');
  }
  const audiences = requireRecord(
    verification.audienceByOwnerService,
    'stepUpVerification.audienceByOwnerService'
  );
  if (
    JSON.stringify(Object.keys(audiences).sort()) !== JSON.stringify(['approval', 'people']) ||
    audiences.approval !== 'dwp-approval-server' ||
    audiences.people !== 'dwp-people-server'
  ) {
    fail('stepUpVerification.audienceByOwnerService must close over approval and people exactly');
  }
  if (verification.requiredAcr !== 'urn:dwp:acr:mfa') {
    fail('stepUpVerification.requiredAcr differs from the immutable fixture assurance contract');
  }
  const publicKeyPem = requireString(verification.publicKeyPem, 'stepUpVerification.publicKeyPem');
  try {
    const publicKey = crypto.createPublicKey(publicKeyPem);
    if (
      publicKey.asymmetricKeyType !== 'rsa' ||
      (publicKey.asymmetricKeyDetails?.modulusLength ?? 0) < 2048
    ) {
      fail('stepUpVerification.publicKeyPem must be an RSA public key of at least 2048 bits');
    }
    const fingerprint = crypto
      .createHash('sha256')
      .update(publicKey.export({ type: 'spki', format: 'der' }))
      .digest('hex');
    if (fingerprint !== STEP_UP_PUBLIC_KEY_SHA256) {
      fail('stepUpVerification.publicKeyPem differs from the immutable fixture key contract');
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Product authorization fixture')) {
      throw error;
    }
    fail('stepUpVerification.publicKeyPem must be a valid public key');
  }
}

function validateComponents(bundle, catalogKeys) {
  const components = requireArray(bundle.components, 'components');
  if (components.length === 0) fail('components must not be empty');
  const componentKeys = components.map((component, index) =>
    requireString(requireRecord(component, `components[${index}]`).key, `components[${index}].key`)
  );
  requireUnique(componentKeys, 'component key');
  const knownReferences = new Set([...catalogKeys, ...componentKeys]);
  const reserved = new Set(requireArray(bundle.reservedContracts, 'reservedContracts'));

  for (const component of components) {
    for (const contractKey of component.capabilityContractKeys ?? []) {
      if (reserved.has(contractKey)) {
        fail(`reserved capability cannot be materialized by ${component.key}: ${contractKey}`);
      }
    }
    for (const referenceField of ['scopeRefs', 'relationshipRefs', 'evidenceRefs']) {
      for (const reference of component[referenceField] ?? []) {
        if (!catalogKeys.has(reference)) {
          fail(`${component.key}.${referenceField} references unknown catalog key ${reference}`);
        }
      }
    }
    if (component.supportSessionRef && !catalogKeys.has(component.supportSessionRef)) {
      fail(`${component.key} references unknown support session ${component.supportSessionRef}`);
    }
  }
  return knownReferences;
}

function validateRegistryLineage(bundle, authorizationRegistry) {
  const lineage = requireRecord(bundle.registryLineage, 'registryLineage');
  if (lineage.authority !== 'INFORMATIONAL_ONLY' || lineage.bundleKey !== 'product-surfaces') {
    fail('registryLineage must be an informational product-surfaces lineage');
  }
  if (!SHA_256.test(lineage.indexSha256) || /^0+$/.test(lineage.indexSha256)) {
    fail('registryLineage.indexSha256 must be a non-placeholder SHA-256');
  }
  const versions = requireArray(lineage.versions, 'registryLineage.versions');
  if (versions.length !== EXPECTED_REGISTRY_VERSIONS.length) {
    fail(`registryLineage must contain v1-v${EXPECTED_REGISTRY_VERSIONS.at(-1)} exactly`);
  }
  const versionByNumber = new Map();
  for (const [index, expectedVersion] of EXPECTED_REGISTRY_VERSIONS.entries()) {
    const reference = requireRecord(versions[index], `registryLineage.versions[${index}]`);
    if (
      reference.bundleKey !== 'product-surfaces' ||
      reference.version !== expectedVersion ||
      !SHA_256.test(reference.sha256) ||
      /^0+$/.test(reference.sha256)
    ) {
      fail(`registryLineage v${expectedVersion} reference is invalid`);
    }
    const authorizationBundle = authorizationRegistry.bundlesByVersion.get(expectedVersion);
    if (reference.sha256 !== authorizationBundle?.checksum) {
      fail(`registryLineage v${expectedVersion} differs from the authorization bundle`);
    }
    versionByNumber.set(expectedVersion, { reference, bundle: authorizationBundle });
  }
  if (
    lineage.latestAliasVersion !== authorizationRegistry.index.latestVersion ||
    lineage.indexSha256 !== authorizationRegistry.index.indexChecksum
  ) {
    fail('registryLineage index or latest alias differs from the authorization registry');
  }
  return versionByNumber;
}

function validateRequiredRegistryRef(value, label, registryVersions) {
  const reference = requireRecord(value, label);
  const canonical = registryVersions.get(reference.version);
  if (
    !canonical ||
    reference.bundleKey !== canonical.reference.bundleKey ||
    reference.sha256 !== canonical.reference.sha256
  ) {
    fail(`${label} is outside the canonical authorization lineage`);
  }
  return canonical;
}

function pathMatchesTemplate(template, candidate) {
  const expression = template
    .split('/')
    .map((segment) =>
      /^\{[A-Za-z][A-Za-z0-9]*\}$/u.test(segment)
        ? '[^/]+'
        : segment.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
    )
    .join('/');
  return new RegExp(`^${expression}$`, 'u').test(candidate);
}

function pathParameterValues(template, candidate) {
  const templateSegments = template.split('/');
  const candidateSegments = candidate.split('/');
  if (templateSegments.length !== candidateSegments.length) return undefined;
  const values = {};
  for (let index = 0; index < templateSegments.length; index += 1) {
    const templateSegment = templateSegments[index];
    const candidateSegment = candidateSegments[index];
    const match = /^\{([A-Za-z][A-Za-z0-9]*)\}$/u.exec(templateSegment);
    if (match) {
      if (!candidateSegment) return undefined;
      values[match[1]] = candidateSegment;
    } else if (templateSegment !== candidateSegment) {
      return undefined;
    }
  }
  return values;
}

function templateParameterNames(template) {
  if (typeof template !== 'string') return [];
  return [...template.matchAll(/\{([A-Za-z][A-Za-z0-9]*)\}/gu)].map((match) => match[1]);
}

function epochSeconds(value, label) {
  const instant = requireString(value, label);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(instant)) {
    fail(`${label} must be an RFC 3339 UTC date-time at whole-second precision`);
  }
  const milliseconds = Date.parse(instant);
  if (
    !Number.isFinite(milliseconds) ||
    new Date(milliseconds).toISOString() !== instant.replace(/Z$/u, '.000Z')
  ) {
    fail(`${label} must be a valid RFC 3339 UTC date-time`);
  }
  return milliseconds / 1000;
}

function decodeAndVerifyStepUpToken(challenge, verification) {
  const compactToken = requireString(challenge.compactToken, `${challenge.key}.compactToken`);
  const parts = compactToken.split('.');
  if (parts.length !== 3) fail(`${challenge.key}.compactToken must be a signed JWT`);
  if (
    parts.some(
      (part) =>
        !/^[A-Za-z0-9_-]+$/u.test(part) ||
        Buffer.from(part, 'base64url').toString('base64url') !== part
    )
  ) {
    fail(`${challenge.key}.compactToken must use canonical unpadded base64url segments`);
  }
  let header;
  let claims;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    fail(`${challenge.key}.compactToken header or claims are invalid`);
  }
  requireRecord(header, `${challenge.key}.compactToken header`);
  requireRecord(claims, `${challenge.key}.compactToken claims`);
  if (
    JSON.stringify(Object.keys(header).sort()) !== JSON.stringify(STEP_UP_HEADER_FIELDS) ||
    header.alg !== 'RS256' ||
    header.typ !== 'JWT' ||
    header.kid !== challenge.keyId
  ) {
    fail(`${challenge.key}.compactToken header differs from the fixture challenge`);
  }
  if (
    !crypto.verify(
      'RSA-SHA256',
      Buffer.from(`${parts[0]}.${parts[1]}`, 'utf8'),
      verification.publicKeyPem,
      Buffer.from(parts[2], 'base64url')
    )
  ) {
    fail(`${challenge.key}.compactToken signature is invalid`);
  }
  const payloadSha256 = sha256(requireRecord(challenge.payload, `${challenge.key}.payload`));
  if (challenge.payloadSha256 !== payloadSha256) {
    fail(`${challenge.key}.payloadSha256 differs from its canonical payload`);
  }
  const commandSha256 = sha256Text(
    [
      challenge.commandContractKey,
      challenge.ownerServiceKey,
      challenge.audience,
      challenge.method,
      challenge.path,
      challenge.contextKey,
      challenge.scopeRef,
      challenge.targetType,
      challenge.targetId,
      String(challenge.targetVersion),
      challenge.idempotencyKey,
      payloadSha256,
      challenge.decisionRevision,
    ].join('\n')
  );
  if (challenge.commandSha256 !== commandSha256) {
    fail(`${challenge.key}.commandSha256 differs from its canonical command tuple`);
  }
  if (
    challenge.algorithm !== verification.algorithm ||
    challenge.keyId !== verification.keyId ||
    challenge.issuer !== verification.issuer ||
    challenge.audience !== verification.audienceByOwnerService[challenge.ownerServiceKey] ||
    challenge.acr !== verification.requiredAcr
  ) {
    fail(`${challenge.key} verification metadata differs from the fixture verifier`);
  }
  const expectedClaims = {
    iss: challenge.issuer,
    sub: String(challenge.actorUserId),
    aud: challenge.audience,
    jti: challenge.challengeId,
    nonce: challenge.nonce,
    iat: epochSeconds(challenge.issuedAt, `${challenge.key}.issuedAt`),
    nbf: epochSeconds(challenge.issuedAt, `${challenge.key}.issuedAt`),
    exp: epochSeconds(challenge.expiresAt, `${challenge.key}.expiresAt`),
    auth_time: epochSeconds(challenge.authenticatedAt, `${challenge.key}.authenticatedAt`),
    acr: challenge.acr,
    amr: challenge.amr,
    tenant_id: challenge.tenantId,
    owner_service_key: challenge.ownerServiceKey,
    command_contract_key: challenge.commandContractKey,
    activation_policy: challenge.policy,
    capability_contract_key: challenge.capabilityContractKey,
    context_key: challenge.contextKey,
    scope_ref: challenge.scopeRef,
    target_type: challenge.targetType,
    target_id: challenge.targetId,
    target_version: challenge.targetVersion,
    command_method: challenge.method,
    command_path: challenge.path,
    idempotency_key: challenge.idempotencyKey,
    payload_sha256: payloadSha256,
    command_sha256: commandSha256,
    decision_revision: challenge.decisionRevision,
  };
  if (JSON.stringify(Object.keys(claims).sort()) !== JSON.stringify(STEP_UP_CLAIM_FIELDS)) {
    fail(`${challenge.key}.compactToken claim set is not exact`);
  }
  for (const [claim, expected] of Object.entries(expectedClaims)) {
    if (JSON.stringify(canonicalize(claims[claim])) !== JSON.stringify(canonicalize(expected))) {
      fail(`${challenge.key}.compactToken ${claim} differs from the fixture challenge`);
    }
  }
}

function validateStepUpChallenges(bundle, registryVersions) {
  const challenges = requireArray(bundle.catalogs.stepUpChallenges, 'catalogs.stepUpChallenges');
  const challengeKeys = challenges.map((challenge, index) =>
    requireString(
      requireRecord(challenge, `catalogs.stepUpChallenges[${index}]`).key,
      `catalogs.stepUpChallenges[${index}].key`
    )
  );
  requireUnique(challengeKeys, 'step-up challenge key');
  if (
    JSON.stringify([...challengeKeys].sort()) !==
    JSON.stringify(Object.keys(STEP_UP_CONTEXT_KEYS).sort())
  ) {
    fail('step-up challenge keys must be the closed canonical nine-challenge set');
  }
  const scopeKeys = new Set(
    requireArray(bundle.catalogs.scopes, 'catalogs.scopes').map((scope, index) =>
      requireString(requireRecord(scope, `catalogs.scopes[${index}]`).key, `scope[${index}].key`)
    )
  );
  const riskPolicyIds = new Set(
    requireArray(bundle.riskPolicies, 'riskPolicies').flatMap((policy, index) =>
      requireArray(
        requireRecord(policy, `riskPolicies[${index}]`).policyIds,
        `riskPolicies[${index}].policyIds`
      ).map((policyId, policyIndex) =>
        requireString(policyId, `riskPolicies[${index}].policyIds[${policyIndex}]`)
      )
    )
  );
  const counts = Object.fromEntries(
    Object.keys(EXPECTED_STEP_UP_CHALLENGES).map((key) => [key, 0])
  );
  const verification = bundle.stepUpVerification;
  const fixedClock = epochSeconds(bundle.fixedClock, 'fixedClock');
  for (const [index, rawChallenge] of challenges.entries()) {
    const challenge = requireRecord(rawChallenge, `catalogs.stepUpChallenges[${index}]`);
    const targetSourceField =
      challenge.targetIdSource === 'PATH_PARAMETER'
        ? 'targetIdPathParameter'
        : challenge.targetIdSource === 'COMMAND_BODY'
          ? 'targetIdBodyFields'
          : undefined;
    const expectedChallengeFields = [
      ...STEP_UP_CHALLENGE_BASE_FIELDS,
      ...(targetSourceField ? [targetSourceField] : []),
    ].sort();
    if (JSON.stringify(Object.keys(challenge).sort()) !== JSON.stringify(expectedChallengeFields)) {
      fail(`${challenge.key ?? index} step-up challenge field set is not exact`);
    }
    requireString(challenge.key, `catalogs.stepUpChallenges[${index}].key`);
    if (
      challenge.contextKey !== STEP_UP_CONTEXT_KEYS[challenge.key] ||
      !scopeKeys.has(challenge.scopeRef) ||
      !riskPolicyIds.has(challenge.policy)
    ) {
      fail(`${challenge.key} context, scope, or risk policy is outside the canonical fixture`);
    }
    const payload = requireRecord(challenge.payload, `${challenge.key}.payload`);
    if (
      !Number.isInteger(challenge.actorUserId) ||
      challenge.actorUserId <= 0 ||
      !Number.isInteger(challenge.tenantId) ||
      challenge.tenantId <= 0 ||
      !Number.isInteger(challenge.targetVersion) ||
      challenge.targetVersion < 0
    ) {
      fail(`${challenge.key} actor, tenant, or targetVersion is invalid`);
    }
    if (
      !['POST', 'PUT', 'PATCH', 'DELETE'].includes(challenge.method) ||
      !requireString(challenge.path, `${challenge.key}.path`).startsWith('/api/') ||
      !['ACTIVE', 'CONSUMED'].includes(challenge.state) ||
      JSON.stringify(challenge.amr) !== JSON.stringify(['mfa'])
    ) {
      fail(`${challenge.key} command, state, or assurance method is invalid`);
    }
    const authenticatedAt = epochSeconds(
      challenge.authenticatedAt,
      `${challenge.key}.authenticatedAt`
    );
    const issuedAt = epochSeconds(challenge.issuedAt, `${challenge.key}.issuedAt`);
    const expiresAt = epochSeconds(challenge.expiresAt, `${challenge.key}.expiresAt`);
    if (
      authenticatedAt > issuedAt ||
      issuedAt > fixedClock ||
      fixedClock >= expiresAt ||
      expiresAt - issuedAt > 900 ||
      fixedClock - authenticatedAt > 600
    ) {
      fail(`${challenge.key} assurance window is invalid`);
    }
    const owner = requireString(challenge.ownerServiceKey, `${challenge.key}.ownerServiceKey`);
    const expectedVersion = owner === 'approval' ? 2 : owner === 'people' ? 3 : undefined;
    if (!expectedVersion) fail(`${challenge.key} has unsupported ownerServiceKey ${owner}`);
    counts[owner] += 1;
    const canonical = validateRequiredRegistryRef(
      challenge.requiredRegistryRef,
      `${challenge.key}.requiredRegistryRef`,
      registryVersions
    );
    if (challenge.requiredRegistryRef.version !== expectedVersion) {
      fail(`${challenge.key} must bind ${owner} to registry v${expectedVersion}`);
    }
    const capabilityKey = requireString(
      challenge.capabilityContractKey,
      `${challenge.key}.capabilityContractKey`
    );
    if (
      !canonical.bundle.capabilities.some((capability) => capability.contractKey === capabilityKey)
    ) {
      fail(`${challenge.key} references an unknown v${expectedVersion} capability`);
    }
    const commandContractKey = requireString(
      challenge.commandContractKey,
      `${challenge.key}.commandContractKey`
    );
    const route = canonical.bundle.routes.find(
      (candidate) => candidate.routeContractKey === commandContractKey
    );
    if (!route || route.routeKind !== 'ACTION') {
      fail(`${challenge.key} references an unknown v${expectedVersion} ACTION route`);
    }
    if (
      !requireArray(route.accessProfiles, `${challenge.key} ACTION accessProfiles`).some(
        (profile) => profile.requiredAccess?.capabilityContractKey === capabilityKey
      )
    ) {
      fail(`${challenge.key} capability differs from its ACTION route access profile`);
    }
    const method = requireString(challenge.method, `${challenge.key}.method`);
    const commandPath = requireString(challenge.path, `${challenge.key}.path`);
    const gatewayBinding = requireArray(
      route.gatewayApiBindings,
      `${challenge.key} ACTION gatewayApiBindings`
    ).find(
      (binding) => binding.method === method && pathMatchesTemplate(binding.path, commandPath)
    );
    if (!gatewayBinding) {
      fail(`${challenge.key} method/path differs from its public ACTION binding`);
    }
    const stepUpBindings = requireArray(
      route.stepUpCommandBindings,
      `${challenge.key} ACTION stepUpCommandBindings`
    ).filter((binding) => binding.bindingKey === gatewayBinding.bindingKey);
    if (stepUpBindings.length !== 1) {
      fail(`${challenge.key} must resolve exactly one step-up command binding`);
    }
    const stepUpBinding = stepUpBindings[0];
    const hasPathTarget = Object.hasOwn(stepUpBinding, 'targetIdPathParameter');
    const hasBodyTarget = Object.hasOwn(stepUpBinding, 'targetIdBodyFields');
    const expectedStepUpBindingFields = [
      'audience',
      'bindingKey',
      'expectedObjectVersionName',
      'expectedObjectVersionSource',
      'ownerServiceKey',
      'targetType',
      hasPathTarget ? 'targetIdPathParameter' : 'targetIdBodyFields',
    ].sort();
    if (
      hasPathTarget === hasBodyTarget ||
      JSON.stringify(Object.keys(stepUpBinding).sort()) !==
        JSON.stringify(expectedStepUpBindingFields)
    ) {
      fail(`${challenge.key} step-up target binding must be an exact exclusive union`);
    }
    const serviceBindings = requireArray(
      route.servicePepBindings,
      `${challenge.key} ACTION servicePepBindings`
    ).filter((binding) => binding.bindingKey === gatewayBinding.bindingKey);
    if (
      serviceBindings.length !== 1 ||
      serviceBindings[0].serviceKey !== owner ||
      serviceBindings[0].method !== method ||
      JSON.stringify(templateParameterNames(serviceBindings[0].path)) !==
        JSON.stringify(templateParameterNames(gatewayBinding.path))
    ) {
      fail(`${challenge.key} must resolve one paired owner service binding`);
    }
    if (
      challenge.stepUpCommandBindingKey !== gatewayBinding.bindingKey ||
      stepUpBinding.bindingKey !== challenge.stepUpCommandBindingKey ||
      stepUpBinding.ownerServiceKey !== owner ||
      stepUpBinding.audience !== challenge.audience ||
      stepUpBinding.targetType !== challenge.targetType ||
      stepUpBinding.expectedObjectVersionSource !== challenge.expectedObjectVersionSource ||
      stepUpBinding.expectedObjectVersionName !== challenge.expectedObjectVersionName
    ) {
      fail(`${challenge.key} metadata differs from its step-up command binding`);
    }
    if (hasPathTarget) {
      if (
        typeof stepUpBinding.targetIdPathParameter !== 'string' ||
        stepUpBinding.targetIdPathParameter.length === 0 ||
        challenge.targetIdSource !== 'PATH_PARAMETER' ||
        challenge.targetIdPathParameter !== stepUpBinding.targetIdPathParameter
      ) {
        fail(`${challenge.key} targetId path metadata differs from its step-up binding`);
      }
      const pathValues = pathParameterValues(gatewayBinding.path, commandPath);
      if (pathValues?.[stepUpBinding.targetIdPathParameter] !== challenge.targetId) {
        fail(`${challenge.key} targetId differs from its step-up path binding`);
      }
    } else {
      const bodyFields = stepUpBinding.targetIdBodyFields;
      if (
        !Array.isArray(bodyFields) ||
        bodyFields.length === 0 ||
        new Set(bodyFields).size !== bodyFields.length ||
        challenge.targetIdSource !== 'COMMAND_BODY' ||
        JSON.stringify(challenge.targetIdBodyFields) !== JSON.stringify(bodyFields) ||
        bodyFields.some(
          (field) =>
            typeof payload[field] !== 'string' ||
            payload[field].length === 0 ||
            /[:\r\n]/u.test(payload[field])
        ) ||
        bodyFields.map((field) => payload[field]).join(':') !== challenge.targetId
      ) {
        fail(`${challenge.key} targetId differs from its step-up command body binding`);
      }
    }
    if (stepUpBinding.expectedObjectVersionSource === 'COMMAND_BODY') {
      const boundVersion = payload[stepUpBinding.expectedObjectVersionName];
      if (!Number.isInteger(boundVersion) || boundVersion !== challenge.targetVersion) {
        fail(`${challenge.key} targetVersion differs from its command body binding`);
      }
    } else if (stepUpBinding.expectedObjectVersionSource === 'COMMAND_HEADER') {
      const leakedVersionFields = Object.keys(payload).filter((field) => {
        const normalized = field.toLowerCase().replaceAll(/[^a-z0-9]/gu, '');
        return (
          normalized.includes('expectedversion') || normalized.includes('expectedobjectversion')
        );
      });
      if (
        Object.hasOwn(payload, stepUpBinding.expectedObjectVersionName) ||
        leakedVersionFields.length > 0
      ) {
        fail(`${challenge.key} command-header payload leaks an object version`);
      }
    } else {
      fail(`${challenge.key} has an unsupported expected object version source`);
    }
    decodeAndVerifyStepUpToken(challenge, verification);
  }
  for (const [owner, expectedCount] of Object.entries(EXPECTED_STEP_UP_CHALLENGES)) {
    if (counts[owner] !== expectedCount) {
      fail(`step-up challenges for ${owner} expected ${expectedCount}, found ${counts[owner]}`);
    }
  }
}

function validateCases(bundle, knownReferences, registryVersions) {
  const testCases = requireArray(bundle.testCases, 'testCases');
  const negativeCases = requireArray(bundle.negativeCases, 'negativeCases');
  const contextCases = requireArray(bundle.contextCases, 'contextCases');
  if (testCases.length !== 71) fail(`testCases must contain 71 cases, found ${testCases.length}`);
  if (negativeCases.length !== 46) {
    fail(`negativeCases must contain 46 cases, found ${negativeCases.length}`);
  }
  const testIds = testCases.map((testCase, index) =>
    requireString(
      requireRecord(testCase, `testCases[${index}]`).testId,
      `testCases[${index}].testId`
    )
  );
  testCases.forEach((testCase, index) =>
    requireString(testCase.fixtureId, `testCases[${index}].fixtureId`)
  );
  requireUnique(testIds, 'test ID');
  requireUnique(
    negativeCases.map((testCase, index) =>
      requireString(
        requireRecord(testCase, `negativeCases[${index}]`).fixtureId,
        `negativeCases[${index}].fixtureId`
      )
    ),
    'negative fixture ID'
  );

  const groupCounts = Object.fromEntries(Object.keys(EXPECTED_GROUP_COUNTS).map((key) => [key, 0]));
  for (const testCase of testCases) {
    if (!(testCase.group in groupCounts)) fail(`unknown test group ${String(testCase.group)}`);
    groupCounts[testCase.group] += 1;
    const requiredRegistryRef = requireRecord(
      testCase.requiredRegistryRef,
      `${testCase.testId}.requiredRegistryRef`
    );
    validateRequiredRegistryRef(
      requiredRegistryRef,
      `${testCase.testId}.requiredRegistryRef`,
      registryVersions
    );
    const requiredWaveVersion = { CANARY: 1, APPROVALS: 2, HCM: 3 }[testCase.group];
    if (requiredWaveVersion && requiredRegistryRef.version !== requiredWaveVersion) {
      fail(`${testCase.testId} must bind to registry v${requiredWaveVersion}`);
    }
    for (const reference of requireArray(testCase.composition, `${testCase.testId}.composition`)) {
      if (!knownReferences.has(reference) && !String(reference).startsWith('CASE:')) {
        fail(`${testCase.testId} references unknown source key ${String(reference)}`);
      }
    }
  }
  for (const [group, expectedCount] of Object.entries(EXPECTED_GROUP_COUNTS)) {
    if (groupCounts[group] !== expectedCount) {
      fail(`${group} must contain ${expectedCount} cases, found ${groupCounts[group]}`);
    }
  }

  const contextIds = new Set(contextCases.map((testCase) => testCase.fixtureId));
  if (
    contextIds.size !== EXPECTED_CONTEXT_CASES.size ||
    [...EXPECTED_CONTEXT_CASES].some((fixtureId) => !contextIds.has(fixtureId))
  ) {
    fail('context fixture IDs do not match the canonical three-case contract');
  }
}

function validateFixtureBundle(value, authorizationRegistry) {
  const bundle = requireRecord(value, 'fixture bundle');
  if (JSON.stringify(Object.keys(bundle).sort()) !== JSON.stringify(FIXTURE_BUNDLE_FIELDS)) {
    fail('fixture bundle field set is not exact');
  }
  if (bundle.schemaVersion !== 1) fail('schemaVersion must be 1');
  if (bundle.fixtureBundleKey !== 'pilot-fixtures.v1') {
    fail('fixtureBundleKey must be pilot-fixtures.v1');
  }
  if (Number.isNaN(Date.parse(requireString(bundle.fixedClock, 'fixedClock')))) {
    fail('fixedClock must be an ISO date-time');
  }
  const registryVersions = validateRegistryLineage(bundle, authorizationRegistry);
  if (bundle.fixtureChecksumAlgorithm !== 'SHA-256') {
    fail('fixtureChecksumAlgorithm must be SHA-256');
  }
  if (!SHA_256.test(bundle.fixtureChecksum)) fail('fixtureChecksum must be a SHA-256');

  validateStepUpVerification(bundle);

  const reserved = new Set(requireArray(bundle.reservedContracts, 'reservedContracts'));
  if (
    reserved.size !== EXPECTED_RESERVED_CONTRACTS.size ||
    [...EXPECTED_RESERVED_CONTRACTS].some((key) => !reserved.has(key))
  ) {
    fail('reserved contracts do not match the approved negative-only contract');
  }

  const catalogKeys = validateCatalogs(bundle);
  validateStepUpChallenges(bundle, registryVersions);
  validateCases(bundle, validateComponents(bundle, catalogKeys), registryVersions);
  requireArray(bundle.riskPolicies, 'riskPolicies');

  const checksumInput = structuredClone(bundle);
  delete checksumInput.fixtureChecksum;
  const expectedChecksum = sha256(checksumInput);
  if (bundle.fixtureChecksum !== expectedChecksum) {
    fail(`fixtureChecksum mismatch: expected ${expectedChecksum}, found ${bundle.fixtureChecksum}`);
  }
  return bundle;
}

async function generatedTypescript(bundle) {
  const literal = JSON.stringify(bundle, null, 2);
  const registryVersionType = EXPECTED_REGISTRY_VERSIONS.join(' | ');
  const latestRegistryVersion = EXPECTED_REGISTRY_VERSIONS.at(-1);
  const source = `/** @generated from architecture/pilot-fixtures.v1.generated.json. Do not edit manually. */

export type PilotFixtureOpenRecord = Readonly<{ key: string } & Record<string, unknown>>;

export type PilotAuthorizationComponent = Readonly<{
  key: string;
  kind: 'ENTITLEMENT' | 'CAPABILITY' | 'POLICY' | 'RELATIONSHIP' | 'SUPPORT' | 'COMPOSITE';
  appEntitlements?: readonly string[];
  capabilityContractKeys?: readonly string[];
  accessPolicyKeys?: readonly string[];
  scopeRefs?: readonly string[];
  relationshipRefs?: readonly string[];
  supportSessionRef?: string;
  responsibility?: Readonly<Record<string, unknown>> | null;
  responsibilityRequirement?: 'REQUIRED' | 'NOT_REQUIRED';
  authorityMode?: string;
  accessMode?: 'NORMAL' | 'PROVIDER_SUPPORT';
  readOnly?: boolean;
  validUntil?: string;
  evidenceRefs?: readonly string[];
  explicitDenies?: readonly Readonly<Record<string, unknown>>[];
  notes?: string;
}>;

export type PilotAuthorizationTestCase = Readonly<{
  testId: string;
  fixtureId: string;
  group: 'GUARD' | 'CANARY' | 'APPROVALS' | 'HCM';
  composition: readonly string[];
  expected: string;
  requiredRegistryRef: Readonly<{
    bundleKey: 'product-surfaces';
    version: ${registryVersionType};
    sha256: string;
  }>;
  activeAccessMode?: 'NORMAL' | 'PROVIDER_SUPPORT';
  testRegistryOverrideRef?: string | null;
  delta?: Readonly<Record<string, unknown>>;
}>;

export type PilotAuthorizationNegativeCase = Readonly<{
  fixtureId: string;
  input: string;
  expected: string;
}>;

export type PilotAuthorizationContextCase = Readonly<{
  fixtureId: string;
  composition?: readonly string[];
  expected: string;
}>;

export type PilotAuthorizationFixtureBundle = Readonly<{
  schemaVersion: 1;
  fixtureBundleKey: 'pilot-fixtures.v1';
  fixedClock: string;
  normalValidUntil?: string;
  stepUpVerification: Readonly<{
    algorithm: 'RS256';
    keyId: string;
    issuer: string;
    audienceByOwnerService: Readonly<{
      approval: 'dwp-approval-server';
      people: 'dwp-people-server';
    }>;
    requiredAcr: string;
    publicKeyPem: string;
  }>;
  registryLineage: Readonly<{
    authority: 'INFORMATIONAL_ONLY';
    bundleKey: 'product-surfaces';
    indexSha256: string;
    latestAliasVersion: ${latestRegistryVersion};
    versions: readonly Readonly<{
      bundleKey: 'product-surfaces';
      version: ${registryVersionType};
      sha256: string;
    }>[];
  }>;
  sourceRevisions?: Readonly<Record<string, string>>;
  catalogs: Readonly<{
    scopes: readonly PilotFixtureOpenRecord[];
    targetPopulations: readonly PilotFixtureOpenRecord[];
    objects: readonly PilotFixtureOpenRecord[];
    payloads: readonly PilotFixtureOpenRecord[];
    relationships: readonly PilotFixtureOpenRecord[];
    supportSessions: readonly PilotFixtureOpenRecord[];
    stepUpChallenges: readonly PilotFixtureOpenRecord[];
  }>;
  components: readonly PilotAuthorizationComponent[];
  testCases: readonly PilotAuthorizationTestCase[];
  negativeCases: readonly PilotAuthorizationNegativeCase[];
  contextCases: readonly PilotAuthorizationContextCase[];
  riskPolicies: readonly PilotFixtureOpenRecord[];
  reservedContracts: readonly string[];
  fixtureChecksumAlgorithm: 'SHA-256';
  fixtureChecksum: string;
}>;

export const PILOT_AUTHORIZATION_FIXTURES = ${literal} as const satisfies PilotAuthorizationFixtureBundle;

export const PILOT_AUTHORIZATION_FIXTURE_CHECKSUM =
  PILOT_AUTHORIZATION_FIXTURES.fixtureChecksum;
`;
  const formatOptions = (await prettier.resolveConfig(generatedTarget)) ?? {};
  return prettier.format(source, { ...formatOptions, filepath: generatedTarget });
}

function readBundle(sourcePath, authorizationSource) {
  return validateFixtureBundle(
    readJson(sourcePath, 'fixture artifact'),
    readAuthorizationRegistry(authorizationSource)
  );
}

function parseArguments(argv) {
  const usage = () => {
    console.error(
      'Usage: node scripts/sync-product-authorization-fixtures.mjs --sync <artifact path> [--authorization <snapshot-or-directory>] | --check [official artifact path] [--authorization <snapshot-or-directory>]'
    );
    process.exit(2);
  };
  const mode = argv[0];
  if (!['--sync', '--check'].includes(mode)) usage();
  const rest = argv.slice(1);
  const positional = [];
  let authorizationSource;
  let sawAuthorization = false;
  for (let index = 0; index < rest.length; index += 1) {
    if (rest[index] === '--authorization') {
      if (sawAuthorization || !rest[index + 1] || rest[index + 1].startsWith('--')) usage();
      sawAuthorization = true;
      authorizationSource = rest[index + 1];
      index += 1;
    } else {
      if (rest[index].startsWith('--')) usage();
      positional.push(rest[index]);
    }
  }
  if (positional.length > 1) usage();
  const artifact = positional[0] ?? process.env.DWP_PRODUCT_AUTHORIZATION_FIXTURE;
  authorizationSource ??= process.env.DWP_PRODUCT_AUTHORIZATION_DIR;
  if (mode === '--sync' && artifact) {
    return {
      mode: 'sync',
      artifact: path.resolve(artifact),
      authorizationSource: path.resolve(authorizationSource ?? authorizationSnapshot),
    };
  }
  if (mode === '--check') {
    return {
      mode: 'check',
      officialArtifact: artifact ? path.resolve(artifact) : undefined,
      officialAuthorizationSource: authorizationSource
        ? path.resolve(authorizationSource)
        : undefined,
    };
  }
  usage();
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  if (args.mode === 'sync') {
    const bundle = readBundle(args.artifact, args.authorizationSource);
    fs.mkdirSync(path.dirname(snapshot), { recursive: true });
    fs.writeFileSync(snapshot, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
    fs.mkdirSync(path.dirname(generatedTarget), { recursive: true });
    fs.writeFileSync(generatedTarget, await generatedTypescript(bundle), 'utf8');
    console.log(
      `Synchronized ${bundle.fixtureBundleKey} v1-v${bundle.registryLineage.latestAliasVersion} (${bundle.fixtureChecksum}).`
    );
    return;
  }

  const bundle = readBundle(snapshot, args.officialAuthorizationSource ?? authorizationSnapshot);
  const expectedGenerated = await generatedTypescript(bundle);
  if (!fs.existsSync(generatedTarget)) fail(`generated TypeScript is missing: ${generatedTarget}`);
  if (fs.readFileSync(generatedTarget, 'utf8') !== expectedGenerated) {
    fail('generated TypeScript is stale; run fixtures:sync with an approved backend artifact');
  }
  if (args.officialArtifact) {
    readBundle(args.officialArtifact, args.officialAuthorizationSource ?? authorizationSnapshot);
    if (!fs.readFileSync(snapshot).equals(fs.readFileSync(args.officialArtifact))) {
      fail('frontend fixture snapshot is not byte-identical to the official backend artifact');
    }
  }
  console.log(
    `PASS ${bundle.fixtureBundleKey} snapshot and generated TypeScript (${bundle.fixtureChecksum})` +
      `${args.officialArtifact ? '; official backend artifact matched.' : '.'}`
  );
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
