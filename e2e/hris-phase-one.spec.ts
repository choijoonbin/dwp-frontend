import { mkdir, writeFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import {
  people360ListSnapshot,
  people360Page,
  people360Snapshot,
} from '../apps/dwp/src/features/hris/people/testing/people-360.test-support';
import {
  HR_HOME_FIXTURE,
  HR_PAY_FIXTURE,
  HR_TALENT_FIXTURE,
  HR_TIME_FIXTURE,
} from './support/product-area-fixtures';
import { mockHcmProductSurfaceAuthority } from './support/product-surface-authority';
import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';
import { createBrowserZoomSession } from './support/browser-zoom';

const DATA_ANCHORS = [
  {
    module: 'HRM',
    path: '/hr/operations/people',
    apiPath: '/api/people/v1/workforce/people',
    contextScopeKey: 'scope:hcm:operations',
    heading: 'Workforce people',
    marker: 'input[data-testid="hris-people360-search"]',
  },
  {
    module: 'TIM',
    path: '/hr/time',
    apiPath: '/api/people/v1/hr/time',
    contextScopeKey: 'scope:hcm:self',
    heading: 'My time',
    marker: '[data-testid="hris-query-state"][data-query-state="ready"]',
  },
  {
    module: 'PAY',
    path: '/hr/pay',
    apiPath: '/api/people/v1/hr/pay',
    contextScopeKey: 'scope:hcm:self',
    heading: 'Pay statements',
    marker: '[data-testid="hris-payroll-workspace"]',
  },
  {
    module: 'PER',
    path: '/hr/talent',
    apiPath: '/api/people/v1/hr/talent',
    contextScopeKey: 'scope:hcm:self',
    heading: 'Growth and career',
    marker: '[data-route="/hr/talent"][data-scope="personal-goal-progress"]',
  },
] as const;

const HRIS_TIME_ANCHOR_FIXTURE = {
  ...HR_TIME_FIXTURE,
  card: {
    ...HR_TIME_FIXTURE.card,
    dataOrigin: 'SOURCE',
  },
  entries: HR_TIME_FIXTURE.entries.map((entry) => ({
    ...entry,
    entryType: 'WORK',
  })),
} as const;

const PEOPLE_IDENTITY = {
  personId: '11111111-1111-4111-8111-111111111111',
  displayName: 'Phase One Person',
} as const;

async function expectNoDocumentOverflow(page: Page) {
  const geometry = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(geometry.content).toBeLessThanOrEqual(geometry.viewport + 1);
}

async function captureEvidence(page: Page, projectName: string, name: string) {
  const directory = process.env.HRIS_PHASE_ONE_EVIDENCE_DIR;
  if (!directory) return;
  await page.screenshot({ path: `${directory}/${projectName}-${name}.png`, fullPage: true });
}

async function mockHrisOperator(page: Page) {
  await mockShellSession(page, ['HR_ADMIN'], {
    locale: 'en',
    displayName: 'HRIS Operator',
    jobTitle: 'People operations lead',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
}

async function mockGovernedHrisOperator(page: Page) {
  await mockHrisOperator(page);
  await mockHcmProductSurfaceAuthority(page);
}

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

async function mockWorkExplorerAuthority(page: Page, locale: 'en' | 'ko' = 'en') {
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
      contractVersion: 'product-surfaces/v3',
      decisionRevision: 'e2e-work-explorer-authority-1',
      sourceRevisions: { auth: 'auth-1', policy: 'policy-1', productRelationship: 'relation-1' },
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

async function mockWorkExplorerApi(page: Page, initialMode: WorkExplorerMode = 'partial') {
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

async function createWorkExplorerZoomExtension(directory: string) {
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

function fixtureMarker(module: (typeof DATA_ANCHORS)[number]['module']) {
  if (module === 'TIM') return HR_TIME_FIXTURE.exceptions[0].message;
  if (module === 'PAY') return HR_PAY_FIXTURE.nextCycle.name;
  if (module === 'PER') return HR_TALENT_FIXTURE.goals[0].title;
  return null;
}

test('employee enters a widget-only HRIS home instead of a menu catalog', async ({
  page,
}, testInfo) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    displayName: 'HRIS Employee',
    jobTitle: 'Product designer',
  });
  await page.goto('/hr/home');

  await expect(page.getByTestId('hcm-home-overview')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: new RegExp(HR_HOME_FIXTURE.employee.displayName, 'u') })
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'HR work that needs attention' })).toBeVisible();
  await expect(page.locator('[data-workspace-widget="people-signals"]')).toBeVisible();
  await expect(page.locator('[data-workspace-widget="quick-actions"]')).toBeVisible();
  await expect(page.locator('[data-workspace-widget="profile"]')).toBeVisible();
  await expect(page.locator('[data-workspace-widget="team"]')).toHaveCount(0);
  await expect(page.getByTestId('hris-product-map')).toHaveCount(0);
  await captureEvidence(page, testInfo.project.name, 'hris-home');

  const accessibility = await new AxeBuilder({ page }).include('[data-dwp-page-canvas]').analyze();
  expect(accessibility.violations).toEqual([]);
  await expectNoDocumentOverflow(page);
});

