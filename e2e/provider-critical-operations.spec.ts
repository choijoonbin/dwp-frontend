import { expect, test } from '@playwright/test';

import { fulfillSuccess, mockShellSession } from './support/shell-session';

import type { Route } from '@playwright/test';

test.beforeEach(async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize(
    testInfo.project.name === 'mobile' ? { width: 320, height: 720 } : { width: 1280, height: 800 }
  );
  await mockShellSession(page, ['PROVIDER_ADMIN'], {
    locale: 'en',
    appearance: {
      mode: 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
});

test('service operations connects customer impact, service exceptions, and incident action', async ({
  page,
}) => {
  await page.goto('/provider/health');

  await expect(
    page.getByRole('heading', { name: 'Service operations', exact: true })
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Service operating scope' })).toContainText(
    'All customer services'
  );
  await expect(
    page.getByRole('heading', { name: 'Service operations review is required' })
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Service operating signals' })).toContainText(
    '35 / 36'
  );
  await expect(page.getByText('Workspace latency elevated in Seoul cell')).toBeVisible();
  await expect(page.getByText('Workspace service', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Update state' }).click();
  await expect(page.getByRole('dialog', { name: /Update INC-2026-0811/ })).toBeVisible();
});

test('service operations stays within the viewport', async ({ page }) => {
  await page.goto('/provider/health');
  await expect(page.getByRole('region', { name: 'Service operating signals' })).toBeVisible();

  const geometry = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));

  expect(geometry.content).toBeLessThanOrEqual(geometry.viewport);
});

test('change control connects approval, execution ledger, and auditable evidence', async ({
  page,
}) => {
  await page.goto('/provider/operations');

  await expect(page.getByRole('heading', { name: 'Change control', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Change control scope' })).toContainText(
    'All customer environments'
  );
  await expect(
    page.getByRole('heading', { name: 'Changes are awaiting independent approval' })
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Change control key signals' })).toContainText('1');
  await expect(page.getByText('Apply the reviewed platform schema release.')).toBeVisible();

  await page.getByRole('row', { name: /operation-1/ }).click();
  const review = page.getByRole('dialog', { name: 'Review change plan' });
  await expect(review).toBeVisible();
  await expect(review.getByText('Approval gates')).toBeVisible();
  await expect(review.getByText('Execution evidence')).toBeVisible();
  await expect(review.getByText('Execution steps')).toBeVisible();
  await review.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByRole('dialog', { name: 'Approve change' })).toBeVisible();
});

test('change control stays within the viewport', async ({ page }) => {
  await page.goto('/provider/operations');
  await expect(page.getByRole('region', { name: 'Change control key signals' })).toBeVisible();

  const geometry = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));

  expect(geometry.content).toBeLessThanOrEqual(geometry.viewport);
});

test('privileged support separates request approval, sessions, and post-access review', async ({
  page,
}) => {
  await page.goto('/provider/support');

  await expect(
    page.getByRole('heading', { name: 'Support access lifecycle', exact: true })
  ).toBeVisible();
  await expect(page.getByText('Awaiting approval').locator('../..')).toContainText('1');
  await expect(page.getByText('Post-reviews due').locator('../..')).toContainText('1');
  await expect(
    page.getByText('Preview the customer-approved tenant experience configuration.')
  ).toBeVisible();

  await page.getByRole('button', { name: 'Approve' }).click();
  const approval = page.getByRole('dialog', { name: 'Approve support access' });
  await expect(approval).toContainText('You cannot approve your own request');
  const exactGrant = approval.getByRole('region', { name: 'Exact access evidence' });
  await expect(exactGrant).toContainText('SKAX Production · skax-production');
  await expect(exactGrant).toContainText('Provider Support Engineer');
  await expect(exactGrant).toContainText('Preview redacted tenant experience configuration');
  await expect(exactGrant).toContainText('30 minutes');
  await expect(exactGrant).toContainText('SKAX-CASE-2408');
  await expect(exactGrant).toContainText(
    'Preview the customer-approved tenant experience configuration.'
  );
  await approval.getByLabel('Justification').fill('Customer evidence and scope verified.');

  await approval.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Complete review' }).click();
  const postReview = page.getByRole('dialog', { name: 'Complete post-access review' });
  await expect(postReview).toContainText('Confirm the session ended');
  const recordedEvidence = postReview.getByRole('region', {
    name: 'Actual support-use evidence',
  });
  await expect(recordedEvidence).toContainText('support-session-history');
  await expect(recordedEvidence).toContainText('All evidence · 12');
  await expect(recordedEvidence).toContainText('Authorized uses · 10');
  await expect(recordedEvidence).toContainText('Denied attempts · 2');
  await expect(recordedEvidence).toContainText('Actual scope · TENANT_EXPERIENCE_PREVIEW');
  await expect(recordedEvidence).toContainText('Denial reason · SCOPE_INSUFFICIENT');
  await expect(recordedEvidence).toContainText('0123456789abcdef0123456789abcdef');
  const longCorrelation = recordedEvidence.getByText(/sha256:0123456789abcdef/);
  await expect(longCorrelation).toBeVisible();
  expect(
    await longCorrelation.evaluate((node) => ({
      clientWidth: node.clientWidth,
      scrollWidth: node.scrollWidth,
    }))
  ).toEqual(expect.objectContaining({ scrollWidth: expect.any(Number) }));
  expect(await longCorrelation.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(
    true
  );
  await expect(recordedEvidence).toContainText('Showing the latest 2 of 12');
  await expect(recordedEvidence).not.toContainText('support.postReviewEvidence');
  await postReview
    .getByLabel('Review evidence and conclusion')
    .fill('Actual scope, denied commands, and complete aggregate reconciled.');
  await expect(postReview.getByRole('button', { name: 'Complete review' })).toBeEnabled();
  await postReview.getByRole('button', { name: 'Cancel' }).click();

  await expect(
    page.getByRole('heading', { name: 'Active and historical sessions', exact: true })
  ).toBeVisible();
  await expect(
    page
      .getByRole('grid', { name: 'Support sessions' })
      .getByText('Approved standard access')
      .first()
  ).toBeVisible();
});

test('privileged support offers only the customer-approved preview scope for new access', async ({
  page,
}) => {
  await page.goto('/provider/support');

  await page.getByRole('button', { name: 'Start tenant diagnosis' }).click();
  const request = page.getByRole('dialog', {
    name: 'Start tenant diagnosis with time-bound access',
  });
  await expect(
    request.getByRole('checkbox', {
      name: /Preview redacted tenant experience configuration/,
    })
  ).toBeChecked();
  await expect(request.getByRole('checkbox', { name: /tenant diagnostics/i })).toHaveCount(0);
  await expect(request.getByRole('checkbox', { name: /tenant configuration/i })).toHaveCount(0);

  await request.getByRole('combobox', { name: 'Tenant' }).click();
  await page.getByRole('option', { name: /SKAX Production/ }).click();
  await request
    .getByLabel('Justification')
    .fill('Validate the redacted customer experience configuration for the approved case.');
  await expect(request.getByRole('button', { name: 'Submit for review' })).toBeDisabled();
  await request.getByLabel('Customer approval reference').fill('SKAX-CASE-2408');
  await expect(request.getByRole('button', { name: 'Submit for review' })).toBeEnabled();
});

test('post-access review accepts only an explicit complete no-use decision', async ({ page }) => {
  await page.route('**/support-request-review/post-review-evidence', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          supportAccessRequestId: 'support-request-review',
          supportSessionId: 'support-session-history',
          tenantId: 'tenant-skax',
          sessionLifecycleState: 'REVOKED',
          evidenceFrom: '2026-08-10T21:10:00Z',
          evidenceThrough: '2026-08-10T21:25:00Z',
          grantedScopes: ['TENANT_EXPERIENCE_PREVIEW'],
          observedScopes: [],
          totalEventCount: 0,
          actualUseCount: 0,
          deniedAttemptCount: 0,
          evidenceComplete: true,
          displayTruncated: false,
          noUseConfirmed: true,
          readiness: 'READY_NO_USE',
          anomalies: [],
          events: [],
        },
      }),
    });
  });
  await page.goto('/provider/support');
  await page.getByRole('button', { name: 'Complete review' }).click();
  const review = page.getByRole('dialog', { name: 'Complete post-access review' });
  await expect(review).toContainText('The explicit no-use policy is satisfied.');
  await review
    .getByLabel('Review evidence and conclusion')
    .fill('Complete terminal no-use evidence independently reconciled.');
  await expect(review.getByRole('button', { name: 'Complete review' })).toBeEnabled();
});

