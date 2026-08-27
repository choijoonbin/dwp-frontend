import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const fixtureUrl = new URL('./widget-binding-catalog.v1.golden.json', import.meta.url);
const schemaUrl = new URL('./widget-binding-catalog.v1.schema.json', import.meta.url);
const manifestUrl = new URL('./widget-manifests.v1.golden.json', import.meta.url);
const fixtureSource = readFileSync(fixtureUrl, 'utf8');
const schemaSource = readFileSync(schemaUrl, 'utf8');

const anchors = Object.freeze({
  fixtureFile: '7c8d38e25ef876667933c57bb6ee9450772a93350a0cc4d0edf9fdda1732cc2f',
  schemaFile: 'a1ab65e06abefa54e453f3f262b6e756fe4a189cdf86981d889871acbd20ebd2',
  catalogRevisionId: '4d5f2dc393e62275cf465b5bc347f3205222b163dff92ab9ae5ec563ab97f703',
  productAppRevision: 'b59dce21b863448fdbe253086ac69d0c60da318bdc816e95990abce5ccbd7fa7',
  rendererRevision: '6a51005a5fa1ac0949c5f6a4c82a08a420f1b20b533111ad4b4a6f969c7dbe30',
  capabilityRevision: '9e8c345623f2dce1a1771cc76872bf4ed534a157f4b2f4a538697e0011c3c5ba',
});

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertKeys(value, expected, path) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${path} must be an object.`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  assert(
    actual.length === wanted.length && actual.every((key, index) => key === wanted[index]),
    `${path} keys must be exactly ${wanted.join(', ')}; received ${actual.join(', ')}.`
  );
}

function canonicalize(value, path = '$') {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') {
    assert(value === value.normalize('NFC'), `${path} must be NFC.`);
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    assert(
      Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0),
      `${path} must be a non-negative safe integer and cannot be negative zero.`
    );
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item, index) => canonicalize(item, `${path}[${index}]`)).join(',')}]`;
  }
  assert(value && typeof value === 'object', `${path} must be JSON.`);
  return `{${Object.keys(value)
    .sort()
    .map((key) => {
      assert(key === key.normalize('NFC'), `${path}.${key} key must be NFC.`);
      return `${JSON.stringify(key)}:${canonicalize(value[key], `${path}.${key}`)}`;
    })
    .join(',')}}`;
}

function digest(value) {
  return sha256(Buffer.from(canonicalize(value), 'utf8'));
}

assert(sha256(fixtureSource) === anchors.fixtureFile, 'Binding fixture bytes changed.');
assert(sha256(schemaSource) === anchors.schemaFile, 'Binding schema bytes changed.');

const fixture = JSON.parse(fixtureSource);
const schema = JSON.parse(schemaSource);
const manifests = JSON.parse(readFileSync(manifestUrl, 'utf8'));

assertKeys(fixture, ['fixtureVersion', 'canonicalization', 'expected', 'catalog'], '$');
assert(fixture.fixtureVersion === 1, '$.fixtureVersion must be 1.');
assertKeys(
  fixture.canonicalization,
  ['algorithm', 'encoding', 'hash', 'hashScope', 'componentHashScope'],
  '$.canonicalization'
);
assert(
  JSON.stringify(fixture.canonicalization) ===
    JSON.stringify({
      algorithm: 'RFC8785-JCS',
      encoding: 'UTF-8',
      hash: 'SHA-256',
      hashScope: 'catalog',
      componentHashScope: 'component-array',
    }),
  'Canonicalization contract changed.'
);
assertKeys(
  fixture.expected,
  ['catalogRevisionId', 'productAppRevision', 'rendererRevision', 'capabilityRevision'],
  '$.expected'
);
assertKeys(
  fixture.catalog,
  ['schemaVersion', 'productApps', 'renderers', 'capabilities'],
  '$.catalog'
);
assert(fixture.catalog.schemaVersion === 1, '$.catalog.schemaVersion must be 1.');
assert(
  schema.$id.endsWith('/widget-binding-catalog.v1.schema.json'),
  'Unexpected schema identity.'
);

const actualDigests = Object.freeze({
  catalogRevisionId: digest(fixture.catalog),
  productAppRevision: digest(fixture.catalog.productApps),
  rendererRevision: digest(fixture.catalog.renderers),
  capabilityRevision: digest(fixture.catalog.capabilities),
});
for (const [key, expected] of Object.entries(actualDigests)) {
  assert(expected === anchors[key], `${key}: independent anchor mismatch.`);
  assert(fixture.expected[key] === expected, `${key}: fixture expected digest mismatch.`);
}

const productPattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const appPattern = /^APP\.[A-Z][A-Z0-9_]*(?:\.[A-Z0-9_]+)*$/;
const authorityPattern = /^APP\.[A-Z][A-Z0-9_.]*:[A-Z][A-Z0-9_]*$/;
const rendererPattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const capabilityPattern = /^[A-Z][A-Z0-9_]*(?:\.[A-Z0-9_]+)*$/;

assert(fixture.catalog.productApps.length === 4, 'Expected exactly four Product/App bindings.');
assert(fixture.catalog.renderers.length === 5, 'Expected exactly five Renderer bindings.');
assert(fixture.catalog.capabilities.length === 9, 'Expected exactly nine Capability bindings.');