test('HR administrator receives the same widget home contract without the legacy product map', async ({
  page,
}, testInfo) => {
  await mockHrisOperator(page);
  await page.goto('/hr/home');

  await expect(page.getByTestId('hcm-home-overview')).toBeVisible();
  await expect(page.locator('[data-workspace-widget="people-signals"]')).toBeVisible();
  await expect(page.locator('[data-workspace-widget="quick-actions"]')).toBeVisible();
  await expect(page.locator('[data-workspace-widget="profile"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'My team', exact: true })).toBeVisible();
  await expect(page.getByTestId('hris-product-map')).toHaveCount(0);
  await captureEvidence(page, testInfo.project.name, 'hris-administrator-home');
  await expectNoDocumentOverflow(page);
});

test('HRIS home fails explicitly when the aggregate is unavailable instead of falling back to a menu catalog', async ({
  page,
}) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    displayName: 'HRIS Employee',
    jobTitle: 'Product designer',
  });
  await page.route('**/api/people/v1/hr/home', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ERROR', message: 'Overview temporarily unavailable' }),
    })
  );

  await page.goto('/hr/home');

  await expect(
    page.getByRole('heading', { level: 2, name: 'Information could not be loaded' })
  ).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('The home aggregate could not be loaded');
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
  await expect(page.getByTestId('hcm-home-overview')).toHaveCount(0);
  await expect(page.getByTestId('hris-product-map')).toHaveCount(0);
  await expectNoDocumentOverflow(page);
});

