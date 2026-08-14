#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const featureRoot = path.join(root, 'apps/dwp/src/features');
const guardedFeatures = new Set(['approvals', 'calendar', 'hcm']);
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);
const importPattern =
  /(?:import|export)\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    return sourceExtensions.has(path.extname(entry.name)) ? [absolute] : [];
  });
}

function featureNameFor(filePath) {
  const relative = path.relative(featureRoot, filePath);
  if (relative.startsWith('..')) return undefined;
  return relative.split(path.sep)[0];
}

function importedFeature(sourceFile, specifier) {
  if (!specifier.startsWith('.')) return undefined;
  const target = path.normalize(path.join(path.dirname(sourceFile), specifier));
  if (!target.startsWith(`${featureRoot}${path.sep}`)) return undefined;
  return featureNameFor(target);
}

const violations = [];

for (const sourceFile of walk(featureRoot)) {
  const fromFeature = featureNameFor(sourceFile);
  if (!fromFeature || !guardedFeatures.has(fromFeature)) continue;

  const source = fs.readFileSync(sourceFile, 'utf8');
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1] ?? match[2];
    const toFeature = importedFeature(sourceFile, specifier);
    if (toFeature && toFeature !== fromFeature) {
      violations.push({
        file: path.relative(root, sourceFile),
        fromFeature,
        toFeature,
        specifier,
      });
    }
  }
}

if (violations.length > 0) {
  console.error('Feature boundary violations found.');
  console.error(
    'Guarded product features must use libs/shared-* or apps/dwp/src/components for shared contracts.'
  );
  for (const violation of violations) {
    console.error(
      `- ${violation.file}: ${violation.fromFeature} -> ${violation.toFeature} (${violation.specifier})`
    );
  }
  process.exit(1);
}

console.log(
  `PASS feature boundaries: ${[...guardedFeatures].sort().join(', ')} do not import sibling features.`
);
