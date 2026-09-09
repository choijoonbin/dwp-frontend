import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'public/assets/meeting-background/mediapipe-0.10.14');
const packageRoot = path.join(root, 'node_modules/@mediapipe/tasks-vision');
const installed = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'));
const bundle = await readFile(path.join(packageRoot, 'vision_bundle.mjs'));
if (
  installed.version !== '0.10.14' ||
  createHash('sha256').update(bundle).digest('hex') !==
    'e77f281f9619150d937023c355bae170e9120e3b9e43f1e23a2a7bee07197669'
) {
  throw new Error('Unapproved MediaPipe runtime: explicit security and network review required');
}
const artifacts = {
  'vision_wasm_nosimd_internal.js':
    'abe9b6fbeaf86fcb53a5edce3926c82ccb0619e18fed4d9d9ce561ee7f55e054',
  'vision_wasm_nosimd_internal.wasm':
    '38b61feab2fd7934e05cbe9f68baa308978a5e3b7f85c1913bb8ae89b8ef8b97',
  'selfie-segmenter-landscape-v1.tflite':
    '490e9ea734313e0de10fa0cd9e3c6133e36ea4db2b7a49bde9ef019f72796b8e',
};
await mkdir(target, { recursive: true });
for (const [name, expected] of Object.entries(artifacts)) {
  if (!process.argv.includes('--check') && name.startsWith('vision_')) {
    const source = path.join(root, 'node_modules/@mediapipe/tasks-vision/wasm', name);
    const bytes = await readFile(source);
    if (createHash('sha256').update(bytes).digest('hex') !== expected) {
      throw new Error(`Unapproved MediaPipe asset: ${name}`);
    }
    await copyFile(source, path.join(target, name));
  }
  const bytes = await readFile(path.join(target, name));
  if (createHash('sha256').update(bytes).digest('hex') !== expected) {
    throw new Error(`Background asset checksum mismatch: ${name}`);
  }
}
const officePreset = path.join(
  root,
  'public/assets/meeting-background/presets/office-neutral-v1.svg'
);
const officeBytes = await readFile(officePreset);
if (
  createHash('sha256').update(officeBytes).digest('hex') !==
  '1f206bb431463f91a988dd8e0c31656cbc89c004509a3058d51dc6d60bb02949'
) {
  throw new Error('Background asset checksum mismatch: presets/office-neutral-v1.svg');
}
console.log('Meeting background assets: 4 approved local artifacts PASS');