test('Work Explorer opens from its exact-authorized Home action and reconciles a recent destination', async ({
  page,
}, testInfo) => {
  const authority = await mockWorkExplorerAuthority(page, 'en');
  const api = await mockWorkExplorerApi(page, 'fresh');
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/hr/home');

  await expect(page.getByTestId('hcm-home-overview')).toBeVisible();
  const explorerAction = page.getByRole('button', { name: 'Explore HR work', exact: true });
  await expect(explorerAction).toBeVisible();
  await expect(page.getByRole('group', { name: 'HRIS home scope' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Customize HRIS home widgets' })).toBeVisible();
  await expectNoDocumentOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('work-explorer-home-320x640-three-actions.png'),
    fullPage: true,
  });
  await explorerAction.click();
  await expect(page).toHaveURL((url) => {
    return (
      url.pathname === '/hr/explore' &&
      url.searchParams.getAll('scope').join() === 'scope:hcm:utility'
    );
  });
  const explorer = page.getByTestId('hris-work-explorer');
  await expect(explorer).toHaveAttribute('data-projection-state', 'FRESH');
  await page.screenshot({
    path: testInfo.outputPath('work-explorer-fresh-home-success.png'),
    fullPage: true,
  });

  await page.getByRole('button', { name: 'Add Compensation planning to favorites' }).click();
  await expect(
    page.getByRole('button', { name: 'Remove Compensation planning from favorites' })
  ).toBeVisible();
  expect(api.favoriteRouteKeys).toContain('hris.explorer.hcm-operations-compensation-planning');

  api.recent = 'result-unknown';
  await page.getByRole('button', { name: 'Open Employment & documents' }).click();
  await expect(page.getByText('The command result is unknown')).toBeVisible();
  await expect(page).toHaveURL((url) => url.pathname === '/hr/explore');
  expect(api.recentRouteKeys).toEqual(['hris.explorer.my-employment-documents']);
  expect(api.recentHeaders).toHaveLength(1);
  expect(api.recentHeaders[0]).toMatchObject({
    'x-dwp-expected-decision-revision': 'e2e-work-explorer-authority-1',
  });
  expect(api.recentHeaders[0]?.['idempotency-key']).toBeTruthy();
  await page.screenshot({
    path: testInfo.outputPath('work-explorer-home-recent-result-unknown.png'),
    fullPage: true,
  });

  api.receiptIdentity = 'wrong-context';
  await page.getByRole('button', { name: 'Reconcile receipt' }).click();
  await expect(page.getByText('The receipt could not be reconciled yet.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reconcile receipt' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Employment & documents' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Resume Approval case' })).toBeDisabled();
  await expect(page).toHaveURL((url) => url.pathname === '/hr/explore');

  api.receiptIdentity = 'exact';
  await page.getByRole('button', { name: 'Reconcile receipt' }).click();
  await expect(page).toHaveURL((url) => {
    return url.pathname === '/hr/me/employment-documents' && url.search === '';
  });

  api.recent = 'accepted';
  await page.goto('/hr/explore?scope=scope%3Ahcm%3Autility');
  await expect(page.getByTestId('hris-work-explorer')).toBeVisible();
  await page.getByRole('button', { name: 'Open Compensation planning' }).click();
  await expect(page.getByText('The change is still processing')).toBeVisible();
  await expect(page).toHaveURL((url) => url.pathname === '/hr/explore');
  await page.getByRole('button', { name: 'Reconcile receipt' }).click();
  await expect(page).toHaveURL((url) => {
    return url.pathname === '/hr/operations/performance/compensation-planning';
  });

  api.recent = 'succeeded';
  await page.goto('/hr/explore?scope=scope%3Ahcm%3Autility');
  await expect(page.getByTestId('hris-work-explorer')).toBeVisible();
  api.receiptProfile = 'platform';
  api.receiptProfilesServed.length = 0;
  api.receiptRead = 'result-unknown-once';
  await page.reload();
  await page.getByRole('button', { name: 'Resume Command receipt' }).click();
  await expect(page.getByText('The command result is unknown')).toBeVisible();
  await expect(page).toHaveURL((url) => url.pathname === '/hr/explore');
  await page.screenshot({
    path: testInfo.outputPath('work-explorer-reloaded-command-receipt-result-unknown.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Reconcile receipt' }).click();
  await expect(page).toHaveURL((url) => url.pathname === '/hr/team/time');
  expect(api.receiptProfilesServed).toEqual(['platform', 'platform']);

  await page.goto('/hr/explore?scope=scope%3Ahcm%3Autility');
  await expect(page.getByTestId('hris-work-explorer')).toBeVisible();
  await page.getByRole('button', { name: 'Resume Approval case' }).click();
  await expect(page).toHaveURL((url) => {
    return url.pathname === '/hr/operations/people/employee-change-requests';
  });

  const projectionRequestCount = api.requests.length;
  for (const shellDuty of ['absent', 'wrong'] as const) {
    authority.shellDuty = shellDuty;
    await page.goto('/hr/home');
    await expect(page.getByRole('button', { name: 'Explore HR work', exact: true })).toHaveCount(0);
    await page.goto('/hr/explore?scope=scope%3Ahcm%3Autility');
    await expect(page.getByTestId('hris-work-explorer')).toHaveCount(0);
    await expect.poll(() => authority.rejectedShellDuties.includes(shellDuty)).toBe(true);
    expect(api.requests).toHaveLength(projectionRequestCount);
  }
});

test('Work Explorer keeps authorized discovery, URL state, and governed command recovery explicit', async ({
  page,
}, testInfo) => {
  await mockWorkExplorerAuthority(page, 'en');
  const api = await mockWorkExplorerApi(page, 'loading');
  await page.goto('/hr/explore?scope=scope%3Ahcm%3Autility');

  const explorer = page.getByTestId('hris-work-explorer');
  await expect(explorer.getByLabel('Loading HRIS Work Explorer')).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('work-explorer-loading.png'),
    fullPage: true,
  });
  expect(api.releaseLoading).toBeDefined();
  api.releaseLoading?.();

  await expect(page.getByRole('heading', { level: 1, name: 'Work Explorer' })).toBeVisible();
  await expect(explorer).toHaveAttribute('data-projection-state', 'PARTIAL');
  await expect(page.getByText('Some work sources are unavailable')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Favorites' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recent work' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'In progress' })).toBeVisible();
  await expect(page.getByTestId('hcm-home-overview')).toHaveCount(0);
  await expect(page.getByTestId('hris-product-map')).toHaveCount(0);

  const projectionRequest = api.requests[0];
  expect(projectionRequest).toBeDefined();
  expect(projectionRequest!.searchParams.get('asOf')).toBeTruthy();
  expect(projectionRequest!.searchParams.getAll('freshness')).toEqual(['ALLOW_STALE']);
  expect(projectionRequest!.searchParams.getAll('limit')).toEqual(['100']);
  expect(projectionRequest!.searchParams.getAll('contextScopeKey')).toEqual(['scope:hcm:utility']);
  expect(projectionRequest!.searchParams.has('filter')).toBe(false);
  const firstAsOf = projectionRequest!.searchParams.get('asOf');
  const requestCountBeforeRefresh = api.requests.length;
  await page.waitForTimeout(2);
  await explorer.getByRole('button', { name: 'Retry', exact: true }).first().click();
  await expect.poll(() => api.requests.length).toBeGreaterThan(requestCountBeforeRefresh);
  const refreshedAsOf = api.requests.at(-1)?.searchParams.get('asOf');
  expect(refreshedAsOf).toBeTruthy();
  expect(Date.parse(refreshedAsOf!)).toBeGreaterThan(Date.parse(firstAsOf!));

  const search = page.getByRole('textbox', { name: 'Search authorized HRIS work' });
  await search.focus();
  await expect(search).toBeFocused();
  await search.pressSequentially('Multi-rater & surveys');
  await expect(page).toHaveURL((url) => {
    return (
      url.searchParams.get('q') === 'Multi-rater & surveys' &&
      url.searchParams.getAll('scope').join() === 'scope:hcm:utility'
    );
  });
  await expect(
    page.getByRole('heading', { level: 3, name: 'Multi-rater & surveys' })
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('work-explorer-long-english-keyboard-focus.png'),
    fullPage: true,
  });

  await search.press('Control+A');
  await search.fill('No such authorized destination');
  await expect(page.getByText('No authorized work matches')).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('work-explorer-search-empty.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.getByText('No authorized work matches')).toHaveCount(0);

  await page.goto(
    '/hr/explore?scope=scope%3Ahcm%3Autility&q=Compensation&module=PER&workbench=PERFORMANCE&selected=hris.explorer.hcm-operations-compensation-planning'
  );
  await expect(page.getByRole('textbox', { name: 'Search authorized HRIS work' })).toHaveValue(
    'Compensation'
  );
  await expect(page.getByRole('combobox', { name: 'Module' })).toContainText('Performance');
  await expect(page.getByRole('combobox', { name: 'Workbench' })).toContainText('Performance');
  await expect(
    page.locator(
      '[data-route-key="hris.explorer.hcm-operations-compensation-planning"][data-selected="true"]'
    )
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('work-explorer-url-state-restored.png'),
    fullPage: true,
  });
  await page.goto('/hr/explore?scope=scope%3Ahcm%3Autility');
  await expect(
    page.getByRole('heading', { level: 3, name: 'Compensation planning' })
  ).toBeVisible();

  api.preference = 'accepted';
  await page.getByRole('button', { name: 'Add Multi-rater & surveys to favorites' }).click();
  await expect(page.getByText('The change is still processing')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Add Multi-rater & surveys to favorites' })
  ).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Open Employment & documents' })).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Employment & documents', exact: true })
  ).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Resume Approval case' })).toBeDisabled();
  await page.getByRole('button', { name: 'Reconcile receipt' }).click();
  await expect(
    page.getByRole('button', { name: 'Remove Multi-rater & surveys from favorites' })
  ).toBeVisible();

  api.preference = 'transport-error-once';
  const commandCountBeforeTransportReplay = api.commandHeaders.length;
  const replayFavorite = page.getByRole('button', {
    name: 'Add Employee change requests to favorites',
  });
  await replayFavorite.evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  await expect(page.getByText('Nothing was assumed. Retry after refreshing')).toBeVisible();
  expect(api.commandHeaders).toHaveLength(commandCountBeforeTransportReplay + 1);
  const replayIdempotencyKey = api.commandHeaders.at(-1)?.['idempotency-key'];
  expect(replayIdempotencyKey).toBeTruthy();
  await expect(page.getByRole('button', { name: 'Open Employment & documents' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Resume Approval case' })).toBeDisabled();
  await page.getByRole('button', { name: 'Retry', exact: true }).last().click();
  await expect(
    page.getByRole('button', { name: 'Remove Employee change requests from favorites' })
  ).toBeVisible();
  expect(api.commandHeaders).toHaveLength(commandCountBeforeTransportReplay + 2);
  expect(api.commandHeaders.at(-1)?.['idempotency-key']).toBe(replayIdempotencyKey);

  api.preference = 'conflict';
  const commandCountBeforeConflict = api.commandHeaders.length;
  await page.getByRole('button', { name: 'Add Compensation planning to favorites' }).click();
  await expect(page.getByText('Favorites changed elsewhere')).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('work-explorer-preference-conflict.png'),
    fullPage: true,
  });
  expect(api.commandHeaders).toHaveLength(commandCountBeforeConflict + 1);
  expect(api.commandHeaders.at(-1)).toMatchObject({
    'if-match': '"pref-3"',
    'x-dwp-expected-decision-revision': 'e2e-work-explorer-authority-1',
  });
  expect(api.commandHeaders.at(-1)?.['idempotency-key']).toBeTruthy();

  api.preference = 'result-unknown';
  await page.getByRole('button', { name: 'Reload favorites' }).click();
  await expect(page.getByText('Favorites changed elsewhere')).toHaveCount(0);
  await page.getByRole('button', { name: 'Add Compensation planning to favorites' }).click();
  await expect(page.getByText('The command result is unknown')).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('work-explorer-result-unknown.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Reconcile receipt' }).click();
  await expect(page.getByText('The command result is unknown')).toHaveCount(0);

  api.mode = 'error';
  await explorer.getByRole('button', { name: 'Retry', exact: true }).first().click();
  await expect(explorer).toHaveAttribute('data-refresh-state', 'FAILED_RETAINED');
  await expect(explorer).toHaveAttribute('data-projection-state', 'PARTIAL');
  await expect(page.getByText('Showing an older verified projection')).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: 'Team time' })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('work-explorer-stale-client-refresh-error.png'),
    fullPage: true,
  });

  api.mode = 'empty';
  await explorer.getByRole('button', { name: 'Retry', exact: true }).first().click();
  await expect(page.getByText('No HRIS work is currently authorized')).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('work-explorer-authorized-empty.png'),
    fullPage: true,
  });

  api.mode = 'forbidden';
  await explorer.getByRole('button', { name: 'Retry', exact: true }).first().click();
  await expect(page.getByText('Work Explorer is unavailable')).toBeVisible();
  await expect(page.getByRole('heading', { level: 3 })).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath('work-explorer-denied.png'),
    fullPage: true,
  });

  api.mode = 'error';
  await page.reload();
  await expect(page.getByText('Work Explorer could not be loaded')).toBeVisible();
  await expect(page.getByRole('heading', { level: 3 })).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath('work-explorer-initial-retryable-error.png'),
    fullPage: true,
  });

  api.mode = 'partial';
  await explorer.getByRole('button', { name: 'Retry', exact: true }).first().click();
  await expect(explorer).toHaveAttribute('data-projection-state', 'PARTIAL');
  await expect(page.getByText('Some work sources are unavailable')).toBeVisible();
  await expectNoDocumentOverflow(page);
  const accessibility = await new AxeBuilder({ page })
    .include('[data-testid="hris-work-explorer"]')
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath('work-explorer-partial-recovered.png'),
    fullPage: true,
  });

  await page.setViewportSize({ width: 320, height: 640 });
  await search.fill('Employee change requests');
  const longEnglishCard = page.locator(
    '[data-route-key="hris.explorer.hr-employee-change-requests"]'
  );
  await expect(
    longEnglishCard.getByRole('heading', { name: 'Employee change requests' })
  ).toBeVisible();
  const longEnglishFavorite = longEnglishCard.getByRole('button', {
    name: 'Remove Employee change requests from favorites',
  });
  const longEnglishOpen = longEnglishCard.getByRole('button', {
    name: 'Open Employee change requests',
  });
  await longEnglishFavorite.focus();
  await page.keyboard.press('Tab');
  await expect(longEnglishOpen).toBeFocused();
  expect(await longEnglishOpen.evaluate((button) => button.matches(':focus-visible'))).toBe(true);
  await expectNoDocumentOverflow(page);
  const longEnglishBounds = await longEnglishCard.boundingBox();
  expect(longEnglishBounds).not.toBeNull();
  expect(longEnglishBounds!.x + longEnglishBounds!.width).toBeLessThanOrEqual(321);
  await page.screenshot({
    path: testInfo.outputPath('work-explorer-320x640-longest-authorized-english-focus.png'),
    fullPage: true,
  });
  api.recent = 'result-unknown';
  await page.keyboard.press('Enter');
  await expect(page.getByText('The command result is unknown')).toBeVisible();
});

