#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const sourceRoots = ['apps', 'libs'].map((segment) => path.join(root, segment));
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);
const allowedFetchFiles = new Set(['libs/shared-utils/src/axios-instance.ts']);

const checks = [
  {
    pattern: /\bfetch\s*\(/g,
    message:
      'Use libs/shared-utils/src/axios-instance.ts so browser calls keep CSRF, tenant, locale, and Gateway routing.',
    allow: (relative) => allowedFetchFiles.has(relative),
  },
  {
    pattern: /\bXMLHttpRequest\b|\bEventSource\s*\(|\bnew\s+WebSocket\s*\(/g,
    message:
      'Browser transport must be introduced through an approved shared client and Gateway contract.',
  },
  {
    pattern: /from\s+['"]axios['"]|require\(\s*['"]axios['"]\s*\)|\baxios\.create\s*\(/g,
    message: 'Use the shared axiosInstance-compatible client instead of local Axios instances.',
  },
  {
    pattern: /https?:\/\/(?:localhost|127\.0\.0\.1):800[1-9]\b/g,
    message:
      'Frontend code must not call backend service ports directly; use VITE_API_URL and /api/** Gateway routes.',
  },
  {
    pattern: /['"`]\/internal\//g,
    message: 'Frontend code must not call backend internal service APIs.',
  },
  {
    pattern: /axiosInstance\.(?:get|post|put|patch|delete)\(\s*(['"`])(?!\/api\/)/g,
    message:
      'Literal axiosInstance calls must start with /api/ so they resolve through the Gateway.',
  },
];

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (['node_modules', 'dist', 'coverage', '.turbo'].includes(entry.name)) return [];
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    return sourceExtensions.has(path.extname(entry.name)) ? [absolute] : [];
  });
}

const violations = [];

for (const sourceFile of sourceRoots.flatMap(walk)) {
  const relative = path.relative(root, sourceFile);
  const source = fs.readFileSync(sourceFile, 'utf8');
  for (const check of checks) {
    if (check.allow?.(relative)) continue;
    for (const match of source.matchAll(check.pattern)) {
      const before = source.slice(0, match.index);
      const line = before.split('\n').length;
      violations.push({
        file: relative,
        line,
        marker: match[0],
        message: check.message,
      });
    }
  }
}

if (violations.length > 0) {
  console.error('API boundary violations found.');
  console.error(
    'Frontend runtime integrations must use shared API clients and Gateway /api/** routes.'
  );
  for (const violation of violations) {
    console.error(
      `- ${violation.file}:${violation.line}: ${violation.marker} - ${violation.message}`
    );
  }
  process.exit(1);
}

console.log(
  'PASS API boundaries: frontend runtime calls are centralized through Gateway /api/** clients.'
);
