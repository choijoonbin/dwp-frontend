import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

import { incrementalRouteKeys, manifestImportClosure } from './notification-route-budget-model.mjs';

const workspaceRoot = path.resolve(import.meta.dirname, '..');
const outputRoot = path.resolve(workspaceRoot, process.argv[2] ?? 'apps/dwp/dist');
const manifestPath = path.join(outputRoot, '.vite/manifest.json');
const budgetsPath = path.join(workspaceRoot, 'scripts/notification-route-budgets.json');
const [manifest, budgets] = await Promise.all([
  readFile(manifestPath, 'utf8').then(JSON.parse),
  readFile(budgetsPath, 'utf8').then(JSON.parse),
]);

const expectedRoutes = [
  'notification-settings-route.tsx',
  'notification-admin-overview-route.tsx',
  'notification-admin-contracts-route.tsx',
  'notification-admin-policies-route.tsx',
  'notification-admin-templates-route.tsx',
  'notification-admin-operations-route.tsx',
  'notification-admin-suppressions-route.tsx',
];

const entries = new Map();
for (const route of expectedRoutes) {
  const matches = Object.entries(manifest).filter(
    ([key, value]) =>
      key.endsWith(`/notifications/${route}`) || value.src?.endsWith(`/notifications/${route}`)
  );
  if (matches.length !== 1) {
    throw new Error(`Expected one manifest entry for ${route}, found ${matches.length}.`);
  }
  const [key, entry] = matches[0];
  if (!entry.isDynamicEntry) {
    throw new Error(`${route} must remain an independent dynamic entry.`);
  }
  entries.set(route, { key, entry });
}

const outputFiles = new Set([...entries.values()].map(({ entry }) => entry.file));
if (outputFiles.size !== expectedRoutes.length) {
  throw new Error('Notification settings/admin routes were merged into the same output entry.');
}

const routeKeys = new Set([...entries.values()].map(({ key }) => key));
for (const [route, { key }] of entries) {
  const crossRouteImport = [...manifestImportClosure(manifest, key)].find(
    (importedKey) => importedKey !== key && routeKeys.has(importedKey)
  );
  if (crossRouteImport) {
    throw new Error(
      `${route} statically imports another notification route entry: ${crossRouteImport}.`
    );
  }
}

console.log('\nNotification route entry manifest');
const failures = [];
const assetMeasurements = new Map();
async function measureAsset(file) {
  const cached = assetMeasurements.get(file);
  if (cached) return cached;
  const filePath = path.join(outputRoot, file);
  const source = await readFile(filePath);
  const measurement = { raw: source.length, gzip: gzipSync(source, { level: 9 }).length };
  assetMeasurements.set(file, measurement);
  return measurement;
}

for (const [route, { key, entry }] of entries) {
  const filePath = path.join(outputRoot, entry.file);
  const [metadata, source] = await Promise.all([stat(filePath), readFile(filePath)]);
  const budget = budgets[route];
  if (
    !budget ||
    !Number.isInteger(budget.rawBytes) ||
    !Number.isInteger(budget.gzipBytes) ||
    !Number.isInteger(budget.closureRawBytes) ||
    !Number.isInteger(budget.closureGzipBytes)
  ) {
    throw new Error(`Missing valid raw/gzip budget for ${route}.`);
  }
  const gzipBytes = gzipSync(source, { level: 9 }).length;
  const incrementalKeys = [...incrementalRouteKeys(manifest, key)];
  const closureAssets = [
    ...new Set(
      incrementalKeys
        .map((importedKey) => manifest[importedKey]?.file)
        .filter((file) => typeof file === 'string' && file.endsWith('.js'))
    ),
  ];
  const closureMeasurements = await Promise.all(closureAssets.map(measureAsset));
  const closureRawBytes = closureMeasurements.reduce((total, item) => total + item.raw, 0);
  const closureGzipBytes = closureMeasurements.reduce((total, item) => total + item.gzip, 0);
  const rawKiB = (metadata.size / 1024).toFixed(1);
  const gzipKiB = (gzipBytes / 1024).toFixed(1);
  const rawBudgetKiB = (budget.rawBytes / 1024).toFixed(1);
  const gzipBudgetKiB = (budget.gzipBytes / 1024).toFixed(1);
  console.log(
    `${route.padEnd(48)} ${rawKiB.padStart(8)}/${rawBudgetKiB} KiB raw  ${gzipKiB.padStart(8)}/${gzipBudgetKiB} KiB gzip`
  );
  console.log(
    `${''.padEnd(48)} ${(closureRawBytes / 1024).toFixed(1).padStart(8)}/${(budget.closureRawBytes / 1024).toFixed(1)} KiB closure raw  ${(closureGzipBytes / 1024).toFixed(1).padStart(8)}/${(budget.closureGzipBytes / 1024).toFixed(1)} KiB closure gzip  (${closureAssets.length} JS)`
  );
  if (metadata.size > budget.rawBytes) {
    failures.push(`${route} raw ${metadata.size} > ${budget.rawBytes}`);
  }
  if (gzipBytes > budget.gzipBytes) {
    failures.push(`${route} gzip ${gzipBytes} > ${budget.gzipBytes}`);
  }
  if (closureRawBytes > budget.closureRawBytes) {
    failures.push(`${route} closure raw ${closureRawBytes} > ${budget.closureRawBytes}`);
  }
  if (closureGzipBytes > budget.closureGzipBytes) {
    failures.push(`${route} closure gzip ${closureGzipBytes} > ${budget.closureGzipBytes}`);
  }
}

if (failures.length > 0) {
  throw new Error(`Notification route budget exceeded:\n${failures.join('\n')}`);
}
console.log(`PASS  ${expectedRoutes.length} independent Notification dynamic route entries.`);
