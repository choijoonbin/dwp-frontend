import type { Page, Route } from '@playwright/test';

type SurfaceId = 'approvals.work' | 'approvals.admin';
type HcmSurfaceId = 'hcm.personal' | 'hcm.team' | 'hcm.operations' | 'hcm.management';

export type ApprovalAuthorityOptions = {
  work?: boolean;
  management?: boolean;
  surfaceUi?: boolean;
  deniedRouteKeys?: readonly string[];
  workCapabilityKeys?: readonly string[];
  managementCapabilityKeys?: readonly string[];
  managementReadOnly?: boolean;
  managementScopes?: 'default' | 'two-no-default';
  managementScopeDisplayName?: string;
  generatedAt?: string;
  revalidateAt?: string;
};

export type HcmAuthorityOptions = {
  deniedRouteKeys?: readonly string[];
};

const GENERATED_AT = '2026-08-24T00:00:00Z';
const REVALIDATE_AT = '2026-08-25T00:00:00Z';
const GOVERNED_PRODUCT_KEYS = [
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
] as const;
const WORK_SCOPE = {
  key: 'scope:approvals:self',
  kind: 'SELF',
  displayName: '나의 결재',
  isDefault: true,
  readOnly: false,
  validUntil: null,
} as const;
const MANAGEMENT_SCOPE = {
  key: 'scope:approvals:tenant',
  kind: 'RESOURCE_SET',
  displayName: '전자결재 운영 범위',
  isDefault: true,
  readOnly: false,
  validUntil: null,
} as const;
const MANAGEMENT_SCOPES_WITHOUT_DEFAULT = [
  { ...MANAGEMENT_SCOPE, key: 'S1', displayName: '전자결재 운영 A', isDefault: false },
  { ...MANAGEMENT_SCOPE, key: 'S2', displayName: '전자결재 운영 B', isDefault: false },
] as const;

const WORK_CAPABILITIES = [
  'approvals.work.task.read',
  'approvals.work.task.update',
  'approvals.work.task.approve',
  'approvals.work.request.read',
  'approvals.work.request.create',
  'approvals.work.request.update',
  'approvals.work.delegation.read',
  'approvals.work.delegation.manage',
] as const;

const MANAGEMENT_CAPABILITIES = [
  'approvals.operations.read',
  'approvals.operations.execute',
  'approvals.design.read',
  'approvals.design.create',
  'approvals.design.update',
  'approvals.design.publish',
  'approvals.policy.read',
  'approvals.policy.update',
  'approvals.policy.publish',
  'approvals.signature.read',
  'approvals.audit.operations.read',
] as const;

export const APPROVAL_ACTION_CAPABILITY = {
  'route.approvals.admin.form-category-create.action': 'approvals.design.create',
  'route.approvals.admin.form-category-update.action': 'approvals.design.update',
  'route.approvals.admin.form-create.action': 'approvals.design.create',
  'route.approvals.admin.form-publish.action': 'approvals.design.publish',
  'route.approvals.admin.form-update.action': 'approvals.design.update',
  'route.approvals.admin.operations.retry.action': 'approvals.operations.execute',
  'route.approvals.admin.policy-publish.action': 'approvals.policy.publish',
  'route.approvals.admin.policy-update.action': 'approvals.policy.update',
  'route.approvals.admin.workflow-create.action': 'approvals.design.create',
  'route.approvals.admin.workflow-publish.action': 'approvals.design.publish',
  'route.approvals.admin.workflow-update.action': 'approvals.design.update',
  'route.approvals.work.delegation-create.action': 'approvals.work.delegation.manage',
  'route.approvals.work.delegation-revoke.action': 'approvals.work.delegation.manage',
  'route.approvals.work.request-create.action': 'approvals.work.request.create',
  'route.approvals.work.request-draft-update.action': 'approvals.work.request.update',
  'route.approvals.work.request-information-response.action': 'approvals.work.request.update',
  'route.approvals.work.request-submit.action': 'approvals.work.request.update',
  'route.approvals.work.request-withdraw.action': 'approvals.work.request.update',
  'route.approvals.work.task-claim.action': 'approvals.work.task.update',
  'route.approvals.work.task-decision.action': 'approvals.work.task.approve',
} as const;

