#!/usr/bin/env node

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const outputDirectory = path.join(process.cwd(), 'build', 'reports', 'sbom');
const executable = path.join(
  process.cwd(),
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'cyclonedx-yarn.cmd' : 'cyclonedx-yarn'
);
mkdirSync(outputDirectory, { recursive: true });

const result = spawnSync(
  executable,
  [
    '--production',
    '--output-format',
    'JSON',
    '--output-file',
    path.join(outputDirectory, 'frontend.cdx.json'),
  ],
  { stdio: 'inherit' }
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
