import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const featureRoot = path.join(root, 'apps/dwp/src/features');
const manifestPath = path.join(root, 'architecture/frontend-apps.json');
const routeCompositionPath = path.join(root, 'deploy/nginx/dwp-product-routes.conf');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const failures = [];

if (manifest.schemaVersion !== 1) failures.push('Unsupported frontend app manifest version.');
if (manifest.composition !== 'same-origin-route') {
  failures.push('Frontend applications must use same-origin route composition.');
}
if (manifest.gatewayPrefix !== '/api') failures.push('All browser APIs must use the /api Gateway.');
if (manifest.assetBaseTemplate !== '/assets/dwp/{applicationId}/') {
  failures.push('Product assets must use an application-specific deployment namespace.');
}

if (!fs.existsSync(routeCompositionPath)) {
  failures.push('The generated Nginx route composition is missing.');
} else {
  const routeComposition = fs.readFileSync(routeCompositionPath, 'utf8');
  const secureAskRedirects = [
    `location = /ask {
  # Legacy question query strings are sensitive and must never enter edge logs.
  access_log off;
  return 308 /dwaion/new;
}`,
    `location ^~ /ask/ {
  access_log off;
  return 308 /dwaion/new;
}`,
  ];
  if (secureAskRedirects.some((block) => !routeComposition.includes(block))) {
    failures.push(
      'Legacy /ask ingress must disable access logging and use a query-discarding return redirect.'
    );
  }
  const askBlocks = routeComposition.match(/location (?:=|\^~) \/ask\/? \{[\s\S]*?\n\}/g) ?? [];
  if (askBlocks.some((block) => /\$(?:args|request_uri)|\/dwaion\/new\?/.test(block))) {
    failures.push('Legacy /ask redirects must not preserve or reconstruct query arguments.');
  }
}

const productFeatures = new Map();
const appIds = new Set();
const routePrefixes = new Map();
for (const app of manifest.applications ?? []) {
  if (!/^[a-z][a-z0-9-]*$/.test(app.id)) failures.push(`Invalid application id: ${app.id}`);
  if (appIds.has(app.id)) failures.push(`Duplicate application id: ${app.id}`);
  appIds.add(app.id);
  if (app.deployment !== 'independent') failures.push(`${app.id} is not independently deployable.`);
  if (!Array.isArray(app.backendServices) || app.backendServices.length === 0) {
    failures.push(`${app.id} does not declare its backend service ownership.`);
  }
  for (const prefix of app.routePrefixes ?? []) {
    if (!prefix.startsWith('/')) failures.push(`${app.id} has an invalid route prefix: ${prefix}`);
    if (prefix !== '/' && routePrefixes.has(prefix)) {
      failures.push(
        `Route prefix ${prefix} is owned by both ${routePrefixes.get(prefix)} and ${app.id}.`
      );
    }
    routePrefixes.set(prefix, app.id);
  }
  for (const feature of app.features ?? []) {
    if (productFeatures.has(feature)) {
      failures.push(`${feature} is owned by both ${productFeatures.get(feature)} and ${app.id}.`);
    }
    productFeatures.set(feature, app.id);
  }

  const projectPath = path.join(root, 'apps', `dwp-${app.id}`, 'project.json');
  if (!fs.existsSync(projectPath)) {
    failures.push(`${app.id} has no independent Nx application project.`);
  } else {
    const project = JSON.parse(fs.readFileSync(projectPath, 'utf8'));
    const tags = new Set(project.tags ?? []);
    const command = project.targets?.build?.options?.command;
    const inputs = project.targets?.build?.inputs ?? [];
    if (
      project.projectType !== 'application' ||
      !tags.has(`scope:${app.id}`) ||
      !tags.has('deployment:independent')
    ) {
      failures.push(`${app.id} Nx project does not declare an independent product boundary.`);
    }
    if (command !== `node scripts/build-product-app.mjs ${app.id}`) {
      failures.push(`${app.id} does not have a dedicated product build target.`);
    }
    if (!inputs.includes(`${app.id}Product`)) {
      failures.push(`${app.id} does not declare its product-aware Nx cache inputs.`);
    }
  }

  const routeModule = path.join(
    root,
    'apps/dwp/src/routes',
    `${app.id === 'administration' ? 'administration' : app.id}-routes.tsx`
  );
  if (!fs.existsSync(routeModule)) {
    failures.push(`${app.id} has no isolated route composition module.`);
  }
}

const shell = manifest.shell;
if (!shell || shell.id !== 'platform-shell' || shell.deployment !== 'independent') {
  failures.push('The platform shell must be an independently deployable application.');
} else {
  for (const prefix of shell.routePrefixes ?? []) {
    if (!prefix.startsWith('/')) failures.push(`platform-shell has an invalid route: ${prefix}`);
    if (routePrefixes.has(prefix)) {
      failures.push(`Route prefix ${prefix} is also owned by ${routePrefixes.get(prefix)}.`);
    }
    routePrefixes.set(prefix, shell.id);
  }
  const shellProjectPath = path.join(root, 'apps/dwp-platform-shell/project.json');
  if (!fs.existsSync(shellProjectPath)) {
    failures.push('The platform shell Nx project is missing.');
  } else {
    const shellProject = JSON.parse(fs.readFileSync(shellProjectPath, 'utf8'));
    const tags = new Set(shellProject.tags ?? []);
    const inputs = shellProject.targets?.build?.inputs ?? [];
    if (
      shellProject.targets?.build?.options?.command !==
        'node scripts/build-product-app.mjs platform-shell' ||
      !tags.has('deployment:independent')
    ) {
      failures.push('The platform shell does not have a dedicated deployment target.');
    }
    if (!inputs.includes('platformShellProduct')) {
      failures.push('The platform shell does not declare product-aware Nx cache inputs.');
    }
  }
}

