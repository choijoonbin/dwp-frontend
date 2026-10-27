import { mkdir, writeFile } from 'node:fs/promises';
import { type Page } from '@playwright/test';

import { FULL_PRODUCT_PERMISSIONS, fulfillSuccess, mockShellSession } from './shell-session';

const WORK_EXPLORER_NOW = '2026-10-15T06:00:00Z';
const WORK_EXPLORER_HASH = 'a'.repeat(64);
const WORK_EXPLORER_RECEIPT_ID = '77777777-7777-4777-8777-777777777777';

type WorkExplorerMode = 'loading' | 'fresh' | 'partial' | 'empty' | 'forbidden' | 'error';

function workExplorerRoute(input: {
  suffix: string;
  path: string;
  module: 'HRM' | 'PER' | 'TIM' | 'PAY' | 'SYS';
  workbench: 'MY_HR' | 'TEAM' | 'HR_OPERATIONS' | 'TIME' | 'PAYROLL' | 'PERFORMANCE' | 'SETTINGS';
  routeContractKey: string;
  capabilityKey: string;
  control?: boolean;
}) {
  return {
    routeKey: `hris.explorer.${input.suffix}`,
    target: {
      kind: input.control ? ('DWP_CONTROL' as const) : ('HRIS_INTERNAL' as const),
      path: input.path,
    },
    labelKey: `hris.explorer.routes.${input.suffix}`,
    module: input.module,
    workbench: input.workbench,
    authorization: {
      routeContractKey: input.routeContractKey,
      capabilityMode: 'SINGLE' as const,
      capabilityKeys: [input.capabilityKey],
    },
  };
}

const WORK_EXPLORER_ROUTES = [
  workExplorerRoute({
    suffix: 'team-time',
    path: '/hr/team/time',
    module: 'TIM',
    workbench: 'TEAM',
    routeContractKey: 'route.hcm.team.time.page',
    capabilityKey: 'hcm.team.time.read',
  }),
  workExplorerRoute({
    suffix: 'my-employment-documents',
    path: '/hr/me/employment-documents',
    module: 'HRM',
    workbench: 'MY_HR',
    routeContractKey: 'route.hcm.personal.employment-documents.page',
    capabilityKey: 'hcm.personal.profile.view',
  }),
  workExplorerRoute({
    suffix: 'hr-employee-change-requests',
    path: '/hr/operations/people/employee-change-requests',
    module: 'HRM',
    workbench: 'HR_OPERATIONS',
    routeContractKey: 'route.hcm.operations.employee-change-requests.page',
    capabilityKey: 'hcm.operations.people.view',
  }),
  workExplorerRoute({
    suffix: 'performance-multirater-surveys',
    path: '/hr/operations/performance/multirater-surveys',
    module: 'PER',
    workbench: 'PERFORMANCE',
    routeContractKey: 'route.hcm.operations.performance-multirater-surveys.page',
    capabilityKey: 'hcm.operations.performance.view',
  }),
  workExplorerRoute({
    suffix: 'hcm-operations-compensation-planning',
    path: '/hr/operations/performance/compensation-planning',
    module: 'PER',
    workbench: 'PERFORMANCE',
    routeContractKey: 'route.hcm.operations.compensation-planning.page',
    capabilityKey: 'hcm.compensation.plan.view',
  }),
  workExplorerRoute({
    suffix: 'dwp-governance',
    path: '/admin/governance/audit-overview?product=HCM',
    module: 'SYS',
    workbench: 'SETTINGS',
    routeContractKey: 'route.hcm.audit.evidence.page',
    capabilityKey: 'hcm.audit.evidence.view',
    control: true,
  }),
] as const;