const APPROVAL_POLICY_ACTIONS = new Set(['route.approvals.work.home-preference-update.action']);
export const APPROVAL_ACTION_ROUTE_CONTRACT_KEYS = [
  ...Object.keys(APPROVAL_ACTION_CAPABILITY),
  ...APPROVAL_POLICY_ACTIONS,
] as const;
const APPROVAL_HIGH_RISK_ACTIONS = new Set([
  'route.approvals.admin.form-publish.action',
  'route.approvals.admin.operations.retry.action',
  'route.approvals.admin.policy-publish.action',
  'route.approvals.admin.workflow-publish.action',
]);
const APPROVAL_HIGH_RISK_CAPABILITIES = new Set([
  'approvals.design.publish',
  'approvals.policy.publish',
  'approvals.operations.execute',
]);

function capabilityGrant(
  capabilityContractKey: string,
  scopeKeys: string | readonly string[],
  readOnly = false,
  activationState: 'ACTIVE' | 'ELIGIBLE' = 'ACTIVE'
) {
  return {
    grantKind: 'CAPABILITY',
    capabilityContractKey,
    resolvedCapabilityCode: capabilityContractKey,
    authorityMode: 'PERMISSION_AND_RELATIONSHIP',
    predicatePolicyKeys: [],
    responsibilityRequirement: 'REQUIRED',
    responsibility: {
      code: 'APP_CONFIG_ADMIN',
      resourceSetKey: 'RS_APPROVALS',
    },
    scopeKeys: typeof scopeKeys === 'string' ? [scopeKeys] : [...scopeKeys],
    requiresProductEntitlement: false,
    readOnly,
    activationState,
    validUntil: null,
  } as const;
}

function workContext(options: ApprovalAuthorityOptions) {
  const capabilities = options.workCapabilityKeys ?? WORK_CAPABILITIES;
  return {
    contextKey: 'ctx:approvals:work',
    productKey: 'approvals',
    surfaceKey: 'approvals.work',
    plane: 'work',
    accessMode: 'NORMAL',
    accessSource: 'ENTITLEMENT',
    appResourceKey: 'APP.APPROVALS',
    effectiveGrants: [
      {
        grantKind: 'POLICY',
        accessPolicyKey: 'approvals.work-access.v1',
        authorityMode: 'ENTITLEMENT',
        policyDecisionRef: 'policy:approvals.work-access.v1',
        scopeKeys: [WORK_SCOPE.key],
        requiresProductEntitlement: true,
        readOnly: false,
        validUntil: null,
      },
      ...capabilities.map((key) => capabilityGrant(key, WORK_SCOPE.key)),
    ],
    scopes: [WORK_SCOPE],
    revalidateAt: options.revalidateAt ?? REVALIDATE_AT,
  } as const;
}

function managementContext(options: ApprovalAuthorityOptions) {
  const capabilities = options.managementCapabilityKeys ?? MANAGEMENT_CAPABILITIES;
  const readOnly = options.managementReadOnly ?? false;
  const scopes =
    options.managementScopes === 'two-no-default'
      ? MANAGEMENT_SCOPES_WITHOUT_DEFAULT.map((scope) => ({ ...scope, readOnly }))
      : [
          {
            ...MANAGEMENT_SCOPE,
            displayName: options.managementScopeDisplayName ?? MANAGEMENT_SCOPE.displayName,
            readOnly,
          },
        ];
  return {
    contextKey: 'ctx:approvals:admin',
    productKey: 'approvals',
    surfaceKey: 'approvals.admin',
    plane: 'management',
    accessMode: 'NORMAL',
    accessSource: 'MANAGEMENT',
    appResourceKey: 'APP.APPROVALS',
    effectiveGrants: capabilities.map((key) =>
      capabilityGrant(
        key,
        scopes.map((scope) => scope.key),
        readOnly,
        APPROVAL_HIGH_RISK_CAPABILITIES.has(key) ? 'ELIGIBLE' : 'ACTIVE'
      )
    ),
    scopes,
    revalidateAt: options.revalidateAt ?? REVALIDATE_AT,
  } as const;
}