test('Work Explorer visual matrix covers responsive themes, contrast, motion, and Korean labels', async ({
  page,
}, testInfo) => {
  await mockWorkExplorerAuthority(page, 'ko');
  await mockWorkExplorerApi(page, 'partial');
  await page.goto('/hr/explore?scope=scope%3Ahcm%3Autility');

  const explorer = page.getByTestId('hris-work-explorer');
  await expect(page.getByRole('heading', { level: 1, name: '업무 탐색기' })).toBeVisible();
  const scenarios = [
    {
      name: '1440x900-light',
      width: 1440,
      height: 900,
      colorScheme: 'light' as const,
      forcedColors: 'none' as const,
      reducedMotion: 'no-preference' as const,
    },
    {
      name: '1280x800-dark',
      width: 1280,
      height: 800,
      colorScheme: 'dark' as const,
      forcedColors: 'none' as const,
      reducedMotion: 'no-preference' as const,
    },
    {
      name: '390x844-forced-colors',
      width: 390,
      height: 844,
      colorScheme: 'light' as const,
      forcedColors: 'active' as const,
      reducedMotion: 'no-preference' as const,
    },
    {
      name: '320x640-reduced-motion',
      width: 320,
      height: 640,
      colorScheme: 'light' as const,
      forcedColors: 'none' as const,
      reducedMotion: 'reduce' as const,
    },
  ];

  for (const scenario of scenarios) {
    await page.setViewportSize({ width: scenario.width, height: scenario.height });
    await page.emulateMedia({
      colorScheme: scenario.colorScheme,
      forcedColors: scenario.forcedColors,
      reducedMotion: scenario.reducedMotion,
    });
    await expect(explorer).toBeVisible();
    await expect(page.getByText('일부 업무 소스를 사용할 수 없습니다')).toBeVisible();
    await expectNoDocumentOverflow(page);
    await page.screenshot({
      path: testInfo.outputPath(`work-explorer-${scenario.name}.png`),
      fullPage: true,
    });
  }

  await page.emulateMedia({
    colorScheme: 'light',
    forcedColors: 'none',
    reducedMotion: 'reduce',
  });
  const search = page.getByRole('textbox', { name: '허용된 HRIS 업무 검색' });
  await search.focus();
  await expect(search).toBeFocused();
  await search.fill('Governance · HRIS 감사');
  const longKoreanCard = page.locator('[data-route-key="hris.explorer.dwp-governance"]');
  await expect(
    longKoreanCard.getByRole('heading', { name: 'Governance · HRIS 감사' })
  ).toBeVisible();
  await expect(page).toHaveURL((url) => url.searchParams.get('q') === 'Governance · HRIS 감사');
  await longKoreanCard
    .getByRole('button', { name: 'Governance · HRIS 감사 즐겨찾기에 추가' })
    .focus();
  await page.keyboard.press('Tab');
  const longKoreanOpen = longKoreanCard.getByRole('button', {
    name: 'Governance · HRIS 감사 열기',
  });
  await expect(longKoreanOpen).toBeFocused();
  expect(await longKoreanOpen.evaluate((button) => button.matches(':focus-visible'))).toBe(true);
  await expectNoDocumentOverflow(page);
  const longKoreanBounds = await longKoreanCard.boundingBox();
  expect(longKoreanBounds).not.toBeNull();
  expect(longKoreanBounds!.x + longKoreanBounds!.width).toBeLessThanOrEqual(321);
  await page.screenshot({
    path: testInfo.outputPath('work-explorer-320x640-longest-authorized-korean-label.png'),
    fullPage: true,
  });
});