function workExplorerProjection(
  mode: Exclude<WorkExplorerMode, 'loading' | 'forbidden' | 'error'>
) {
  const routes = mode === 'empty' ? [] : WORK_EXPLORER_ROUTES;
  const status = mode === 'partial' ? 'PARTIAL' : 'FRESH';
  return {
    asOf: WORK_EXPLORER_NOW,
    projectionRevision: 12,
    entitlementRevision: 18,
    favoritePreferenceRevision: 3,
    routes,
    favorites: mode === 'empty' ? [] : [{ ...WORK_EXPLORER_ROUTES[0], position: 1 }],
    recents:
      mode === 'empty'
        ? []
        : [
            {
              ...WORK_EXPLORER_ROUTES[1],
              lastVisitedAt: '2026-10-15T05:00:00Z',
              expiresAt: '2026-11-14T05:00:00Z',
            },
          ],
    inProgress:
      mode === 'empty'
        ? []
        : [
            {
              activityId: '66666666-6666-4666-8666-666666666666',
              sourceKind: 'APPROVAL_CASE',
              module: 'HRM',
              state: 'WAITING_FOR_ME',
              sourceRevision: 4,
              updatedAt: '2026-10-15T05:30:00Z',
              target: {
                kind: 'HRIS_INTERNAL',
                path: '/hr/operations/people/employee-change-requests',
              },
            },
            {
              activityId: WORK_EXPLORER_RECEIPT_ID,
              sourceKind: 'COMMAND_RECEIPT',
              module: 'HRM',
              state: 'RESULT_UNKNOWN',
              sourceRevision: 2,
              updatedAt: '2026-10-15T05:45:00Z',
              target: {
                kind: 'HRIS_INTERNAL',
                path: '/hr/team/time',
              },
            },
          ],
    nextCursor: null,
    projectionStatus: {
      state: status,
      degradedSources:
        status === 'FRESH'
          ? []
          : [
              {
                module: 'PER',
                sourceKind: 'WORKFLOW_CASE',
                reason: 'UNAVAILABLE',
                retryable: true,
              },
            ],
    },
    policy: {
      maxFavorites: 20,
      maxRecents: 20,
      recentTtlDays: 30,
      maxInProgress: 20,
      entitlementRefilter: true,
      cleanupMode: 'READ_AND_WRITE_THROUGH_PURGE',
    },
  };
}

function workExplorerReceipt(
  commandType: 'EXPLORER_PREFERENCES_REPLACE' | 'EXPLORER_RECENT_RECORD',
  status: 'ACCEPTED' | 'SUCCEEDED' | 'RESULT_UNKNOWN'
) {
  return {
    receiptId: WORK_EXPLORER_RECEIPT_ID,
    commandType,
    originatingAction: commandType,
    subjectPrincipalPublicId: '88888888-8888-4888-8888-888888888888',
    populationScopeDigest: WORK_EXPLORER_HASH,
    fieldPolicyRevision: 4,
    purposeCode: 'HRIS_APP_DISCOVERY',
    authorizationRevision: 18,
    status,
    correlationId: '99999999-9999-4999-8999-999999999999',
    requestDigest: WORK_EXPLORER_HASH,
    createdAt: WORK_EXPLORER_NOW,
  };
}

function workExplorerPlatformReceipt(status: 'SUCCEEDED' | 'RESULT_UNKNOWN') {
  return {
    receiptId: WORK_EXPLORER_RECEIPT_ID,
    commandType: 'REFERENCE_CONFIGURATION_PUBLISH',
    originatingAction: 'HRIS_REFERENCE_CONFIGURATION_PUBLISH',
    subjectPrincipalPublicId: '88888888-8888-4888-8888-888888888888',
    populationScopeDigest: WORK_EXPLORER_HASH,
    fieldPolicyRevision: 4,
    purposeCode: 'HRIS_SYSTEM_ADMIN',
    authorizationRevision: 18,
    status,
    correlationId: '99999999-9999-4999-8999-999999999999',
    requestDigest: WORK_EXPLORER_HASH,
    createdAt: WORK_EXPLORER_NOW,
  };
}

