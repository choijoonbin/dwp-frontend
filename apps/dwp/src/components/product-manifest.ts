import type { LucideIcon } from 'lucide-react';

export type NonEmptyReadonlyArray<Value> = readonly [Value, ...Value[]];

export type ProductTaskKind = 'work' | 'team' | 'operations' | 'administration';
export type ProductPlane = 'work' | 'management';
export type GovernedMenuPlane = ProductPlane | 'tenant-governance' | 'provider-control' | 'account';
export type ProductScopeKind =
  | 'TENANT'
  | 'SELF'
  | 'TEAM'
  | 'ORG_UNIT'
  | 'LEGAL_ENTITY'
  | 'RESOURCE_SET'
  | 'RESOURCE'
  | 'POLICY_NODE';

export type ProductRouteMatcher = {
  kind: 'exact' | 'prefix';
  path: `/${string}`;
};

export type ProductNavigationAccess =
  | { type: 'capability'; capabilityContractKey: string }
  | {
      type: 'capability-expression';
      mode: 'ANY' | 'ALL';
      capabilityContractKeys: NonEmptyReadonlyArray<string>;
    }
  | { type: 'policy'; accessPolicyKey: string };

export type ProductSurfaceEntryAccess =
  | {
      type: 'capability';
      requiresProductEntitlement: boolean;
      entryCapabilityMode: 'ANY' | 'ALL';
      requiredCapabilityContractKeys: NonEmptyReadonlyArray<string>;
    }
  | {
      type: 'policy';
      requiresProductEntitlement: boolean;
      accessPolicyKey: string;
    };

/**
 * Optional authority fields are the compatibility projection used by products that have not yet
 * migrated to Product Manifest v2. New surface navigation must use `access` instead.
 */
export type ProductNavigationItem = {
  path: string;
  view: string;
  icon: LucideIcon;
  requiredResourceKey?: string;
  requiredPermissionCode?: string;
  requiredAnyPermissionCodes?: readonly string[];
  requiredAllPermissionCodes?: readonly string[];
  requiredAnyAuthorities?: readonly {
    resourceKey: string;
    permissionCode: string;
  }[];
  requiredAnySupportScopes?: readonly string[];
};

export type ProductNavigationGroup = {
  id: string;
  items: readonly ProductNavigationItem[];
};

export type ProductSurfaceNavigationItem = ProductNavigationItem & {
  taskKind: ProductTaskKind;
  access: ProductNavigationAccess;
};

export type ProductSurfaceNavigationGroup = Omit<ProductNavigationGroup, 'items'> & {
  items: readonly ProductSurfaceNavigationItem[];
};

export type ProductSurfaceDefinition = {
  id: string;
  plane: ProductPlane;
  labelKey: string;
  taskKinds: NonEmptyReadonlyArray<ProductTaskKind>;
  routeMatchers: NonEmptyReadonlyArray<ProductRouteMatcher>;
  indexPath: `/${string}`;
  navigation: readonly ProductSurfaceNavigationGroup[];
  entryAccess: ProductSurfaceEntryAccess;
  supportedScopeKinds: NonEmptyReadonlyArray<ProductScopeKind>;
  shellProfile: 'product-work' | 'product-management';
  returnSurfaceId?: string;
};

export type LegacyRedirectTarget =
  | { kind: 'static'; path: `/${string}` }
  | {
      kind: 'path-map';
      entries: NonEmptyReadonlyArray<{
        sourcePath: `/${string}`;
        targetPath: `/${string}`;
      }>;
    }
  | {
      kind: 'registered-suffix';
      sourceBase: `/${string}`;
      targetBase: `/${string}`;
      registeredRouteCatalogId: string;
    };

export type LegacyRedirectDefinition = {
  id: string;
  sourceMatcher: ProductRouteMatcher;
  target: LegacyRedirectTarget;
  preserveQuery: boolean;
  preserveHash: boolean;
  maxHops: 1;
  unknownTarget: 'surface-not-found' | 'product-not-found';
};

export type ProductSurfaceManifest = {
  id: string;
  appKey: string;
  basePath: `/${string}`;
  surfaces: NonEmptyReadonlyArray<ProductSurfaceDefinition>;
  legacyRedirects?: readonly LegacyRedirectDefinition[];
  /** Ownership-only migration shorthand. Runtime resolution always prefers `surfaces`. */
  adminMode?: 'none' | 'embedded' | 'control-center';
};

export type GovernedMenuRecord = {
  menuId: string;
  path: `/${string}`;
  plane: GovernedMenuPlane;
  taskKind: ProductTaskKind;
  navigationContextId: string;
  productSurfaceId?: string;
};