test('post-access review stays blocked when the evidence aggregate is incomplete', async ({
  page,
}) => {
  await page.route('**/support-request-review/post-review-evidence', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          supportAccessRequestId: 'support-request-review',
          supportSessionId: 'support-session-history',
          tenantId: 'tenant-skax',
          sessionLifecycleState: 'REVOKED',
          evidenceFrom: '2026-08-10T21:10:00Z',
          evidenceThrough: '2026-08-10T21:25:00Z',
          grantedScopes: ['TENANT_EXPERIENCE_PREVIEW'],
          observedScopes: ['TENANT_EXPERIENCE_PREVIEW'],
          totalEventCount: 1,
          actualUseCount: 1,
          deniedAttemptCount: 0,
          evidenceComplete: false,
          displayTruncated: false,
          noUseConfirmed: false,
          readiness: 'INCOMPLETE',
          anomalies: ['INVALID_CORRELATION_EVIDENCE'],
          events: [],
        },
      }),
    });
  });
  await page.goto('/provider/support');
  await page.getByRole('button', { name: 'Complete review' }).click();
  const review = page.getByRole('dialog', { name: 'Complete post-access review' });
  await expect(review).toContainText('Post-access review remains blocked.');
  await expect(review).toContainText('non-canonical correlation evidence');
  await review
    .getByLabel('Review evidence and conclusion')
    .fill('This must not bypass incomplete evidence.');
  await expect(review.getByRole('button', { name: 'Complete review' })).toBeDisabled();
});

