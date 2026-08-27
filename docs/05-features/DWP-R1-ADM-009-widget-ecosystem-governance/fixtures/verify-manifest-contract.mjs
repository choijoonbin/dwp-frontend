import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const schemaUrl = new URL('./widget-manifest.v1.schema.json', import.meta.url);
const goldenUrl = new URL('./widget-manifests.v1.golden.json', import.meta.url);
const negativeUrl = new URL('./widget-manifest.v1.negative.json', import.meta.url);
const schemaSource = readFileSync(schemaUrl, 'utf8');
const negativeSource = readFileSync(negativeUrl, 'utf8');

const anchors = Object.freeze({
  schemaFile: 'd78f69eb6f910edb0e09315b1479e676cceaf1f569dab824e70bf72a5e0dd1dc',
  negativeFile: '9eefa9860380e7c9c485389be721b0336ce511e91c671d625890b0efcc8e00f7',
});

const patterns = Object.freeze({
  lowerKey: /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/,
  upperKey: /^[A-Z][A-Z0-9_]*(?:\.[A-Z0-9_]+)*$/,
  app: /^APP\.[A-Z][A-Z0-9_]*(?:\.[A-Z0-9_]+)*$/,
  authority: /^APP\.[A-Z][A-Z0-9_.]*:[A-Z][A-Z0-9_]*$/,
  field: /^[a-z][A-Za-z0-9]*$/,
});

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function canonicalize(value, path = '$') {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') {
    assert(value === value.normalize('NFC'), `${path} is not NFC.`);
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    assert(
      Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0),
      `${path} must be a non-negative safe integer.`
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

function exactKeys(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function unique(values) {
  return new Set(values.map((value) => JSON.stringify(value))).size === values.length;
}

function sorted(values, rank) {
  const key = (value) => (rank ? rank.indexOf(value) : value);
  return values.every((value, index) => index === 0 || key(values[index - 1]) < key(value));
}

function arrayOfStrings(value, min, max, pattern) {
  return (
    Array.isArray(value) &&
    value.length >= min &&
    value.length <= max &&
    unique(value) &&
    value.every(
      (item) =>
        typeof item === 'string' &&
        item === item.normalize('NFC') &&
        item.length >= 1 &&
        item.length <= 160 &&
        pattern.test(item)
    )
  );
}

function validate(manifest) {
  let canonical;
  try {
    canonical = canonicalize(manifest);
  } catch {
    return 'SCHEMA_TYPE';
  }
  if (Buffer.byteLength(canonical, 'utf8') > 32768) return 'MANIFEST_TOO_LARGE';

  if (
    !exactKeys(manifest, [
      'schemaVersion',
      'definitionKey',
      'owner',
      'renderer',
      'supportedSurfaces',
      'requiredAuthorities',
      'placement',
      'configurationContract',
      'dataCapabilities',
      'actionCapabilities',
      'sharing',
      'operations',
      'privacy',
    ])
  ) {
    return 'SCHEMA_UNKNOWN_FIELD';
  }
  if (manifest.schemaVersion !== 1) return 'SCHEMA_CONST';
  if (
    typeof manifest.definitionKey !== 'string' ||
    manifest.definitionKey.length < 3 ||
    manifest.definitionKey.length > 128 ||
    !patterns.lowerKey.test(manifest.definitionKey)
  ) {
    return 'SCHEMA_PATTERN';
  }
  if (!exactKeys(manifest.owner, ['productKey', 'sourceAppResourceKey']))
    return 'SCHEMA_UNKNOWN_FIELD';
  if (
    !patterns.lowerKey.test(manifest.owner.productKey) ||
    !patterns.app.test(manifest.owner.sourceAppResourceKey)
  ) {
    return 'SCHEMA_PATTERN';
  }
  if (!exactKeys(manifest.renderer, ['kind', 'rendererKey', 'minimumHostApiVersion'])) {
    return 'SCHEMA_UNKNOWN_FIELD';
  }
  if (manifest.renderer.kind !== 'NATIVE') return 'SCHEMA_ENUM';
  if (!patterns.lowerKey.test(manifest.renderer.rendererKey)) return 'SCHEMA_PATTERN';
  if (
    !Number.isInteger(manifest.renderer.minimumHostApiVersion) ||
    manifest.renderer.minimumHostApiVersion < 1 ||
    manifest.renderer.minimumHostApiVersion > 65535
  ) {
    return 'SCHEMA_RANGE';
  }
  if (
    !arrayOfStrings(manifest.supportedSurfaces, 1, 8, /^workspace-home$/) ||
    !sorted(manifest.supportedSurfaces)
  ) {
    return unique(manifest.supportedSurfaces ?? []) ? 'SCHEMA_ENUM' : 'SCHEMA_UNIQUE';
  }
  if (!arrayOfStrings(manifest.requiredAuthorities, 1, 32, patterns.authority)) {
    return unique(manifest.requiredAuthorities ?? []) ? 'SCHEMA_PATTERN' : 'SCHEMA_UNIQUE';
  }
  if (!sorted(manifest.requiredAuthorities)) return 'MANIFEST_SET_NOT_SORTED';

  const placement = manifest.placement;
  if (
    !exactKeys(placement, [
      'supportedContexts',
      'policyClass',
      'canHide',
      'defaultSize',
      'allowedSizes',
      'defaultHeight',
      'allowedHeights',
    ])
  ) {
    return 'SCHEMA_UNKNOWN_FIELD';
  }
  const contextRank = ['CLASSIC_PERSONAL', 'FLOW_PERSONAL', 'FLOW_GOVERNED'];
  const sizeRank = ['fifth', 'quarter', 'compact', 'medium', 'large', 'full'];
  const heightRank = ['short', 'standard', 'tall', 'expanded'];
  if (
    !Array.isArray(placement.supportedContexts) ||
    placement.supportedContexts.length < 1 ||
    placement.supportedContexts.length > 3 ||
    !unique(placement.supportedContexts)
  ) {
    return 'SCHEMA_UNIQUE';
  }
  if (
    !placement.supportedContexts.every((value) => contextRank.includes(value)) ||
    !sorted(placement.supportedContexts, contextRank)
  ) {
    return 'SCHEMA_ENUM';
  }
  if (!['PERSONAL', 'GOVERNED'].includes(placement.policyClass)) return 'SCHEMA_ENUM';
  if (typeof placement.canHide !== 'boolean') return 'SCHEMA_TYPE';
  if (
    (placement.policyClass === 'PERSONAL' &&
      placement.supportedContexts.includes('FLOW_GOVERNED')) ||
    (placement.policyClass === 'GOVERNED' &&
      (!placement.supportedContexts.includes('FLOW_GOVERNED') ||
        placement.supportedContexts.includes('FLOW_PERSONAL')))
  ) {
    return 'MANIFEST_POLICY_CONTEXT_INVALID';
  }
  if (
    !Array.isArray(placement.allowedSizes) ||
    placement.allowedSizes.length < 1 ||
    placement.allowedSizes.length > sizeRank.length ||
    !unique(placement.allowedSizes) ||
    !placement.allowedSizes.every((value) => sizeRank.includes(value)) ||
    !sorted(placement.allowedSizes, sizeRank) ||
    !sizeRank.includes(placement.defaultSize)
  ) {
    return 'SCHEMA_ENUM';
  }
  if (!placement.allowedSizes.includes(placement.defaultSize))
    return 'MANIFEST_DEFAULT_NOT_ALLOWED';
  if (
    !Array.isArray(placement.allowedHeights) ||
    placement.allowedHeights.length < 1 ||
    placement.allowedHeights.length > heightRank.length ||
    !unique(placement.allowedHeights) ||
    !placement.allowedHeights.every((value) => heightRank.includes(value)) ||
    !sorted(placement.allowedHeights, heightRank) ||
    !heightRank.includes(placement.defaultHeight)
  ) {
    return 'SCHEMA_ENUM';
  }
  if (!placement.allowedHeights.includes(placement.defaultHeight))
    return 'MANIFEST_DEFAULT_NOT_ALLOWED';

  const configuration = manifest.configurationContract;
  if (configuration !== null) {
    if (!exactKeys(configuration, ['sourceKey', 'fieldKeys', 'filterPresets', 'itemLimit'])) {
      return 'SCHEMA_UNKNOWN_FIELD';
    }
    if (!patterns.upperKey.test(configuration.sourceKey)) return 'SCHEMA_PATTERN';
    if (!arrayOfStrings(configuration.fieldKeys, 1, 32, patterns.field)) return 'SCHEMA_UNIQUE';
    if (!arrayOfStrings(configuration.filterPresets, 1, 32, patterns.upperKey))
      return 'SCHEMA_UNIQUE';
    if (!exactKeys(configuration.itemLimit, ['min', 'max'])) return 'SCHEMA_UNKNOWN_FIELD';
    if (
      !Number.isInteger(configuration.itemLimit.min) ||
      !Number.isInteger(configuration.itemLimit.max) ||
      configuration.itemLimit.min < 1 ||
      configuration.itemLimit.max > 100
    ) {
      return 'SCHEMA_RANGE';
    }
    if (configuration.itemLimit.min > configuration.itemLimit.max) {
      return 'MANIFEST_ITEM_LIMIT_INVALID';
    }
  }

  if (!arrayOfStrings(manifest.dataCapabilities, 1, 32, patterns.upperKey)) {
    return unique(manifest.dataCapabilities ?? []) ? 'SCHEMA_PATTERN' : 'SCHEMA_UNIQUE';
  }
  if (!sorted(manifest.dataCapabilities)) return 'MANIFEST_SET_NOT_SORTED';
  if (!arrayOfStrings(manifest.actionCapabilities, 0, 32, patterns.upperKey)) {
    return unique(manifest.actionCapabilities ?? []) ? 'SCHEMA_PATTERN' : 'SCHEMA_UNIQUE';
  }
  if (!sorted(manifest.actionCapabilities)) return 'MANIFEST_SET_NOT_SORTED';
  if (
    !exactKeys(manifest.sharing, ['presetEligible']) ||
    typeof manifest.sharing.presetEligible !== 'boolean'
  ) {
    return 'SCHEMA_TYPE';
  }
  if (!exactKeys(manifest.operations, ['freshnessSeconds', 'analyticsKey']))
    return 'SCHEMA_UNKNOWN_FIELD';
  if (
    !Number.isInteger(manifest.operations.freshnessSeconds) ||
    manifest.operations.freshnessSeconds < 5 ||
    manifest.operations.freshnessSeconds > 3600
  ) {
    return 'SCHEMA_RANGE';
  }
  if (!patterns.lowerKey.test(manifest.operations.analyticsKey)) return 'SCHEMA_PATTERN';
  if (!exactKeys(manifest.privacy, ['classification', 'retention', 'recipientContextBinding'])) {
    return 'SCHEMA_UNKNOWN_FIELD';
  }
  if (
    !['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'].includes(manifest.privacy.classification)
  ) {
    return 'SCHEMA_ENUM';
  }
  if (manifest.privacy.retention !== 'NONE' || manifest.privacy.recipientContextBinding !== true) {
    return 'SCHEMA_CONST';
  }
  return null;
}

assert(sha256(schemaSource) === anchors.schemaFile, 'Manifest schema bytes changed.');
assert(sha256(negativeSource) === anchors.negativeFile, 'Manifest negative fixture bytes changed.');
const schema = JSON.parse(schemaSource);
assert(schema.$id.endsWith('/widget-manifest.v1.schema.json'), 'Unexpected Manifest schema ID.');
assert(schema.additionalProperties === false, 'Manifest root must reject unknown fields.');

const golden = JSON.parse(readFileSync(goldenUrl, 'utf8'));
for (const fixture of golden.fixtures) {
  const code = validate(fixture.manifest);
  assert(code === null, `${fixture.legacyWidgetKey}: positive Manifest failed with ${code}.`);
  process.stdout.write(`${fixture.legacyWidgetKey} schema-ok\n`);
}

const base = golden.fixtures.find((fixture) => fixture.legacyWidgetKey === 'schedule').manifest;
const negative = JSON.parse(negativeSource);
assert(negative.fixtureVersion === 1 && negative.cases.length === 10, 'Negative case set changed.');

function mutate(kind) {
  const value = structuredClone(base);
  if (kind === 'ADD_UNKNOWN_ROOT') value.unknown = true;
  if (kind === 'UPPERCASE_DEFINITION') value.definitionKey = 'Core.Calendar.Schedule';
  if (kind === 'REMOTE_RENDERER') value.renderer.kind = 'REMOTE';
  if (kind === 'DUPLICATE_AUTHORITY') value.requiredAuthorities.push(value.requiredAuthorities[0]);
  if (kind === 'DEFAULT_SIZE_OUTSIDE_ALLOWED') value.placement.defaultSize = 'full';
  if (kind === 'ITEM_LIMIT_REVERSED') value.configurationContract.itemLimit = { min: 20, max: 1 };
  if (kind === 'GOVERNED_WITH_FLOW_PERSONAL') value.placement.policyClass = 'GOVERNED';
  if (kind === 'RETENTION_NOT_NONE') value.privacy.retention = 'SESSION';
  if (kind === 'UNSORTED_AUTHORITIES') {
    value.requiredAuthorities = ['APP.Z:VIEW', 'APP.A:VIEW'];
  }
  if (kind === 'OVERSIZED_MANIFEST') value.padding = 'x'.repeat(33000);
  return value;
}

for (const testCase of negative.cases) {
  const actual = validate(mutate(testCase.mutation));
  assert(
    actual === testCase.expectedCode,
    `${testCase.caseId}: expected ${testCase.expectedCode}, got ${actual}.`
  );
  process.stdout.write(`${testCase.caseId} rejected ${actual}\n`);
}
