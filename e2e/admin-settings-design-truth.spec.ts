import { mkdir } from 'node:fs/promises';

import { expect, test, type Page, type Route } from '@playwright/test';

import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

const EVIDENCE_DIRECTORY =
  '/Users/a10697/Work/DWP/output/admin-settings-truth-audit-2026-09-17/screenshots';

const viewports = [
  { name: '1440', width: 1440, height: 900 },
  { name: '390', width: 390, height: 844 },
] as const;

test.setTimeout(90_000);

function success(route: Route, data: unknown) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data }),
  });
}

const appGovernance = {
  metrics: {
    activeAssignments: 1,
    pendingApprovals: 1,
    reviewsDueSoon: 1,
    resourcesWithoutOwner: 0,
  },
  responsibilities: [
    {
      code: 'APP_ACCESS_MANAGER',
      displayName: 'App access fulfiller',
      description: 'Activates approved app administration packages.',
      riskTier: 'L2',
      sortOrder: 1,
    },
  ],
  principals: [{ type: 'USER', ref: '40', displayName: 'Mail target administrator' }],
  resourceSets: [
    {
      resourceSetId: 'rs-mail',
      key: 'RS_MAIL',
      name: 'Mail administration',
      description: 'Tenant Mail administration boundary',
      lifecycleState: 'ACTIVE',
      version: 3,
      resources: [{ resourceType: 'APP', resourceKey: 'APP.MAIL', resourceName: 'Mail' }],
    },
  ],
  assignments: [
    {
      assignmentId: 'assignment-mail-owner',
      principalType: 'USER',
      principalRef: '20',
      principalName: 'Mail owner',
      responsibilityCode: 'APP_OWNER',
      resourceSetId: 'rs-mail',
      resourceSetKey: 'RS_MAIL',
      resourceSetName: 'Mail administration',
      assignmentSource: 'GOVERNED_DIRECT',
      lifecycleState: 'ACTIVE',
      validFrom: '2026-09-01T00:00:00Z',
      validTo: null,
      reviewDueAt: '2026-12-01T00:00:00Z',
      justification: 'Named owner for the Mail tenant boundary.',
      requestedBy: 10,
      requestedByName: 'Access requester',
      approvedBy: 20,
      approvedByName: 'Access approver',
      approvedAt: '2026-09-01T01:00:00Z',
      decisionReason: 'Ownership evidence verified.',
      firstApproverBootstrapEligible: false,
      version: 1,
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T01:00:00Z',
    },
  ],
  presetCatalog: [
    {
      presetCode: 'MAIL_ADMIN',
      productKey: 'mail',
      appResourceKey: 'APP.MAIL',
      displayName: 'Mail administrator',
      description: 'Minimum Mail administration package.',
      responsibilityCode: 'APP_ACCESS_MANAGER',
      riskTier: 'HIGH',
      catalogVersion: 4,
      requestable: true,
      duties: [
        {
          dutyCode: 'MAIL_POLICY_ADMIN',
          resourceKey: 'APP.MAIL',
          riskTier: 'HIGH',
          auditPolicyException: false,
          capabilityContractKeys: ['mail.admin.policy.update'],
        },
      ],
    },
  ],
  presetAssignments: [
    {
      presetAssignmentId: 'preset-mail-1',
      presetCode: 'MAIL_ADMIN',
      productKey: 'mail',
      presetName: 'Mail administrator',
      principalType: 'USER',
      principalRef: '40',
      principalName: 'Mail target administrator',
      resourceSetId: 'rs-mail',
      resourceSetKey: 'RS_MAIL',
      resourceSetName: 'Mail administration',
      responsibilityAssignmentId: 'assignment-mail-owner',
      assignmentSource: 'GOVERNED_PRESET',
      requestChannel: 'GOVERNANCE',
      lifecycleState: 'APPROVED',
      validFrom: null,
      validTo: '2026-12-31T00:00:00Z',
      reviewDueAt: '2026-12-01T00:00:00Z',
      justification: 'Time-bound Mail policy administration coverage.',
      requestedBy: 10,
      requestedByName: 'Request owner',
      approvedBy: 20,
      approvedByName: 'Security approver',
      approvedAt: '2026-09-17T02:00:00Z',
      decisionReason: 'Scope and expiry verified.',
      activatedBy: null,
      activatedByName: null,
      activatedAt: null,
      activationReason: null,
      version: 2,
      catalogVersion: 4,
      createdAt: '2026-09-17T01:00:00Z',
      updatedAt: '2026-09-17T02:00:00Z',
      duties: [
        {
          assignmentId: 'duty-mail-1',
          dutyCode: 'MAIL_POLICY_ADMIN',
          lifecycleState: 'APPROVED',
          version: 1,
        },
      ],
    },
  ],
  presetReviews: [],
};

