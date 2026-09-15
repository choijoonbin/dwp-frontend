#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const testOnlyPattern = /home-wave2-state-spec|e2e-fixtures\/home-wave2-state-spec/u;
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

const leakedEntries = sourceEntries.filter((path) => {
  const absolute = resolve(root, path);
  return existsSync(absolute) && testOnlyPattern.test(readFileSync(absolute, 'utf8'));
});
if (leakedEntries.length > 0) {
  throw new Error(`Wave 2 state-spec leaks into production entries: ${leakedEntries.join(', ')}`);
}

const productionOutput = resolve(root, 'apps/dwp/dist');
if (!existsSync(productionOutput)) {
  throw new Error('Production output apps/dwp/dist is missing; run `yarn vite build` first.');
}
const outputFiles = walk(productionOutput);
const leakedFiles = outputFiles.filter((path) => {
  if (testOnlyPattern.test(path)) return true;
  const extension = extname(path);
  if (!['.html', '.js', '.css', '.json', '.map'].includes(extension)) return false;
  return testOnlyPattern.test(readFileSync(path, 'utf8'));
});
if (leakedFiles.length > 0) {
  throw new Error(`Wave 2 state-spec leaks into production output: ${leakedFiles.join(', ')}`);
}

console.log('Wave 2 test-only production exclusion');
console.log(`- production files inspected: ${outputFiles.length}`);
console.log('- state-spec routes/modules found: 0');