function routeAllowed(
  surfaceId: SurfaceId,
  routeContractKey: string,
  options: ApprovalAuthorityOptions
): boolean {
  const capabilities = new Set(
    surfaceId === 'approvals.work'
      ? (options.workCapabilityKeys ?? WORK_CAPABILITIES)
      : (options.managementCapabilityKeys ?? MANAGEMENT_CAPABILITIES)
  );
  const actionCapability =
    APPROVAL_ACTION_CAPABILITY[routeContractKey as keyof typeof APPROVAL_ACTION_CAPABILITY];
  if (actionCapability) return capabilities.has(actionCapability);
  if (APPROVAL_POLICY_ACTIONS.has(routeContractKey)) {
    return surfaceId === 'approvals.work' && options.work !== false;
  }
  if (surfaceId === 'approvals.work') {
    if (routeContractKey === 'route.approvals.work.home.page') return options.work !== false;
    if (
      routeContractKey === 'route.approvals.work.inbox.page' ||
      routeContractKey === 'route.approvals.work.completed.page'
    ) {
      return capabilities.has('approvals.work.task.read');
    }
    if (routeContractKey === 'route.approvals.work.request-new.page') {
      return (
        capabilities.has('approvals.work.request.create') &&
        capabilities.has('approvals.work.request.update')
      );
    }
    if (
      routeContractKey === 'route.approvals.work.request-drafts.page' ||
      routeContractKey === 'route.approvals.work.request-submitted.page' ||
      routeContractKey === 'route.approvals.work.request-needs-info.page' ||
      routeContractKey === 'route.approvals.work.request-archive.page'
    ) {
      return capabilities.has('approvals.work.request.read');
    }
    if (routeContractKey === 'route.approvals.work.delegations.page') {
      return (
        capabilities.has('approvals.work.delegation.read') ||
        capabilities.has('approvals.work.delegation.manage')
      );
    }
    return false;
  }
  const required =
    routeContractKey === 'route.approvals.admin.overview.page'
      ? ['approvals.operations.read', 'approvals.oversight.overview.read']
      : routeContractKey === 'route.approvals.admin.workflows.page' ||
          routeContractKey === 'route.approvals.admin.forms.page'
        ? ['approvals.design.read', 'approvals.oversight.design.read']
        : routeContractKey === 'route.approvals.admin.policies.page'
          ? ['approvals.policy.read', 'approvals.oversight.policy.read']
          : routeContractKey === 'route.approvals.admin.operations.page'
            ? [
                'approvals.operations.read',
                'approvals.audit.operations.read',
                'approvals.oversight.operations.read',
              ]
            : routeContractKey === 'route.approvals.admin.signatures.page'
              ? ['approvals.signature.read', 'approvals.oversight.signature.read']
              : [];
  return required.some((key) => capabilities.has(key));
}

function success(route: Route, data: unknown) {
  return route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data }),
  });
}

function baselineRollout(productKey: (typeof GOVERNED_PRODUCT_KEYS)[number]) {
  return {
    productKey,
    state: '000',
    flags: {
      contextShadow: false,
      capabilityEnforcement: false,
      surfaceUi: false,
    },
    cohort: 'baseline',
    opaqueRevision: `rollout-${productKey}-baseline`,
    authorityStatus: 'NOT_EVALUATED',
  } as const;
}

export async function mockLegacyProductSurfaceAuthority(page: Page) {
  const rollouts = GOVERNED_PRODUCT_KEYS.map(baselineRollout);

  await page.route('**/api/auth/product-surface-contexts', (route) =>
    success(route, {
      contractVersion: 'product-surfaces/v3',
      decisionRevision: 'e2e-product-authority-baseline',
      sourceRevisions: {
        auth: 'auth-baseline',
        policy: 'policy-baseline',
        productRelationship: 'relationship-baseline',
      },
      activeAccessMode: 'NORMAL',
      generatedAt: GENERATED_AT,
      contexts: [],
      rollouts,
    })
  );
  await page.route('**/api/auth/product-surface-access/evaluate', (route) =>
    success(route, {
      decision: 'SURFACE_DENIED',
      reasonCode: 'PRODUCT_SURFACE_AUTHORITY_UNAVAILABLE',
      decisionRevision: 'e2e-product-authority-baseline',
    })
  );
}

