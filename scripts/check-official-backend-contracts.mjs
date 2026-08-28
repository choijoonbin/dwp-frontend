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
    officialReleaseMode: Boolean(
      process.env.DWP_OFFICIAL_BACKEND_CONTRACTS_DIR && !cli.backendContracts && !hasSpecificCli
    ),
  };
}

function requireArtifact(target, kind) {
  const stats = fs.statSync(target, { throwIfNoEntry: false });
  if (!stats || (kind === 'directory' ? !stats.isDirectory() : !stats.isFile())) {
    fail(`official ${kind} is missing: ${target}`, 1);
  }
}

function runCheck(script, ...arguments_) {
  const environment = { ...process.env };
  if (script === 'sync-product-surface-internal-closure.mjs' && arguments_.length === 0) {
    delete environment.DWP_PRODUCT_AUTHORIZATION_DIR;
    delete environment.DWP_BACKEND_CHECKOUT;
    delete environment.DWP_BACKEND_REVISION;
  }
  const result = spawnSync(
    process.execPath,
    [path.join(root, 'scripts', script), '--check', ...arguments_],
    {
      cwd: root,
      encoding: 'utf8',
      env: environment,
    }
  );
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) fail(result.error.message, 1);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function runOfficialBackendExecutableChecks(inputs) {
  if (!inputs.officialReleaseMode) return;
  const checkout = process.env.DWP_BACKEND_CHECKOUT;
  const revision = process.env.DWP_BACKEND_REVISION;
  const agentRoot = process.env.DWP_AGENT_EVIDENCE_ROOT;
  if (!checkout || !revision || !agentRoot || !/^[a-f0-9]{40}$/u.test(revision)) {
    fail(
      'official release mode requires DWP_BACKEND_CHECKOUT, full DWP_BACKEND_REVISION and DWP_AGENT_EVIDENCE_ROOT',
      1
    );
  }
  requireArtifact(checkout, 'directory');
  requireArtifact(agentRoot, 'directory');
  const actualRevision = spawnSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  });
  if (actualRevision.status !== 0 || actualRevision.stdout.trim() !== revision) {
    fail('official backend checkout HEAD differs from DWP_BACKEND_REVISION', 1);
  }
  const origin = spawnSync('git', ['-C', checkout, 'remote', 'get-url', 'origin'], {
    encoding: 'utf8',
  });
  if (
    origin.status !== 0 ||
    ![
      'https://github.com/choijoonbin/dwp-backend',
      'https://github.com/choijoonbin/dwp-backend.git',
    ].includes(origin.stdout.trim())
  ) {
    fail('official backend checkout origin is not trusted', 1);
  }
  const expectedAuthorization = fs.realpathSync(
    path.join(checkout, 'contracts/product-authorization')
  );
  if (fs.realpathSync(inputs.authorizationDirectory) !== expectedAuthorization) {
    fail('official authorization directory is not owned by DWP_BACKEND_CHECKOUT', 1);
  }
  for (const [script, arguments_] of [
    ['scripts/generate-product-authorization-contracts.py', ['--check']],
    ['scripts/check-authorization-negative-matrix.py', []],
  ]) {
    const result = spawnSync('python3', [script, ...arguments_], {
      cwd: checkout,
      encoding: 'utf8',
      env: { ...process.env, DWP_AGENT_EVIDENCE_ROOT: agentRoot },
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.error) fail(result.error.message, 1);
    if (result.status !== 0) {
      fail(`official backend executable validator failed: ${script}`, result.status ?? 1);
    }
  }
  console.log(
    'PASS official backend registry and source-bound negative matrix validators executed.'
  );
}

const inputs = parseArguments(process.argv.slice(2));
requireArtifact(inputs.authorizationDirectory, 'directory');
requireArtifact(inputs.fixtureArtifact, 'file');
requireArtifact(inputs.gatewayOpenApi, 'file');
runOfficialBackendExecutableChecks(inputs);

runCheck('sync-product-surface-authorization.mjs', inputs.authorizationDirectory);
if (inputs.officialReleaseMode) {
  runCheck('sync-product-surface-internal-closure.mjs', inputs.authorizationDirectory);
} else {
  runCheck('sync-product-surface-internal-closure.mjs');
}
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
