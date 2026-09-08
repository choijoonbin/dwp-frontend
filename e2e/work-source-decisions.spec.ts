import { expect, test } from '@playwright/test';

import { fulfillSuccess } from './support/shell-session';
import { mockApprovalProductSurfaceAuthority } from './support/product-surface-authority';
import { mockWorkHubFoundation, WORK_HUB_FIXTURE } from './support/work-hub-foundation-fixtures';

import type { Page, TestInfo } from '@playwright/test';

/** UI acceptance uses fictional allowed source receipts; the live tenant remains fail-closed. */
const fixture = WORK_HUB_FIXTURE;
const reviewId = 'f1111111-1111-4111-8111-111111111111';
const sourceRoute = (source: string, id: string, obligation = '') =>
  `/work/queue?work=${encodeURIComponent(`${source}:${id}:${obligation}`)}`;
const reviewPath = `/api/auth/work/access-review-items/${reviewId}`;
const rationale = 'The current business evidence and assigned access scope have been reviewed.';

async function openReview(page: Page) {
  await page.goto(sourceRoute('IDENTITY_GOVERNANCE', reviewId));
  await expect(page.getByRole('heading', { name: 'Access review', exact: true })).toBeVisible({
    timeout: 20_000,
  });
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await testInfo.attach(name, {
    body: await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true }),
    contentType: 'image/png',
  });
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
}