async function mockTruthAuditOwners(page: Page) {
  await mockShellSession(page, ['TENANT_ADMIN', 'APP_CATALOG_ADMIN'], {
    locale: 'en',
    permissions: [...FULL_PRODUCT_PERMISSIONS],
    resourceRoles: [
      {
        responsibilityCode: 'APP_ACCESS_MANAGER',
        resourceType: 'APP',
        resourceKey: 'APP.MAIL',
        resourceSetId: 'rs-mail',
        resourceSetKey: 'RS_MAIL',
      },
    ],
  });

  await page.route('**/api/auth/me/policy', (route) =>
    success(route, {
      tenantId: 1,
      defaultLoginType: 'SSO',
      allowedLoginTypes: ['SSO', 'LOCAL'],
      localLoginEnabled: true,
      ssoLoginEnabled: true,
      ssoProviderKey: 'okta-workforce',
      requireMfa: true,
    })
  );
  await page.route('**/api/auth/idp', (route) =>
    success(route, [
      {
        enabled: true,
        providerType: 'SAML',
        providerKey: 'okta-workforce',
      },
    ])
  );
  await page.route('**/api/auth/admin/provisioning/scim/connectors', (route) =>
    success(route, [
      {
        connectorId: 'scim-okta',
        connectorKey: 'okta-workforce',
        displayName: 'Okta Workforce',
        tokenPrefix: 'dwp_scim',
        allowedOperations: ['USERS', 'GROUPS'],
        purpose: 'Authoritative workforce lifecycle',
        ownerUserId: 1,
        lifecycleState: 'ACTIVE',
        credentialState: 'ACTIVE',
        credentialIssuedAt: '2026-09-01T00:00:00Z',
        credentialExpiresAt: '2026-12-01T00:00:00Z',
        lastUsedAt: '2026-09-17T00:30:00Z',
        health: 'READY',
        events24h: 31,
        failedEvents24h: 0,
        lastSuccessAt: '2026-09-17T00:30:00Z',
        version: 2,
      },
    ])
  );
  await page.route('**/api/auth/admin/access/app-governance', (route) =>
    success(route, appGovernance)
  );
  await page.route('**/api/platform/v1/admin/catalog', (route) =>
    success(route, {
      entityCount: 1,
      relationCount: 0,
      declaredRelationCount: 0,
      orphanCount: 1,
      criticalRelationCount: 0,
      entitiesByKind: { APP: 1 },
      entitiesByLifecycle: { ACTIVE: 1 },
      entities: [
        {
          ref: 'APP:MAIL',
          kind: 'APP',
          key: 'APP.MAIL',
          name: 'Mail',
          description: 'Tenant Mail application registry record.',
          ownerRef: 'TEAM:MESSAGING',
          lifecycleState: 'ACTIVE',
          riskTier: 'HIGH',
          scope: 'TENANT',
          revision: 7,
          metadata: { appResourceKey: 'APP.MAIL' },
        },
      ],
      generatedAt: '2026-09-17T00:00:00Z',
    })
  );
  await page.route('**/api/auth/product-surface-contexts', (route) =>
    success(route, {
      contractVersion: 'product-surfaces/v3',
      decisionRevision: 'truth-audit-mail-1',
      sourceRevisions: {
        auth: 'auth-mail-1',
        policy: 'policy-mail-1',
        productRelationship: 'relationship-mail-1',
      },
      activeAccessMode: 'NORMAL',
      generatedAt: '2026-09-17T00:00:00Z',
      contexts: [
        {
          contextKey: 'mail-work',
          productKey: 'mail',
          surfaceKey: 'mail.work',
          plane: 'work',
          accessMode: 'NORMAL',
          accessSource: 'ENTITLEMENT',
          appResourceKey: 'APP.MAIL',
          effectiveGrants: [],
          scopes: [
            {
              key: 'scope:mail:self',
              kind: 'SELF',
              displayName: 'My Mail',
              isDefault: true,
              readOnly: false,
              validUntil: null,
            },
          ],
          revalidateAt: '2026-09-18T00:00:00Z',
        },
        {
          contextKey: 'mail-management',
          productKey: 'mail',
          surfaceKey: 'mail.management',
          plane: 'management',
          accessMode: 'NORMAL',
          accessSource: 'MANAGEMENT',
          appResourceKey: 'APP.MAIL',
          effectiveGrants: [],
          scopes: [
            {
              key: 'scope:mail:admin',
              kind: 'RESOURCE_SET',
              displayName: 'Mail administration',
              isDefault: true,
              readOnly: false,
              validUntil: '2026-12-31T00:00:00Z',
            },
          ],
          revalidateAt: '2026-09-18T00:00:00Z',
        },
      ],
      rollouts: [
        {
          productKey: 'mail',
          state: '111',
          flags: { contextShadow: true, capabilityEnforcement: true, surfaceUi: true },
          cohort: 'truth-audit',
          opaqueRevision: 'mail-rollout-1',
          authorityStatus: 'AVAILABLE',
        },
      ],
    })
  );
  await page.route('**/api/platform/v1/admin/audit-control/policy/revisions', (route) =>
    success(route, [
      {
        revisionId: 'revision-2',
        revisionNumber: 2,
        lifecycleState: 'IN_REVIEW',
        standardRetentionDays: 540,
        extendedRetentionDays: 2555,
        exportLimitRows: 5000,
        requireExportReason: true,
        integrityEnabled: true,
        highRiskThreshold: 70,
        baselineRevisionId: 'revision-1',
        rollbackOfRevisionId: null,
        incidentCaseId: null,
        changeReason: 'Extend standard evidence retention after legal review.',
        diff: {
          standardRetentionDays: { before: 365, after: 540 },
          exportLimitRows: { before: 10000, after: 5000 },
        },
        contentSha256: 'b'.repeat(64),
        createdBy: 'tenant-admin',
        createdAt: '2026-09-17T01:00:00Z',
        submittedBy: 'tenant-admin',
        submittedAt: '2026-09-17T01:10:00Z',
        version: 2,
        approval: {
          approvalId: 'approval-revision-2',
          lifecycleState: 'PENDING',
          requestedBy: 'tenant-admin',
          requestedAt: '2026-09-17T01:10:00Z',
          expiresAt: '2026-09-18T01:10:00Z',
          decidedBy: null,
          decidedAt: null,
          decisionReason: null,
          version: 1,
        },
      },
    ])
  );
}

