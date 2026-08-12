import { expect, test, type Page } from '@playwright/test';

import type { NavigationNode } from '@dwp-frontend/shared-utils';

import { WORKSPACE_APPS_FIXTURE } from './support/runtime-access';
import {
  CATALOG_ENTITIES_FIXTURE,
  CATALOG_RELATION_FIXTURE,
  FULL_PRODUCT_PERMISSIONS,
  NAVIGATION_REVISION_FIXTURE,
  NAVIGATION_VALIDATION_FIXTURE,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';

type AccessRequest = {
  requestId: string;
  userId: number;
  appId: string;
  appName: string;
  resourceKey: string;
  requestedPermissionCode: 'VIEW';
  justification: string;
  state: 'PENDING' | 'APPROVED';
  requestedUntil: string | null;
  decisionNote: string | null;
  decidedAt: string | null;
  decidedBy: number | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

async function installTenantAdmin(page: Page) {
  await mockShellSession(page, ['ADMIN', 'HR_ADMIN'], {
    locale: 'en',
    displayName: 'Tenant Admin',
    jobTitle: 'Tenant administrator',
    permissions: FULL_PRODUCT_PERMISSIONS,
    appearance: {
      mode: 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
}

test('app access moves from employee request to governed approval and IAM synchronization', async ({
  page,
}) => {
  await installTenantAdmin(page);
  let request: AccessRequest | null = null;
  let app = {
    ...WORKSPACE_APPS_FIXTURE[1],
    id: 'knowledge-workspace',
    name: 'Knowledge workspace',
    description: 'Search governed policies and verified answers.',
    owner: 'Knowledge Office',
    category: 'KNOWLEDGE',
    launchMode: 'NATIVE',
    launchTarget: '/knowledge',
    iconKey: 'knowledge',
    resourceKey: 'APP.KNOWLEDGE',
    health: 'HEALTHY',
    accessState: 'REQUESTABLE',
  };

  await page.route('**/api/platform/v1/workspace/apps**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'GET' && path === '/api/platform/v1/workspace/apps') {
      return fulfillSuccess(route, [WORKSPACE_APPS_FIXTURE[0], app]);
    }
    if (path.endsWith('/knowledge-workspace/access-requests')) {
      const body = route.request().postDataJSON() as {
        justification: string;
        requestedUntil?: string;
      };
      request = {
        requestId: 'access-request-wave3',
        userId: 1,
        appId: app.id,
        appName: app.name,
        resourceKey: app.resourceKey,
        requestedPermissionCode: 'VIEW',
        justification: body.justification,
        state: 'PENDING',
        requestedUntil: body.requestedUntil ?? null,
        decisionNote: null,
        decidedAt: null,
        decidedBy: null,
        version: 0,
        createdAt: '2026-08-12T00:00:00Z',
        updatedAt: '2026-08-12T00:00:00Z',
      };
      app = {
        ...app,
        accessState: 'PENDING',
        accessRequestId: request.requestId,
        accessRequestState: request.state,
        accessRequestUpdatedAt: request.updatedAt,
        accessRequestVersion: request.version,
      };
      return fulfillSuccess(route, request);
    }
    return route.fallback();
  });
  await page.route('**/api/platform/v1/admin/app-access-requests**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'GET') {
      return fulfillSuccess(route, request ? [request] : []);
    }
    if (path.endsWith('/access-request-wave3/decision') && request) {
      const body = route.request().postDataJSON() as {
        decision: 'APPROVED';
        decisionNote: string;
      };
      request = {
        ...request,
        state: body.decision,
        decisionNote: body.decisionNote,
        decidedAt: '2026-08-12T00:05:00Z',
        decidedBy: 1,
        version: request.version + 1,
        updatedAt: '2026-08-12T00:05:00Z',
      };
      app = {
        ...app,
        accessState: 'APPROVED_PENDING_SYNC',
        accessRequestState: 'APPROVED',
        accessRequestUpdatedAt: request.updatedAt,
        accessRequestVersion: request.version,
      };
      return fulfillSuccess(route, request);
    }
    return route.fallback();
  });
  await page.route('**/api/auth/admin/identity/users**', (route) =>
    fulfillSuccess(route, {
      content: [
        {
          userId: 1,
          displayName: 'Tenant Admin',
          email: 'tenant.admin@dwp.local',
          status: 'ACTIVE',
          mfaEnabled: true,
          roles: ['ADMIN'],
          roleManagement: { allowed: false, reason: 'SELF' },
          accessRevision: 3,
          version: 2,
        },
      ],
      page: 0,
      size: 100,
      totalElements: 1,
      totalPages: 1,
    })
  );

  await page.goto('/apps');
  await page.getByText('Knowledge workspace', { exact: true }).click();
  const requestDialog = page.getByRole('dialog', {
    name: 'Request access to Knowledge workspace',
  });
  await requestDialog
    .getByRole('textbox', { name: 'Business justification' })
    .fill('Required for the customer policy review and response workflow.');
  await requestDialog.getByRole('button', { name: 'Submit request' }).click();
  await expect(page.getByText('Review pending', { exact: true })).toBeVisible();

  await page.goto('/admin/identity/app-access-requests');
  await expect(page.getByRole('heading', { name: 'Knowledge workspace', level: 2 })).toBeVisible();
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  const decisionDialog = page.getByRole('dialog', {
    name: 'Approve Knowledge workspace access?',
  });
  await decisionDialog
    .getByRole('textbox', { name: 'Decision rationale' })
    .fill('Approved for the current customer delivery assignment.');
  await decisionDialog.getByRole('button', { name: 'Approve', exact: true }).click();
  await page.getByRole('button', { name: 'Approved', exact: true }).click();
  await expect(page.getByText('IAM entitlement synchronization required')).toBeVisible();

  await page.goto('/apps');
  await expect(page.getByText('Approved · syncing', { exact: true })).toBeVisible();
});

test('navigation studio creates, validates, and publishes an immutable revision', async ({
  page,
}) => {
  await installTenantAdmin(page);
  const publishedV1 = structuredClone(NAVIGATION_REVISION_FIXTURE);
  let published = publishedV1;
  let draft: typeof publishedV1 | null = null;

  await page.route('**/api/platform/v1/admin/navigation/studio**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (method === 'GET' && path === '/api/platform/v1/admin/navigation/studio') {
      return fulfillSuccess(route, {
        published,
        draft,
        history: draft ? [draft, published] : [published, publishedV1],
        currentTree: published.tree,
        currentValidation: NAVIGATION_VALIDATION_FIXTURE,
      });
    }
    if (method === 'POST' && path.endsWith('/drafts')) {
      draft = {
        ...structuredClone(published),
        navigationRevisionId: '61000000-0000-0000-0000-000000000002',
        revisionNumber: 2,
        lifecycleState: 'DRAFT',
        baselineRevisionId: published.navigationRevisionId,
        changeSummary: '',
        version: 0,
        publishedAt: null,
        publishedBy: null,
      };
      return fulfillSuccess(route, draft);
    }
    if (method === 'PUT' && draft && path.endsWith(draft.navigationRevisionId)) {
      const body = route.request().postDataJSON() as {
        tree: NavigationNode[];
        changeSummary?: string;
      };
      draft = {
        ...draft,
        tree: body.tree,
        changeSummary: body.changeSummary,
        validation: NAVIGATION_VALIDATION_FIXTURE,
        diff: { added: 0, removed: 0, changed: 1, reordered: 0, lifecycleChanged: 0 },
        version: draft.version + 1,
        updatedAt: '2026-08-12T00:10:00Z',
      };
      return fulfillSuccess(route, draft);
    }
    if (method === 'POST' && draft && path.endsWith(`${draft.navigationRevisionId}/publish`)) {
      published = {
        ...draft,
        lifecycleState: 'PUBLISHED',
        version: draft.version + 1,
        publishedAt: '2026-08-12T00:11:00Z',
        publishedBy: 1,
      };
      draft = null;
      return fulfillSuccess(route, published);
    }
    return route.fallback();
  });

  await page.goto('/admin/platform/navigation');
  await page.getByRole('button', { name: 'Create draft' }).click();
  await expect(page.getByText('Revision 2 draft')).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Change summary' })
    .fill('Expose the governed customer workspace navigation.');
  await page.getByRole('button', { name: 'Publish revision' }).click();
  const publishDialog = page.getByRole('dialog', {
    name: 'Publish this navigation revision?',
  });
  await publishDialog.getByRole('button', { name: 'Publish revision' }).click();
  await expect(page.getByText('Revision 2 published')).toBeVisible();
  await expect(
    page.getByText('No blocking issues were found. This revision is ready to publish.')
  ).toBeVisible();
});

