#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const testOnlyPatterns = new Map([
  ['state-spec route/module', /home-wave2-state-spec|e2e-fixtures\/home-wave2-state-spec/u],
  [
    'query-driven evidence adapter',
    /wave2ResourceState|wave2FlowState|wave2ModePreset|home-wave2-evidence-adapter/u,
  ],
]);
const sourceEntries = [
  'apps/dwp/index.html',
  'apps/dwp/src/main.tsx',
  'vite.config.ts',
  'vite.product.config.ts',
];

function walk(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const leakedEntries = sourceEntries.flatMap((path) => {
  const absolute = resolve(root, path);
  if (!existsSync(absolute)) return [];
  const source = readFileSync(absolute, 'utf8');
  return [...testOnlyPatterns]
    .filter(([, pattern]) => pattern.test(source))
    .map(([label]) => `${path} (${label})`);
});
if (leakedEntries.length > 0) {
  throw new Error(`Wave 2 evidence leaks into production entries: ${leakedEntries.join(', ')}`);
}

const productionOutput = resolve(root, 'apps/dwp/dist');
if (!existsSync(productionOutput)) {
  throw new Error('Production output apps/dwp/dist is missing; run `yarn vite build` first.');
}
const outputFiles = walk(productionOutput);
const leakedFiles = outputFiles.flatMap((path) => {
  const pathLeaks = [...testOnlyPatterns]
    .filter(([, pattern]) => pattern.test(path))
    .map(([label]) => `${path} (${label} in path)`);
  const extension = extname(path);
  if (!['.html', '.js', '.css', '.json', '.map'].includes(extension)) return pathLeaks;
  const content = readFileSync(path, 'utf8');
  return [
    ...pathLeaks,
    ...[...testOnlyPatterns]
      .filter(([, pattern]) => pattern.test(content))
      .map(([label]) => `${path} (${label} in content)`),
  ];
});
if (leakedFiles.length > 0) {
  throw new Error(`Wave 2 evidence leaks into production output: ${leakedFiles.join(', ')}`);
}

console.log('Wave 2 test-only production exclusion');
console.log(`- production files inspected: ${outputFiles.length}`);
console.log('- state-spec routes/modules found: 0');
console.log('- query-driven evidence adapter markers found: 0');
