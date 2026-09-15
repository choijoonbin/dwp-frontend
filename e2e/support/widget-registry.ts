import type { Page, Route } from '@playwright/test';
import firstPartyFixture from '../../architecture/widget-registry-native-manifests.v1.json' with { type: 'json' };
import { createHash } from 'node:crypto';

// Persisted pre-correction provider records remain visible during the 1.0.1 migration.
const BINDINGS = [
  ['command-rail', 'core.workspace.command-rail', 'home.command-rail', 'core.workspace'],
  ['daily-brief', 'core.workspace.daily-brief', 'home.daily-brief', 'core.workspace'],
  ['focus', 'core.work.focus', 'home.focus', 'core.work'],
  ['schedule', 'core.calendar.schedule', 'home.schedule', 'core.calendar'],
  ['activity', 'core.activity.activity', 'home.activity', 'core.activity'],
  ['focus-balance', 'core.work.focus-balance', 'home.focus-balance', 'core.work'],
  ['meeting-load', 'core.calendar.meeting-load', 'home.meeting-load', 'core.calendar'],
] as const;
const BINDING_REVISION = createHash('sha256').update([...firstPartyFixture.fixtures]
  .sort((a, b) => a.manifest.renderer.rendererKey < b.manifest.renderer.rendererKey ? -1 : 1)
  .map(({ manifest, expectedSha256 }) => `${manifest.renderer.rendererKey}:${expectedSha256}`)
  .join('\n')).digest('hex');

const CAPABILITIES = [
  'WIDGET_REGISTRY_CONTROL_PLANE',
  'WIDGET_REGISTRY_SHADOW_EVALUATION',
  'TENANT_WIDGET_POLICY',
] as const;
const NOW = '2026-09-15T05:00:00Z';
const HASH = 'a'.repeat(64);

