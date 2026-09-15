#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateHomeWave2Evidence } from './home-wave2-evidence-validation.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = resolve(root, 'architecture/home-wave2-evidence.v1.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const errors = validateHomeWave2Evidence(manifest, root);

if (errors.length > 0) {
  console.error('Wave 2 Home evidence is invalid:\n');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Wave 2 Home evidence');
console.log(`- canonical screens: ${manifest.canonicalScreens.length}`);
console.log(`- production compositions: ${manifest.counts.productionCompositions}`);
console.log(`- state and specification evidence: ${manifest.counts.stateAndSpecificationEvidence}`);
console.log('- remote runtime sources: 0');
