#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const defaultLimit = 1_000;
const baselinePath = path.join(root, 'scripts/maintenance-source-size-baseline.json');
const rewriteCommand = 'yarn maintenance-source-size:baseline';
const governedRoots = ['e2e', 'e2e-storybook', '.storybook', 'scripts'];
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

function readBaseline() {
  const value = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    value.version !== 1 ||
    value.files === null ||
    typeof value.files !== 'object' ||
    Array.isArray(value.files)
  ) {
    throw new Error('expected { version: 1, files: { <path>: <exact line count> } }');
  }

  for (const [file, limit] of Object.entries(value.files)) {
    const segments = file.split('/');
    if (
      !file ||
      path.isAbsolute(file) ||
      file.includes('\\') ||
      segments.includes('..') ||
      !governedRoots.some(
        (governedRoot) => file === governedRoot || file.startsWith(`${governedRoot}/`)
      ) ||
      !extensions.has(path.extname(file)) ||
      !Number.isSafeInteger(limit) ||
      limit <= defaultLimit
    ) {
      throw new Error(`invalid maintenance source-size entry: ${file}`);
    }
  }
  return value.files;
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.endsWith('-snapshots')) return [];
      return walk(absolute);
    }
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

function measuredSources() {
  return Object.fromEntries(
    governedRoots
      .map((governedRoot) => path.join(root, governedRoot))
      .filter(fs.existsSync)
      .flatMap(walk)
      .filter((file) => !isGeneratedSource(file))
      .map((file) => [path.relative(root, file), lineCount(file)])
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

function writeExactBaseline(baseline, measured) {
  const increases = Object.entries(measured).filter(
    ([relative, lines]) => lines > (baseline[relative] ?? defaultLimit)
  );
  if (increases.length) {
    console.error('Refusing to raise the maintenance source-size baseline. Split these files:');
    increases.forEach(([relative, lines]) =>
      console.error(`- ${relative}: ${lines} lines exceeds ${baseline[relative] ?? defaultLimit}`)
    );
    return 1;
  }

  const nextFiles = Object.fromEntries(
    Object.entries(measured).filter(([, lines]) => lines > defaultLimit)
  );
  fs.writeFileSync(baselinePath, `${JSON.stringify({ version: 1, files: nextFiles }, null, 2)}\n`);
  console.log(
    `Maintenance source-size baseline updated (${Object.keys(nextFiles).length} exact exception(s)).`
  );
  return 0;
}

function checkExactBaseline(baseline, measured) {
  const violations = [];
  for (const [relative, lines] of Object.entries(measured)) {
    const allowed = baseline[relative] ?? defaultLimit;
    if (lines > allowed) {
      violations.push(`${relative}: ${lines} lines exceeds ${allowed}`);
    } else if (relative in baseline && lines <= defaultLimit) {
      violations.push(
        `${relative}: ${lines} lines no longer needs an exception; run \`${rewriteCommand}\``
      );
    } else if (relative in baseline && lines < allowed) {
      violations.push(
        `${relative}: reduced from ${allowed} to ${lines} lines; run \`${rewriteCommand}\` to lock in the improvement`
      );
    }
  }

  for (const relative of Object.keys(baseline)) {
    if (!(relative in measured)) {
      violations.push(`${relative}: stale maintenance source-size baseline entry`);
    }
  }

  if (violations.length) {
    console.error('Maintenance source-size budget violations found.');
    violations.forEach((violation) => console.error(`- ${violation}`));
    return 1;
  }

  console.log(
    `PASS maintenance source-size budget: ${Object.keys(measured).length} test/tool files checked; ${Object.keys(baseline).length} exact legacy exception(s); new files are limited to ${defaultLimit} lines.`
  );
  return 0;
}

function main() {
  const argumentsList = process.argv.slice(2);
  if (argumentsList.length > 1 || (argumentsList.length === 1 && argumentsList[0] !== '--write')) {
    console.error('Usage: check-maintenance-source-size.mjs [--write]');
    return 2;
  }
  try {
    const baseline = readBaseline();
    const measured = measuredSources();
    return argumentsList[0] === '--write'
      ? writeExactBaseline(baseline, measured)
      : checkExactBaseline(baseline, measured);
  } catch (error) {
    console.error(
      `Invalid maintenance source-size baseline: ${error instanceof Error ? error.message : error}`
    );
    return 1;
  }
}

process.exitCode = main();
