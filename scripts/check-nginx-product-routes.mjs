#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const routeConfiguration = resolve(repositoryRoot, 'deploy/nginx/dwp-product-routes.conf');
const architecture = JSON.parse(
  readFileSync(resolve(repositoryRoot, 'architecture/frontend-apps.json'), 'utf8')
);
const applications = [...architecture.applications, architecture.shell];

const NGINX_IMAGE = 'nginx@sha256:db35bfc6b2951e7f8a72db5db120288c127ffaeeb4a6d4b95a26fead017d5913';
const EXPECTED_NGINX_VERSION = '1.31.4';
const MINIMUM_NGINX_VERSION = '1.29.3';
const CONTENT_SECURITY_POLICY =
  "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' wss://realtime.example.test; " +
  "object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'";

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'dwp-nginx-routes-'));
const fixtureRoot = join(temporaryDirectory, 'srv-dwp');
const nginxConfiguration = join(temporaryDirectory, 'nginx.conf');
const containerName = `dwp-nginx-routes-${process.pid}-${Date.now()}`;
let containerStarted = false;

try {
  assertGeneratedRouteConfigurationIsCurrent();
  const nginxVersion = readPinnedNginxVersion();
  assertVersionAtLeast(nginxVersion, MINIMUM_NGINX_VERSION);
  assert(
    nginxVersion === EXPECTED_NGINX_VERSION,
    `Pinned Nginx digest resolved to ${nginxVersion}; expected ${EXPECTED_NGINX_VERSION}.`
  );

  writeFixtures();
  writeNginxConfiguration();
  assertNginxConfigurationIsValid();

  const port = await reservePort();
  startNginx(port);
  await waitUntilReady(port);
  const assertions = await assertRuntimeMatrix(port);

  console.log(
    `PASS pinned Nginx ${nginxVersion} (minimum ${MINIMUM_NGINX_VERSION}), nginx -t, and ${assertions} runtime route/header/cache assertions across ${applications.length} application artifacts.`
  );
} finally {
  if (containerStarted) {
    runDocker(['stop', '--time', '3', containerName], { allowFailure: true });
  }
  rmSync(temporaryDirectory, { recursive: true, force: true });
}

function assertGeneratedRouteConfigurationIsCurrent() {
  const result = spawnSync(
    process.execPath,
    ['scripts/generate-route-composition.mjs', '--check'],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
    }
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `Generated Nginx route configuration is not current.\n${result.stderr || result.stdout}`
    );
  }
}

function readPinnedNginxVersion() {
  const output = runDocker(['run', '--rm', NGINX_IMAGE, 'nginx', '-v']);
  const match = output.match(/nginx\/(\d+\.\d+\.\d+)/);
  assert(match, `Unable to read the Nginx version from: ${output.trim()}`);
  return match[1];
}

function assertVersionAtLeast(actual, minimum) {
  const actualParts = actual.split('.').map(Number);
  const minimumParts = minimum.split('.').map(Number);
  const comparison = actualParts.findIndex((part, index) => part !== minimumParts[index]);
  const isSupported = comparison === -1 || actualParts[comparison] > minimumParts[comparison];
  assert(
    isSupported,
    `Nginx ${actual} does not support add_header_inherit; ${minimum}+ is required.`
  );
}

function writeFixtures() {
  for (const application of applications) {
    const applicationRoot = join(fixtureRoot, application.id);
    const assetsRoot = join(applicationRoot, 'assets');
    const viteRoot = join(applicationRoot, '.vite');
    mkdirSync(assetsRoot, { recursive: true });
    mkdirSync(viteRoot, { recursive: true });
    writeFileSync(
      join(applicationRoot, 'index.html'),
      `<!doctype html><title>${application.id}</title><main data-dwp-application="${application.id}">${application.id}</main>\n`
    );
    writeFileSync(
      join(assetsRoot, `runtime-${application.id}-a1b2c3d4.js`),
      `globalThis.__DWP_APPLICATION__ = ${JSON.stringify(application.id)};\n`
    );
    writeFileSync(
      join(applicationRoot, 'theme-bootstrap.js'),
      `globalThis.__DWP_THEME_APPLICATION__ = ${JSON.stringify(application.id)};\n`
    );
    writeFileSync(
      join(applicationRoot, 'site.webmanifest'),
      `${JSON.stringify({ name: `DWP ${application.id}`, start_url: '/' })}\n`
    );
    writeFileSync(join(viteRoot, 'manifest.json'), `${JSON.stringify({ private: true })}\n`);
  }
}