const platformFeatures = new Set(manifest.platformFeatures ?? []);
const governedProducts = manifest.governedProductSurfaces ?? [];
const governedProductIds = new Set();
const governedSurfaceIds = new Set();
const governedRoutePrefixes = new Set();
const migrationWaves = new Set(['W0.5', 'W1a', 'W1b', 'W2', 'W3']);
const requiredGovernedProductIds = new Set([
  'approvals',
  'calendar',
  'communications',
  'dwaion',
  'hcm',
  'mail',
  'meetings',
  'messaging',
  'notifications',
  'services',
  'spaces',
  'workplace',
]);

for (const product of governedProducts) {
  if (!/^[a-z][a-z0-9-]*$/.test(product.productId ?? '')) {
    failures.push(`Invalid governed product id: ${product.productId}`);
  }
  if (governedProductIds.has(product.productId)) {
    failures.push(`Duplicate governed product id: ${product.productId}`);
  }
  governedProductIds.add(product.productId);
  if (!migrationWaves.has(product.migrationWave)) {
    failures.push(`${product.productId} has an invalid migration wave: ${product.migrationWave}`);
  }
  if (product.rolloutDefault !== '000') {
    failures.push(`${product.productId} must remain default-off at rollout state 000.`);
  }
  if (!product.routePrefix?.startsWith('/') || governedRoutePrefixes.has(product.routePrefix)) {
    failures.push(`${product.productId} has an invalid or duplicate governed route prefix.`);
  }
  governedRoutePrefixes.add(product.routePrefix);

  const ownsApplication = typeof product.applicationId === 'string';
  const ownsPlatformFeature = typeof product.platformFeature === 'string';
  if (ownsApplication === ownsPlatformFeature) {
    failures.push(
      `${product.productId} must declare exactly one applicationId or platformFeature owner.`
    );
  } else if (ownsApplication) {
    if (!appIds.has(product.applicationId)) {
      failures.push(
        `${product.productId} references unknown application ${product.applicationId}.`
      );
    }
    if (routePrefixes.get(product.routePrefix) !== product.applicationId) {
      failures.push(`${product.productId} route prefix is not owned by ${product.applicationId}.`);
    }
  } else {
    if (!platformFeatures.has(product.platformFeature)) {
      failures.push(
        `${product.productId} references unknown platform feature ${product.platformFeature}.`
      );
    }
    if (!appIds.has(product.artifactApplicationId)) {
      failures.push(
        `${product.productId} must declare the application artifact that deploys its platform route.`
      );
    } else if (routePrefixes.get(product.routePrefix) !== product.artifactApplicationId) {
      failures.push(
        `${product.productId} route prefix is not owned by artifact ${product.artifactApplicationId}.`
      );
    }
    const routeModule = path.join(root, 'apps/dwp/src/routes', product.routeModule ?? '');
    if (!product.routeModule || !fs.existsSync(routeModule)) {
      failures.push(`${product.productId} logical product route module is missing.`);
    }
  }

  const workSurfaces = product.workSurfaceIds ?? [];
  const managementSurfaces = product.managementSurfaceIds ?? [];
  if (workSurfaces.length === 0 || managementSurfaces.length === 0) {
    failures.push(`${product.productId} must declare both Work and Management Surfaces.`);
  }
  for (const surfaceId of [...workSurfaces, ...managementSurfaces]) {
    if (!surfaceId.startsWith(`${product.productId}.`) || governedSurfaceIds.has(surfaceId)) {
      failures.push(`${product.productId} has an invalid or duplicate Surface id: ${surfaceId}`);
    }
    governedSurfaceIds.add(surfaceId);
  }
}
for (const productId of requiredGovernedProductIds) {
  if (!governedProductIds.has(productId)) {
    failures.push(`${productId} must declare governed Product Surfaces.`);
  }
}
for (const productId of governedProductIds) {
  if (!requiredGovernedProductIds.has(productId)) {
    failures.push(`${productId} is not registered as a governed business product.`);
  }
}
const diskFeatures = fs
  .readdirSync(featureRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

for (const feature of diskFeatures) {
  const owner = productFeatures.get(feature) ?? (platformFeatures.has(feature) ? 'platform' : null);
  if (!owner) failures.push(`${feature} has no bounded-context owner in frontend-apps.json.`);
}
for (const feature of [...productFeatures.keys(), ...platformFeatures]) {
  if (!diskFeatures.includes(feature))
    failures.push(`Declared feature directory is missing: ${feature}`);
}

const sharedProjects = ['api-contracts', 'design-system', 'shared-i18n', 'shared-utils'];
for (const projectName of sharedProjects) {
  const projectPath = path.join(root, 'libs', projectName, 'project.json');
  const project = JSON.parse(fs.readFileSync(projectPath, 'utf8'));
  const tags = new Set(project.tags ?? []);
  if (!tags.has('scope:platform') || !tags.has('deployment:shared')) {
    failures.push(`${projectName} must remain a platform-owned shared project.`);
  }
}

if (failures.length > 0) {
  console.error(
    'FAIL frontend application architecture:\n' + failures.map((item) => `- ${item}`).join('\n')
  );
  process.exit(1);
}

console.log(
  `PASS frontend application architecture: ${appIds.size} independent product applications, ` +
    `1 independent platform shell, ${platformFeatures.size} platform features, ` +
    `${governedProductIds.size} governed Product Surfaces, Gateway ${manifest.gatewayPrefix}.`
);
