import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  securityHeaders,
  trustedHttpOrigin,
  trustedWebSocketOrigin,
} from './frontend-security-headers.mjs';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const architecture = JSON.parse(
  fs.readFileSync(path.join(workspaceRoot, 'architecture/frontend-apps.json'), 'utf8')
);
const port = Number(process.env.DWP_PRODUCT_ARTIFACT_PORT || 4310);
const host = process.env.DWP_PRODUCT_ARTIFACT_HOST || '127.0.0.1';
const artifactSecurityHeaders = securityHeaders(
  false,
  trustedHttpOrigin(process.env.VITE_API_URL || ''),
  trustedWebSocketOrigin(
    process.env.DWP_LIVEKIT_CLIENT_URL ||
      process.env.VITE_LIVEKIT_URL ||
      process.env.LIVEKIT_URL ||
      ''
  )
);
const routeOwners = [
  ...architecture.applications.flatMap((application) =>
    application.routePrefixes.map((prefix) => ({ applicationId: application.id, prefix }))
  ),
  ...architecture.shell.routePrefixes.map((prefix) => ({
    applicationId: architecture.shell.id,
    prefix,
  })),
].sort((left, right) => right.prefix.length - left.prefix.length);
const deployedApplicationIds = new Set([
  ...architecture.applications.map(({ id }) => id),
  architecture.shell.id,
]);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
};

function ownsPath(prefix, pathname) {
  if (prefix === '/') return pathname === '/';
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function resolveProductApplication(pathname) {
  return routeOwners.find(({ prefix }) => ownsPath(prefix, pathname))?.applicationId ?? 'workspace';
}

function safeArtifactPath(applicationId, relativePath) {
  const segments = relativePath.split('/');
  const hasControlCharacter = [...relativePath].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 31 || codePoint === 127);
  });
  if (
    !relativePath ||
    relativePath.includes('\\') ||
    hasControlCharacter ||
    segments.some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    return null;
  }
  const artifactRoot = path.join(workspaceRoot, 'dist/apps', applicationId);
  const candidate = path.resolve(artifactRoot, relativePath);
  return candidate === artifactRoot || candidate.startsWith(`${artifactRoot}${path.sep}`)
    ? candidate
    : null;
}

function sendFile(response, filePath, cacheControl, headers = {}) {
  let fileStat;
  try {
    fileStat = filePath ? fs.statSync(filePath, { throwIfNoEntry: false }) : null;
  } catch {
    return false;
  }
  if (!fileStat?.isFile()) return false;
  response.writeHead(200, {
    'Cache-Control': cacheControl,
    'Content-Type': contentTypes[path.extname(filePath)] ?? 'application/octet-stream',
    ...headers,
  });
  fs.createReadStream(filePath).pipe(response);
  return true;
}

function sendAssetNotFound(response) {
  response.writeHead(404, {
    'Cache-Control': 'no-store',
    'Content-Type': 'text/plain; charset=utf-8',
    ...artifactSecurityHeaders,
  });
  response.end('Artifact asset not found');
}

export function createProductArtifactServer() {
  return http.createServer((request, response) => {
    const url = new URL(request.url || '/', `http://${request.headers.host || host}`);
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      response.writeHead(400, {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/plain; charset=utf-8',
        ...artifactSecurityHeaders,
      });
      response.end('Invalid URL encoding');
      return;
    }

    if (pathname === '/__dwp-artifact-health') {
      response.writeHead(204, { 'Cache-Control': 'no-store' }).end();
      return;
    }
    if (pathname === '/ask' || pathname.startsWith('/ask/')) {
      response.writeHead(308, {
        'Cache-Control': 'no-store',
        Location: '/dwaion/new',
      });
      response.end();
      return;
    }
    if (pathname.startsWith('/api/') || pathname.startsWith('/scim/v2/')) {
      response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: 'Artifact smoke server has no backend proxy.' }));
      return;
    }

    const assetMatch = pathname.match(/^\/assets\/dwp\/([a-z][a-z0-9-]*)\/assets\/(.+)$/u);
    if (assetMatch) {
      const [, applicationId, relativePath] = assetMatch;
      if (
        !deployedApplicationIds.has(applicationId) ||
        !sendFile(
          response,
          safeArtifactPath(applicationId, `assets/${relativePath}`),
          'public, max-age=31536000, immutable',
          artifactSecurityHeaders
        )
      ) {
        sendAssetNotFound(response);
      }
      return;
    }
    const publicRootAssetMatch = pathname.match(
      /^\/assets\/dwp\/([a-z][a-z0-9-]*)\/(theme-bootstrap\.js|site\.webmanifest)$/u
    );
    if (publicRootAssetMatch) {
      const [, applicationId, relativePath] = publicRootAssetMatch;
      if (
        !deployedApplicationIds.has(applicationId) ||
        !sendFile(
          response,
          safeArtifactPath(applicationId, relativePath),
          'no-store',
          artifactSecurityHeaders
        )
      ) {
        sendAssetNotFound(response);
      }
      return;
    }
    if (pathname.startsWith('/assets/')) {
      sendAssetNotFound(response);
      return;
    }

    const applicationId = resolveProductApplication(pathname);
    const indexPath = safeArtifactPath(applicationId, 'index.html');
    if (!sendFile(response, indexPath, 'no-store', artifactSecurityHeaders)) {
      response.writeHead(503).end(`Missing built artifact: ${applicationId}`);
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createProductArtifactServer();
  server.listen(port, host, () => {
    process.stdout.write(`DWP product artifact server listening on http://${host}:${port}\n`);
  });
  const close = () => server.close(() => process.exit(0));
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
}
