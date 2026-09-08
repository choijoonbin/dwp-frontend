#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const mode = process.argv[2];
if (!['--write', '--check'].includes(mode)) {
  console.error('Usage: node scripts/generate-route-composition.mjs --write|--check');
  process.exit(2);
}

const architecture = JSON.parse(
  fs.readFileSync(path.join(root, 'architecture/frontend-apps.json'), 'utf8')
);
const applications = [...architecture.applications, architecture.shell];
const target = path.join(root, 'deploy/nginx/dwp-product-routes.conf');
const lines = [
  '# Generated from architecture/frontend-apps.json. Do not edit manually.',
  '# Include inside the DWP HTTPS server block.',
  '',
  'location ^~ /api/ {',
  '  proxy_pass http://dwp-gateway:8080;',
  '}',
  '',
  'location ^~ /scim/v2/ {',
  '  proxy_pass http://dwp-gateway:8080;',
  '}',
  '',
  '# Fail closed before Nginx normalizes encoded separators or dot segments into another asset location.',
  'error_page 418 = @dwp_asset_not_found;',
  'if ($request_uri ~* "^/assets/dwp/[a-z][a-z0-9-]*/[^?]*(%2e|%2f|%5c)") {',
  '  return 418;',
  '}',
  '',
];

for (const application of applications) {
  lines.push(`location = /assets/dwp/${application.id}/assets/ {`);
  lines.push('  add_header Cache-Control "no-store" always;');
  lines.push('  add_header_inherit merge;');
  lines.push('  return 404;');
  lines.push('}', '');
  lines.push(`location ^~ /assets/dwp/${application.id}/assets/ {`);
  lines.push(`  alias /srv/dwp/${application.id}/assets/;`);
  lines.push('  add_header Cache-Control "public, max-age=31536000, immutable";');
  lines.push('  add_header_inherit merge;');
  lines.push('  error_page 404 = @dwp_asset_not_found;');
  lines.push('}', '');
  lines.push(`location = /assets/dwp/${application.id}/theme-bootstrap.js {`);
  lines.push(`  alias /srv/dwp/${application.id}/theme-bootstrap.js;`);
  lines.push('  add_header Cache-Control "no-store" always;');
  lines.push('  add_header_inherit merge;');
  lines.push('}', '');
  lines.push(`location = /assets/dwp/${application.id}/site.webmanifest {`);
  lines.push(`  alias /srv/dwp/${application.id}/site.webmanifest;`);
  lines.push('  default_type application/manifest+json;');
  lines.push('  add_header Cache-Control "no-store" always;');
  lines.push('  add_header_inherit merge;');
  lines.push('}', '');
  lines.push(`location ^~ /assets/dwp/${application.id}/ {`);
  lines.push('  add_header Cache-Control "no-store" always;');
  lines.push('  add_header_inherit merge;');
  lines.push('  return 404;');
  lines.push('}', '');
  lines.push(`location = /__dwp/${application.id}/index.html {`);
  lines.push('  internal;');
  lines.push(`  alias /srv/dwp/${application.id}/index.html;`);
  lines.push('  add_header Cache-Control "no-store";');
  lines.push('  add_header_inherit merge;');
  lines.push('}', '');
}

lines.push(
  'location @dwp_asset_not_found {',
  '  default_type text/plain;',
  '  add_header Cache-Control "no-store" always;',
  '  add_header_inherit merge;',
  '  return 404 "Artifact asset not found\\n";',
  '}',
  '',
  'location = /theme-bootstrap.js {',
  '  alias /srv/dwp/platform-shell/theme-bootstrap.js;',
  '  add_header Cache-Control "no-store" always;',
  '  add_header_inherit merge;',
  '}',
  '',
  'location = /site.webmanifest {',
  '  alias /srv/dwp/platform-shell/site.webmanifest;',
  '  default_type application/manifest+json;',
  '  add_header Cache-Control "no-store" always;',
  '  add_header_inherit merge;',
  '}',
  '',
  'location ^~ /assets/brand/ { alias /srv/dwp/platform-shell/assets/brand/; }',
  '',
  'location ^~ /assets/ {',
  '  add_header Cache-Control "no-store" always;',
  '  add_header_inherit merge;',
  '  return 404;',
  '}',
  ''
);

const routeOwners = applications
  .flatMap((application) =>
    application.routePrefixes
      .filter((prefix) => prefix !== '/')
      .map((prefix) => ({ prefix, applicationId: application.id }))
  )
  .sort((left, right) => right.prefix.length - left.prefix.length);
for (const route of routeOwners) {
  if (route.prefix === '/ask') {
    lines.push('location = /ask {');
    lines.push('  # Legacy question query strings are sensitive and must never enter edge logs.');
    lines.push('  access_log off;');
    lines.push('  return 308 /dwaion/new;');
    lines.push('}', '');
    lines.push('location ^~ /ask/ {');
    lines.push('  access_log off;');
    lines.push('  return 308 /dwaion/new;');
    lines.push('}', '');
    continue;
  }
  lines.push(`location = ${route.prefix} {`);
  lines.push(`  try_files /__dwp-route-miss__ /__dwp/${route.applicationId}/index.html;`);
  lines.push('}', '');
  lines.push(`location ^~ ${route.prefix}/ {`);
  lines.push(`  try_files $uri /__dwp/${route.applicationId}/index.html;`);
  lines.push('}', '');
}

lines.push('location / {', '  try_files $uri /__dwp/workspace/index.html;', '}', '');
const generated = lines.join('\n');

if (mode === '--write') {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, generated, 'utf8');
  console.log(`Wrote ${path.relative(root, target)}.`);
} else if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== generated) {
  console.error('Route composition config is stale. Run corepack yarn routes:sync.');
  process.exit(1);
} else {
  console.log(
    `PASS route composition: ${applications.length} independently deployed applications.`
  );
}