function hcmPolicyGrant(accessPolicyKey: string, scopeKey: string) {
  return {
    grantKind: 'POLICY',
    accessPolicyKey,
    authorityMode: 'ENTITLEMENT',
    policyDecisionRef: `policy:${accessPolicyKey}`,
    scopeKeys: [scopeKey],
    requiresProductEntitlement: false,
    readOnly: false,
    validUntil: null,
  } as const;
}

function hcmCapabilityGrant(capabilityContractKey: string, scopeKey: string) {
  return {
    grantKind: 'CAPABILITY',
    capabilityContractKey,
    resolvedCapabilityCode: capabilityContractKey,
    authorityMode: 'PERMISSION',
    predicatePolicyKeys: [],
    responsibilityRequirement: 'NOT_REQUIRED',
    scopeKeys: [scopeKey],
    requiresProductEntitlement: false,
    readOnly: false,
    activationState: 'ACTIVE',
    validUntil: null,
  } as const;
}

function hcmContext(
  surfaceKey: HcmSurfaceId,
  plane: 'work' | 'management',
  scope: { key: string; kind: 'SELF' | 'TEAM' | 'TARGET_POPULATION' | 'RESOURCE_SET' },
  policies: readonly string[],
  capabilities: readonly string[]
) {
  return {
    contextKey: `ctx:${surfaceKey}`,
    productKey: 'hcm',
    surfaceKey,
    plane,
    accessMode: 'NORMAL',
    accessSource: plane === 'management' ? 'MANAGEMENT' : 'ENTITLEMENT',
    appResourceKey: 'APP.HCM',
    effectiveGrants: [
      ...policies.map((key) => hcmPolicyGrant(key, scope.key)),
      ...capabilities.map((key) => hcmCapabilityGrant(key, scope.key)),
    ],
    scopes: [
      {
        ...scope,
        displayName: surfaceKey,
        isDefault: true,
        readOnly: false,
        validUntil: null,
      },
    ],
    revalidateAt: REVALIDATE_AT,
  } as const;
}

