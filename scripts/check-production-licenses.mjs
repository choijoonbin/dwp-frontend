#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportPath = path.join(
  workspaceRoot,
  'docs/06-delivery/generated/production-dependency-licenses.json'
);

const allowedLicenseIds = new Set([
  '0BSD',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'BlueOak-1.0.0',
  'CC0-1.0',
  'ISC',
  'MIT',
  'Unicode-3.0',
]);
const expressionKeywords = new Set(['AND', 'OR', 'WITH']);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function packagePath(name, fromDirectory) {
  let current = fromDirectory;

  while (current.startsWith(workspaceRoot)) {
    const candidate = path.join(current, 'node_modules', ...name.split('/'), 'package.json');
    if (fs.existsSync(candidate)) return candidate;
    if (current === workspaceRoot) break;
    current = path.dirname(current);
  }

  return null;
}

function licenseExpression(packageJson) {
  if (typeof packageJson.license === 'string') return packageJson.license.trim();
  if (packageJson.license && typeof packageJson.license.type === 'string') {
    return packageJson.license.type.trim();
  }
  if (Array.isArray(packageJson.licenses)) {
    const values = packageJson.licenses
      .map((item) => (typeof item === 'string' ? item : item?.type))
      .filter(Boolean);
    if (values.length) return values.join(' OR ');
  }
  return 'UNKNOWN';
}

function licenseIds(expression) {
  return (expression.match(/[A-Za-z0-9][A-Za-z0-9.+-]*/g) ?? []).filter(
    (token) => !expressionKeywords.has(token)
  );
}

function isAllowed(expression) {
  if (expression === 'UNKNOWN' || expression.startsWith('SEE LICENSE')) return false;
  const ids = licenseIds(expression);
  return ids.length > 0 && ids.every((id) => allowedLicenseIds.has(id));
}

function repositoryUrl(packageJson) {
  if (typeof packageJson.repository === 'string') return packageJson.repository;
  return packageJson.repository?.url ?? null;
}

function productionGraph(rootPackage) {
  const packages = new Map();
  const issues = [];
  const queue = Object.keys(rootPackage.dependencies ?? {}).map((name) => ({
    name,
    fromDirectory: workspaceRoot,
    optional: false,
  }));

  while (queue.length) {
    const request = queue.shift();
    const manifestPath = packagePath(request.name, request.fromDirectory);

    if (!manifestPath) {
      if (!request.optional) {
        issues.push({ type: 'MISSING_PACKAGE', package: request.name });
      }
      continue;
    }

    const manifest = readJson(manifestPath);
    const key = `${manifest.name}@${manifest.version}`;
    if (packages.has(key)) continue;

    const license = licenseExpression(manifest);
    const entry = {
      name: manifest.name,
      version: manifest.version,
      license,
      repository: repositoryUrl(manifest),
    };
    packages.set(key, entry);

    if (!isAllowed(license)) {
      issues.push({ type: 'LICENSE_REVIEW_REQUIRED', package: key, license });
    }

    const packageDirectory = path.dirname(manifestPath);
    for (const name of Object.keys(manifest.dependencies ?? {})) {
      queue.push({ name, fromDirectory: packageDirectory, optional: false });
    }
    for (const name of Object.keys(manifest.optionalDependencies ?? {})) {
      queue.push({ name, fromDirectory: packageDirectory, optional: true });
    }
  }

  const sortedPackages = [...packages.values()].sort(
    (left, right) =>
      left.name.localeCompare(right.name) || left.version.localeCompare(right.version)
  );
  const licenseCounts = {};
  for (const item of sortedPackages) {
    licenseCounts[item.license] = (licenseCounts[item.license] ?? 0) + 1;
  }

  return {
    schemaVersion: 1,
    rootPackage: rootPackage.name,
    dependencyCount: sortedPackages.length,
    licenseCounts: Object.fromEntries(
      Object.entries(licenseCounts).sort(([left], [right]) => left.localeCompare(right))
    ),
    packages: sortedPackages,
    issues: issues.sort((left, right) =>
      `${left.type}:${left.package}`.localeCompare(`${right.type}:${right.package}`)
    ),
  };
}

const rootPackage = readJson(path.join(workspaceRoot, 'package.json'));
const report = productionGraph(rootPackage);
const serialized = `${JSON.stringify(report, null, 2)}\n`;

if (process.argv.includes('--write')) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, serialized);
} else if (!fs.existsSync(reportPath) || fs.readFileSync(reportPath, 'utf8') !== serialized) {
  console.error(
    'Production dependency license report is missing or stale. Run yarn license:report.'
  );
  process.exitCode = 1;
}

if (report.issues.length) {
  console.error(JSON.stringify(report.issues, null, 2));
  process.exitCode = 1;
} else {
  console.log(
    `Production dependency license check passed: ${report.dependencyCount} packages, ${Object.keys(report.licenseCounts).length} license expressions.`
  );
}