function uuid(prefix: '3' | '4' | '5' | '6', index: number) {
  return `${prefix}0000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
}

function success(data: unknown) {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', success: true, data }),
  };
}

function pageOf<T>(items: readonly T[]) {
  return {
    items,
    page: 0,
    size: 100,
    totalElements: items.length,
    hasNext: false,
    readRevision: '1',
  };
}

export function widgetRegistryReadiness(
  mode: 'SHADOW' | 'AUTHORITATIVE' = 'SHADOW',
  runtimeActivationReady = false
) {
  return {
    schemaVersion: 1,
    migrationMode: mode,
    controlPlaneReady: true,
    runtimeActivationReady,
    capabilities:
      mode === 'AUTHORITATIVE'
        ? [...CAPABILITIES, 'WIDGET_REGISTRY_AUTHORITATIVE_RUNTIME']
        : [...CAPABILITIES],
    registryRevision: 7,
    policyRevision: 7,
    safetyRevision: 1,
  };
}

export function widgetRegistryEffectiveCatalog(
  mode: 'SHADOW' | 'AUTHORITATIVE' = 'SHADOW',
  state: 'AVAILABLE' | 'DENY' | 'DEPRECATED' = 'AVAILABLE'
) {
  const items = BINDINGS.map(([legacyWidgetKey, definitionKey], index) => ({
    definitionId: uuid('3', index + 1),
    definitionKey,
    legacyWidgetKey,
    resolvedVersionId: uuid('4', index + 1),
    semanticVersion: firstPartyFixture.fixtures[index]!.semanticVersion,
    effectiveState: state,
    reasonCodes: [
      state === 'AVAILABLE'
        ? 'AVAILABLE'
        : state === 'DEPRECATED'
          ? 'DEPRECATED'
          : 'DISABLED_BY_ORGANIZATION',
    ],
    placementCapabilities: {
      canAdd: state === 'AVAILABLE',
      canHide: true,
      canMove: state === 'AVAILABLE',
      canResize: state === 'AVAILABLE',
    },
    addedInstanceCount: state === 'AVAILABLE' ? 0 : 1,
  }));
  return {
    schemaVersion: 1,
    mode,
    catalogRevision: '7',
    bindingCatalogRevision: BINDING_REVISION,
    policyRevision: '7',
    safetyRevision: '1',
    hostContext: {
      surfaceKey: 'workspace-home',
      resolvedHostMode: 'CLASSIC',
      homeExperienceVersion: 1,
      compositionSchemaVersion: 4,
      layoutSource: 'HOME_VIEW',
      activeViewRef: null,
      layoutRevision: 1,
      hostConfigurationRevision: 'home-1',
      hostCapabilityVersion: 1,
      decisionRevision: 'decision-7',
    },
    contexts: [
      {
        placementContext: 'CLASSIC_PERSONAL',
        capabilities: {
          libraryRead: true,
          legacyPlacementWrite: false,
          instanceV6Write: false,
          brokerRead: false,
          presetCreate: false,
          presetShare: false,
        },
        items,
      },
    ],
  };
}

const definitions = BINDINGS.map(([legacyWidgetKey, definitionKey, , ownerProductKey], index) => ({
  definitionId: uuid('3', index + 1),
  definitionKey,
  legacyWidgetKey,
  ownerProductKey,
  ownerTeamKey: `${ownerProductKey}.team`,
  riskTier: 'MEDIUM',
  dataClassification: 'CONFIDENTIAL',
  definitionState: 'ACTIVE',
  version: 1,
  createdAt: NOW,
  updatedAt: NOW,
  allowedTransitions: ['RETIRE'],
}));

function version(index: number) {
  const binding = BINDINGS[index]!;
  return {
    versionId: uuid('4', index + 1),
    definitionId: uuid('3', index + 1),
    semanticVersion: '1.0.0',
    manifest: {
      schemaVersion: 1,
      definitionKey: binding[1],
      renderer: { kind: 'NATIVE', rendererKey: binding[2], minimumHostApiVersion: 1 },
    },
    manifestHash: HASH,
    workflowState: 'APPROVED',
    releaseState: 'PUBLISHED',
    safetyState: 'CLEAR',
    attestation: { source: 'LEGACY_UNVERIFIED', fixtureVersion: 2 },
    certificationStatus: 'NOT_RUN',
    predecessorVersionId: null,
    replacementVersionId: null,
    validationRunId: null,
    bindingCatalogRevision: HASH,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    allowedTransitions: ['BLOCK', 'DEPRECATE', 'QUARANTINE', 'REVOKE'],
  };
}

function impact(definitionId: string, versionId: string, operation: string) {
  return {
    definitionId,
    versionId,
    operation,
    activeChannelCount: 1,
    tenantPolicyReferenceCount: 3,
    instanceReferenceCount: 12,
    affectedTenantCount: 2,
    operationAllowed: true,
    impactRevision: HASH,
    calculatedAt: NOW,
  };
}

function policy(index: number) {
  const current = {
    policyRevisionId: uuid('5', index + 1),
    tenantId: 1,
    definitionId: uuid('3', index + 1),
    revisionNumber: 1,
    policyState: 'DRAFT',
    enabled: true,
    selector: 'CHANNEL',
    channel: 'STABLE',
    versionId: uuid('4', index + 1),
    supportedSurfaceKeys: ['workspace-home'],
    audienceSelector: { schemaVersion: 1, mode: 'ALL_ENTITLED', roleCodes: [], groupRefs: [] },
    required: false,
    lockedConfiguration: {},
    sharingPolicy: 'PRIVATE',
    impactRevision: HASH,
    predecessorRevisionId: null,
    version: 1,
    createdAt: NOW,
  };
  return {
    definitionId: current.definitionId,
    currentRevisionId: current.policyRevisionId,
    current,
    version: 1,
    allowedTransitions: ['PUBLISH', 'REVOKE', 'ROLLBACK'],
  };
}

function definitionIndex(identifier: string) {
  return definitions.findIndex(
    (definition) =>
      definition.definitionId === identifier ||
      uuid('4', definitions.indexOf(definition) + 1) === identifier
  );
}

async function fulfillProviderDefinition(route: Route) {
  const path = new URL(route.request().url()).pathname;
  if (route.request().method() !== 'GET') return route.fallback();
  if (path === '/api/provider/v1/admin/widget-definitions') {
    return route.fulfill(success(pageOf(definitions)));
  }
  const versionsMatch = path.match(
    /^\/api\/provider\/v1\/admin\/widget-definitions\/([^/]+)\/versions$/u
  );
  if (versionsMatch) {
    const index = definitionIndex(decodeURIComponent(versionsMatch[1]!));
    return route.fulfill(success(pageOf(index >= 0 ? [version(index)] : [])));
  }
  return route.fallback();
}

async function fulfillProviderVersion(route: Route) {
  const url = new URL(route.request().url());
  if (route.request().method() !== 'GET') return route.fallback();
  const match = url.pathname.match(
    /^\/api\/provider\/v1\/admin\/widget-definition-versions\/([^/]+)(?:\/(evidence|impact))?$/u
  );
  if (!match) return route.fallback();
  const versionId = decodeURIComponent(match[1]!);
  const index = definitionIndex(versionId);
  if (index < 0) return route.fulfill({ ...success(null), status: 404 });
  if (match[2] === 'evidence') {
    return route.fulfill(
      success(
        pageOf([
          {
            evidenceId: uuid('6', index + 1),
            versionId,
            evidenceType: 'MANIFEST',
            status: 'PASS',
            manifestHash: HASH,
            evidenceRef: `fixture:manifest:${index + 1}`,
            evidenceSha256: HASH,
            expiresAt: null,
            decisionRevision: 1,
            waivedEvidenceId: null,
            trackingTicketRef: null,
            reviewedBy: 'migration:legacy-unverified',
            createdAt: NOW,
          },
        ])
      )
    );
  }
  if (match[2] === 'impact') {
    return route.fulfill(
      success(
        impact(uuid('3', index + 1), versionId, url.searchParams.get('operation') ?? 'PUBLISH')
      )
    );
  }
  return route.fulfill(success(version(index)));
}

export async function mockProviderWidgetRegistry(page: Page) {
  await page.route('**/api/provider/v1/admin/widget-registry/readiness', (route) =>
    route.fulfill(success(widgetRegistryReadiness()))
  );
  await page.route('**/api/provider/v1/admin/widget-registry/events**', (route) =>
    route.fulfill(
      success(
        pageOf([
          {
            eventId: uuid('6', 99),
            registryRevision: 7,
            tenantId: null,
            aggregateType: 'WIDGET_DEFINITION',
            aggregateId: definitions[0]!.definitionId,
            eventType: 'NATIVE_WIDGET_SEEDED',
            commandId: null,
            actorRef: 'migration',
            correlationId: 'wave3-fixture',
            before: null,
            after: { certificationStatus: 'NOT_RUN' },
            evidenceRefs: [uuid('6', 1)],
            occurredAt: NOW,
          },
        ])
      )
    )
  );
  await page.route('**/api/provider/v1/admin/widget-definitions**', fulfillProviderDefinition);
  await page.route('**/api/provider/v1/admin/widget-definition-versions**', fulfillProviderVersion);
}

export async function mockTenantWidgetRegistry(page: Page) {
  // Administration can inspect historical persisted versions while native Home uses the corrected baseline.
  const canonical = widgetRegistryEffectiveCatalog('SHADOW', 'DENY');
  const effective = {
    ...canonical,
    bindingCatalogRevision: HASH,
    contexts: canonical.contexts.map((context) => ({
      ...context,
      items: context.items.map((item) => ({ ...item, semanticVersion: '1.0.0' })),
    })),
  };
  await page.route('**/api/platform/v1/widget-catalog/readiness', (route) =>
    route.fulfill(success(widgetRegistryReadiness()))
  );
  await page.route('**/api/platform/v1/admin/widget-catalog**', (route) =>
    route.fulfill(success(effective))
  );
  await page.route('**/api/platform/v1/admin/widget-policies/**', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const path = new URL(route.request().url()).pathname;
    const match = path.match(
      /^\/api\/platform\/v1\/admin\/widget-policies\/([^/]+)(?:\/(history|revisions\/([^/]+)\/impact))?$/u
    );
    if (!match) return route.fallback();
    const definitionId = decodeURIComponent(match[1]!);
    const index = definitionIndex(definitionId);
    if (index < 0) return route.fulfill({ ...success(null), status: 404 });
    const current = policy(index);
    if (match[2] === 'history') return route.fulfill(success(pageOf([current.current])));
    if (match[2]?.endsWith('/impact')) {
      return route.fulfill(
        success(impact(definitionId, current.current.versionId, 'TENANT_POLICY_PUBLISH'))
      );
    }
    return route.fulfill(success(current));
  });
}
