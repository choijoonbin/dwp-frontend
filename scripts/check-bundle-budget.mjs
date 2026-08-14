import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const workspaceRoot = path.resolve(import.meta.dirname, '..');
const argumentsByName = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  argumentsByName.set(process.argv[index], process.argv[index + 1]);
}
const outputRoot = path.resolve(workspaceRoot, argumentsByName.get('--output') ?? 'apps/dwp/dist');
const manifestPath = path.join(outputRoot, '.vite/manifest.json');
const budgetsPath = path.resolve(
  workspaceRoot,
  argumentsByName.get('--budgets') ?? 'scripts/bundle-budgets.json'
);
const reportLabel = argumentsByName.get('--label') ?? 'DWP production bundle budget';

const [manifest, budgets] = await Promise.all([
  readFile(manifestPath, 'utf8').then(JSON.parse),
  readFile(budgetsPath, 'utf8').then(JSON.parse),
]);

const entries = Object.values(manifest).filter((chunk) => chunk.isEntry);
if (entries.length !== 1) {
  throw new Error(`Expected one application entry in ${manifestPath}, found ${entries.length}.`);
}

const byFile = new Map(Object.values(manifest).map((chunk) => [chunk.file, chunk]));
const initialFiles = new Set();

function collectInitialChunk(chunk) {
  if (!chunk?.file?.endsWith('.js') || initialFiles.has(chunk.file)) return;
  initialFiles.add(chunk.file);

  for (const importKey of chunk.imports ?? []) {
    collectInitialChunk(manifest[importKey] ?? byFile.get(importKey));
  }
}

collectInitialChunk(entries[0]);

async function measure(file) {
  const absolutePath = path.join(outputRoot, file);
  const [metadata, source] = await Promise.all([stat(absolutePath), readFile(absolutePath)]);

  return {
    file,
    raw: metadata.size,
    gzip: gzipSync(source, { level: 9 }).length,
  };
}

const initial = await Promise.all([...initialFiles].sort().map(measure));
const allJavaScriptFiles = [
  ...new Set(
    Object.values(manifest)
      .map((chunk) => chunk.file)
      .filter((file) => file?.endsWith('.js'))
  ),
];
const asynchronous = await Promise.all(
  allJavaScriptFiles
    .filter((file) => !initialFiles.has(file))
    .sort()
    .map(measure)
);

const entry = initial.find((asset) => asset.file === entries[0].file);
if (!entry) throw new Error('The application entry was not included in the initial graph.');

const initialTotals = initial.reduce(
  (totals, asset) => ({ raw: totals.raw + asset.raw, gzip: totals.gzip + asset.gzip }),
  { raw: 0, gzip: 0 }
);
const largestAsync = asynchronous.reduce(
  (largest, asset) => (asset.raw > largest.raw ? asset : largest),
  { file: 'none', raw: 0, gzip: 0 }
);

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

const checks = [
  ['entry raw', entry.raw, budgets.entryRawBytes, entry.file],
  ['entry gzip', entry.gzip, budgets.entryGzipBytes, entry.file],
  ['initial raw', initialTotals.raw, budgets.initialRawBytes, `${initial.length} requests`],
  ['initial gzip', initialTotals.gzip, budgets.initialGzipBytes, `${initial.length} requests`],
  ['initial requests', initial.length, budgets.initialRequestCount, 'static import graph'],
  ['largest async raw', largestAsync.raw, budgets.largestAsyncRawBytes, largestAsync.file],
  ['largest async gzip', largestAsync.gzip, budgets.largestAsyncGzipBytes, largestAsync.file],
];

console.log(`\n${reportLabel}`);
for (const [label, actual, limit, detail] of checks) {
  const sizeCheck = !label.includes('requests');
  const actualLabel = sizeCheck ? formatBytes(actual) : String(actual);
  const limitLabel = sizeCheck ? formatBytes(limit) : String(limit);
  const status = actual <= limit ? 'PASS' : 'FAIL';
  console.log(
    `${status.padEnd(4)}  ${label.padEnd(20)} ${actualLabel.padStart(10)} / ${limitLabel.padEnd(10)} ${detail}`
  );
}

const failures = checks.filter(([, actual, limit]) => actual > limit);
if (failures.length > 0) {
  console.error(
    `\nBundle budget exceeded: ${failures.map(([label]) => label).join(', ')}. ` +
      'Inspect the Vite manifest and keep heavy features behind route or component boundaries.'
  );
  process.exitCode = 1;
}