test('privileged support finds tenant 150 with the server-backed picker', async ({ page }) => {
  const tenantSearches: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/api/provider/v1/admin/tenants' && url.searchParams.get('query')) {
      tenantSearches.push(url.searchParams.get('query') ?? '');
    }
  });
  await page.goto('/provider/support');
  await page.getByRole('button', { name: 'Start tenant diagnosis' }).click();
  const request = page.getByRole('dialog', {
    name: 'Start tenant diagnosis with time-bound access',
  });
  const picker = request.getByRole('combobox', { name: 'Tenant' });

  await picker.fill('Tenant 150');
  await page.getByRole('option', { name: /Tenant 150 Production/ }).click();

  await expect(picker).toHaveValue(/Tenant 150 Production/);
  expect(tenantSearches).toContain('Tenant 150');
});

test('privileged support remains usable when the request ledger partially fails', async ({
  page,
}) => {
  await page.route('**/api/provider/v1/admin/support-access-requests*', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, code: 'E5000', message: 'Unavailable' }),
    });
  });
  await page.goto('/provider/support');

  await expect(page.getByText('The request ledger is temporarily unavailable.')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Active and historical sessions', exact: true })
  ).toBeVisible();
  await expect(page.getByText('Approved standard access')).toBeVisible();
});

test('commercial governance connects renewal impact, independent approval, and locked delivery', async ({
  page,
}) => {
  await page.goto('/provider/commercial');

  await expect(page.getByRole('region', { name: 'Commercial governance context' })).toContainText(
    'Independent approval'
  );
  await expect(
    page.getByRole('heading', { name: 'Renewal decision queue', exact: true })
  ).toBeVisible();
  await expect(page.getByText('Enterprise → Regulated enterprise').first()).toBeVisible();
  await expect(page.getByText('Add premium-audit')).toBeVisible();

  await page.getByRole('button', { name: 'Approve' }).click();
  const approval = page.getByRole('dialog', { name: 'Approve renewal proposal' });
  await approval
    .getByLabel('Decision reason')
    .fill(
      'Customer contract, entitlement impact, and security evidence were independently reviewed.'
    );
  await approval.getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('button', { name: 'Propose renewal' }).click();
  const proposal = page.getByRole('dialog', { name: 'Propose renewal for SKAX' });
  await expect(proposal).toContainText('immutable impact snapshot');
  await proposal
    .getByLabel('Renewal reason and evidence')
    .fill('Renew the customer contract after commercial evidence review.');
  await expect(proposal.getByRole('button', { name: 'Submit for approval' })).toBeEnabled();
});

