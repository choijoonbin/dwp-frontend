#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import prettier from 'prettier';

const root = process.cwd();
const snapshotPath = path.join(root, 'architecture/product-surface-authorization.v1.json');
const routerSourcePath = path.join(root, 'architecture/product-page-routes.v1.json');
const generatedPath = path.join(
  root,
  'apps/dwp/src/routes/product-surface-authorization.generated.ts'
);
const INDEX_FILE = 'product-surfaces-v1.index.json';
const LATEST_ALIAS_FILE = 'product-surfaces-v1.json';
const VERSIONS = [1, 2, 3];
const LATEST_VERSION = VERSIONS.at(-1);
const SNAPSHOT_FIELDS = [
  'bundles',
  'index',
  'latestAlias',
  'rolloutInventory',
  'schemaVersion',
  'snapshotKey',
];
const BUNDLE_FIELDS = new Set([
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
const INDEX_VERSION_FIELDS = [
  'artifact',
  'authSeedArtifact',
  'bundleStatus',
  'checksum',
  'counts',
  'version',
];
const SECTION_KEYS = {
  capabilities: 'contractKey',
  accessPolicies: 'accessPolicyKey',
  entitlementExpressions: 'expressionKey',
  predicatePolicies: 'predicatePolicyKey',
  routes: 'routeContractKey',
};
const EXPECTED_COUNTS = {
  1: {
    capabilities: 10,
    accessPolicies: 5,
    entitlementExpressions: 2,
    predicatePolicies: 6,
    routes: 35,
  },
  2: {
    capabilities: 34,
    accessPolicies: 6,
    entitlementExpressions: 3,
    predicatePolicies: 13,
    routes: 76,
  },
  3: {
    capabilities: 62,
    accessPolicies: 14,
    entitlementExpressions: 8,
    predicatePolicies: 25,
    routes: 129,
  },
};
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
const PRESERVED_V1_CHECKSUM = 'bc34f47b0ad783d27aa7979f25f75e2fdf29506a12a23c0088f94837abad0b67';
const SHA_256 = /^[a-f0-9]{64}$/u;

function fail(message) {
  throw new Error(`Product surface authorization contract error: ${message}`);
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

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])])
  );
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function sha256(value) {
  return crypto.createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function readJson(filePath, label = filePath) {
  if (!fs.existsSync(filePath)) fail(`${label} is missing: ${filePath}`);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function validateUnique(records, key, label) {
  const values = records.map((record, index) =>
    requireString(requireRecord(record, `${label}[${index}]`)[key], `${label}[${index}].${key}`)
  );
  if (new Set(values).size !== values.length) fail(`${label}.${key} values must be unique`);
}

function bundleChecksum(bundle) {
  const payload = structuredClone(bundle);
  delete payload.checksum;
  delete payload.bundleStatus;
  return sha256(payload);
}

function validateBundle(value, expectedVersion) {
  const bundle = requireRecord(value, `bundle v${expectedVersion}`);
  const expectedBundleFields = [...BUNDLE_FIELDS]
    .filter((field) => field !== 'authorityEndpoints' || expectedVersion >= 2)
    .sort();
  if (canonicalJson(Object.keys(bundle).sort()) !== canonicalJson(expectedBundleFields)) {
    fail(`bundle v${expectedVersion} field set is not exact`);
  }
  if (bundle.schemaVersion !== 1 || bundle.bundleKey !== 'product-surfaces') {
    fail(`bundle v${expectedVersion} identity is invalid`);
  }
  if (bundle.bundleStatus !== 'DRAFT') {
    fail(`bundle v${expectedVersion} must remain DRAFT until external activation approval`);
  }
  if (bundle.version !== expectedVersion) fail(`bundle v${expectedVersion} version is invalid`);
  if (bundle.checksumAlgorithm !== 'SHA-256' || !SHA_256.test(bundle.checksum)) {
    fail(`bundle v${expectedVersion} checksum metadata is invalid`);
  }
  if (bundleChecksum(bundle) !== bundle.checksum) {
    fail(`bundle v${expectedVersion} checksum does not match canonical content`);
  }
  for (const [section, key] of Object.entries(SECTION_KEYS)) {
    const records = requireArray(bundle[section], `bundle v${expectedVersion}.${section}`);
    const expectedCount = EXPECTED_COUNTS[expectedVersion][section];
    if (records.length !== expectedCount) {
      fail(
        `bundle v${expectedVersion}.${section} expected ${expectedCount}, found ${records.length}`
      );
    }
    validateUnique(records, key, `bundle v${expectedVersion}.${section}`);
  }
  const routeKinds = { PAGE: 0, DATA: 0, ACTION: 0 };
  for (const route of bundle.routes) {
    if (!(route.routeKind in routeKinds)) fail(`unknown route kind ${String(route.routeKind)}`);
    routeKinds[route.routeKind] += 1;
    if (route.routeKind === 'PAGE') {
      requireString(route.uiRouteId, `${route.routeContractKey}.uiRouteId`);
      requireString(route.uiRoutePattern, `${route.routeContractKey}.uiRoutePattern`);
      const subject = requireRecord(route.subject, `${route.routeContractKey}.subject`);
      if (subject.type !== 'PRODUCT')
        fail(`${route.routeContractKey} PAGE must have PRODUCT subject`);
      requireString(subject.productKey, `${route.routeContractKey}.subject.productKey`);
      requireString(subject.surfaceKey, `${route.routeContractKey}.subject.surfaceKey`);
    } else if (route.uiRouteId != null || route.uiRoutePattern != null) {
      fail(`${route.routeContractKey} ${route.routeKind} must not expose a browser route`);
    }
  }
  return bundle;
}

function validateRolloutInventory(value) {
  const inventory = requireRecord(value, 'rollout inventory');
  const expectedFields = [
    'checksum',
    'checksumAlgorithm',
    'inventoryKey',
    'products',
    'schemaVersion',
  ];
  if (canonicalJson(Object.keys(inventory).sort()) !== canonicalJson(expectedFields)) {
    fail('rollout inventory field set is not exact');
  }
  if (
    inventory.schemaVersion !== 1 ||
    inventory.inventoryKey !== 'product-surface-rollout-products.v1' ||
    inventory.checksumAlgorithm !== 'SHA-256' ||
    !SHA_256.test(inventory.checksum) ||
    canonicalJson(inventory.products) !== canonicalJson(EXPECTED_ROLLOUT_PRODUCTS)
  ) {
    fail('rollout inventory identity or product set is invalid');
  }
  const payload = structuredClone(inventory);
  delete payload.checksum;
  if (sha256(payload) !== inventory.checksum) fail('rollout inventory checksum is invalid');
  return inventory;
}

function isAppendOnlySuperset(previous, next) {
  if (Array.isArray(previous)) {
    return (
      Array.isArray(next) &&
      next.length >= previous.length &&
      previous.every((value, index) => isAppendOnlySuperset(value, next[index]))
    );
  }
  if (isRecord(previous)) {
    return (
      isRecord(next) &&
      Object.entries(previous).every(
        ([field, value]) => Object.hasOwn(next, field) && isAppendOnlySuperset(value, next[field])
      )
    );
  }
  return Object.is(previous, next);
}

function validateNoDroppedContracts(previous, next) {
  for (const [section, key] of Object.entries(SECTION_KEYS)) {
    const nextByKey = new Map(next[section].map((record) => [record[key], record]));
    for (const record of previous[section]) {
      const candidate = nextByKey.get(record[key]);
      if (!candidate)
        fail(`v${next.version} dropped v${previous.version} ${section} ${record[key]}`);
      if (!isAppendOnlySuperset(record, candidate)) {
        fail(
          `v${next.version} non-monotonically changed v${previous.version} ${section} ${record[key]}`
        );
      }
    }
  }
}

function validateIndex(value, bundles) {
  const index = requireRecord(value, 'registry index');
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
  if (canonicalJson(Object.keys(index).sort()) !== canonicalJson(expectedIndexFields)) {
    fail('registry index contains an unknown field or active pointer');
  }
  if (
    index.schemaVersion !== 1 ||
    index.bundleKey !== 'product-surfaces' ||
    index.latestVersion !== LATEST_VERSION ||
    index.latestArtifact !== `product-surfaces-v1.bundle-v${LATEST_VERSION}.json` ||
    index.latestAuthSeedArtifact !== `product-surfaces-v1.bundle-v${LATEST_VERSION}.generated.json`
  ) {
    fail('registry index identity or latest pointer is invalid');
  }
  if (index.indexChecksumAlgorithm !== 'SHA-256' || !SHA_256.test(index.indexChecksum)) {
    fail('registry index checksum metadata is invalid');
  }
  const checksumPayload = structuredClone(index);
  delete checksumPayload.indexChecksum;
  if (sha256(checksumPayload) !== index.indexChecksum) fail('registry index checksum is invalid');
  const versions = requireArray(index.versions, 'registry index versions');
  if (versions.length !== VERSIONS.length) {
    fail(`registry index must close over v1-v${LATEST_VERSION} exactly`);
  }
  for (const version of VERSIONS) {
    const entry = versions[version - 1];
    if (entry?.version !== version) {
      fail(`registry index versions must be ordered v1-v${LATEST_VERSION} exactly`);
    }
    if (canonicalJson(Object.keys(entry).sort()) !== canonicalJson(INDEX_VERSION_FIELDS)) {
      fail(`registry index v${version} entry contains an unknown field or active marker`);
    }
    const bundle = bundles[version - 1];
    if (
      entry.artifact !== `product-surfaces-v1.bundle-v${version}.json` ||
      entry.authSeedArtifact !== `product-surfaces-v1.bundle-v${version}.generated.json` ||
      entry.bundleStatus !== 'DRAFT' ||
      entry.checksum !== bundle.checksum ||
      canonicalJson(entry.counts) !== canonicalJson(EXPECTED_COUNTS[version])
    ) {
      fail(`registry index v${version} entry is not closed over its bundle`);
    }
  }
  if (index.latestChecksum !== bundles.at(-1).checksum) fail('registry latest checksum is stale');
  return index;
}

function validateSnapshot(value) {
  const snapshot = requireRecord(value, 'authorization snapshot');
  if (canonicalJson(Object.keys(snapshot).sort()) !== canonicalJson(SNAPSHOT_FIELDS)) {
    fail('authorization snapshot contains an unknown field or active pointer');
  }
  if (snapshot.schemaVersion !== 1 || snapshot.snapshotKey !== 'product-surface-authorization.v1') {
    fail('authorization snapshot identity is invalid');
  }
  const bundles = requireArray(snapshot.bundles, 'authorization snapshot bundles').map(
    (bundle, index) => validateBundle(bundle, index + 1)
  );
  if (bundles.length !== VERSIONS.length) {
    fail(`authorization snapshot must contain v1-v${LATEST_VERSION} exactly`);
  }
  if (bundles[0].checksum !== PRESERVED_V1_CHECKSUM) fail('preserved v1 checksum changed');
  for (let index = 1; index < bundles.length; index += 1) {
    validateNoDroppedContracts(bundles[index - 1], bundles[index]);
  }
  const index = validateIndex(snapshot.index, bundles);
  const rolloutInventory = validateRolloutInventory(snapshot.rolloutInventory);
  const latestAlias = validateBundle(snapshot.latestAlias, index.latestVersion);
  if (canonicalJson(latestAlias) !== canonicalJson(bundles.at(-1))) {
    fail('latest alias does not match the latest immutable bundle');
  }
  return { snapshot, index, bundles, latestAlias, rolloutInventory };
}

function validateRouterSource(value, latestBundle) {
  const source = requireRecord(value, 'router source');
  if (source.schemaVersion !== 1 || source.sourceKey !== 'product-page-routes.v1') {
    fail('router source identity is invalid');
  }
  const routes = requireArray(source.pageRoutes, 'router source pageRoutes');
  const redirects = requireArray(source.legacyRedirects, 'router source legacyRedirects');
  validateUnique(routes, 'routeContractKey', 'router source pageRoutes');
  validateUnique(routes, 'routeId', 'router source pageRoutes');
  validateUnique(routes, 'pattern', 'router source pageRoutes');
  validateUnique(redirects, 'redirectId', 'router source legacyRedirects');
  validateUnique(redirects, 'sourcePath', 'router source legacyRedirects');
  const registryPages = latestBundle.routes.filter((route) => route.routeKind === 'PAGE');
  const registryByKey = new Map(registryPages.map((route) => [route.routeContractKey, route]));
  const routerByKey = new Map(routes.map((route) => [route.routeContractKey, route]));
  for (const route of routes) {
    const registry = registryByKey.get(route.routeContractKey);
    if (!registry) fail(`router source has stale PAGE ${route.routeContractKey}`);
    const subject = registry.subject;
    if (
      route.routeId !== registry.uiRouteId ||
      route.pattern !== registry.uiRoutePattern ||
      route.productId !== subject.productKey ||
      route.surfaceId !== subject.surfaceKey ||
      route.surfaceId !== registry.navigationContextId
    ) {
      fail(`router source PAGE metadata differs from registry ${route.routeContractKey}`);
    }
    const forbidden = [
      'accessProfiles',
      'predicatePolicyKeys',
      'gatewayApiBindings',
      'servicePepBindings',
      'accessPolicyKey',
      'capabilityContractKey',
    ];
    if (forbidden.some((field) => field in route)) {
      fail(`router source must not own authorization or API binding: ${route.routeContractKey}`);
    }
  }
  for (const route of registryPages) {
    if (!routerByKey.has(route.routeContractKey)) {
      fail(`registry PAGE is missing from router source ${route.routeContractKey}`);
    }
  }
  const routeByKey = new Map(routes.map((route) => [route.routeContractKey, route]));
  const redirectBySource = new Map(redirects.map((redirect) => [redirect.sourcePath, redirect]));
  for (const redirect of redirects) {
    if (
      redirect.maxHops !== 1 ||
      redirect.preserveQuery !== true ||
      redirect.preserveHash !== true
    ) {
      fail(`legacy redirect ${redirect.redirectId} must preserve URL state and stop after one hop`);
    }
    const registeredTarget = routeByKey.get(redirect.targetRouteContractKey);
    const draftTarget =
      !registeredTarget &&
      redirect.targetLifecycle === 'DRAFT' &&
      typeof redirect.targetPath === 'string' &&
      redirect.targetPath.startsWith('/') &&
      !redirect.targetPath.includes('?') &&
      !redirect.targetPath.includes('#') &&
      !redirect.targetPath.includes(':') &&
      !redirect.targetPath.includes('*')
        ? { pattern: redirect.targetPath }
        : undefined;
    const target = registeredTarget ?? draftTarget;
    if (!target) fail(`legacy redirect ${redirect.redirectId} has unknown target`);
    if (registeredTarget && ('targetLifecycle' in redirect || 'targetPath' in redirect)) {
      fail(`registered legacy redirect ${redirect.redirectId} must not claim DRAFT metadata`);
    }
    if (
      draftTarget &&
      !/^route\.[a-z0-9]+(?:[.-][a-z0-9]+)*\.page$/u.test(redirect.targetRouteContractKey)
    ) {
      fail(`DRAFT legacy redirect ${redirect.redirectId} has an invalid target contract`);
    }
    if (redirectBySource.has(target.pattern)) {
      fail(`legacy redirect ${redirect.redirectId} forms a redirect cycle`);
    }
  }
  return source;
}

function routeProjection(route) {
  const subject = requireRecord(route.subject, `${route.routeContractKey}.subject`);
  const gatewayBindings = requireArray(
    route.gatewayApiBindings,
    `${route.routeContractKey}.gatewayApiBindings`
  ).map((binding, index) => {
    const candidate = requireRecord(
      binding,
      `${route.routeContractKey}.gatewayApiBindings[${index}]`
    );
    return {
      method: requireString(
        candidate.method,
        `${route.routeContractKey}.gatewayApiBindings[${index}].method`
      ),
      path: requireString(
        candidate.path,
        `${route.routeContractKey}.gatewayApiBindings[${index}].path`
      ),
    };
  });
  return {
    routeContractKey: route.routeContractKey,
    routeKind: route.routeKind,
    navigationContextId: route.navigationContextId,
    subjectType: subject.type,
    productId: subject.productKey ?? null,
    surfaceId: subject.surfaceKey ?? null,
    routeId: route.uiRouteId ?? null,
    pattern: route.uiRoutePattern ?? null,
    gatewayBindings,
  };
}

async function generatedTypescript(index, latestBundle, rolloutInventory) {
  const projections = latestBundle.routes.map(routeProjection);
  const literal = JSON.stringify(projections, null, 2);
  const source = `/** @generated from architecture/product-surface-authorization.v1.json. Do not edit manually. */

export type ProductAuthorizationRouteProjection = Readonly<{
  routeContractKey: string;
  routeKind: 'PAGE' | 'DATA' | 'ACTION';
  navigationContextId: string;
  subjectType: 'PRODUCT' | 'GOVERNED_CONTEXT';
  productId: string | null;
  surfaceId: string | null;
  routeId: string | null;
  pattern: string | null;
  gatewayBindings: readonly Readonly<{ method: string; path: string }>[];
}>;

export const PRODUCT_AUTHORIZATION_REGISTRY_REVISION = ${JSON.stringify({
    bundleKey: index.bundleKey,
    version: index.latestVersion,
    checksum: index.latestChecksum,
    indexChecksum: index.indexChecksum,
  })} as const;

export const PRODUCT_SURFACE_ROLLOUT_INVENTORY_REVISION = ${JSON.stringify({
    inventoryKey: rolloutInventory.inventoryKey,
    checksum: rolloutInventory.checksum,
  })} as const;

export const PRODUCT_SURFACE_ROLLOUT_PRODUCTS = ${JSON.stringify(
    rolloutInventory.products
  )} as const;

export const PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS = ${literal} as const satisfies readonly ProductAuthorizationRouteProjection[];

export const PRODUCT_AUTHORIZATION_PAGE_PROJECTIONS =
  PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS.filter(
    (route): route is (typeof PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS)[number] & {
      routeKind: 'PAGE'; productId: string; surfaceId: string; routeId: string; pattern: string;
    } => route.routeKind === 'PAGE'
  );
`;
  const formatOptions = (await prettier.resolveConfig(generatedPath)) ?? {};
  return prettier.format(source, { ...formatOptions, filepath: generatedPath });
}

function parseArguments(argv) {
  if (argv[0] === '--sync' && argv.length === 2 && !argv[1].startsWith('--')) {
    return { mode: 'sync', artifactDirectory: path.resolve(argv[1]) };
  }
  if (argv[0] === '--sync' && argv.length === 1 && process.env.DWP_PRODUCT_AUTHORIZATION_DIR) {
    return {
      mode: 'sync',
      artifactDirectory: path.resolve(process.env.DWP_PRODUCT_AUTHORIZATION_DIR),
    };
  }
  if (
    argv[0] === '--check' &&
    argv.length <= 2 &&
    (argv.length === 1 || !argv[1].startsWith('--'))
  ) {
    const officialDirectory = argv[1] ?? process.env.DWP_PRODUCT_AUTHORIZATION_DIR;
    return {
      mode: 'check',
      officialDirectory: officialDirectory ? path.resolve(officialDirectory) : undefined,
    };
  }
  console.error(
    'Usage: node scripts/sync-product-surface-authorization.mjs --sync <official backend artifact directory> | --check [official backend artifact directory]'
  );
  process.exit(2);
}

function readOfficialSnapshot(artifactDirectory) {
  if (!fs.statSync(artifactDirectory, { throwIfNoEntry: false })?.isDirectory()) {
    fail(`official artifact directory is missing: ${artifactDirectory}`);
  }
  const readOfficialJson = (fileName, label) => {
    const filePath = path.join(artifactDirectory, fileName);
    const value = readJson(filePath, label);
    const canonicalBytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
    if (!fs.readFileSync(filePath).equals(canonicalBytes)) {
      fail(`official ${label} serialization is not byte-canonical: ${filePath}`);
    }
    return value;
  };
  const expectedBundles = VERSIONS.map((version) => `product-surfaces-v1.bundle-v${version}.json`);
  const packagedBundles = fs
    .readdirSync(artifactDirectory)
    .filter((fileName) =>
      /^product-surfaces-v1\.bundle-v\d+(?:\.generated)?\.json$/u.test(fileName)
    )
    .sort();
  if (canonicalJson(packagedBundles) !== canonicalJson(expectedBundles)) {
    fail('official artifact directory must contain exactly immutable bundle v1-v3 files');
  }
  const index = readOfficialJson(INDEX_FILE, 'registry index');
  const bundles = VERSIONS.map((version) =>
    readOfficialJson(`product-surfaces-v1.bundle-v${version}.json`, `bundle v${version}`)
  );
  const aliasPath = path.join(artifactDirectory, LATEST_ALIAS_FILE);
  const latestPath = path.join(
    artifactDirectory,
    `product-surfaces-v1.bundle-v${LATEST_VERSION}.json`
  );
  if (
    !fs.existsSync(aliasPath) ||
    !fs.readFileSync(aliasPath).equals(fs.readFileSync(latestPath))
  ) {
    fail(`official latest alias is not byte-identical to bundle v${LATEST_VERSION}`);
  }
  return {
    schemaVersion: 1,
    snapshotKey: 'product-surface-authorization.v1',
    index,
    bundles,
    latestAlias: readOfficialJson(LATEST_ALIAS_FILE, 'latest alias'),
    rolloutInventory: readOfficialJson(
      'product-surface-rollout-inventory.v1.generated.json',
      'rollout inventory'
    ),
  };
}

async function writeOrCheck(snapshot, generated, mode) {
  const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
  if (mode === 'sync') {
    fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
    fs.writeFileSync(snapshotPath, serialized, 'utf8');
    fs.mkdirSync(path.dirname(generatedPath), { recursive: true });
    fs.writeFileSync(generatedPath, generated, 'utf8');
    return;
  }
  if (!fs.existsSync(generatedPath)) fail(`generated TypeScript is missing: ${generatedPath}`);
  if (fs.readFileSync(snapshotPath, 'utf8') !== serialized) {
    fail('authorization snapshot serialization is stale');
  }
  if (fs.readFileSync(generatedPath, 'utf8') !== generated) {
    fail('generated authorization TypeScript is stale; synchronize approved backend artifacts');
  }
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  let snapshot;
  if (args.mode === 'sync') {
    snapshot = readOfficialSnapshot(args.artifactDirectory);
  } else {
    snapshot = readJson(snapshotPath, 'authorization snapshot');
    if (args.officialDirectory) {
      const officialSnapshot = readOfficialSnapshot(args.officialDirectory);
      validateSnapshot(officialSnapshot);
      const expectedOfficialBytes = Buffer.from(
        `${JSON.stringify(officialSnapshot, null, 2)}\n`,
        'utf8'
      );
      if (!fs.readFileSync(snapshotPath).equals(expectedOfficialBytes)) {
        fail('frontend authorization snapshot is not byte-identical to official backend artifacts');
      }
    }
  }
  const validated = validateSnapshot(snapshot);
  const routerSource = readJson(routerSourcePath, 'router source');
  validateRouterSource(routerSource, validated.latestAlias);
  const generated = await generatedTypescript(
    validated.index,
    validated.latestAlias,
    validated.rolloutInventory
  );
  await writeOrCheck(validated.snapshot, generated, args.mode);
  console.log(
    `PASS product surface authorization v1-v${validated.index.latestVersion} ` +
      `(${validated.index.latestChecksum}); ${routerSource.pageRoutes.length} PAGE routes closed` +
      `${args.mode === 'check' && args.officialDirectory ? '; official backend artifacts matched.' : '.'}`
  );
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
