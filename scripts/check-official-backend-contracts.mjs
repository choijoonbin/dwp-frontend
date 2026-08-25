#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(dirname(fileURLToPath(import.meta.url)), '..');

function fail(message, exitCode = 2) {
  console.error(`Official backend contract release check failed: ${message}`);
  process.exit(exitCode);
}

function parseArguments(argv) {
  const cli = {};
  const options = new Map([
    ['--backend-contracts', 'backendContracts'],
    ['--authorization-directory', 'authorizationDirectory'],
    ['--fixture-artifact', 'fixtureArtifact'],
    ['--gateway-openapi', 'gatewayOpenApi'],
  ]);
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 2) {
    const field = options.get(argv[index]);
    const value = argv[index + 1];
    if (!field || !value || value.startsWith('--') || seen.has(field)) {
      fail(
        'usage: node scripts/check-official-backend-contracts.mjs ' +
          '[--backend-contracts <official contracts directory>] or ' +
          '[--authorization-directory <directory> --fixture-artifact <file> --gateway-openapi <file>]'
      );
    }
    seen.add(field);
    cli[field] = value;
  }
  const hasSpecificCli = ['authorizationDirectory', 'fixtureArtifact', 'gatewayOpenApi'].some(
    (field) => cli[field]
  );
  if (cli.backendContracts && hasSpecificCli) {
    fail('backend package mode and contract-specific CLI inputs are mutually exclusive.');
  }
  const backendContracts =
    cli.backendContracts ??
    (hasSpecificCli ? undefined : process.env.DWP_OFFICIAL_BACKEND_CONTRACTS_DIR);
  const values = {};
  if (backendContracts) {
    const contractRoot = path.resolve(backendContracts);
    values.authorizationDirectory = path.join(contractRoot, 'product-authorization');
    values.fixtureArtifact = path.join(
      contractRoot,
      'product-authorization/pilot-fixtures.v1.generated.json'
    );
    values.gatewayOpenApi = path.join(contractRoot, 'openapi/gateway-public.json');
  } else {
    values.authorizationDirectory =
      cli.authorizationDirectory ?? process.env.DWP_PRODUCT_AUTHORIZATION_DIR;
    values.fixtureArtifact = cli.fixtureArtifact ?? process.env.DWP_PRODUCT_AUTHORIZATION_FIXTURE;
    values.gatewayOpenApi = cli.gatewayOpenApi ?? process.env.DWP_GATEWAY_OPENAPI;
  }

  const missing = [
    ['authorization directory', values.authorizationDirectory],
    ['fixture artifact', values.fixtureArtifact],
    ['Gateway OpenAPI artifact', values.gatewayOpenApi],
  ].filter(([, value]) => !value);
  if (missing.length > 0) {
    fail(
      `release mode requires explicit official backend ${missing.map(([label]) => label).join(', ')}. ` +
        'Set DWP_OFFICIAL_BACKEND_CONTRACTS_DIR or all three contract-specific inputs.'
    );
  }

  return {
    authorizationDirectory: path.resolve(values.authorizationDirectory),
    fixtureArtifact: path.resolve(values.fixtureArtifact),
    gatewayOpenApi: path.resolve(values.gatewayOpenApi),
  };
}

function requireArtifact(target, kind) {
  const stats = fs.statSync(target, { throwIfNoEntry: false });
  if (!stats || (kind === 'directory' ? !stats.isDirectory() : !stats.isFile())) {
    fail(`official ${kind} is missing: ${target}`, 1);
  }
}

function runCheck(script, ...arguments_) {
  const result = spawnSync(
    process.execPath,
    [path.join(root, 'scripts', script), '--check', ...arguments_],
    {
      cwd: root,
      encoding: 'utf8',
    }
  );
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) fail(result.error.message, 1);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const inputs = parseArguments(process.argv.slice(2));
requireArtifact(inputs.authorizationDirectory, 'directory');
requireArtifact(inputs.fixtureArtifact, 'file');
requireArtifact(inputs.gatewayOpenApi, 'file');

runCheck('sync-product-surface-authorization.mjs', inputs.authorizationDirectory);
runCheck(
  'sync-product-authorization-fixtures.mjs',
  inputs.fixtureArtifact,
  '--authorization',
  inputs.authorizationDirectory
);
runCheck('sync-openapi-contract.mjs', inputs.gatewayOpenApi);

console.log(
  'PASS frontend contract snapshots exactly match all official backend release artifacts.'
);
