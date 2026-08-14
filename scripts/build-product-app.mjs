#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const productId = process.argv[2];
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, 'architecture/frontend-apps.json'), 'utf8')
);
const product = [...manifest.applications, manifest.shell].find(
  (candidate) => candidate.id === productId
);
if (!product || product.deployment !== 'independent') {
  console.error(
    `Unknown independently deployable product application: ${productId ?? '<missing>'}`
  );
  process.exit(2);
}

const vite = path.join(
  root,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'vite.cmd' : 'vite'
);
const result = spawnSync(vite, ['build', '--config', 'vite.product.config.ts'], {
  cwd: root,
  env: { ...process.env, DWP_PRODUCT_ID: productId },
  stdio: 'inherit',
});
if (result.status !== 0) process.exit(result.status ?? 1);

const budgetResult = spawnSync(
  process.execPath,
  [
    'scripts/check-bundle-budget.mjs',
    '--output',
    `dist/apps/${productId}`,
    '--budgets',
    'scripts/product-bundle-budgets.json',
    '--label',
    `DWP ${productId} product bundle budget`,
  ],
  { cwd: root, stdio: 'inherit' }
);
process.exit(budgetResult.status ?? 1);
