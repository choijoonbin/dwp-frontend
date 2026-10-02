import { spawn } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { chmod, mkdir } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';

import { LOCAL_HOST, hold, readAttestedRegular } from './hris-w1-checkpoint-core.mjs';

let activeProcessGroup = null;
let ownedBrowserArtifact = null;
let terminating = false;

export function assertFilesystemBoundary(environment) {
  if (!existsSync(environment.evidenceDir)) hold('The runner evidence directory does not exist.');
  const evidenceStat = lstatSync(environment.evidenceDir);
  if (!evidenceStat.isDirectory() || evidenceStat.isSymbolicLink()) {
    hold('The runner evidence directory must be a non-symlink directory.');
  }
  const resolvedEvidence = realpathSync(environment.evidenceDir);
  const manifestParent = path.dirname(environment.checkpointManifest);
  if (!existsSync(manifestParent)) hold('The runner-owned checkpoint directory does not exist.');
  const parentStat = lstatSync(manifestParent);
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) {
    hold('The checkpoint directory must be a non-symlink directory.');
  }
  if (realpathSync(manifestParent) !== path.join(resolvedEvidence, 'checkpoint')) {
    hold('The checkpoint directory escapes the runner evidence directory.');
  }
  if (existsSync(environment.checkpointManifest)) hold('The checkpoint manifest already exists.');
}

export async function createBrowserArtifactRoot(environment) {
  const browserParent = path.join(environment.evidenceDir, 'checkpoint', 'browser');
  if (existsSync(browserParent)) hold('Checkpoint browser parent already exists.');
  await mkdir(browserParent, { mode: 0o700 });
  await chmod(browserParent, 0o700);
  const artifactRoot = path.join(browserParent, `hris-w1-live-browser-${environment.runId}`);
  if (existsSync(artifactRoot)) hold('Owned browser artifact already exists.');
  ownedBrowserArtifact = artifactRoot;
  return artifactRoot;
}

export async function freeLoopbackPort(forbiddenPorts) {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const port = await new Promise((resolve, reject) => {
      const server = net.createServer();
      server.unref();
      server.once('error', reject);
      server.listen({ host: LOCAL_HOST, port: 0, exclusive: true }, () => {
        const address = server.address();
        const selected = typeof address === 'object' && address ? address.port : null;
        server.close((error) => (error ? reject(error) : resolve(selected)));
      });
    });
    if (Number.isSafeInteger(port) && !forbiddenPorts.has(port)) return port;
  }
  hold('Could not reserve a distinct loopback frontend port.');
}

export function browserChildEnvironment(
  environment,
  routeMatrices,
  frontendPort,
  artifactRoot,
  payrollFoundation
) {
  const inherited = {};
  for (const name of ['PATH', 'LANG', 'LC_ALL', 'TMPDIR', 'TZ']) {
    if (process.env[name]) inherited[name] = process.env[name];
  }
  return {
    ...inherited,
    CI: '1',
    HRIS_W1_LIVE_ACK: 'LOCAL_SYNTHETIC_ONLY',
    HRIS_W1_LIVE_RUN_ID: environment.runId,
    HRIS_W1_LIVE_BASE_URL: `http://${LOCAL_HOST}:${frontendPort}/`,
    HRIS_W1_LIVE_GATEWAY_URL: environment.endpoints.gateway,
    HRIS_W1_LIVE_ARTIFACT_DIR: artifactRoot,
    HRIS_W1_LIVE_ASSERTION_TIMEOUT_MS: '60000',
    HRIS_W1_EXPECTED_PAYROLL_CONFIGURATION_ID: payrollFoundation.configurationId,
    HRIS_W1_TENANT_A_ID: String(environment.tenants[0].tenantId),
    HRIS_W1_TENANT_A_EMAIL: environment.tenants[0].email,
    HRIS_W1_TENANT_A_PASSWORD: environment.tenants[0].password,
    HRIS_W1_TENANT_A_ROUTES_JSON: JSON.stringify(routeMatrices.tenantA),
    HRIS_W1_TENANT_B_ID: String(environment.tenants[1].tenantId),
    HRIS_W1_TENANT_B_EMAIL: environment.tenants[1].email,
    HRIS_W1_TENANT_B_PASSWORD: environment.tenants[1].password,
    HRIS_W1_TENANT_B_ROUTES_JSON: JSON.stringify(routeMatrices.tenantB),
  };
}

export function removeRawHarSync(root = ownedBrowserArtifact) {
  if (!root || !existsSync(root)) return;
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const candidate = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) visit(candidate);
      else if (entry.isFile() && entry.name.endsWith('-raw.har'))
        rmSync(candidate, { force: true });
    }
  };
  try {
    visit(root);
  } catch {
    // Signal/exit cleanup is best effort. Normal control flow validates strict absence.
  }
}

function signalProcessGroup(processGroup, signal) {
  if (!Number.isSafeInteger(processGroup) || processGroup <= 1) return false;
  try {
    process.kill(-processGroup, signal);
    return true;
  } catch (error) {
    if (error?.code === 'ESRCH') return false;
    throw error;
  }
}

async function terminateProcessGroup(processGroup) {
  if (!signalProcessGroup(processGroup, 'SIGTERM')) return;
  await new Promise((resolve) => setTimeout(resolve, 750));
  signalProcessGroup(processGroup, 'SIGKILL');
}

export function installExitCleanup() {
  process.once('exit', () => {
    try {
      signalProcessGroup(activeProcessGroup, 'SIGKILL');
    } catch {
      // Exit handlers cannot recover from process signaling failures.
    }
    removeRawHarSync();
  });
  for (const [signal, exitCode] of [
    ['SIGTERM', 143],
    ['SIGINT', 130],
  ]) {
    process.once(signal, () => {
      if (terminating) return;
      terminating = true;
      try {
        signalProcessGroup(activeProcessGroup, signal);
      } catch {
        // Escalation below remains fail-closed.
      }
      setTimeout(() => {
        try {
          signalProcessGroup(activeProcessGroup, 'SIGKILL');
        } finally {
          removeRawHarSync();
          process.exit(exitCode);
        }
      }, 750);
    });
  }
}

export async function runBrowserSuite(
  frontendRoot,
  environment,
  routeMatrices,
  frontendPort,
  artifactRoot,
  payrollFoundation
) {
  const playwrightCli = path.join(frontendRoot, 'node_modules', '@playwright', 'test', 'cli.js');
  readAttestedRegular(playwrightCli, 'Playwright CLI', 4 * 1024 * 1024);
  const childEnvironment = browserChildEnvironment(
    environment,
    routeMatrices,
    frontendPort,
    artifactRoot,
    payrollFoundation
  );
  let processGroup = null;
  let exit;
  try {
    exit = await new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [playwrightCli, 'test', '--config', 'playwright.hris-w1-live.config.ts'],
        {
          cwd: frontendRoot,
          env: childEnvironment,
          stdio: 'inherit',
          shell: false,
          detached: true,
        }
      );
      processGroup = child.pid;
      activeProcessGroup = child.pid;
      child.once('error', reject);
      child.once('exit', (code, signal) => resolve({ code, signal }));
    });
  } finally {
    if (processGroup) await terminateProcessGroup(processGroup);
    activeProcessGroup = null;
    removeRawHarSync(artifactRoot);
  }
  if (exit.code !== 0 || exit.signal !== null) {
    hold(
      `Live browser suite failed (exit=${exit.code ?? 'signal'}, signal=${exit.signal ?? 'none'}).`
    );
  }
}