async function expectNoHorizontalOverflow(page: Page, context: string) {
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(
    geometry.scrollWidth,
    `${context}: document width ${geometry.scrollWidth}px exceeds ${geometry.clientWidth}px`
  ).toBeLessThanOrEqual(geometry.clientWidth + 1);
}

test.beforeAll(async () => {
  await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
});

for (const viewport of viewports) {
  test(`tenant settings truth evidence at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await mockTruthAuditOwners(page);

    await page.goto('/admin');
    await expect(page.getByTestId('tenant-settings-operational-overview')).toBeVisible();
    await expect(page.getByText('Tenant read contract unavailable')).toBeVisible();
    await expect(page.getByText('okta-workforce')).toBeVisible();
    await expectNoHorizontalOverflow(page, `S06 ${viewport.name}`);
    await page.screenshot({
      path: `${EVIDENCE_DIRECTORY}/S06-tenant-overview-${viewport.name}.png`,
      fullPage: true,
      animations: 'disabled',
    });

    await page.goto('/admin/identity/access');
    await expect(page.getByRole('heading', { name: 'Identity access', level: 1 })).toBeVisible();
    if (viewport.width >= 900) {
      await page.getByRole('row', { name: /Tenant Admin tenant\.admin@dwp\.local/ }).click();
    } else {
      await page.getByRole('button', { name: 'Review effective access' }).first().click();
    }
    await expect(page.getByRole('heading', { name: 'Effective access' })).toBeVisible();
    await expect(page.getByText('Source: Direct')).toBeVisible();
    await expect(page.getByText('Scope: TENANT')).toBeVisible();
    await expect(page.getByText('No expiry')).toBeVisible();
    await expectNoHorizontalOverflow(page, `S07 ${viewport.name}`);
    await page.screenshot({
      path: `${EVIDENCE_DIRECTORY}/S07-effective-access-${viewport.name}.png`,
      fullPage: true,
      animations: 'disabled',
    });

    await page.goto('/admin/governance/audit-governance');
    await expect(
      page.getByRole('table', { name: 'Policy before and after comparison' })
    ).toBeVisible();
    await expect(page.getByText(/population impact.*remains unconfirmed/i)).toBeVisible();
    await expect(page.getByText('Independent approval pending')).toBeVisible();
    await expectNoHorizontalOverflow(page, `S08 ${viewport.name}`);
    await page.screenshot({
      path: `${EVIDENCE_DIRECTORY}/S08-policy-evidence-${viewport.name}.png`,
      fullPage: true,
      animations: 'disabled',
    });

    await page.goto('/admin/platform/catalog');
    await expect(page.getByTestId('application-lifecycle-catalog')).toBeVisible();
    const mailLifecycle = page.getByTestId('application-lifecycle-APP.MAIL');
    await expect(mailLifecycle).toBeVisible();
    await expect(mailLifecycle.getByText('No tenant owner read contract')).toHaveCount(2);
    await expect(page.getByRole('link', { name: 'Open management workspace' })).toBeVisible();
    await expectNoHorizontalOverflow(page, `S13 ${viewport.name}`);
    await page.screenshot({
      path: `${EVIDENCE_DIRECTORY}/S13-application-lifecycle-${viewport.name}.png`,
      fullPage: true,
      animations: 'disabled',
    });

    await page.goto('/admin/identity/app-governance');
    const presetProgress = page.getByTestId('app-preset-assignment-progress');
    await expect(presetProgress).toBeVisible();
    await expect(presetProgress.getByText('Request owner')).toBeVisible();
    await expect(
      presetProgress.getByRole('heading', { name: 'Independent approver' })
    ).toBeVisible();
    await expect(
      presetProgress.getByRole('heading', { name: 'Independent activator' })
    ).toBeVisible();
    await expect(presetProgress.getByText(/Separation remains pending/)).toBeVisible();
    await expectNoHorizontalOverflow(page, `S14 ${viewport.name}`);
    await page.screenshot({
      path: `${EVIDENCE_DIRECTORY}/S14-preset-progress-${viewport.name}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  });
}