function writeNginxConfiguration() {
  writeFileSync(
    nginxConfiguration,
    `worker_processes 1;
error_log /dev/stderr notice;
pid /tmp/nginx.pid;

events {
  worker_connections 256;
}

http {
  include /etc/nginx/mime.types;
  default_type application/octet-stream;
  access_log off;

  server {
    listen 8080;
    server_name _;

    add_header Content-Security-Policy "${CONTENT_SECURITY_POLICY}" always;
    add_header X-Content-Type-Options "nosniff" always;

    include /etc/nginx/dwp-product-routes.conf;
  }
}
`
  );
}

function dockerMounts() {
  return [
    '--volume',
    `${realpathSync(nginxConfiguration)}:/etc/nginx/nginx.conf:ro`,
    '--volume',
    `${realpathSync(routeConfiguration)}:/etc/nginx/dwp-product-routes.conf:ro`,
    '--volume',
    `${realpathSync(fixtureRoot)}:/srv/dwp:ro`,
    '--add-host',
    'dwp-gateway:127.0.0.1',
  ];
}

function assertNginxConfigurationIsValid() {
  runDocker([
    'run',
    '--rm',
    ...dockerMounts(),
    NGINX_IMAGE,
    'nginx',
    '-t',
    '-c',
    '/etc/nginx/nginx.conf',
  ]);
}

function startNginx(port) {
  runDocker([
    'run',
    '--detach',
    '--rm',
    '--name',
    containerName,
    '--publish',
    `127.0.0.1:${port}:8080`,
    ...dockerMounts(),
    NGINX_IMAGE,
  ]);
  containerStarted = true;
}

async function waitUntilReady(port) {
  const deadline = Date.now() + 30_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`, { redirect: 'manual' });
      if (response.status === 200) return;
      lastError = new Error(`Nginx returned ${response.status} while starting.`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  const logs = runDocker(['logs', containerName], { allowFailure: true });
  throw new Error(`Nginx did not become ready: ${lastError?.message ?? 'unknown error'}\n${logs}`);
}

async function assertRuntimeMatrix(port) {
  const baseUrl = `http://127.0.0.1:${port}`;
  let assertions = 0;

  for (const application of applications) {
    for (const prefix of application.routePrefixes) {
      if (prefix === '/ask') continue;
      const routePath = prefix === '/' ? '/' : `${prefix}/nginx-runtime-probe`;
      const response = await request(baseUrl, routePath);
      assertions += assertResponse(response, {
        status: 200,
        cacheControl: 'no-store',
        bodyIncludes: `data-dwp-application="${application.id}"`,
      });
    }

    const assetName = `runtime-${application.id}-a1b2c3d4.js`;
    const assetResponse = await request(
      baseUrl,
      `/assets/dwp/${application.id}/assets/${assetName}`
    );
    assertions += assertResponse(assetResponse, {
      status: 200,
      cacheControl: 'public, max-age=31536000, immutable',
      bodyIncludes: application.id,
    });

    const themeResponse = await request(
      baseUrl,
      `/assets/dwp/${application.id}/theme-bootstrap.js`
    );
    assertions += assertResponse(themeResponse, {
      status: 200,
      cacheControl: 'no-store',
      bodyIncludes: application.id,
    });

    const manifestResponse = await request(
      baseUrl,
      `/assets/dwp/${application.id}/site.webmanifest`
    );
    assertions += assertResponse(manifestResponse, {
      status: 200,
      cacheControl: 'no-store',
      contentType: 'application/manifest+json',
      bodyIncludes: `DWP ${application.id}`,
    });

    for (const deniedPath of [
      `/assets/dwp/${application.id}/`,
      `/assets/dwp/${application.id}/index.html`,
      `/assets/dwp/${application.id}/.vite/manifest.json`,
      `/assets/dwp/${application.id}/assets/`,
      `/assets/dwp/${application.id}/assets/..%2Ftheme-bootstrap.js`,
      `/assets/dwp/${application.id}/assets/%2E%2E%2Fsite.webmanifest`,
    ]) {
      const response = await request(baseUrl, deniedPath);
      assertions += assertResponse(response, { status: 404, cacheControl: 'no-store' });
    }

    const missingAssetResponse = await request(
      baseUrl,
      `/assets/dwp/${application.id}/assets/missing-a1b2c3d4.js`
    );
    assertions += assertResponse(missingAssetResponse, {
      status: 404,
      cacheControl: 'no-store',
      bodyIncludes: 'Artifact asset not found',
    });
  }

  const genericMissingAssetResponse = await request(baseUrl, '/assets/missing-a1b2c3d4.js');
  assertions += assertResponse(genericMissingAssetResponse, {
    status: 404,
    cacheControl: 'no-store',
  });

  const globalThemeResponse = await request(baseUrl, '/theme-bootstrap.js');
  assertions += assertResponse(globalThemeResponse, {
    status: 200,
    cacheControl: 'no-store',
    bodyIncludes: 'platform-shell',
  });

  const globalManifestResponse = await request(baseUrl, '/site.webmanifest');
  assertions += assertResponse(globalManifestResponse, {
    status: 200,
    cacheControl: 'no-store',
    contentType: 'application/manifest+json',
    bodyIncludes: 'DWP platform-shell',
  });

  for (const askPath of ['/ask?question=do-not-forward', '/ask/thread?question=do-not-forward']) {
    const result = await request(baseUrl, askPath);
    assertions += assertResponse(result, { status: 308 });
    const redirectLocation = result.response.headers.get('location');
    assert(redirectLocation, `${askPath} did not return a Location header.`);
    const redirect = new URL(redirectLocation, baseUrl);
    assert(redirect.pathname === '/dwaion/new', `${askPath} redirected to ${redirect.pathname}.`);
    assert(redirect.search === '', `${askPath} leaked its query into ${redirect.href}.`);
    assertions += 2;
  }

  return assertions;
}