/** Server-authoritative HCM fixture used by the four-surface browser acceptance suite. */
export async function mockHcmProductSurfaceAuthority(
  page: Page,
  options: HcmAuthorityOptions = {}
) {
  const deniedRouteKeys = new Set(options.deniedRouteKeys ?? []);
  const contexts = [
    hcmContext(
      'hcm.personal',
      'work',
      { key: 'scope:hcm:self', kind: 'SELF' },
      [
        'hcm.personal-access.v1',
        'hcm.personal-core-access.v1',
        'hcm.personal-services-access.v1',
        'hcm.directory-access.v1',
      ],
      []
    ),
    hcmContext(
      'hcm.team',
      'work',
      { key: 'scope:hcm:team', kind: 'TEAM' },
      ['hcm.team-access.v1'],
      ['hcm.team.time.read', 'hcm.team.absence.read']
    ),
    hcmContext(
      'hcm.operations',
      'management',
      { key: 'scope:hcm:operations', kind: 'TARGET_POPULATION' },
      ['hcm.operations-access.v1'],
      [
        'hcm.operations.workforce.read',
        'hcm.operations.time.read',
        'hcm.operations.absence.read',
        'hcm.operations.benefits.read',
        'hcm.operations.pay.read',
        'hcm.operations.talent.read',
      ]
    ),
    hcmContext(
      'hcm.management',
      'management',
      { key: 'scope:hcm:management', kind: 'RESOURCE_SET' },
      [],
      [
        'hcm.org-design.read',
        'hcm.reference.read',
        'hcm.integration.read',
        'hcm.controlled-export.read',
      ]
    ),
  ] as const;
  const contextBySurface = new Map(contexts.map((context) => [context.surfaceKey, context]));

  await page.route('**/api/auth/product-surface-contexts', (route) =>
    success(route, {
      contractVersion: 'product-surfaces/v3',
      decisionRevision: 'e2e-hcm-authority-1',
      sourceRevisions: {
        auth: 'auth-hcm-1',
        policy: 'policy-hcm-1',
        productRelationship: 'relationship-hcm-1',
      },
      activeAccessMode: 'NORMAL',
      generatedAt: GENERATED_AT,
      contexts,
      rollouts: GOVERNED_PRODUCT_KEYS.map((productKey) =>
        productKey === 'hcm'
          ? {
              productKey,
              state: '111',
              flags: {
                contextShadow: true,
                capabilityEnforcement: true,
                surfaceUi: true,
              },
              cohort: 'e2e-hcm-pilot',
              opaqueRevision: 'rollout-hcm-e2e-1',
              authorityStatus: 'AVAILABLE',
            }
          : baselineRollout(productKey)
      ),
    })
  );
  await page.route('**/api/auth/product-surface-access/evaluate', (route) => {
    const body = route.request().postDataJSON() as {
      subject?: { surfaceKey?: HcmSurfaceId };
      routeContractKey?: string;
      contextScopeKey?: string;
    };
    const surfaceKey = body.subject?.surfaceKey;
    const routeContractKey = body.routeContractKey ?? '';
    const context = surfaceKey ? contextBySurface.get(surfaceKey) : undefined;
    if (!context) {
      return success(route, {
        decision: 'SURFACE_DENIED',
        reasonCode: 'SURFACE_CAPABILITY_REQUIRED',
        decisionRevision: 'e2e-hcm-authority-1',
      });
    }
    if (deniedRouteKeys.has(routeContractKey)) {
      return success(route, {
        decision: 'ROUTE_DENIED',
        reasonCode: 'ROUTE_CAPABILITY_REQUIRED',
        decisionRevision: 'e2e-hcm-authority-1',
      });
    }
    const scope =
      context.scopes.find((candidate) => candidate.key === body.contextScopeKey) ??
      context.scopes[0];
    return success(route, {
      decision: 'ALLOWED',
      reasonCode: null,
      decisionRevision: 'e2e-hcm-authority-1',
      context,
      routeGrantRef: `grant:${routeContractKey}`,
      scope,
      effectiveReadOnly: false,
      validUntil: null,
      revalidateAt: REVALIDATE_AT,
    });
  });
}

