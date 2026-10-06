#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, constants as fsConstants, fstatSync, openSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE_PATH = fileURLToPath(import.meta.url);
const FRONTEND_ROOT = path.resolve(path.dirname(FILE_PATH), '..');
const REQUIRED_NODE_MAJOR = 24;
const REQUIRED_NODE_MINOR = 18;
const MAX_SOURCE_BYTES = 1000 * 1024;
const EXECUTION_MODULES = Object.freeze([
  'scripts/hris-w1-checkpoint-core.mjs',
  'scripts/hris-w1-checkpoint-runtime.mjs',
  'scripts/hris-w1-checkpoint-live.mjs',
  'scripts/hris-w1-checkpoint-payroll.mjs',
  'scripts/hris-w1-checkpoint-browser-run.mjs',
  'scripts/hris-w1-checkpoint-browser-evidence.mjs',
  'scripts/hris-w1-checkpoint-evidence.mjs',
]);
const CLOSURE_PATHS = Object.freeze([
  ...EXECUTION_MODULES,
  'scripts/hris-w1-playwright-artifact-ownership.mjs',
  'playwright.hris-w1-live.config.ts',
  'e2e/hris-w1-live-synthetic-acceptance.spec.ts',
  'e2e/support/hris-w1-live-environment.ts',
  'e2e/support/hris-w1-live-home-identity.ts',
  'e2e/support/hris-w1-live-artifact-sanitizer.ts',
  'package.json',
  'yarn.lock',
  '.node-version',
  'vite.config.ts',
]);
const LINE_LIMITED_MODULES = new Set([
  ...EXECUTION_MODULES,
  'scripts/hris-w1-playwright-artifact-ownership.mjs',
  'e2e/support/hris-w1-live-artifact-sanitizer.ts',
]);

function fail(message) {
  throw new Error(message);
}

function sameStat(left, right) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.mode === right.mode &&
    left.nlink === right.nlink &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

function attestedRead(
  pathname,
  location,
  maximumBytes = MAX_SOURCE_BYTES,
  maximumLines = undefined
) {
  if (typeof fsConstants.O_NOFOLLOW !== 'number') fail('Checkpoint requires O_NOFOLLOW support.');
  let descriptor;
  try {
    descriptor = openSync(
      pathname,
      fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW | (fsConstants.O_CLOEXEC ?? 0)
    );
  } catch (error) {
    fail(`${location} could not be opened without following links: ${error.message}`);
  }
  try {
    const before = fstatSync(descriptor, { bigint: true });
    if (!before.isFile() || before.nlink !== 1n || before.size <= 0n) {
      fail(`${location} must be one non-empty, singly linked regular file.`);
    }
    if (before.size > BigInt(maximumBytes)) fail(`${location} exceeds its integrity size limit.`);
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor, { bigint: true });
    if (!sameStat(before, after) || BigInt(bytes.byteLength) !== before.size) {
      fail(`${location} changed while it was read.`);
    }
    if (maximumLines !== undefined && bytes.toString('utf8').split('\n').length > maximumLines) {
      fail(`${location} exceeds the ${maximumLines}-line checkpoint module limit.`);
    }
    return Object.freeze({
      sha256: createHash('sha256').update(bytes).digest('hex'),
      byteCount: bytes.byteLength,
    });
  } finally {
    closeSync(descriptor);
  }
}