test('Work Explorer remains usable at native browser 200 percent zoom', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.close();
  const extension = await createWorkExplorerZoomExtension(
    testInfo.outputPath('work-explorer-native-zoom-extension')
  );
  const {
    context,
    page: zoomPage,
    setZoom,
    setPhysicalViewport,
    captureViewport,
  } = await createBrowserZoomSession(
    extension,
    testInfo.project.use.baseURL ?? 'http://localhost:4200'
  );
  try {
    await setPhysicalViewport(1280, 800);
    await zoomPage.emulateMedia({
      colorScheme: 'light',
      forcedColors: 'none',
      reducedMotion: 'reduce',
    });
    await mockWorkExplorerAuthority(zoomPage, 'ko');
    await mockWorkExplorerApi(zoomPage, 'partial');
    await zoomPage.goto('/hr/explore?scope=scope%3Ahcm%3Autility');
    await expect(zoomPage.getByRole('heading', { level: 1, name: '업무 탐색기' })).toBeVisible();

    const reportedZoom = await setZoom(2);
    expect(reportedZoom).toBe(2);
    await expect.poll(() => zoomPage.evaluate(() => window.innerWidth)).toBe(640);
    const metrics = await zoomPage.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
      devicePixelRatio,
      cssZoom: getComputedStyle(document.documentElement).zoom,
      rootFontSize: getComputedStyle(document.documentElement).fontSize,
    }));
    expect(metrics).toMatchObject({
      width: 640,
      devicePixelRatio: 2,
      cssZoom: '1',
      rootFontSize: '16px',
    });
    await testInfo.attach('work-explorer-browser-zoom-metrics', {
      contentType: 'application/json',
      body: JSON.stringify({ reportedZoom, physicalViewport: '1280x800', ...metrics }),
    });

    const search = zoomPage.getByRole('textbox', { name: '허용된 HRIS 업무 검색' });
    await search.focus();
    await expect(search).toBeFocused();
    await expectNoDocumentOverflow(zoomPage);
    const accessibility = await new AxeBuilder({ page: zoomPage })
      .include('[data-testid="hris-work-explorer"]')
      .analyze();
    expect(accessibility.violations).toEqual([]);
    await captureViewport(testInfo.outputPath('work-explorer-1280x800-browser-zoom200.png'));
  } finally {
    await context.close();
  }
});