test('commercial governance keeps subscriptions usable when renewal queue fails', async ({
  page,
}) => {
  await page.route('**/api/provider/v1/admin/subscription-renewals*', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, code: 'E5000', message: 'Unavailable' }),
    });
  });
  await page.goto('/provider/commercial');

  await expect(
    page.getByText('Subscription data remains available, but the renewal decision queue')
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Customer subscriptions & renewals', exact: true })
  ).toBeVisible();
  await expect(page.getByText('SKAX-2026-001')).toBeVisible();
});

test('provider audit restores relationship query and tenant scope from the URL', async ({
  page,
}) => {
  await page.goto('/provider/audit?query=support-session-1&tenantId=tenant-skax');

  await expect(page.getByLabel('Search action, target, operator, or correlation')).toHaveValue(
    'support-session-1'
  );
  await expect(page.getByRole('combobox', { name: 'Tenant' })).toContainText('SKAX Production');
  await expect(page.getByText('Support session started')).toBeVisible();
});

test('feature rollout evaluation adopts delayed options and rejects superseded results', async ({
  page,
}) => {
  const flags = [
    {
      featureFlagId: '59000000-0000-0000-0000-000000000001',
      featureKey: 'WORKFORCE_EXPORT_V2',
      displayName: 'Governed workforce export',
      description: 'Controls the governed workforce export request experience.',
      ownerService: 'dwp-people-server',
      valueType: 'BOOLEAN',
      defaultValue: false,
      configurationSchema: { type: 'boolean' },
      riskTier: 'L2',
      lifecycleState: 'ACTIVE',
      version: 1,
    },
    {
      featureFlagId: '59000000-0000-0000-0000-000000000002',
      featureKey: 'FLOW_HOME_V2',
      displayName: 'Flow home v2',
      description: 'Controls the staged Flow home experience.',
      ownerService: 'dwp-platform-server',
      valueType: 'BOOLEAN',
      defaultValue: false,
      configurationSchema: { type: 'boolean' },
      riskTier: 'L2',
      lifecycleState: 'ACTIVE',
      version: 1,
    },
  ];
  const tenants = {
    content: [
      {
        tenantId: 'tenant-skax',
        tenantKey: 'skax-production',
        displayName: 'SKAX Production',
      },
      {
        tenantId: 'tenant-acme',
        tenantKey: 'acme-production',
        displayName: 'Acme Production',
      },
    ],
    page: 0,
    size: 100,
    totalElements: 2,
    totalPages: 1,
  };
  const evaluationFixture = ({
    featureKey,
    tenantId,
    tenantKey,
    value,
    bucket,
    exposure,
  }: {
    featureKey: string;
    tenantId: string;
    tenantKey: string;
    value: boolean;
    bucket: number;
    exposure: number;
  }) => ({
    featureKey,
    providerTenantId: tenantId,
    tenantKey,
    value,
    reasonCode: 'ROLLOUT_MATCH',
    rolloutRevisionId: '5a000000-0000-0000-0000-000000000001',
    revisionNumber: 3,
    exposurePercentage: exposure,
    deterministicBucket: bucket,
    externalExecutionEnabled: false,
    evaluatedAt: '2026-08-28T01:00:00Z',
  });
  const earlyResponses = new Set<string>();
  let delayedFlagsRoute: Route | undefined;
  let delayedTenantsRoute: Route | undefined;
  const evaluationRequests: Array<{
    route: Route;
    featureKey: string;
    query: [string, string][];
  }> = [];
  const expectEvaluationRequest = async (
    index: number,
    featureKey: string,
    tenantId: string
  ): Promise<Route> => {
    await expect.poll(() => evaluationRequests.length).toBe(index + 1);
    const request = evaluationRequests[index];
    if (!request) throw new Error(`Expected evaluation request ${index + 1}.`);
    expect(request.featureKey).toBe(featureKey);
    expect(request.query).toEqual([['tenantId', tenantId]]);
    return request.route;
  };

  page.on('response', (response) => {
    const path = new URL(response.url()).pathname;
    if (
      path === '/api/provider/v1/admin/me' ||
      path === '/api/provider/v1/admin/feature-rollouts'
    ) {
      earlyResponses.add(path);
    }
  });
  await page.route('**/api/provider/v1/admin/feature-rollouts/flags', (route) => {
    delayedFlagsRoute = route;
  });
  await page.route('**/api/provider/v1/admin/tenants?*', (route) => {
    delayedTenantsRoute = route;
  });
  await page.route('**/api/provider/v1/admin/feature-rollouts/flags/*/evaluate?*', (route) => {
    const url = new URL(route.request().url());
    const prefix = '/api/provider/v1/admin/feature-rollouts/flags/';
    const suffix = '/evaluate';
    evaluationRequests.push({
      route,
      featureKey: decodeURIComponent(url.pathname.slice(prefix.length, -suffix.length)),
      query: [...url.searchParams.entries()],
    });
  });

  await page.goto('/provider/feature-rollouts');
  await expect(page.getByRole('heading', { name: 'Feature rollout control' })).toBeVisible();
  await expect
    .poll(
      () =>
        earlyResponses.has('/api/provider/v1/admin/me') &&
        earlyResponses.has('/api/provider/v1/admin/feature-rollouts') &&
        Boolean(delayedFlagsRoute) &&
        Boolean(delayedTenantsRoute)
    )
    .toBe(true);

  const flagsRoute = delayedFlagsRoute;
  const tenantsRoute = delayedTenantsRoute;
  if (!flagsRoute || !tenantsRoute) throw new Error('Expected delayed evaluation option requests.');
  await Promise.all([fulfillSuccess(flagsRoute, flags), fulfillSuccess(tenantsRoute, tenants)]);

  const feature = page.getByRole('combobox', { name: 'Feature' });
  const tenant = page.getByRole('combobox', { name: 'Evaluation tenant' });
  const evaluate = page.getByRole('button', { name: 'Evaluate' });
  await expect(feature).toContainText('Governed workforce export');
  await expect(tenant).toContainText('SKAX Production');
  await expect(evaluate).toBeEnabled();

  await evaluate.click();
  const initialEvaluationRoute = await expectEvaluationRequest(
    0,
    'WORKFORCE_EXPORT_V2',
    'tenant-skax'
  );
  await fulfillSuccess(
    initialEvaluationRoute,
    evaluationFixture({
      featureKey: 'WORKFORCE_EXPORT_V2',
      tenantId: 'tenant-skax',
      tenantKey: 'skax-production',
      value: true,
      bucket: 7,
      exposure: 5,
    })
  );
  const initialResult = 'skax-production receives true. Bucket 7, current exposure 5%.';
  await expect(page.getByText(initialResult)).toBeVisible();

  await feature.click();
  await page.getByRole('option', { name: 'Flow home v2' }).click();
  await expect(page.getByText(initialResult)).toHaveCount(0);

  await evaluate.click();
  const supersededEvaluationRoute = await expectEvaluationRequest(1, 'FLOW_HOME_V2', 'tenant-skax');
  await tenant.click();
  await page.getByRole('option', { name: /Acme Production/ }).click();
  await fulfillSuccess(
    supersededEvaluationRoute,
    evaluationFixture({
      featureKey: 'FLOW_HOME_V2',
      tenantId: 'tenant-skax',
      tenantKey: 'skax-production',
      value: true,
      bucket: 19,
      exposure: 25,
    })
  );
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
  await expect(
    page.getByText('skax-production receives true. Bucket 19, current exposure 25%.')
  ).toHaveCount(0);

  await evaluate.click();
  const currentEvaluationRoute = await expectEvaluationRequest(2, 'FLOW_HOME_V2', 'tenant-acme');
  await fulfillSuccess(
    currentEvaluationRoute,
    evaluationFixture({
      featureKey: 'FLOW_HOME_V2',
      tenantId: 'tenant-acme',
      tenantKey: 'acme-production',
      value: false,
      bucket: 73,
      exposure: 25,
    })
  );
  await expect(
    page.getByText('acme-production receives false. Bucket 73, current exposure 25%.')
  ).toBeVisible();
});