export async function mockWorkExplorerAuthority(page: Page, locale: 'en' | 'ko' = 'en') {
  const authority: {
    denied: boolean;
    shellDuty: 'exact' | 'absent' | 'wrong';
    rejectedShellDuties: Array<'absent' | 'wrong'>;
  } = {
    denied: false,
    shellDuty: 'exact',
    rejectedShellDuties: [],
  };
  await mockShellSession(page, ['HR_ADMIN', 'MANAGER'], {
    locale,
    displayName: locale === 'ko' ? 'HRIS 운영 담당자' : 'HRIS Operator',
    jobTitle: locale === 'ko' ? '인사 운영 책임자' : 'People operations lead',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  const scope = {
    key: 'scope:hcm:utility',
    kind: 'SELF',
    displayName: 'HRIS Work Explorer',
    isDefault: true,
    readOnly: false,
    validUntil: null,
  } as const;
  const context = {
    contextKey: 'ctx:hcm.utility',
    productKey: 'hcm',
    surfaceKey: 'hcm.utility',
    plane: 'work',
    accessMode: 'NORMAL',
    accessSource: 'ENTITLEMENT',
    appResourceKey: 'APP.HCM',
    effectiveGrants: [
      {
        grantKind: 'CAPABILITY',
        capabilityContractKey: 'hcm.app.shell.view',
        resolvedCapabilityCode: 'DATA.HRIS_APP_SHELL:VIEW',
        authorityMode: 'PERMISSION_AND_RELATIONSHIP',
        predicatePolicyKeys: ['predicate.hcm-explorer-authority.v1'],
        responsibilityRequirement: 'REQUIRED',
        responsibility: {
          code: 'HRIS_DUTY_APP_SHELL_READER',
          resourceSetKey: 'SELF',
        },
        scopeKeys: [scope.key],
        requiresProductEntitlement: true,
        readOnly: false,
        activationState: 'ACTIVE',
        validUntil: null,
      },
      {
        grantKind: 'CAPABILITY',
        capabilityContractKey: 'hcm.command-receipt.view',
        resolvedCapabilityCode: 'DATA.HRIS_COMMAND_RECEIPT:VIEW',
        authorityMode: 'PERMISSION_AND_RELATIONSHIP',
        predicatePolicyKeys: ['predicate.hcm-platform-command-receipt-authority.v1'],
        responsibilityRequirement: 'NOT_REQUIRED',
        scopeKeys: [scope.key],
        requiresProductEntitlement: false,
        readOnly: true,
        activationState: 'ACTIVE',
        validUntil: null,
      },
    ],
    scopes: [scope],
    revalidateAt: '2026-10-16T06:00:00Z',
  } as const;
  const personalScope = {
    key: 'scope:hcm:self',
    kind: 'SELF',
    displayName: 'My HR',
    isDefault: true,
    readOnly: false,
    validUntil: null,
  } as const;
  const personalContext = {
    contextKey: 'ctx:hcm.personal',
    productKey: 'hcm',
    surfaceKey: 'hcm.personal',
    plane: 'work',
    accessMode: 'NORMAL',
    accessSource: 'ENTITLEMENT',
    appResourceKey: 'APP.HCM',
    effectiveGrants: [
      {
        grantKind: 'CAPABILITY',
        capabilityContractKey: 'hcm.personal.profile.view',
        resolvedCapabilityCode: 'hcm.personal.profile.view',
        authorityMode: 'PERMISSION',
        predicatePolicyKeys: ['hcm.personal-access.v1'],
        responsibilityRequirement: 'NOT_REQUIRED',
        scopeKeys: [personalScope.key],
        requiresProductEntitlement: true,
        readOnly: false,
        activationState: 'ACTIVE',
        validUntil: null,
      },
    ],
    scopes: [personalScope],
    revalidateAt: '2026-10-16T06:00:00Z',
  } as const;
  const utilityContext = () => {
    const shellGrant = context.effectiveGrants[0];
    if (authority.shellDuty === 'exact') return context;
    return {
      ...context,
      effectiveGrants: [
        {
          ...shellGrant,
          ...(authority.shellDuty === 'absent'
            ? { responsibility: undefined }
            : {
                responsibility: {
                  code: 'HRIS_DUTY_CONFIGURATION_READER',
                  resourceSetKey: 'SELF',
                },
              }),
        },
      ],
    };
  };

  await page.route('**/api/auth/product-surface-contexts', (route) =>
    fulfillSuccess(route, {
      contractVersion: '2',
      decisionRevision: 'e2e-work-explorer-authority-1',
      sourceRevisions: {
        auth: 'auth-1',
        policy: 'policy-1',
        productRelationship: 'relation-1',
        targetPopulation: 'population-1',
        support: null,
        tenantControl: 'tenant-control-1',
      },
      activeAccessMode: 'NORMAL',
      generatedAt: WORK_EXPLORER_NOW,
      contexts: [personalContext, utilityContext()],
      rollouts: [
        {
          productKey: 'hcm',
          state: '111',
          flags: { contextShadow: true, capabilityEnforcement: true, surfaceUi: true },
          cohort: 'e2e-work-explorer',
          opaqueRevision: 'rollout-hcm-explorer-1',
          authorityStatus: 'AVAILABLE',
        },
      ],
    })
  );
  await page.route('**/api/auth/product-surface-access/evaluate', (route) => {
    const request = route.request().postDataJSON() as {
      subject?: { surfaceKey?: string };
      routeContractKey?: string;
      contextScopeKey?: string;
    };
    const matched =
      request.subject?.surfaceKey === 'hcm.utility'
        ? { context: utilityContext(), scope }
        : request.subject?.surfaceKey === 'hcm.personal'
          ? { context: personalContext, scope: personalScope }
          : undefined;
    const shellGrant =
      matched?.context.surfaceKey === 'hcm.utility'
        ? matched.context.effectiveGrants[0]
        : undefined;
    const exactShellDuty =
      shellGrant?.capabilityContractKey === 'hcm.app.shell.view' &&
      shellGrant.resolvedCapabilityCode === 'DATA.HRIS_APP_SHELL:VIEW' &&
      shellGrant.authorityMode === 'PERMISSION_AND_RELATIONSHIP' &&
      shellGrant.responsibilityRequirement === 'REQUIRED' &&
      shellGrant.responsibility?.code === 'HRIS_DUTY_APP_SHELL_READER' &&
      shellGrant.responsibility.resourceSetKey === 'SELF' &&
      shellGrant.scopeKeys.includes(scope.key);
    if (
      !matched ||
      authority.denied ||
      (request.subject?.surfaceKey === 'hcm.utility' && !exactShellDuty)
    ) {
      if (authority.shellDuty !== 'exact') {
        authority.rejectedShellDuties.push(authority.shellDuty);
      }
      return fulfillSuccess(route, {
        decision: 'ROUTE_DENIED',
        reasonCode: 'ROUTE_CAPABILITY_REQUIRED',
        decisionRevision: 'e2e-work-explorer-authority-1',
      });
    }
    return fulfillSuccess(route, {
      decision: 'ALLOWED',
      reasonCode: null,
      decisionRevision: 'e2e-work-explorer-authority-1',
      context: matched.context,
      routeGrantRef: `grant:${request.routeContractKey}`,
      scope: matched.scope,
      effectiveReadOnly: false,
      validUntil: null,
      revalidateAt: matched.context.revalidateAt,
    });
  });
  return authority;
}

export async function mockWorkExplorerApi(page: Page, initialMode: WorkExplorerMode = 'partial') {
  const state: {
    mode: WorkExplorerMode;
    preference: 'succeeded' | 'accepted' | 'conflict' | 'result-unknown' | 'transport-error-once';
    recent: 'succeeded' | 'accepted' | 'result-unknown';
    favoriteRouteKeys: string[];
    recentRouteKeys: string[];
    receiptCommandType: 'EXPLORER_PREFERENCES_REPLACE' | 'EXPLORER_RECENT_RECORD';
    receiptProfile: 'explorer' | 'platform';
    receiptProfilesServed: Array<'explorer' | 'platform'>;
    receiptIdentity: 'exact' | 'wrong-context';
    receiptRead: 'succeeded' | 'result-unknown-once';
    releaseLoading?: () => void;
    requests: URL[];
    commandHeaders: Record<string, string>[];
    recentHeaders: Record<string, string>[];
  } = {
    mode: initialMode,
    preference: 'succeeded',
    recent: 'succeeded',
    favoriteRouteKeys: [WORK_EXPLORER_ROUTES[0].routeKey],
    recentRouteKeys: [],
    receiptCommandType: 'EXPLORER_PREFERENCES_REPLACE',
    receiptProfile: 'explorer',
    receiptProfilesServed: [],
    receiptIdentity: 'exact',
    receiptRead: 'succeeded',
    requests: [],
    commandHeaders: [],
    recentHeaders: [],
  };
  await page.route('**/api/platform/v1/hris/explorer?**', async (route) => {
    const requestUrl = new URL(route.request().url());
    state.requests.push(requestUrl);
    if (state.mode === 'forbidden') {
      return route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Explorer authority denied' }),
      });
    }
    if (state.mode === 'error') {
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Explorer projection unavailable' }),
      });
    }
    if (state.mode === 'loading') {
      await new Promise<void>((resolve) => {
        state.releaseLoading = () => {
          state.mode = 'partial';
          resolve();
        };
      });
    }
    const mode = state.mode;
    if (mode === 'loading') {
      throw new Error(`Unexpected Work Explorer fixture mode after loading: ${mode}`);
    }
    const projection = workExplorerProjection(mode);
    const favorites = state.favoriteRouteKeys.flatMap((routeKey, index) => {
      const favorite = WORK_EXPLORER_ROUTES.find((candidate) => candidate.routeKey === routeKey);
      return favorite ? [{ ...favorite, position: index + 1 }] : [];
    });
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...projection, ...(mode === 'empty' ? {} : { favorites }) }),
    });
  });
  await page.route('**/api/platform/v1/hris/explorer/preferences?**', (route) => {
    state.commandHeaders.push(route.request().headers());
    if (state.preference === 'transport-error-once') {
      state.preference = 'succeeded';
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Preference command transport unavailable' }),
      });
    }
    if (state.preference === 'conflict') {
      return route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Preference revision changed' }),
      });
    }
    const status =
      state.preference === 'result-unknown'
        ? 'RESULT_UNKNOWN'
        : state.preference === 'accepted'
          ? 'ACCEPTED'
          : 'SUCCEEDED';
    state.receiptCommandType = 'EXPLORER_PREFERENCES_REPLACE';
    if (status === 'RESULT_UNKNOWN') {
      state.receiptCommandType = 'EXPLORER_PREFERENCES_REPLACE';
    } else {
      const command = route.request().postDataJSON() as { orderedFavoriteRouteKeys: string[] };
      state.favoriteRouteKeys = command.orderedFavoriteRouteKeys;
    }
    return route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify(workExplorerReceipt('EXPLORER_PREFERENCES_REPLACE', status)),
    });
  });
  await page.route('**/api/platform/v1/hris/explorer/recents?**', (route) => {
    const command = route.request().postDataJSON() as { routeKey: string };
    state.recentRouteKeys.push(command.routeKey);
    state.recentHeaders.push(route.request().headers());
    const status =
      state.recent === 'result-unknown'
        ? 'RESULT_UNKNOWN'
        : state.recent === 'accepted'
          ? 'ACCEPTED'
          : 'SUCCEEDED';
    state.receiptCommandType = 'EXPLORER_RECENT_RECORD';
    return route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify(workExplorerReceipt('EXPLORER_RECENT_RECORD', status)),
    });
  });
  await page.route('**/api/platform/v1/admin/hris/command-receipts/**?**', (route) => {
    const status = state.receiptRead === 'result-unknown-once' ? 'RESULT_UNKNOWN' : 'SUCCEEDED';
    if (state.receiptRead === 'result-unknown-once') state.receiptRead = 'succeeded';
    state.receiptProfilesServed.push(state.receiptProfile);
    const receipt =
      state.receiptProfile === 'platform'
        ? workExplorerPlatformReceipt(status)
        : workExplorerReceipt(state.receiptCommandType, status);
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        state.receiptIdentity === 'wrong-context'
          ? {
              ...receipt,
              subjectPrincipalPublicId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            }
          : receipt
      ),
    });
  });
  return state;
}

export async function createWorkExplorerZoomExtension(directory: string) {
  await mkdir(directory, { recursive: true });
  await Promise.all([
    writeFile(
      `${directory}/manifest.json`,
      JSON.stringify({
        manifest_version: 3,
        name: 'Work Explorer native zoom evidence',
        version: '1.0.0',
        permissions: ['tabs'],
        background: { service_worker: 'worker.js' },
      })
    ),
    writeFile(`${directory}/worker.js`, 'chrome.runtime.onInstalled.addListener(() => {});\n'),
  ]);
  return directory;
}
