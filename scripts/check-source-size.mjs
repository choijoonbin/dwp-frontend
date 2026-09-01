#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const defaultLimit = 1_000;
const baselinePath = path.join(root, 'scripts/source-size-baseline.json');
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const writeBaseline = process.argv.includes('--write');
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);

function isValidBaseline(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.entries(value).every(
      ([file, limit]) =>
        file.length > 0 &&
        !path.isAbsolute(file) &&
        !file.split('/').includes('..') &&
        (file.startsWith('apps/dwp/src/') || file.startsWith('libs/')) &&
        Number.isSafeInteger(limit) &&
        limit > defaultLimit
    )
  );
}

if (!isValidBaseline(baseline)) {
  console.error(
    `Invalid source-size baseline: every entry must map a file to an integer greater than ${defaultLimit}.`
  );
  process.exit(1);
}

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
  return /^\/\*\* (?:@generated|Generated) from [^\r\n*]+\. Do not edit manually\. \*\/(?:\r?\n|$)/.test(
    header
  );
}

const sourceFiles = [path.join(root, 'apps/dwp/src'), path.join(root, 'libs')]
  .filter(fs.existsSync)
  .flatMap(walk)
  .filter((file) => !file.includes(`${path.sep}node_modules${path.sep}`));
const governedSourceFiles = sourceFiles.filter((file) => !isGeneratedSource(file));
const violations = [];

if (writeBaseline) {
  const measuredFiles = governedSourceFiles.map((file) => [
    path.relative(root, file),
    lineCount(file),
  ]);
  const increases = measuredFiles.filter(
    ([relative, lines]) => lines > (baseline[relative] ?? defaultLimit)
  );
  if (increases.length) {
    console.error('Refusing to raise the source-size baseline. Split the following source files:');
    increases.forEach(([relative, lines]) =>
      console.error(`- ${relative}: ${lines} lines exceeds ${baseline[relative] ?? defaultLimit}`)
    );
    process.exit(1);
  }

  const nextBaseline = Object.fromEntries(
    measuredFiles
      .filter(([, lines]) => lines > defaultLimit)
      .sort(([left], [right]) => left.localeCompare(right))
  );
  fs.writeFileSync(baselinePath, `${JSON.stringify(nextBaseline, null, 2)}\n`);
  console.log(
    `Source-size baseline updated (${Object.keys(nextBaseline).length} exception file(s)).`
  );
  process.exit(0);
}

for (const file of governedSourceFiles) {
  const relative = path.relative(root, file);
  const lines = lineCount(file);
  const limit = baseline[relative] ?? defaultLimit;
  if (lines > limit) violations.push(`${relative}: ${lines} lines exceeds ${limit}`);
}

for (const relative of Object.keys(baseline)) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) {
    violations.push(`${relative}: stale source-size baseline entry`);
    continue;
  }

  const lines = lineCount(absolute);
  if (lines <= defaultLimit) {
    violations.push(
      `${relative}: ${lines} lines no longer needs a source-size exception; remove the baseline entry`
    );
    continue;
  }

  const allowedLines = baseline[relative];
  if (lines < allowedLines) {
    violations.push(
      `${relative}: reduced from ${allowedLines} to ${lines} lines; run \`yarn source-size:baseline\` to lock in the improvement`
    );
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
