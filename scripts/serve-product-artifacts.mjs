import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const architecture = JSON.parse(
  fs.readFileSync(path.join(workspaceRoot, 'architecture/frontend-apps.json'), 'utf8')
);
const port = Number(process.env.DWP_PRODUCT_ARTIFACT_PORT || 4310);
const host = process.env.DWP_PRODUCT_ARTIFACT_HOST || '127.0.0.1';
const routeOwners = [
  ...architecture.applications.flatMap((application) =>
    application.routePrefixes.map((prefix) => ({ applicationId: application.id, prefix }))
  ),
  ...architecture.shell.routePrefixes.map((prefix) => ({
    applicationId: architecture.shell.id,
    prefix,
  })),
].sort((left, right) => right.prefix.length - left.prefix.length);

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
  const artifactRoot = path.join(workspaceRoot, 'dist/apps', applicationId);
  const candidate = path.resolve(artifactRoot, relativePath);
  return candidate === artifactRoot || candidate.startsWith(`${artifactRoot}${path.sep}`)
    ? candidate
    : null;
}

function sendFile(response, filePath, cacheControl) {
  if (!filePath || !fs.statSync(filePath, { throwIfNoEntry: false })?.isFile()) return false;
  response.writeHead(200, {
    'Cache-Control': cacheControl,
    'Content-Type': contentTypes[path.extname(filePath)] ?? 'application/octet-stream',
  });
  fs.createReadStream(filePath).pipe(response);
  return true;
}

export function createProductArtifactServer() {
  return http.createServer((request, response) => {
    const url = new URL(request.url || '/', `http://${request.headers.host || host}`);
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      response.writeHead(400).end('Invalid URL encoding');
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

    const assetMatch = pathname.match(/^\/assets\/dwp\/([a-z][a-z0-9-]*)\/(.+)$/u);
    if (assetMatch) {
      const [, applicationId, relativePath] = assetMatch;
      if (
        !sendFile(
          response,
          safeArtifactPath(applicationId, relativePath),
          'public, max-age=31536000, immutable'
        )
      ) {
        response.writeHead(404).end('Artifact asset not found');
      }
      return;
    }

    const applicationId = resolveProductApplication(pathname);
    const indexPath = safeArtifactPath(applicationId, 'index.html');
    if (!sendFile(response, indexPath, 'no-store')) {
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
