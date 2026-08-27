import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const schemaUrl = new URL('./widget-tenant-policy-seeds.v1.schema.json', import.meta.url);
const fixtureUrl = new URL('./widget-tenant-policy-seeds.v1.golden.json', import.meta.url);
const manifestFixtureUrl = new URL('./widget-manifests.v1.golden.json', import.meta.url);
const schemaSource = readFileSync(schemaUrl, 'utf8');
const fixtureSource = readFileSync(fixtureUrl, 'utf8');

const anchors = Object.freeze({
  schemaFile: 'c81d98415c948149c972dc7caf2542f2a9867c2d835515322af91f323b571c2d',
  fixtureFile: 'f38b177a82ca976ca7352b3827315b9ce9b05fc4c1d6fd758dbbdd0c6e83ea08',
  baselineDigest: 'cd91459ee7ae40e1ec4082b5d66bc848b9cbe59d57bae7b3f7f3d3dcc5e8c92b',
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalize(value, path = '$') {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    if (typeof value === 'string') assert(value === value.normalize('NFC'), `${path} is not NFC.`);
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    assert(
      Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0),
      `${path} is not a safe integer.`
    );
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item, index) => canonicalize(item, `${path}[${index}]`)).join(',')}]`;
  }
  assert(value && typeof value === 'object', `${path} is not JSON.`);
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key], `${path}.${key}`)}`)
    .join(',')}}`;
}

function assertExactKeys(value, expected, path) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  assert(
    actual.length === wanted.length && actual.every((key, index) => key === wanted[index]),
    `${path} keys must be exactly ${wanted.join(', ')}; received ${actual.join(', ')}.`
  );
}

assert(sha256(schemaSource) === anchors.schemaFile, 'Tenant seed schema bytes changed.');
assert(sha256(fixtureSource) === anchors.fixtureFile, 'Tenant seed fixture bytes changed.');

const schema = JSON.parse(schemaSource);
const fixture = JSON.parse(fixtureSource);
const manifestFixture = JSON.parse(readFileSync(manifestFixtureUrl, 'utf8'));
assert(
  schema.$id.endsWith('/widget-tenant-policy-seeds.v1.schema.json'),
  'Unexpected tenant seed schema ID.'
);
assertExactKeys(fixture, ['fixtureVersion', 'expectedBaselineDigest', 'baseline'], '$fixture');
assert(fixture.fixtureVersion === 1, 'Tenant fixture version must be 1.');

const baseline = fixture.baseline;
assertExactKeys(
  baseline,
  ['schemaVersion', 'baselineGeneration', 'actorPlane', 'surfaceKey', 'policies'],
  '$baseline'
);
assert(
  baseline.schemaVersion === 1 && baseline.baselineGeneration === 1,
  'Unexpected baseline version.'
);
assert(baseline.actorPlane === 'SYSTEM_MIGRATION', 'Seed actor must be SYSTEM_MIGRATION.');
assert(baseline.surfaceKey === 'workspace-home', 'Only workspace-home can be seeded.');
assert(baseline.policies.length === 5, 'Exactly five explicit tenant policies are required.');

const expectedPolicyKeys = [
  'audienceSelector',
  'definitionKey',
  'enabled',
  'legacyWidgetKey',
  'lockedConfiguration',
  'manifestHash',
  'predecessorRevision',
  'reasonCode',
  'required',
  'revision',
  'selector',
  'sharingPolicy',
  'state',
  'supportedSurfaceKeys',
];
const manifestByLegacyKey = new Map(
  manifestFixture.fixtures.map((entry) => [
    entry.legacyWidgetKey,
    { definitionKey: entry.manifest.definitionKey, manifestHash: entry.expectedSha256 },
  ])
);
const actualLegacyKeys = [];
for (const [index, policy] of baseline.policies.entries()) {
  const path = `$baseline.policies[${index}]`;
  assertExactKeys(policy, expectedPolicyKeys, path);
  const manifest = manifestByLegacyKey.get(policy.legacyWidgetKey);
  assert(manifest, `${path}: legacy key is not one of the five manifest seeds.`);
  assert(
    policy.definitionKey === manifest.definitionKey,
    `${path}: definition key does not match Manifest Golden.`
  );
  assert(
    policy.manifestHash === manifest.manifestHash,
    `${path}: manifest hash does not match Manifest Golden.`
  );
  assert(
    policy.state === 'PUBLISHED' && policy.revision === 1,
    `${path}: seed must be Published revision 1.`
  );
  assert(
    policy.predecessorRevision === null && policy.enabled === true,
    `${path}: invalid baseline head state.`
  );
  assertExactKeys(policy.selector, ['kind', 'channel', 'versionId'], `${path}.selector`);
  assert(
    policy.selector.kind === 'CHANNEL' &&
      policy.selector.channel === 'STABLE' &&
      policy.selector.versionId === null,
    `${path}: selector must resolve the Stable channel.`
  );
  assert(
    JSON.stringify(policy.supportedSurfaceKeys) === JSON.stringify(['workspace-home']),
    `${path}: surface must be workspace-home only.`
  );
  assertExactKeys(
    policy.audienceSelector,
    ['schemaVersion', 'mode', 'roleCodes', 'groupRefs'],
    `${path}.audienceSelector`
  );
  assert(
    policy.audienceSelector.schemaVersion === 1 &&
      policy.audienceSelector.mode === 'ALL_ENTITLED' &&
      policy.audienceSelector.roleCodes.length === 0 &&
      policy.audienceSelector.groupRefs.length === 0,
    `${path}: seed audience must be ALL_ENTITLED without embedded authority data.`
  );
  assert(policy.required === false, `${path}: migration must not create a newly required widget.`);
  assert(
    policy.lockedConfiguration.length === 0,
    `${path}: migration must not lock user configuration.`
  );
  assert(
    policy.sharingPolicy === 'PRIVATE_ONLY',
    `${path}: migration must preserve private-only sharing.`
  );
  assert(policy.reasonCode === 'LEGACY_BASELINE', `${path}: invalid migration provenance.`);
  actualLegacyKeys.push(policy.legacyWidgetKey);
}

const expectedLegacyKeys = [...manifestByLegacyKey.keys()].sort();
assert(
  JSON.stringify(actualLegacyKeys) === JSON.stringify([...actualLegacyKeys].sort()),
  'Tenant policies must be sorted by legacyWidgetKey.'
);
assert(
  JSON.stringify(actualLegacyKeys) === JSON.stringify(expectedLegacyKeys),
  'Tenant policies must cover the five Manifest Golden entries exactly once.'
);

const actualDigest = sha256(Buffer.from(canonicalize(baseline), 'utf8'));
assert(actualDigest === anchors.baselineDigest, 'Independent tenant baseline digest changed.');
assert(fixture.expectedBaselineDigest === actualDigest, 'Fixture tenant baseline digest mismatch.');

const policySchema = schema.$defs.policy;
assert(policySchema.additionalProperties === false, 'Policy schema must reject unknown fields.');
assert(
  policySchema.properties.selector.additionalProperties === false,
  'Selector schema must be closed.'
);
assert(
  policySchema.properties.audienceSelector.additionalProperties === false,
  'Audience schema must be closed.'
);
assert(
  JSON.stringify([...policySchema.properties.legacyWidgetKey.enum].sort()) ===
    JSON.stringify(expectedLegacyKeys),
  'Tenant schema legacy key allowlist does not match Manifest Golden.'
);

process.stdout.write(`tenantPolicyBaselineRevision ${actualDigest}\n`);
process.stdout.write(`tenantPolicySeeds ${actualLegacyKeys.length}\n`);
process.stdout.write('tenant-policy-seeds ok\n');