for (const anchor of DATA_ANCHORS) {
  test(`${anchor.module} data anchor opens directly with its governed scope`, async ({
    page,
  }, testInfo) => {
    await mockGovernedHrisOperator(page);
    if (anchor.module === 'TIM') {
      await page.route('**/api/people/v1/hr/time**', (route) =>
        fulfillSuccess(route, HRIS_TIME_ANCHOR_FIXTURE)
      );
    }
    const dataRequest = page.waitForRequest(
      (request) => new URL(request.url()).pathname === anchor.apiPath
    );

    await page.goto(anchor.path);

    const requestUrl = new URL((await dataRequest).url());
    expect(requestUrl.searchParams.getAll('contextScopeKey')).toEqual([anchor.contextScopeKey]);
    await expect(page).toHaveURL(new RegExp(`${anchor.path.replaceAll('/', '\\/')}(?:\\?|$)`, 'u'));
    await expect(page.getByRole('heading', { level: 1, name: anchor.heading })).toBeVisible();
    await expect(page.locator(anchor.marker)).toBeVisible();
    const markerText = fixtureMarker(anchor.module);
    if (markerText) await expect(page.getByText(markerText, { exact: true }).first()).toBeVisible();
    await captureEvidence(page, testInfo.project.name, `${anchor.module.toLowerCase()}-anchor`);
    await expectNoDocumentOverflow(page);
  });
}