export type LegacyProductManifest<AreaKey extends string = string> = {
  id: string;
  appKey: string;
  basePath: `/${string}`;
  homePath: `/${string}`;
  shellKey: AreaKey;
  adminMode: 'none' | 'embedded' | 'control-center';
  navigation: readonly ProductNavigationGroup[];
  legacyPaths?: readonly `/${string}`[];
};

export type ProductManifest<AreaKey extends string = string> =
  | ProductSurfaceManifest
  | LegacyProductManifest<AreaKey>;

const TASK_KINDS = new Set<ProductTaskKind>(['work', 'team', 'operations', 'administration']);
const SCOPE_KINDS = new Set<ProductScopeKind>([
  'TENANT',
  'SELF',
  'TEAM',
  'ORG_UNIT',
  'LEGAL_ENTITY',
  'RESOURCE_SET',
  'RESOURCE',
  'POLICY_NODE',
]);
const CONTRACT_KEY_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const SURFACE_ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;

export function normalizeProductPath(path: string): `/${string}` {
  const pathname = path.split(/[?#]/u, 1)[0] || '/';
  const withLeadingSlash = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const normalized = withLeadingSlash.replace(/\/{2,}/gu, '/').replace(/\/$/u, '') || '/';
  return normalized as `/${string}`;
}

export function isSegmentOwnedPath(pathname: string, prefix: string): boolean {
  const path = normalizeProductPath(pathname);
  const boundary = normalizeProductPath(prefix);
  return path === boundary || path.startsWith(`${boundary}/`);
}

export function matchesProductRoute(pathname: string, matcher: ProductRouteMatcher): boolean {
  const path = normalizeProductPath(pathname);
  const matcherPath = normalizeProductPath(matcher.path);
  return matcher.kind === 'exact' ? path === matcherPath : isSegmentOwnedPath(path, matcherPath);
}

export function isProductSurfaceManifest(
  manifest: ProductManifest
): manifest is ProductSurfaceManifest {
  return 'surfaces' in manifest;
}

function assertNonBlank(value: string, message: string): void {
  if (!value.trim()) throw new Error(message);
}

function assertCanonicalPath(path: string, message: string): void {
  if (!path.startsWith('/') || normalizeProductPath(path) !== path || path.includes('..')) {
    throw new Error(message);
  }
}

function assertUniqueNonBlank(values: readonly string[], message: string): void {
  if (values.length === 0 || values.some((value) => !value.trim())) throw new Error(message);
  if (new Set(values).size !== values.length) throw new Error(`${message} Values must be unique.`);
}

function assertContractKey(value: string, message: string): void {
  if (!CONTRACT_KEY_PATTERN.test(value)) throw new Error(message);
}

function validateLegacyNavigation(
  manifest: LegacyProductManifest,
  item: ProductNavigationItem,
  paths: Set<string>
): void {
  if (!isSegmentOwnedPath(item.path, manifest.basePath) || item.path === manifest.basePath) {
    throw new Error(`${manifest.id} navigation path is outside its product boundary: ${item.path}`);
  }
  if (paths.has(item.path)) {
    throw new Error(`${manifest.id} navigation path is duplicated: ${item.path}`);
  }
  paths.add(item.path);
  if (
    (item.requiredPermissionCode ||
      item.requiredAnyPermissionCodes?.length ||
      item.requiredAllPermissionCodes?.length) &&
    !item.requiredResourceKey
  ) {
    throw new Error(`${manifest.id} governed navigation requires a resource: ${item.path}`);
  }
  if (
    item.requiredAnyAuthorities?.some(
      (authority) => !authority.resourceKey.trim() || !authority.permissionCode.trim()
    )
  ) {
    throw new Error(`${manifest.id} navigation authority is incomplete: ${item.path}`);
  }
  if (item.requiredAnySupportScopes?.some((scope) => !scope.trim())) {
    throw new Error(`${manifest.id} navigation support scope is incomplete: ${item.path}`);
  }
}

function validateLegacyProductManifest(manifest: LegacyProductManifest): void {
  assertCanonicalPath(manifest.basePath, `${manifest.id} base path must be canonical.`);
  assertCanonicalPath(manifest.homePath, `${manifest.id} home path must be canonical.`);
  if (
    !isSegmentOwnedPath(manifest.homePath, manifest.basePath) ||
    manifest.homePath === manifest.basePath
  ) {
    throw new Error(`${manifest.id} home path must be owned by its product base path.`);
  }
  const paths = new Set<string>();
  for (const item of manifest.navigation.flatMap((group) => group.items)) {
    validateLegacyNavigation(manifest, item, paths);
  }
  for (const path of manifest.legacyPaths ?? []) {
    assertCanonicalPath(path, `${manifest.id} legacy path must be canonical: ${path}`);
  }
}

function validateNavigationAccess(manifestId: string, item: ProductSurfaceNavigationItem): void {
  const access = item.access;
  if (!access || typeof access !== 'object' || !('type' in access)) {
    throw new Error(`${manifestId} navigation access is missing: ${item.path}`);
  }
  if (access.type === 'capability') {
    if ('accessPolicyKey' in access || 'capabilityContractKeys' in access || 'mode' in access) {
      throw new Error(`${manifestId} navigation access mixes union members: ${item.path}`);
    }
    assertContractKey(
      access.capabilityContractKey,
      `${manifestId} navigation capability contract is invalid: ${item.path}`
    );
    return;
  }
  if (access.type === 'capability-expression') {
    if ('accessPolicyKey' in access || 'capabilityContractKey' in access) {
      throw new Error(`${manifestId} navigation access mixes union members: ${item.path}`);
    }
    if (access.mode !== 'ANY' && access.mode !== 'ALL') {
      throw new Error(`${manifestId} navigation capability mode is invalid: ${item.path}`);
    }
    assertUniqueNonBlank(
      access.capabilityContractKeys,
      `${manifestId} navigation capability expression is empty: ${item.path}`
    );
    access.capabilityContractKeys.forEach((key) =>
      assertContractKey(
        key,
        `${manifestId} navigation capability contract is invalid: ${item.path}`
      )
    );
    return;
  }
  if (access.type === 'policy') {
    if (
      'capabilityContractKey' in access ||
      'capabilityContractKeys' in access ||
      'mode' in access
    ) {
      throw new Error(`${manifestId} navigation access mixes union members: ${item.path}`);
    }
    assertContractKey(
      access.accessPolicyKey,
      `${manifestId} navigation policy contract is invalid: ${item.path}`
    );
    return;
  }
  throw new Error(`${manifestId} navigation access type is invalid: ${item.path}`);
}

function validateEntryAccess(manifestId: string, surface: ProductSurfaceDefinition): void {
  const entry = surface.entryAccess;
  if (!entry || typeof entry !== 'object' || !('type' in entry)) {
    throw new Error(`${manifestId} surface entry access is missing: ${surface.id}`);
  }
  if (entry.type === 'capability') {
    if (typeof entry.requiresProductEntitlement !== 'boolean' || 'accessPolicyKey' in entry) {
      throw new Error(`${manifestId} surface entry access mixes union members: ${surface.id}`);
    }
    if (entry.entryCapabilityMode !== 'ANY' && entry.entryCapabilityMode !== 'ALL') {
      throw new Error(`${manifestId} surface entry capability mode is invalid: ${surface.id}`);
    }
    assertUniqueNonBlank(
      entry.requiredCapabilityContractKeys,
      `${manifestId} surface entry capabilities are empty: ${surface.id}`
    );
    entry.requiredCapabilityContractKeys.forEach((key) =>
      assertContractKey(key, `${manifestId} surface entry capability is invalid: ${surface.id}`)
    );
    return;
  }
  if (entry.type === 'policy') {
    if (
      typeof entry.requiresProductEntitlement !== 'boolean' ||
      'entryCapabilityMode' in entry ||
      'requiredCapabilityContractKeys' in entry
    ) {
      throw new Error(`${manifestId} surface entry access mixes union members: ${surface.id}`);
    }
    assertContractKey(
      entry.accessPolicyKey,
      `${manifestId} surface entry policy is invalid: ${surface.id}`
    );
    return;
  }
  throw new Error(`${manifestId} surface entry access type is invalid: ${surface.id}`);
}

function routeMatchersOverlap(left: ProductRouteMatcher, right: ProductRouteMatcher): boolean {
  // Strictly nested matchers are deterministic because runtime ownership uses longest match.
  // Equal matcher paths remain ambiguous even when their matcher kinds differ.
  return normalizeProductPath(left.path) === normalizeProductPath(right.path);
}

function validateLegacyRedirects(manifest: ProductSurfaceManifest): void {
  const definitions = manifest.legacyRedirects ?? [];
  const ids = new Set<string>();
  for (const definition of definitions) {
    assertNonBlank(definition.id, `${manifest.id} legacy redirect id is empty.`);
    if (ids.has(definition.id)) {
      throw new Error(`${manifest.id} legacy redirect id is duplicated: ${definition.id}`);
    }
    ids.add(definition.id);
    if (definition.maxHops !== 1) {
      throw new Error(`${manifest.id} legacy redirect must have maxHops=1: ${definition.id}`);
    }
    assertCanonicalPath(
      definition.sourceMatcher.path,
      `${manifest.id} legacy redirect source is invalid: ${definition.id}`
    );
    const targetPaths: string[] = [];
    if (definition.target.kind === 'static') targetPaths.push(definition.target.path);
    if (definition.target.kind === 'path-map') {
      assertUniqueNonBlank(
        definition.target.entries.map((entry) => entry.sourcePath),
        `${manifest.id} legacy path map is empty: ${definition.id}`
      );
      for (const entry of definition.target.entries) {
        assertCanonicalPath(
          entry.sourcePath,
          `${manifest.id} legacy path map source is invalid: ${definition.id}`
        );
        targetPaths.push(entry.targetPath);
      }
    }
    if (definition.target.kind === 'registered-suffix') {
      assertCanonicalPath(
        definition.target.sourceBase,
        `${manifest.id} legacy suffix source is invalid: ${definition.id}`
      );
      assertCanonicalPath(
        definition.target.targetBase,
        `${manifest.id} legacy suffix target is invalid: ${definition.id}`
      );
      assertNonBlank(
        definition.target.registeredRouteCatalogId,
        `${manifest.id} legacy route catalog id is empty: ${definition.id}`
      );
      targetPaths.push(definition.target.targetBase);
    }
    for (const targetPath of targetPaths) {
      assertCanonicalPath(
        targetPath,
        `${manifest.id} legacy redirect target is invalid: ${definition.id}`
      );
      if (
        definitions.some((candidate) => matchesProductRoute(targetPath, candidate.sourceMatcher))
      ) {
        throw new Error(
          `${manifest.id} legacy redirect target forms a redirect chain: ${targetPath}`
        );
      }
    }
  }
}

function validateSurfaceProductManifest(manifest: ProductSurfaceManifest): void {
  assertCanonicalPath(manifest.basePath, `${manifest.id} base path must be canonical.`);
  if (manifest.basePath === '/') {
    throw new Error(`${manifest.id} product base path cannot own the workspace root.`);
  }
  if (manifest.surfaces.length === 0) {
    throw new Error(`${manifest.id} product surfaces are empty.`);
  }
  const surfaceIds = new Set<string>();
  const navigationPaths = new Set<string>();
  for (const surface of manifest.surfaces) {
    if (
      !SURFACE_ID_PATTERN.test(surface.id) ||
      !surface.id.startsWith(`${manifest.id}.`) ||
      surfaceIds.has(surface.id)
    ) {
      throw new Error(`${manifest.id} surface id is invalid or duplicated: ${surface.id}`);
    }
    surfaceIds.add(surface.id);
    assertNonBlank(surface.labelKey, `${manifest.id} surface label is empty: ${surface.id}`);
    if (surface.plane !== 'work' && surface.plane !== 'management') {
      throw new Error(`${manifest.id} surface plane is invalid: ${surface.id}`);
    }
    const expectedProfile = surface.plane === 'work' ? 'product-work' : 'product-management';
    if (surface.shellProfile !== expectedProfile) {
      throw new Error(
        `${manifest.id} surface shell profile does not match its plane: ${surface.id}`
      );
    }
    assertUniqueNonBlank(
      surface.taskKinds,
      `${manifest.id} surface task kinds are empty: ${surface.id}`
    );
    if (surface.taskKinds.some((kind) => !TASK_KINDS.has(kind))) {
      throw new Error(`${manifest.id} surface has an unsupported task kind: ${surface.id}`);
    }
    assertUniqueNonBlank(
      surface.supportedScopeKinds,
      `${manifest.id} surface scope kinds are empty: ${surface.id}`
    );
    if (surface.supportedScopeKinds.some((kind) => !SCOPE_KINDS.has(kind))) {
      throw new Error(`${manifest.id} surface has an unsupported scope kind: ${surface.id}`);
    }
    const matcherKeys = new Set<string>();
    for (const matcher of surface.routeMatchers) {
      if (matcher.kind !== 'exact' && matcher.kind !== 'prefix') {
        throw new Error(`${manifest.id} surface matcher kind is invalid: ${surface.id}`);
      }
      assertCanonicalPath(
        matcher.path,
        `${manifest.id} surface matcher path is invalid: ${surface.id}`
      );
      if (
        !isSegmentOwnedPath(matcher.path, manifest.basePath) ||
        (matcher.path === manifest.basePath && matcher.kind !== 'prefix')
      ) {
        throw new Error(
          `${manifest.id} surface matcher is outside its product boundary: ${matcher.path}`
        );
      }
      const matcherKey = `${matcher.kind}:${matcher.path}`;
      if (matcherKeys.has(matcherKey)) {
        throw new Error(`${manifest.id} surface matcher is duplicated: ${matcherKey}`);
      }
      matcherKeys.add(matcherKey);
    }
    assertCanonicalPath(
      surface.indexPath,
      `${manifest.id} surface index path is invalid: ${surface.id}`
    );
    if (!surface.routeMatchers.some((matcher) => matchesProductRoute(surface.indexPath, matcher))) {
      throw new Error(`${manifest.id} surface index is not owned by its matchers: ${surface.id}`);
    }
    validateEntryAccess(manifest.id, surface);
    const groupIds = new Set<string>();
    for (const group of surface.navigation) {
      assertNonBlank(group.id, `${manifest.id} navigation group id is empty: ${surface.id}`);
      if (groupIds.has(group.id)) {
        throw new Error(`${manifest.id} navigation group id is duplicated: ${group.id}`);
      }
      groupIds.add(group.id);
      for (const item of group.items) {
        assertCanonicalPath(item.path, `${manifest.id} navigation path is invalid: ${item.path}`);
        if (navigationPaths.has(item.path)) {
          throw new Error(`${manifest.id} navigation path is duplicated: ${item.path}`);
        }
        navigationPaths.add(item.path);
        if (!surface.routeMatchers.some((matcher) => matchesProductRoute(item.path, matcher))) {
          throw new Error(`${manifest.id} navigation path is outside its surface: ${item.path}`);
        }
        if (!surface.taskKinds.includes(item.taskKind)) {
          throw new Error(
            `${manifest.id} navigation task kind is outside its surface: ${item.path}`
          );
        }
        if (
          item.requiredResourceKey ||
          item.requiredPermissionCode ||
          item.requiredAnyPermissionCodes ||
          item.requiredAllPermissionCodes ||
          item.requiredAnyAuthorities ||
          item.requiredAnySupportScopes
        ) {
          throw new Error(
            `${manifest.id} v2 navigation includes legacy access fields: ${item.path}`
          );
        }
        validateNavigationAccess(manifest.id, item);
      }
    }
  }
  for (let leftIndex = 0; leftIndex < manifest.surfaces.length; leftIndex += 1) {
    const left = manifest.surfaces[leftIndex]!;
    for (let rightIndex = leftIndex + 1; rightIndex < manifest.surfaces.length; rightIndex += 1) {
      const right = manifest.surfaces[rightIndex]!;
      if (
        left.routeMatchers.some((leftMatcher) =>
          right.routeMatchers.some((rightMatcher) =>
            routeMatchersOverlap(leftMatcher, rightMatcher)
          )
        )
      ) {
        throw new Error(
          `${manifest.id} surfaces have ambiguous route ownership: ${left.id}, ${right.id}`
        );
      }
    }
  }
  for (const surface of manifest.surfaces) {
    if (surface.returnSurfaceId) {
      const returnSurface = manifest.surfaces.find(
        (candidate) => candidate.id === surface.returnSurfaceId
      );
      if (!returnSurface) {
        throw new Error(`${manifest.id} return surface is unknown: ${surface.returnSurfaceId}`);
      }
      if (returnSurface.plane !== 'work' || surface.plane !== 'management') {
        throw new Error(
          `${manifest.id} return surface must connect management to work: ${surface.id}`
        );
      }
    }
  }
  validateLegacyRedirects(manifest);
}

export function defineProductManifest<AreaKey extends string>(
  manifest: LegacyProductManifest<AreaKey>
): LegacyProductManifest<AreaKey>;
export function defineProductManifest(manifest: ProductSurfaceManifest): ProductSurfaceManifest;
export function defineProductManifest<AreaKey extends string>(
  manifest: ProductManifest<AreaKey>
): ProductManifest<AreaKey> {
  assertNonBlank(manifest.id, 'Product manifest id is empty.');
  assertNonBlank(manifest.appKey, `${manifest.id} app key is empty.`);
  if (isProductSurfaceManifest(manifest)) validateSurfaceProductManifest(manifest);
  else validateLegacyProductManifest(manifest);
  return manifest;
}
