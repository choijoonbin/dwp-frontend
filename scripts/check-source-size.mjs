#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const defaultLimit = 1_000;
const baselinePath = path.join(root, 'scripts/source-size-baseline.json');
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    return extensions.has(path.extname(entry.name)) ? [absolute] : [];
  });
}

function lineCount(file) {
  const source = fs.readFileSync(file, 'utf8');
  if (!source) return 0;
  return source.split(/\r?\n/).length - (source.endsWith('\n') ? 1 : 0);
}

function isGeneratedSource(file) {
  const header = fs.readFileSync(file, 'utf8').slice(0, 512);
  return /(?:@generated|Generated .*Do not edit manually\.)/i.test(header);
}

const sourceFiles = [path.join(root, 'apps/dwp/src'), path.join(root, 'libs')]
  .filter(fs.existsSync)
  .flatMap(walk)
  .filter((file) => !file.includes(`${path.sep}node_modules${path.sep}`));
const governedSourceFiles = sourceFiles.filter((file) => !isGeneratedSource(file));
const violations = [];

for (const file of governedSourceFiles) {
  const relative = path.relative(root, file);
  const lines = lineCount(file);
  const limit = baseline[relative] ?? defaultLimit;
  if (lines > limit) violations.push(`${relative}: ${lines} lines exceeds ${limit}`);
}

for (const relative of Object.keys(baseline)) {
  if (!fs.existsSync(path.join(root, relative))) {
    violations.push(`${relative}: stale source-size baseline entry`);
  }
}

if (violations.length > 0) {
  console.error('Source-size budget violations found.');
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}

console.log(
  `PASS source-size budget: ${governedSourceFiles.length} production files checked; ${sourceFiles.length - governedSourceFiles.length} generated file(s) excluded; new files are limited to ${defaultLimit} lines.`
);