function gitOutput(args) {
  const result = spawnSync('git', ['-C', FRONTEND_ROOT, ...args], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH ?? '' },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });
  if (result.status !== 0) fail(`Frontend Git provenance failed for ${args[0]}.`);
  return result.stdout.trim();
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function captureFrontendProvenance() {
  const head = gitOutput(['rev-parse', 'HEAD']);
  if (!/^[0-9a-f]{40}$/u.test(head)) fail('Frontend Git HEAD is invalid.');
  if (gitOutput(['status', '--porcelain=v1', '--untracked-files=all'])) {
    fail('Frontend Git worktree must be clean before live checkpoint execution.');
  }
  const closure = Object.fromEntries(
    CLOSURE_PATHS.map((relativePath) => [
      relativePath,
      attestedRead(
        path.join(FRONTEND_ROOT, relativePath),
        relativePath,
        MAX_SOURCE_BYTES,
        LINE_LIMITED_MODULES.has(relativePath) ? 1000 : undefined
      ),
    ])
  );
  return Object.freeze({
    gitHead: head,
    clean: true,
    executable: attestedRead(FILE_PATH, 'checkpoint executable', MAX_SOURCE_BYTES, 1000),
    closure: Object.freeze(closure),
  });
}

function assertFrontendProvenanceUnchanged(provenance) {
  if (canonicalJson(captureFrontendProvenance()) !== canonicalJson(provenance)) {
    fail('Frontend Git HEAD, clean state, executable, or closure changed during checkpoint.');
  }
}

async function importAttestedModules(provenance) {
  const modules = await Promise.all(EXECUTION_MODULES.map((name) => import(`../${name}`)));
  assertFrontendProvenanceUnchanged(provenance);
  return {
    core: modules[0],
    runtime: modules[1],
    live: modules[2],
    payroll: modules[3],
    browserRun: modules[4],
    browserEvidence: modules[5],
    evidence: modules[6],
  };
}