test('People 360 search keeps the operations scope and opens detail from the keyboard', async ({
  page,
}, testInfo) => {
  await mockGovernedHrisOperator(page);
  const listRequests: URL[] = [];
  const detailRequests: URL[] = [];
  const peoplePath = '/api/people/v1/workforce/people';
  const detailPath = `${peoplePath}/${PEOPLE_IDENTITY.personId}`;
  await page.route('**/api/people/v1/workforce/people**', (route) => {
    const url = new URL(route.request().url());
    const asOf = url.searchParams.get('asOf') ?? '2026-09-10';
    if (url.pathname === detailPath) {
      detailRequests.push(url);
      return fulfillSuccess(route, people360Snapshot({ ...PEOPLE_IDENTITY, asOf }));
    }
    if (url.pathname !== peoplePath) return route.fallback();
    listRequests.push(url);
    const items = url.searchParams.get('query')
      ? [people360ListSnapshot({ ...PEOPLE_IDENTITY, asOf })]
      : [];
    return fulfillSuccess(route, people360Page(items, { asOf }));
  });

  await page.goto('/hr/operations/people');
  const search = page.getByTestId('hris-people360-search');
  await expect(search).toBeVisible();
  await search.fill('Phase One');
  await expect
    .poll(() =>
      listRequests.some(
        (url) =>
          url.searchParams.get('query') === 'Phase One' &&
          url.searchParams.get('contextScopeKey') === 'scope:hcm:operations'
      )
    )
    .toBe(true);

  await expect(page.getByText(PEOPLE_IDENTITY.displayName, { exact: true }).first()).toBeVisible();
  const detailAction = page.getByRole('button', { name: /Phase One Person/u }).last();
  await expect(detailAction).toBeVisible();
  await detailAction.focus();
  await expect(detailAction).toBeFocused();
  await detailAction.press('Enter');

  const inspector = page.getByRole('complementary', { name: PEOPLE_IDENTITY.displayName });
  await expect(inspector).toBeVisible();
  await expect(inspector.getByText('Synthetic People Operations', { exact: true })).toBeVisible();
  await expect
    .poll(() => new URL(page.url()).searchParams.get('person'))
    .toBe(PEOPLE_IDENTITY.personId);
  await expect.poll(() => detailRequests.length).toBe(1);
  expect(detailRequests[0]?.searchParams.getAll('contextScopeKey')).toEqual([
    'scope:hcm:operations',
  ]);
  await captureEvidence(page, testInfo.project.name, 'hrm-search-detail');
  await expectNoDocumentOverflow(page);
});
