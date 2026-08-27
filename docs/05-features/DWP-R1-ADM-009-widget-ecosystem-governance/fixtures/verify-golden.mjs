import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const fixtureUrl = new URL('./widget-manifests.v1.golden.json', import.meta.url);
const fixtureSource = readFileSync(fixtureUrl, 'utf8');
const expectedFixtureFileSha256 =
  '612d9c7037040ae55da8a7ee9ae850400b54724914bf3085b33cd0e67f5c6139';
const expectedDefinitions = Object.freeze({
  activity: Object.freeze({
    definitionKey: 'core.activity.activity',
    sha256: 'fbab61015ec3b20c2faf9810b1758aebbd7517029baa64cb6b99190815836ca1',
  }),
  'command-rail': Object.freeze({
    definitionKey: 'core.workspace.command-rail',
    sha256: 'a3a1fd5ffff9d7f6014ec3007a16ebea10dbf8ce3ae19e02fd2bd001fee0eb97',
  }),
  'daily-brief': Object.freeze({
    definitionKey: 'core.workspace.daily-brief',
    sha256: '9b7f48b7ea4ef429120db330a4972c3315ad682759fa86e49c212c42bdd02406',
  }),
  focus: Object.freeze({
    definitionKey: 'core.work.focus',
    sha256: '36d1b02326e4725a235749e173dfdf50a0423ef30f42d7ccab97946ba826d893',
  }),
  schedule: Object.freeze({
    definitionKey: 'core.calendar.schedule',
    sha256: '7f3e090997a213e9d3e6f8184e1458e57382c5f31db79f00fbf678d36f884f5d',
  }),
});
const expectedLegacyKeys = Object.keys(expectedDefinitions).sort();

const actualFixtureFileSha256 = createHash('sha256').update(fixtureSource).digest('hex');
if (actualFixtureFileSha256 !== expectedFixtureFileSha256) {
  throw new Error(
    `Golden fixture bytes changed: expected ${expectedFixtureFileSha256}, received ${actualFixtureFileSha256}.`
  );
}

const fixtureSet = JSON.parse(fixtureSource);

const actualLegacyKeys = fixtureSet.fixtures.map((fixture) => fixture.legacyWidgetKey).sort();
if (
  actualLegacyKeys.length !== expectedLegacyKeys.length ||
  new Set(actualLegacyKeys).size !== expectedLegacyKeys.length ||
  actualLegacyKeys.some((key, index) => key !== expectedLegacyKeys[index])
) {
  throw new Error(
    `Expected exactly ${expectedLegacyKeys.join(', ')}, received ${actualLegacyKeys.join(', ')}.`
  );
}

function canonicalize(value, path = '$') {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') {
    if (value !== value.normalize('NFC')) throw new Error(`${path} is not NFC.`);
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
      throw new Error(`${path} must be a non-negative safe integer and cannot be negative zero.`);
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item, index) => canonicalize(item, `${path}[${index}]`)).join(',')}]`;
  }
  if (!value || typeof value !== 'object') throw new Error(`${path} is not valid JSON.`);

  const keys = Object.keys(value);
  keys.forEach((key) => {
    if (key !== key.normalize('NFC')) throw new Error(`${path}.${key} key is not NFC.`);
  });
  return `{${keys
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key], `${path}.${key}`)}`)
    .join(',')}}`;
}

for (const fixture of fixtureSet.fixtures) {
  const expected = expectedDefinitions[fixture.legacyWidgetKey];
  if (fixture.manifest.definitionKey !== expected.definitionKey) {
    throw new Error(
      `${fixture.legacyWidgetKey}: expected definitionKey ${expected.definitionKey}, received ${fixture.manifest.definitionKey}.`
    );
  }
  if (fixture.expectedSha256 !== expected.sha256) {
    throw new Error(
      `${fixture.legacyWidgetKey}: fixture digest does not match the independent golden anchor.`
    );
  }
  const canonical = canonicalize(fixture.manifest);
  const actual = createHash('sha256').update(Buffer.from(canonical, 'utf8')).digest('hex');
  if (actual !== expected.sha256) {
    throw new Error(`${fixture.legacyWidgetKey}: expected ${expected.sha256}, received ${actual}`);
  }
  process.stdout.write(`${fixture.legacyWidgetKey} ${actual}\n`);
}

// Keep the hash anchor and the executable ManifestV1 schema/negative contract in one release gate.
await import('./verify-manifest-contract.mjs');
await import('./verify-tenant-policy-seeds.mjs');
await import('./verify-bootstrap-prerequisite-contract.mjs');
await import('./verify-registry-event-contract.mjs');
await import('./verify-tenant-impact-contract.mjs');
await import('./verify-revision-authority-contract.mjs');
await import('./verify-registry-command-contract.mjs');
await import('./verify-command-completion-contract.mjs');
await import('./verify-binding-catalog.mjs');
await import('./verify-rollout-evidence-contract.mjs');
await import('./verify-rollout-operation-contract.mjs');