async function main() {
  if (process.argv.length !== 2)
    fail('The checkpoint executable accepts no command-line arguments.');
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major !== REQUIRED_NODE_MAJOR || minor < REQUIRED_NODE_MINOR) {
    fail(`Node ${REQUIRED_NODE_MAJOR}.${REQUIRED_NODE_MINOR}+ <25 is required.`);
  }
  const frontendProvenance = captureFrontendProvenance();
  const modules = await importAttestedModules(frontendProvenance);
  const { core, runtime, live, payroll, browserRun, browserEvidence, evidence } = modules;
  browserRun.installExitCleanup();
  const environment = core.parseCheckpointEnvironment(process.env);
  browserRun.assertFilesystemBoundary(environment);
  const runtimePath = path.join(environment.evidenceDir, core.RUNTIME_MANIFEST_NAME);
  const runtimeFile = core.readAttestedJson(runtimePath, 'runtime.json', 1024 * 1024);
  const validatedRuntime = runtime.validateRuntimeManifest(runtimeFile.value, environment);
  const { request: requestApi } = await import('@playwright/test');
  assertFrontendProvenanceUnchanged(frontendProvenance);

  let sessionA;
  let sessionB;
  try {
    sessionA = await live.createLiveSession(requestApi, environment, environment.tenants[0]);
    try {
      sessionB = await live.createLiveSession(requestApi, environment, environment.tenants[1]);
    } catch (error) {
      await sessionA.context.dispose().catch(() => {});
      sessionA = undefined;
      throw error;
    }
    console.log('[RUN] deriving exact live Gateway route matrices');
    const contracts = await live.deriveLiveContracts(sessionA, sessionB);
    runtime.assertLiveRuntimeBindings(validatedRuntime, contracts);
    const artifactRoot = await browserRun.createBrowserArtifactRoot(environment);
    const forbiddenPorts = new Set(
      Object.values(environment.endpoints).map((value) => Number(new URL(value).port))
    );
    const frontendPort = await browserRun.freeLoopbackPort(forbiddenPorts);
    console.log('[RUN] executing isolated HRIS browser acceptance');
    await browserRun.runBrowserSuite(
      FRONTEND_ROOT,
      environment,
      contracts.routeMatrices,
      frontendPort,
      artifactRoot,
      validatedRuntime.payrollFoundation
    );
    const browserManifestPath = path.join(artifactRoot, 'synthetic-acceptance-manifest.json');
    const browserManifestFile = core.readAttestedJson(
      browserManifestPath,
      'browser synthetic acceptance manifest',
      4 * 1024 * 1024
    );
    const browserSummary = browserEvidence.validateBrowserManifest(browserManifestFile.value, {
      environment,
      routeMatrices: contracts.routeMatrices,
      artifactRoot,
      frontendOrigin: `http://${core.LOCAL_HOST}:${frontendPort}`,
      payrollConfigurationId: validatedRuntime.payrollFoundation.configurationId,
    });
    const secrets = environment.tenants.flatMap((tenant) => [tenant.email, tenant.password]);
    const browserArtifactClosure = browserEvidence.scanBrowserArtifact(artifactRoot, secrets);
    console.log('[RUN] exercising TIM owner read through a fresh Gateway evaluation');
    const timeOwnerRead = await live.runTimeOwnerRead(
      sessionA,
      validatedRuntime.gatewayAuthorities.A.time,
      validatedRuntime.timeProjection
    );
    console.log('[RUN] exercising PAY owner read, idempotent update, simulation, and receipt');
    const ownerChain = await payroll.runPayrollOwnerChain(
      sessionA,
      contracts,
      validatedRuntime.payrollFoundation,
      validatedRuntime.payrollProjection,
      validatedRuntime.payrollFoundationDatabaseObservation
    );
    const crossTenant = await live.crossTenantFence(sessionA, environment.tenants[1]);
    const populationBoundary = await live.populationBoundaryFence(
      sessionA,
      contracts,
      validatedRuntime.runtimeTenants[0]
    );
    const unmappedBoundary = await live.unmappedRouteFence(sessionA, environment.runId);
    browserRun.removeRawHarSync(artifactRoot);
    const finalBrowserArtifactClosure = browserEvidence.scanBrowserArtifact(artifactRoot, secrets);
    if (
      core.canonicalJson(finalBrowserArtifactClosure) !== core.canonicalJson(browserArtifactClosure)
    ) {
      core.hold('Browser artifact closure changed after validation.');
    }
    assertFrontendProvenanceUnchanged(frontendProvenance);
    const browserRelative = path.relative(environment.evidenceDir, artifactRoot);
    const provenance = {
      frontend: frontendProvenance,
      runtimeManifest: {
        path: core.RUNTIME_MANIFEST_NAME,
        sha256: runtimeFile.sha256,
        byteCount: runtimeFile.byteCount,
        negativeObservationAggregateSha256: validatedRuntime.negativeObservations.aggregateSha256,
        payrollFoundationDatabaseObservationSha256:
          validatedRuntime.payrollFoundationDatabaseObservation.observationSha256,
      },
      browser: {
        artifactPath: browserRelative,
        manifestPath: path.posix.join(
          browserRelative.split(path.sep).join('/'),
          'synthetic-acceptance-manifest.json'
        ),
        manifestSha256: browserManifestFile.sha256,
        manifestByteCount: browserManifestFile.byteCount,
        frontendOrigin: `http://${core.LOCAL_HOST}:${frontendPort}`,
        rawHarDeleted: true,
      },
    };
    await evidence.writeEvidenceBundle({
      environment,
      provenance,
      contracts,
      sessionA,
      browserSummary,
      timeOwnerRead,
      ownerChain,
      crossTenant,
      populationBoundary,
      unmappedBoundary,
      negativeObservations: validatedRuntime.negativeObservations,
      runtimeFixture: validatedRuntime.payrollFoundation,
      payrollProjection: validatedRuntime.payrollProjection,
      databaseObservation: validatedRuntime.payrollFoundationDatabaseObservation,
    });
    assertFrontendProvenanceUnchanged(frontendProvenance);
    console.log('[PASS] 15 HRIS W1 checkpoint assertions are evidence-backed.');
  } finally {
    await Promise.allSettled(
      [sessionA, sessionB].filter(Boolean).map((session) => session.context.dispose())
    );
    browserRun.removeRawHarSync();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === FILE_PATH) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[HOLD] ${message}`);
    process.exitCode = 1;
  });
}