test('catalog graph exposes change impact and records an explicit relationship', async ({
  page,
}) => {
  await installTenantAdmin(page);
  const entities = structuredClone(CATALOG_ENTITIES_FIXTURE);
  const discovered = structuredClone(CATALOG_RELATION_FIXTURE);
  let declared: typeof discovered | null = null;

  await page.route('**/api/platform/v1/admin/catalog**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.endsWith('/graph')) {
      return fulfillSuccess(route, {
        focusRef: url.searchParams.get('focusRef'),
        nodes: entities.map((entity) => ({
          entity,
          incomingCount: entity.kind === 'APP' ? 1 : 0,
          outgoingCount: entity.kind === 'SERVICE' ? 1 : 0,
          orphan: false,
        })),
        relations: declared ? [discovered, declared] : [discovered],
        truncated: false,
        generatedAt: '2026-08-12T00:20:00Z',
      });
    }
    if (path.endsWith('/impact')) {
      return fulfillSuccess(route, {
        target: entities[1],
        operation: url.searchParams.get('operation') ?? 'CHANGE',
        riskScore: 62,
        blocked: false,
        directDependentCount: 1,
        transitiveDependentCount: 1,
        impactedEntities: [
          {
            entity: entities[0],
            distance: 1,
            relationTypes: ['PRODUCES'],
            highestCriticality: 'OPERATIONAL',
          },
        ],
        findings: [],
        generatedAt: '2026-08-12T00:20:00Z',
      });
    }
    if (path.endsWith('/relations') && route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as {
        sourceRef: string;
        targetRef: string;
        relationType: 'DEPENDS_ON';
        criticality: 'OPERATIONAL';
        evidenceRef?: string;
      };
      declared = {
        relationId: 'catalog-relation-wave3',
        ...body,
        relationOrigin: 'DECLARED',
        metadata: {},
        lifecycleState: 'ACTIVE',
        version: 0,
      };
      return fulfillSuccess(route, declared);
    }
    if (path === '/api/platform/v1/admin/catalog') {
      return fulfillSuccess(route, {
        entityCount: entities.length,
        relationCount: declared ? 2 : 1,
        declaredRelationCount: declared ? 1 : 0,
        orphanCount: 0,
        criticalRelationCount: 0,
        entitiesByKind: { APP: 1, SERVICE: 1 },
        entitiesByLifecycle: { ACTIVE: 2 },
        entities,
        generatedAt: '2026-08-12T00:20:00Z',
      });
    }
    return route.fallback();
  });

  await page.goto('/admin/platform/catalog');
  const graph = page.locator('.react-flow');
  await graph.scrollIntoViewIfNeeded();
  await expect(graph.locator('.react-flow__node')).toHaveCount(2);
  await graph.getByText('DWP Platform Service', { exact: true }).click();
  await expect(page.getByText('Change impact', { exact: true })).toBeVisible();
  await expect(page.getByText('62', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Declare relationship' }).click();
  const dialog = page.getByRole('dialog', { name: 'Declare catalog relationship' });
  await dialog
    .getByRole('textbox', { name: 'Evidence reference' })
    .fill('ADR-042 customer workspace dependency');
  await dialog.getByRole('button', { name: 'Save relationship' }).click();
  await expect(page.getByText('Catalog relationship saved.')).toBeVisible();
  await expect(page.getByText('Depends on', { exact: true })).toBeVisible();
});
