#!/usr/bin/env node

import fs from 'node:fs';
import { createHash } from 'node:crypto';
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
const meetingBackgroundArtifact = path.join(
  root,
  'dist/apps',
  productId,
  'assets/meeting-background'
);
if (productId !== 'meetings') {
  fs.rmSync(meetingBackgroundArtifact, { force: true, recursive: true });
}
if (result.status !== 0) process.exit(result.status ?? 1);

if (productId === 'meetings') {
  const requiredMeetingBackgroundArtifacts = {
    'mediapipe-0.10.14/selfie-segmenter-landscape-v1.tflite':
      '490e9ea734313e0de10fa0cd9e3c6133e36ea4db2b7a49bde9ef019f72796b8e',
    'mediapipe-0.10.14/vision_wasm_nosimd_internal.js':
      'abe9b6fbeaf86fcb53a5edce3926c82ccb0619e18fed4d9d9ce561ee7f55e054',
    'mediapipe-0.10.14/vision_wasm_nosimd_internal.wasm':
      '38b61feab2fd7934e05cbe9f68baa308978a5e3b7f85c1913bb8ae89b8ef8b97',
    'presets/office-neutral-v1.svg':
      '1f206bb431463f91a988dd8e0c31656cbc89c004509a3058d51dc6d60bb02949',
  };
  const invalid = Object.entries(requiredMeetingBackgroundArtifacts).flatMap(
    ([relativePath, expected]) => {
      const artifact = path.join(meetingBackgroundArtifact, relativePath);
      if (!fs.statSync(artifact, { throwIfNoEntry: false })?.isFile()) return [relativePath];
      const actual = createHash('sha256').update(fs.readFileSync(artifact)).digest('hex');
      return actual === expected ? [] : [relativePath];
    }
  );
  if (invalid.length > 0) {
    console.error(
      `Meetings artifact has missing or unapproved local background assets: ${invalid.join(', ')}`
    );
    process.exit(1);
  }
} else {
  if (fs.existsSync(meetingBackgroundArtifact)) {
    console.error(`${productId} artifact must not contain the Meetings-only background runtime.`);
    process.exit(1);
  }
}
console.log(`PASS ${productId} product-owned public asset boundary.`);

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