for (const source of [
  {
    name: 'approval',
    route: sourceRoute('APPROVAL_TASK', fixture.approvalId, 'SECURITY_REVIEW'),
    destination: `/approvals/inbox?task=${fixture.approvalId}`,
    heading: 'Approval decision context',
    ownerHeading: fixture.approvalTitle,
  },
  {
    name: 'service',
    route: sourceRoute('SERVICE_REQUEST', fixture.serviceId),
    destination: `/services/my/${fixture.serviceId}`,
    heading: 'Your input and request progress',
    ownerHeading: 'VPN access request',
  },
] as const) {
  test(`source-owned ${source.name} work uses a document handoff and sends no foreign command`, async ({
    page,
  }, testInfo) => {
    const runtime = await mockWorkHubFoundation(page, { designDetails: true });
    await page.goto(source.route);
    const detail = page.getByRole('article');
    await expect(detail.getByRole('heading', { name: source.heading, exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect(detail.getByRole('button', { name: 'Open in source', exact: true })).toBeVisible();
    await expect(
      detail.getByRole('button', { name: /Approve|Reject|Submit response/u })
    ).toHaveCount(0);
    await capture(page, testInfo, `${source.name}-handoff`);
    if (source.name === 'approval') await mockApprovalProductSurfaceAuthority(page);

    const destination = new URL(source.destination, 'http://dwp.test');
    const workUrl = new URL(page.url());
    const returnTo = `${workUrl.pathname}${workUrl.search}${workUrl.hash}`;
    const documentRequest = page.waitForRequest((request) => {
      const target = new URL(request.url());
      return (
        request.isNavigationRequest() &&
        target.pathname === destination.pathname &&
        (source.name === 'approval'
          ? target.searchParams.get('task') === fixture.approvalId &&
            target.searchParams.get('returnTo') === returnTo
          : target.search === destination.search)
      );
    });
    await detail.getByRole('button', { name: 'Open in source', exact: true }).click();
    expect((await documentRequest).resourceType()).toBe('document');
    await expect(page).toHaveURL((url) => {
      if (url.pathname !== destination.pathname) return false;
      return source.name === 'approval'
        ? url.searchParams.get('task') === fixture.approvalId &&
            url.searchParams.get('returnTo') === returnTo
        : url.search === destination.search;
    });
    await expect(
      page.getByRole('heading', { name: source.ownerHeading, exact: true })
    ).toBeVisible();
    await capture(page, testInfo, `${source.name}-owner-detail`);
    expect(runtime.sourceMutations).toEqual([]);
    expect(runtime.forbiddenWorkspaceMutations).toEqual([]);
  });
}

for (const selection of ['APPROVE', 'REVOKE'] as const) {
  test(`access ${selection} keeps the governed-context decision separate from remediation`, async ({
    page,
  }, testInfo) => {
    const runtime = await mockWorkHubFoundation(page, { designDetails: true, accessReview: true });
    await openReview(page);
    const review = page.getByRole('button', { name: 'Review decision before submitting' });
    await expect(review).toBeDisabled();
    const choice = page.getByRole('button', {
      name: selection === 'APPROVE' ? 'Keep access' : 'Revoke access',
      exact: true,
    });
    await choice.click();
    await page.getByRole('textbox', { name: 'Decision reason' }).fill(rationale);
    await review.click();
    const preview = page.getByRole('dialog', {
      name: selection === 'APPROVE' ? 'Keep this access?' : 'Revoke this access?',
    });
    await expect(preview.getByText(rationale, { exact: true })).toBeVisible();
    await capture(page, testInfo, `access-${selection.toLowerCase()}-preview`);
    const accepted = page.waitForResponse(
      (response) => response.url().includes(reviewPath) && response.request().method() === 'PUT'
    );
    await preview
      .getByRole('button', {
        name: selection === 'APPROVE' ? 'Keep access' : 'Revoke access',
        exact: true,
      })
      .click();
    const receipt = await (await accepted).json();
    expect(receipt.data).toMatchObject({
      decision: selection,
      version: 4,
      remediationState: selection === 'REVOKE' ? 'PENDING' : 'NOT_REQUIRED',
    });
    const outcomeHeading = page.getByRole('heading', {
      name: 'The access review decision was recorded.',
      exact: true,
    });
    await expect(outcomeHeading).toBeFocused();
    await expect(page.getByRole('status').filter({ has: outcomeHeading })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Keep access', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Revoke access', exact: true })).toHaveCount(0);
    await capture(page, testInfo, `access-${selection.toLowerCase()}-receipt-focus`);
    expect(runtime.sourceMutations).toEqual([
      {
        path: `${reviewPath}/decision`,
        body: { decision: selection, reason: rationale, version: 3 },
      },
    ]);
    expect(runtime.forbiddenWorkspaceMutations).toEqual([]);
  });
}

test('denied governed-context authority never exposes an executable access decision', async ({
  page,
}) => {
  const runtime = await mockWorkHubFoundation(page, { designDetails: true, accessReview: true });
  await page.route('**/api/auth/governed-route-access/evaluate', async (route) => {
    const body = route.request().postDataJSON();
    if (body.routeContractKey === 'route.context.work__work.review-decision.action')
      return fulfillSuccess(route, { decision: 'ROUTE_DENIED', reasonCode: 'FORBIDDEN' });
    return route.fallback();
  });
  await openReview(page);
  await expect(page.getByRole('button', { name: 'Keep access', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Revoke access', exact: true })).toBeDisabled();
  expect(runtime.sourceMutations).toEqual([]);
});

test('a newer access-review version after preview blocks submission and preserves the rationale', async ({
  page,
}) => {
  const runtime = await mockWorkHubFoundation(page, { designDetails: true, accessReview: true });
  const initialRead = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === reviewPath && response.request().method() === 'GET'
  );
  await openReview(page);
  const initial = (await (await initialRead).json()).data;
  await page.getByRole('button', { name: 'Revoke access', exact: true }).click();
  await page.getByRole('textbox', { name: 'Decision reason' }).fill(rationale);
  await page.getByRole('button', { name: 'Review decision before submitting' }).click();
  const preview = page.getByRole('dialog', { name: 'Revoke this access?' });
  await page.route(`**${reviewPath}`, (route) => fulfillSuccess(route, { ...initial, version: 4 }));
  await preview.getByRole('button', { name: 'Revoke access', exact: true }).click();
  await expect(page.getByText(/Your rationale is preserved/u)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Decision reason' })).toHaveValue(rationale);
  expect(runtime.sourceMutations).toEqual([]);
});

test('authority lost after preview is checked again before any access decision', async ({
  page,
}) => {
  const runtime = await mockWorkHubFoundation(page, { designDetails: true, accessReview: true });
  await openReview(page);
  await page.getByRole('button', { name: 'Revoke access', exact: true }).click();
  await page.getByRole('textbox', { name: 'Decision reason' }).fill(rationale);
  await page.getByRole('button', { name: 'Review decision before submitting' }).click();
  const preview = page.getByRole('dialog', { name: 'Revoke this access?' });
  let evaluations = 0;
  await page.route('**/api/auth/governed-route-access/evaluate', async (route) => {
    const input = route.request().postDataJSON();
    if (input.routeContractKey === 'route.context.work__work.review-decision.action') {
      evaluations += 1;
      return fulfillSuccess(route, { decision: 'ROUTE_DENIED', reasonCode: 'FORBIDDEN' });
    }
    return route.fallback();
  });
  await preview.getByRole('button', { name: 'Revoke access', exact: true }).click();
  await expect.poll(() => evaluations).toBe(1);
  await expect(page.getByText(/It may belong to another reviewer/u)).toBeVisible();
  expect(runtime.sourceMutations).toEqual([]);
});