export async function mockApprovalProductSurfaceAuthority(
  page: Page,
  options: ApprovalAuthorityOptions = {}
) {
  const enabled = new Set<SurfaceId>();
  if (options.work !== false) enabled.add('approvals.work');
  if (options.management !== false) enabled.add('approvals.admin');
  const deniedRouteKeys = new Set(options.deniedRouteKeys ?? []);
  let revision = 1;
  const evaluations: Array<{
    surfaceId?: SurfaceId;
    routeContractKey: string;
    contextScopeKey?: string;
  }> = [];

  const contextFor = (surfaceId: SurfaceId) =>
    surfaceId === 'approvals.work' ? workContext(options) : managementContext(options);
  const contexts = () => [...enabled].map(contextFor);
  const decisionRevision = () => `e2e-approval-authority-${revision}`;

  await page.route('**/api/auth/product-surface-contexts', (route) =>
    success(route, {
      contractVersion: 'product-surfaces/v3',
      decisionRevision: decisionRevision(),
      sourceRevisions: {
        auth: `auth-${revision}`,
        policy: 'policy-v2',
        productRelationship: `relationship-${revision}`,
      },
      activeAccessMode: 'NORMAL',
      generatedAt: options.generatedAt ?? GENERATED_AT,
      contexts: contexts(),
      rollouts: [
        {
          productKey: 'approvals',
          state: options.surfaceUi === false ? '000' : '111',
          flags: {
            contextShadow: options.surfaceUi !== false,
            capabilityEnforcement: options.surfaceUi !== false,
            surfaceUi: options.surfaceUi !== false,
          },
          cohort: 'e2e-pilot',
          opaqueRevision: `rollout-approvals-${revision}`,
          authorityStatus: options.surfaceUi === false ? 'NOT_EVALUATED' : 'AVAILABLE',
        },
        ...GOVERNED_PRODUCT_KEYS.filter((productKey) => productKey !== 'approvals').map(
          baselineRollout
        ),
      ],
    })
  );

  await page.route('**/api/auth/product-surface-access/evaluate', (route) => {
    const body = route.request().postDataJSON() as {
      subject?: { surfaceKey?: SurfaceId };
      routeContractKey?: string;
      contextScopeKey?: string;
    };
    const surfaceId = body.subject?.surfaceKey;
    const routeContractKey = body.routeContractKey ?? '';
    evaluations.push({
      surfaceId,
      routeContractKey,
      ...(body.contextScopeKey ? { contextScopeKey: body.contextScopeKey } : {}),
    });
    if (!surfaceId || !enabled.has(surfaceId)) {
      return success(route, {
        decision: 'SURFACE_DENIED',
        reasonCode: 'SURFACE_CAPABILITY_REQUIRED',
        decisionRevision: decisionRevision(),
      });
    }
    if (deniedRouteKeys.has(routeContractKey)) {
      return success(route, {
        decision: 'ROUTE_DENIED',
        reasonCode: 'ROUTE_CAPABILITY_REQUIRED',
        decisionRevision: decisionRevision(),
      });
    }
    if (!routeAllowed(surfaceId, routeContractKey, options)) {
      return success(route, {
        decision: 'ROUTE_DENIED',
        reasonCode: 'ROUTE_CAPABILITY_REQUIRED',
        decisionRevision: decisionRevision(),
      });
    }
    const context = contextFor(surfaceId);
    const scope = body.contextScopeKey
      ? context.scopes.find((candidate) => candidate.key === body.contextScopeKey)
      : (context.scopes.find((candidate) => candidate.isDefault) ??
        (context.scopes.length === 1 ? context.scopes[0] : undefined));
    if (!scope) {
      return success(route, {
        decision: body.contextScopeKey ? 'SCOPE_INVALID' : 'SCOPE_SELECTION_REQUIRED',
        reasonCode: body.contextScopeKey ? 'SCOPE_CONTEXT_EXPIRED' : 'SCOPE_SELECTION_REQUIRED',
        decisionRevision: decisionRevision(),
      });
    }
    if (APPROVAL_HIGH_RISK_ACTIONS.has(routeContractKey)) {
      return success(route, {
        decision: 'STEP_UP_REQUIRED',
        reasonCode: 'STEP_UP_REQUIRED',
        decisionRevision: decisionRevision(),
        requiredAssurance: 'urn:dwp:assurance:high',
        revalidateAt: options.revalidateAt ?? REVALIDATE_AT,
      });
    }
    return success(route, {
      decision: 'ALLOWED',
      reasonCode: null,
      decisionRevision: decisionRevision(),
      context,
      routeGrantRef: `grant:${routeContractKey}`,
      scope,
      effectiveReadOnly: scope.readOnly,
      validUntil: null,
      revalidateAt: options.revalidateAt ?? REVALIDATE_AT,
    });
  });

  return {
    revoke(surfaceId: SurfaceId) {
      enabled.delete(surfaceId);
      revision += 1;
    },
    revision: () => decisionRevision(),
    evaluations,
  };
}

export async function broadcastProductSurfaceRevision(page: Page, decisionRevision: string) {
  await page.evaluate((nextRevision) => {
    const channel = new BroadcastChannel('dwp:product-surface:revision:v1');
    channel.postMessage({
      type: 'product-surface-revision-changed',
      tenantId: '1',
      actorId: '1',
      accessMode: 'NORMAL',
      decisionRevision: nextRevision,
      senderId: 'playwright-revocation',
    });
    channel.close();
  }, decisionRevision);
}
