#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const featureRoot = path.join(root, 'apps/dwp/src/features');
const componentRoot = path.join(root, 'apps/dwp/src/components');
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);
const importPattern =
  /(?:import|export)\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
const reexportPattern =
  /(?:^|\n)\s*export\s+(?:type\s+)?(?:\*|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/g;
const allowedComponentFeatureBridges = new Set([
  'apps/dwp/src/components/allowed-product-surface-context.tsx:shell',
  'apps/dwp/src/components/product-surface-context.ts:shell',
]);

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

function resolveSourceFile(sourceFile, specifier) {
  if (!specifier.startsWith('.')) return undefined;
  const target = path.normalize(path.join(path.dirname(sourceFile), specifier));
  const candidates = [
    target,
    ...[...sourceExtensions].map((extension) => `${target}${extension}`),
    ...[...sourceExtensions].map((extension) => path.join(target, `index${extension}`)),
  ];
  return candidates.find(
    (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()
  );
}

function importedComponent(sourceFile, specifier) {
  const target = resolveSourceFile(sourceFile, specifier);
  if (!target || !target.startsWith(`${componentRoot}${path.sep}`)) return undefined;
  return target;
}

function componentReexportedFeatures(componentFile) {
  const source = fs.readFileSync(componentFile, 'utf8');
  return [...source.matchAll(reexportPattern)].flatMap((match) => {
    const specifier = match[1];
    const feature = importedFeature(componentFile, specifier);
    return feature ? [{ feature, specifier }] : [];
  });
}

const violations = [];
const transitiveViolations = [];

for (const sourceFile of walk(featureRoot)) {
  const fromFeature = featureNameFor(sourceFile);
  if (!fromFeature) continue;

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
    const componentFile = importedComponent(sourceFile, specifier);
    if (!componentFile) continue;
    for (const reexport of componentReexportedFeatures(componentFile)) {
      const component = path.relative(root, componentFile);
      if (
        reexport.feature !== fromFeature &&
        !allowedComponentFeatureBridges.has(`${component}:${reexport.feature}`)
      ) {
        transitiveViolations.push({
          file: path.relative(root, sourceFile),
          fromFeature,
          toFeature: reexport.feature,
          specifier,
          component,
          reexportSpecifier: reexport.specifier,
        });
      }
    }
  }
}

if (violations.length > 0 || transitiveViolations.length > 0) {
  console.error('Feature boundary violations found.');
  console.error(
    'Guarded product features must use neutral shared contracts, not sibling implementations or component re-export bridges.'
  );
  for (const violation of violations) {
    console.error(
      `- ${violation.file}: ${violation.fromFeature} -> ${violation.toFeature} (${violation.specifier})`
    );
  }
  for (const violation of transitiveViolations) {
    console.error(
      `- ${violation.file}: ${violation.fromFeature} -> ${violation.toFeature} via ${violation.component} (${violation.specifier} -> ${violation.reexportSpecifier})`
    );
  }
  process.exit(1);
}

console.log(
  'PASS feature boundaries: product features do not import sibling implementations directly or through component re-export bridges.'
);
