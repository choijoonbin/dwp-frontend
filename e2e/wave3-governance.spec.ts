import { expect, test, type Page } from '@playwright/test';

import type { AppAccessRequest, NavigationNode } from '@dwp-frontend/shared-utils';

import { WORKSPACE_APPS_FIXTURE } from './support/runtime-access';
import {
  CATALOG_ASSURANCE_FIXTURE,
  CATALOG_ENTITIES_FIXTURE,
  CATALOG_RELATION_FIXTURE,
  FULL_PRODUCT_PERMISSIONS,
  NAVIGATION_REVISION_FIXTURE,
  NAVIGATION_VALIDATION_FIXTURE,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';

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

async function installWorkforceMember(page: Page) {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    userId: 1,
    locale: 'en',
    displayName: 'Minseo Kim',
    jobTitle: 'Network Operations Lead',
    email: 'minseo.kim@sk.com',
    appearance: {
      mode: 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
}

async function installKnowledgeAccessApprover(page: Page) {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    userId: 2,
    locale: 'en',
    displayName: 'Taehoon Kang',
    jobTitle: 'Application Access Approver',
    email: 'taehoon.kang@sk.com',
    resourceRoles: [
      {
        responsibilityCode: 'APP_ACCESS_APPROVER',
        resourceType: 'APP',
        resourceKey: 'APP.KNOWLEDGE',
        resourceSetId: 'resource-set-knowledge',
        resourceSetKey: 'APP.KNOWLEDGE',
      },
    ],
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
  await installWorkforceMember(page);
  let request: AppAccessRequest | null = null;
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

  const installAccessWorkflowRoutes = async (targetPage: Page) => {
    await targetPage.route('**/api/platform/v1/workspace/apps**', async (route) => {
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
          fulfillmentState: 'NOT_REQUIRED',
          fulfillmentAttempts: 0,
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
    await targetPage.route('**/api/platform/v1/admin/app-access-requests**', async (route) => {
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
          decidedBy: 2,
          fulfillmentState: 'PENDING',
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
    await targetPage.route('**/api/auth/admin/identity/users**', (route) =>
      fulfillSuccess(route, {
        content: [
          {
            userId: 1,
            displayName: 'Minseo Kim',
            email: 'minseo.kim@sk.com',
            status: 'ACTIVE',
            mfaEnabled: true,
            roles: ['WORKSPACE_MEMBER'],
            roleManagement: { allowed: true, reason: null },
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
  };

  await installAccessWorkflowRoutes(page);

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

  const approverPage = await page.context().newPage();
  await installKnowledgeAccessApprover(approverPage);
  await installAccessWorkflowRoutes(approverPage);
  await approverPage.goto('/admin/identity/app-access-requests');
  await expect(
    approverPage.getByRole('heading', { name: 'Knowledge workspace', level: 2 })
  ).toBeVisible();
  await approverPage.getByRole('button', { name: 'Approve', exact: true }).click();
  const decisionDialog = approverPage.getByRole('dialog', {
    name: 'Approve Knowledge workspace access?',
  });
  await decisionDialog
    .getByRole('textbox', { name: 'Decision rationale' })
    .fill('Approved for the current customer delivery assignment.');
  await decisionDialog.getByRole('button', { name: 'Approve', exact: true }).click();
  await approverPage.getByRole('button', { name: 'Approved', exact: true }).click();
  await expect(
    approverPage.getByText(
      'An application access manager must independently execute this approved decision.'
    )
  ).toBeVisible();
  await approverPage.close();

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
        compatibilityState: 'REVIEW_REQUIRED',
        ruleKey: 'DWP_CATALOG_IMPACT',
        ruleVersion: 1,
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
    if (path.endsWith('/assurance')) {
      return fulfillSuccess(route, CATALOG_ASSURANCE_FIXTURE);
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

test('catalog assurance restores deep links and records governed false-positive evidence', async ({
  page,
}) => {
  await installTenantAdmin(page);
  let finding = structuredClone(CATALOG_ASSURANCE_FIXTURE.findings[0]);

  await page.route('**/api/platform/v1/admin/catalog**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/platform/v1/admin/catalog/assurance') {
      return fulfillSuccess(route, {
        ...CATALOG_ASSURANCE_FIXTURE,
        openCount: ['OPEN', 'ACKNOWLEDGED'].includes(finding.lifecycleState) ? 1 : 0,
        findings: [finding],
      });
    }
    if (
      path.endsWith(`/assurance/findings/${finding.findingId}/disposition`) &&
      route.request().method() === 'POST'
    ) {
      const body = route.request().postDataJSON() as {
        decision: typeof finding.lifecycleState;
        reason: string;
        evidenceRef?: string;
        version: number;
      };
      finding = {
        ...finding,
        lifecycleState: body.decision,
        dispositionReason: body.reason,
        dispositionEvidenceRef: body.evidenceRef ?? null,
        disposedBy: 1,
        disposedAt: '2026-08-12T00:25:00Z',
        version: body.version + 1,
      };
      return fulfillSuccess(route, finding);
    }
    return route.fallback();
  });

  await page.goto(
    `/admin/platform/catalog?view=assurance&finding=${CATALOG_ASSURANCE_FIXTURE.findings[0].findingId}`
  );
  await expect(page.getByRole('tab', { name: 'Assurance' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await expect(page.getByText('DWP_CATALOG_IMPACT v1')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Accountable owner is missing' })).toBeVisible();
  await expect(page.getByText(`Evidence SHA-256: ${'a'.repeat(64)}`)).toBeVisible();

  await page.getByRole('button', { name: 'Record disposition' }).click();
  const dialog = page.getByRole('dialog', { name: 'Record finding disposition' });
  await dialog.getByRole('combobox', { name: /Decision/ }).click();
  await page.getByRole('option', { name: 'False positive' }).click();
  await dialog
    .getByRole('textbox', { name: 'Decision reason' })
    .fill('The application owner is synchronized from the approved service catalog source.');
  await dialog.getByRole('textbox', { name: 'Evidence reference' }).fill('CATALOG-CASE-203');
  await dialog.getByRole('button', { name: 'Record decision' }).click();

  await expect(page.getByText('Finding disposition recorded.')).toBeVisible();
  await expect(
    page.getByLabel('Finding evidence').getByText('False positive', { exact: true })
  ).toBeVisible();
  await expect(
    page.getByText(
      'Recorded disposition: The application owner is synchronized from the approved service catalog source.'
    )
  ).toBeVisible();
});