async function request(baseUrl, pathname) {
  const response = await fetch(`${baseUrl}${pathname}`, { redirect: 'manual' });
  const body = await response.text();
  return { response, body, pathname };
}

function assertResponse(
  { response, body, pathname },
  { status, cacheControl, contentType, bodyIncludes }
) {
  let assertions = 0;
  assert(
    response.status === status,
    `${pathname} returned ${response.status}; expected ${status}.`
  );
  assertions += 1;

  const actualCsp = response.headers.get('content-security-policy');
  assert(actualCsp === CONTENT_SECURITY_POLICY, `${pathname} did not inherit the parent CSP.`);
  assert(
    response.headers.get('x-content-type-options') === 'nosniff',
    `${pathname} did not inherit X-Content-Type-Options.`
  );
  assertions += 2;

  if (cacheControl) {
    assert(
      response.headers.get('cache-control') === cacheControl,
      `${pathname} returned Cache-Control ${response.headers.get('cache-control')}; expected ${cacheControl}.`
    );
    assertions += 1;
  }
  if (contentType) {
    assert(
      response.headers.get('content-type')?.startsWith(contentType),
      `${pathname} returned Content-Type ${response.headers.get('content-type')}; expected ${contentType}.`
    );
    assertions += 1;
  }
  if (bodyIncludes) {
    assert(body.includes(bodyIncludes), `${pathname} response did not include ${bodyIncludes}.`);
    assertions += 1;
  }
  return assertions;
}

function runDocker(args, { allowFailure = false } = {}) {
  const result = spawnSync('docker', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error) {
    throw new Error(`Docker is required for the Nginx route gate: ${result.error.message}`);
  }
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (!allowFailure && result.status !== 0) {
    throw new Error(`docker ${args.join(' ')} failed with exit ${result.status}.\n${output}`);
  }
  return output;
}

function reservePort() {
  return new Promise((resolvePromise, rejectPromise) => {
    const server = createServer();
    server.unref();
    server.once('error', rejectPromise);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close((error) => {
        if (error) rejectPromise(error);
        else if (port) resolvePromise(port);
        else rejectPromise(new Error('Unable to reserve a local port for Nginx.'));
      });
    });
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