const productApps = new Map();
for (const [index, binding] of fixture.catalog.productApps.entries()) {
  const path = `$.catalog.productApps[${index}]`;
  assertKeys(binding, ['productKey', 'sourceAppResourceKey', 'state', 'authorities'], path);
  assert(productPattern.test(binding.productKey), `${path}.productKey is invalid.`);
  assert(appPattern.test(binding.sourceAppResourceKey), `${path}.sourceAppResourceKey is invalid.`);
  assert(binding.state === 'ACTIVE', `${path}.state must be ACTIVE.`);
  assert(binding.authorities.length > 0, `${path}.authorities must not be empty.`);
  assert(
    binding.authorities.every((authority) => authorityPattern.test(authority)),
    `${path}.authorities contains an invalid value.`
  );
  const key = `${binding.productKey}\n${binding.sourceAppResourceKey}`;
  assert(!productApps.has(key), `${path} duplicates Product/App binding ${key}.`);
  productApps.set(key, binding);
}
const productOrder = fixture.catalog.productApps.map(
  (binding) => `${binding.productKey}\n${binding.sourceAppResourceKey}`
);
assert(
  productOrder.every((value, index) => index === 0 || productOrder[index - 1] < value),
  'Product/App bindings must be strictly tuple-sorted.'
);

const renderers = new Map();
for (const [index, binding] of fixture.catalog.renderers.entries()) {
  const path = `$.catalog.renderers[${index}]`;
  assertKeys(
    binding,
    [
      'rendererKey',
      'kind',
      'ownerProductKey',
      'sourceAppResourceKey',
      'minimumHostApiVersion',
      'maximumHostApiVersion',
      'state',
    ],
    path
  );
  assert(rendererPattern.test(binding.rendererKey), `${path}.rendererKey is invalid.`);
  assert(binding.kind === 'NATIVE' && binding.state === 'ACTIVE', `${path} must be active NATIVE.`);
  assert(
    binding.minimumHostApiVersion === 1 && binding.maximumHostApiVersion === 1,
    `${path} Host API range must be 1..1.`
  );
  const ownerKey = `${binding.ownerProductKey}\n${binding.sourceAppResourceKey}`;
  assert(productApps.has(ownerKey), `${path} references an unknown Product/App binding.`);
  assert(!renderers.has(binding.rendererKey), `${path} duplicates rendererKey.`);
  renderers.set(binding.rendererKey, binding);
}
assert(
  fixture.catalog.renderers.every(
    (binding, index, values) => index === 0 || values[index - 1].rendererKey < binding.rendererKey
  ),
  'Renderer bindings must be strictly rendererKey-sorted.'
);

const capabilities = new Set();
const capabilityOrder = [];
for (const [index, binding] of fixture.catalog.capabilities.entries()) {
  const path = `$.catalog.capabilities[${index}]`;
  assertKeys(
    binding,
    ['productKey', 'sourceAppResourceKey', 'capabilityType', 'capabilityKey'],
    path
  );
  const ownerKey = `${binding.productKey}\n${binding.sourceAppResourceKey}`;
  assert(productApps.has(ownerKey), `${path} references an unknown Product/App binding.`);
  assert(
    ['SOURCE', 'DATA', 'ACTION'].includes(binding.capabilityType),
    `${path}.capabilityType is invalid.`
  );
  assert(capabilityPattern.test(binding.capabilityKey), `${path}.capabilityKey is invalid.`);
  const key = `${ownerKey}\n${binding.capabilityType}\n${binding.capabilityKey}`;
  assert(!capabilities.has(key), `${path} duplicates a Capability binding.`);
  capabilities.add(key);
  capabilityOrder.push(key);
}
assert(
  capabilityOrder.every((value, index) => index === 0 || capabilityOrder[index - 1] < value),
  'Capability bindings must be strictly tuple-sorted.'
);

assert(manifests.fixtures.length === 5, 'Expected exactly five Manifest fixtures.');
for (const fixtureManifest of manifests.fixtures) {
  const manifest = fixtureManifest.manifest;
  const ownerKey = `${manifest.owner.productKey}\n${manifest.owner.sourceAppResourceKey}`;
  const productApp = productApps.get(ownerKey);
  assert(productApp, `${fixtureManifest.legacyWidgetKey}: Product/App binding is missing.`);
  assert(
    manifest.requiredAuthorities.every((authority) => productApp.authorities.includes(authority)),
    `${fixtureManifest.legacyWidgetKey}: Authority binding is missing.`
  );
  const renderer = renderers.get(manifest.renderer.rendererKey);
  assert(
    renderer &&
      renderer.ownerProductKey === manifest.owner.productKey &&
      renderer.sourceAppResourceKey === manifest.owner.sourceAppResourceKey &&
      renderer.kind === manifest.renderer.kind &&
      manifest.renderer.minimumHostApiVersion >= renderer.minimumHostApiVersion &&
      manifest.renderer.minimumHostApiVersion <= renderer.maximumHostApiVersion,
    `${fixtureManifest.legacyWidgetKey}: Renderer binding is invalid.`
  );
  const requiredCapabilities = [
    ...(manifest.configurationContract
      ? [['SOURCE', manifest.configurationContract.sourceKey]]
      : []),
    ...manifest.dataCapabilities.map((key) => ['DATA', key]),
    ...manifest.actionCapabilities.map((key) => ['ACTION', key]),
  ];
  for (const [type, key] of requiredCapabilities) {
    assert(
      capabilities.has(`${ownerKey}\n${type}\n${key}`),
      `${fixtureManifest.legacyWidgetKey}: ${type} capability ${key} is missing.`
    );
  }
  process.stdout.write(`${fixtureManifest.legacyWidgetKey} binding-ok\n`);
}

for (const [name, value] of Object.entries(actualDigests)) {
  process.stdout.write(`${name} ${value}\n`);
}
