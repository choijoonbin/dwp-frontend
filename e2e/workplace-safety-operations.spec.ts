import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  mockWorkplaceSafety,
  SAFETY_DECISION_REVISION,
  SAFETY_IDS,
} from './support/workplace-safety-fixtures';

import type { Locator, Page } from '@playwright/test';

async function expectNoSeriousAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((item) => ['critical', 'serious'].includes(item.impact ?? ''))
  ).toEqual([]);
}

async function focusByKeyboard(page: Page, target: Locator) {
  for (let index = 0; index < 100; index += 1) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((element) => element === document.activeElement)) return;
  }
  throw new Error('Keyboard focus did not reach the Workplace safety control.');
}

async function openAdminIncident(page: Page, mobile = false, locale: 'en' | 'ko' = 'en') {
  await page.goto('/workplace/admin/safety');
  await expect(
    page.getByRole('heading', {
      name: locale === 'ko' ? '안전 대응 지휘 센터' : 'Safety response command center',
    })
  ).toBeVisible();
  await page
    .getByRole('button', { name: locale === 'ko' ? '검토' : 'Inspect' })
    .first()
    .click();
  const name = locale === 'ko' ? '안전 사건 상세 패널' : 'Safety incident inspector';
  const inspector = page.getByRole(mobile ? 'dialog' : 'complementary', { name });
  await expect(inspector).toBeVisible();
  return inspector;
}

function section(inspector: Locator, title: string) {
  return inspector.locator('.MuiAccordion-root').filter({ hasText: title });
}

test('submits SAFE and a bidirectional masked message, then recovers RESULT_UNKNOWN with GET only', async ({
  page,
}, testInfo) => {
  const telemetryBodies: string[] = [];
  page.on('request', (request) => {
    if (/observability|telemetry|rum/iu.test(request.url())) {
      telemetryBodies.push(request.postData() ?? '');
    }
  });
  const evidence = await mockWorkplaceSafety(page, { responseUnknown: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/workplace/safety');

  const surface = page.getByRole('main');
  await expect(surface.getByRole('heading', { name: 'Safety check' })).toBeVisible();
  await expect(surface.getByText('Site security desk 02-0000-119')).toBeVisible();
  await expect(surface.getByText('Proceed to the [masked] assembly area.')).toBeVisible();
  await surface
    .getByRole('checkbox', { name: /explicitly confirm this command/i })
    .first()
    .check();
  await surface.getByRole('button', { name: 'I am safe' }).click();
  await expect(surface.getByText(/Do not resend it/u)).toBeVisible();

  const postsBeforeRecovery = evidence.postCount();
  await surface.getByRole('button', { name: 'Recheck with GET' }).click();
  await expect(surface.getByText(/Do not resend it/u)).toHaveCount(0);
  expect(evidence.postCount()).toBe(postsBeforeRecovery);
  await expect(surface.getByText('I am safe')).toHaveCount(2);

  const piiMarker = 'pii-screen20@example.test';
  await surface.getByRole('textbox', { name: 'Message' }).fill(piiMarker);
  await surface
    .getByRole('checkbox', { name: /explicitly confirm this command/i })
    .last()
    .check();
  await surface.getByRole('button', { name: 'Send masked message' }).click();
  await expect(surface.getByText('Status update received from [masked] member.')).toBeVisible();
  await expect(surface.getByText(piiMarker)).toHaveCount(0);

  const storage = await page.evaluate(() => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
  }));
  expect(JSON.stringify(storage)).not.toContain(piiMarker);
  expect(telemetryBodies.join('\n')).not.toContain(piiMarker);
  expect(evidence.commandHeaders.every((headers) => Boolean(headers['idempotency-key']))).toBe(
    true
  );
  await expectNoSeriousAccessibilityViolations(page);
  await page.screenshot({
    path: testInfo.outputPath('screen20-safety-user-en-1440.png'),
    fullPage: true,
  });
});

test('shows only a configured safe emergency call action on the mobile Safety Sheet', async ({
  page,
}) => {
  await mockWorkplaceSafety(page, { locale: 'ko' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/workplace/safety');

  const contacts = page.getByRole('region', { name: '긴급 연락처' });
  const call = contacts.getByRole('link', { name: '공공 긴급 서비스에 전화' });
  await expect(call).toHaveAttribute('href', 'tel:+82123456789');
  await expect(contacts.getByText('외부 긴급 인계 센터')).toBeVisible();
  await expect(contacts.getByText(/지휘 센터 운영자만/u)).toBeVisible();
  await expect(contacts.locator('a[href^="tel:"]')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expectNoSeriousAccessibilityViolations(page);
});

for (const entry of [
  { width: 1280, locale: 'en' as const },
  { width: 390, locale: 'ko' as const },
  { width: 320, locale: 'en' as const },
]) {
  test(`keeps the ${entry.width}px ${entry.locale} Safety Sheet accessible and overflow-free`, async ({
    page,
  }, testInfo) => {
    await mockWorkplaceSafety(page, { locale: entry.locale });
    if (entry.width === 1280) await page.emulateMedia({ colorScheme: 'dark' });
    if (entry.width === 390) {
      await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
    }
    await page.setViewportSize({ width: entry.width, height: 844 });
    await page.goto('/workplace/safety');
    const surface = page.getByRole('main');
    await expect(surface).toBeVisible();
    if (entry.width === 1280) {
      await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
    }
    if (entry.width === 320) {
      const confirmation = surface
        .getByRole('checkbox', { name: /explicitly confirm this command/i })
        .first();
      await focusByKeyboard(page, confirmation);
      await page.keyboard.press('Space');
      const safe = surface.getByRole('button', { name: 'I am safe' });
      await focusByKeyboard(page, safe);
      await page.keyboard.press('Enter');
      await expect(surface.getByText('I am safe')).toHaveCount(2);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      entry.width
    );
    await expectNoSeriousAccessibilityViolations(page);
    await page.screenshot({
      path: testInfo.outputPath(`screen20-safety-user-${entry.locale}-${entry.width}.png`),
      fullPage: true,
    });
  });
}

test('operates activation, source evidence, resend, scope, assembly, messaging, two-person closure, and export', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const evidence = await mockWorkplaceSafety(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/workplace/admin/safety');
  const admin = page.getByRole('main');

  await admin.getByRole('button', { name: 'New incident' }).click();
  await admin.getByRole('textbox', { name: 'Site ID' }).fill(SAFETY_IDS.site);
  await admin.getByRole('textbox', { name: 'Floor IDs' }).fill(SAFETY_IDS.floor);
  await admin.getByRole('textbox', { name: 'Zone IDs' }).fill(SAFETY_IDS.zone);
  await admin.getByRole('textbox', { name: 'Incident message' }).fill('Evacuate now.');
  await admin.getByRole('textbox', { name: 'Required safety action' }).fill('Use the marked exit.');
  await admin.getByRole('checkbox', { name: /governed activation preview request/i }).check();
  await admin.getByRole('button', { name: 'Preview audience and delivery' }).click();
  await expect(admin.getByRole('heading', { name: 'Audience coverage by source' })).toBeVisible();
  await admin
    .getByRole('checkbox', { name: /confirm activation for the current deduplicated audience/i })
    .check();
  await admin.getByRole('button', { name: 'Activate incident' }).click();

  const inspector = page.getByRole('complementary', { name: 'Safety incident inspector' });
  await expect(inspector).toBeVisible();
  for (const sourceName of [
    'Reservation holders',
    'Verified actual presence',
    'Current visitors',
    'Scheduled visitors',
  ]) {
    await expect(inspector.getByText(sourceName)).toBeVisible();
  }
  await expect(inspector.getByText(/Partial · Stale/u)).toBeVisible();

  const delivery = section(inspector, 'Delivery and recovery');
  await delivery.getByRole('button').first().click();
  await delivery.getByRole('checkbox', { name: /verified failed or offline-queued/i }).check();
  await delivery.getByRole('button', { name: 'Resend failed deliveries' }).click();

  const scope = section(inspector, 'Scope revision');
  await scope.getByRole('button').first().click();
  await scope.getByRole('textbox', { name: 'Incident message' }).fill('Updated verified scope.');
  await scope.getByRole('checkbox', { name: /scope impact preview request/i }).check();
  await scope.getByRole('button', { name: 'Preview scope impact' }).click();
  await expect(scope.getByText(/Newly included 2/u)).toBeVisible();
  await scope.getByRole('checkbox', { name: /explicitly confirm this command/i }).check();
  await scope.getByRole('button', { name: 'Apply scope revision' }).click();

  const assembly = section(inspector, 'Assembly attendance');
  await assembly.getByRole('button').first().click();
  await assembly.getByRole('checkbox', { name: /assembly observation/i }).check();
  await assembly.getByRole('button', { name: 'Confirm assembly attendance' }).click();

  const messages = section(inspector, 'Bidirectional safety messages');
  await messages.getByRole('button').first().click();
  await messages.getByRole('textbox', { name: 'Message' }).fill('Proceed to the verified exit.');
  await messages.getByRole('checkbox', { name: /explicitly confirm this command/i }).check();
  await messages.getByRole('button', { name: 'Send masked message' }).click();
  await expect(messages.getByText('Command update for [masked] recipients.')).toBeVisible();

  const closure = section(inspector, 'Two-person closure');
  await closure.getByRole('button').first().click();
  await closure.getByRole('checkbox', { name: /closure impact preview request/i }).check();
  await closure.getByRole('button', { name: 'Preview closure impact' }).click();
  await expect(closure.getByText(/Needs help 0 · No response 0/u)).toBeVisible();
  await closure.getByRole('textbox', { name: 'Designated approver user ID' }).fill('90002');
  await closure.getByRole('checkbox', { name: /request independent approval/i }).check();
  await closure.getByRole('button', { name: 'Request closure' }).click();
  await expect(closure.getByText(/Requester 10001 cannot approve/u)).toBeVisible();
  await closure.getByRole('checkbox', { name: /independent approver/i }).check();
  await closure.getByRole('button', { name: 'Approve closure' }).click();

  const report = section(inspector, 'Post-incident report and audited export');
  await report.getByRole('button').first().click();
  await expect(report.getByText('CLOSED')).toBeVisible();
  await report.getByRole('checkbox', { name: /purpose-limited, audited export/i }).check();
  await report.getByRole('button', { name: 'Create guarded export' }).click();
  await expect(report.getByText(/SHA-256/u)).toBeVisible();
  await report.getByRole('button', { name: 'Download verified export' }).click();
  await expect.poll(evidence.exportGets).toBe(1);

  expect(evidence.postPaths).toEqual(
    expect.arrayContaining([
      '/api/platform/v1/admin/workplace/safety/incidents:preview',
      '/api/platform/v1/admin/workplace/safety/incidents',
      `/api/platform/v1/admin/workplace/safety/incidents/${SAFETY_IDS.incident}/dispatches:resend`,
      `/api/platform/v1/admin/workplace/safety/incidents/${SAFETY_IDS.incident}/scope-revisions:preview`,
      `/api/platform/v1/admin/workplace/safety/incidents/${SAFETY_IDS.incident}/scope-revisions`,
      `/api/platform/v1/admin/workplace/safety/incidents/${SAFETY_IDS.incident}/assembly-confirmations`,
      `/api/platform/v1/admin/workplace/safety/incidents/${SAFETY_IDS.incident}/messages`,
      `/api/platform/v1/admin/workplace/safety/incidents/${SAFETY_IDS.incident}/closures:preview`,
      `/api/platform/v1/admin/workplace/safety/incidents/${SAFETY_IDS.incident}/closure-requests`,
      `/api/platform/v1/admin/workplace/safety/incidents/${SAFETY_IDS.incident}/closure-requests/${SAFETY_IDS.closure}:approve`,
      `/api/platform/v1/admin/workplace/safety/incidents/${SAFETY_IDS.incident}/exports`,
    ])
  );
  expect(
    evidence.commandHeaders.every(
      (headers) =>
        Boolean(headers['idempotency-key']) && headers['x-dwp-active-access-mode'] === 'ELEVATED'
    )
  ).toBe(true);
  const exportIndex = evidence.postPaths.findIndex((path) => path.endsWith('/exports'));
  expect(evidence.commandHeaders[exportIndex]?.['x-dwp-current-decision-revision']).toBe(
    SAFETY_DECISION_REVISION
  );
  expect(
    evidence.postBodies.every(
      (body) =>
        typeof body === 'object' &&
        body !== null &&
        (body as Record<string, unknown>).explicitConfirmation === true &&
        Boolean((body as Record<string, unknown>).reason)
    )
  ).toBe(true);
  await expectNoSeriousAccessibilityViolations(page);
  await page.screenshot({
    path: testInfo.outputPath('screen20-safety-admin-en-1440.png'),
    fullPage: true,
  });
});

test('previews one external handoff and resolves an unknown result by provider lookup without resend', async ({
  page,
}) => {
  const evidence = await mockWorkplaceSafety(page, {
    emergencyProviderReady: true,
    emergencyHandoffUnknown: true,
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  const inspector = await openAdminIncident(page);
  const handoff = section(inspector, 'External emergency handoff');
  await handoff.getByRole('button').first().click();

  await expect(handoff.getByText('Ready', { exact: true })).toBeVisible();
  const previewButton = handoff.getByRole('button', { name: 'Preview external handoff' });
  await expect(previewButton).toBeDisabled();
  await handoff
    .getByRole('textbox', { name: 'Audit reason' })
    .fill('Escalate the verified incident to the configured emergency relay');
  await expect(previewButton).toBeEnabled();
  await previewButton.click();
  await expect(handoff.getByText('External handoff is eligible for confirmation')).toBeVisible();
  await expect(handoff.getByRole('button', { name: 'Confirm external handoff' })).toBeDisabled();
  await handoff
    .getByRole('checkbox', { name: /explicitly confirm one external emergency handoff/i })
    .check();
  await handoff.getByRole('button', { name: 'Confirm external handoff' }).click();
  await expect(handoff.getByText(/provider result is unknown/i)).toBeVisible();
  await expect(handoff.getByRole('button', { name: 'Confirm external handoff' })).toBeDisabled();

  const postsAfterHandoff = evidence.postCount();
  await handoff.getByRole('button', { name: 'Recheck receipt with GET' }).click();
  expect(evidence.postCount()).toBe(postsAfterHandoff);
  await handoff.getByRole('checkbox', { name: /provider status lookup only/i }).check();
  await handoff.getByRole('button', { name: 'Reconcile provider status' }).click();
  await expect(handoff.getByText(/External handoff Succeeded/u)).toBeVisible();

  const executePaths = evidence.postPaths.filter((path) => path.endsWith('/emergency-handoffs'));
  expect(executePaths).toHaveLength(1);
  expect(evidence.postPaths).toContain(
    `/api/platform/v1/admin/workplace/safety/incidents/${SAFETY_IDS.incident}/emergency-handoffs/${SAFETY_IDS.emergencyCommand}:reconcile`
  );
  await expectNoSeriousAccessibilityViolations(page);
});

test('keeps RESULT_UNKNOWN fail-closed and rechecks the admin incident with GET only', async ({
  page,
}) => {
  const evidence = await mockWorkplaceSafety(page, { incidentUnknown: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  const inspector = await openAdminIncident(page);
  await expect(inspector.getByText(/Do not resend it/u)).toBeVisible();
  const delivery = section(inspector, 'Delivery and recovery');
  await delivery.getByRole('button').first().click();
  await expect(delivery.getByRole('button', { name: 'Resend failed deliveries' })).toBeDisabled();
  const postsBeforeRecovery = evidence.postCount();
  await inspector.getByRole('button', { name: 'Recheck with GET' }).click();
  await expect.poll(evidence.detailGets).toBeGreaterThan(1);
  expect(evidence.postCount()).toBe(postsBeforeRecovery);
  await expect(inspector.getByText(/Do not resend it/u)).toHaveCount(0);
});

test('blocks external activation when EBS connector truth is unverified', async ({ page }) => {
  const evidence = await mockWorkplaceSafety(page, { unverifiedEbs: true });
  await page.goto('/workplace/admin/safety');
  const admin = page.getByRole('main');
  await admin.getByRole('button', { name: 'New incident' }).click();
  await admin.getByRole('textbox', { name: 'Site ID' }).fill(SAFETY_IDS.site);
  await admin.getByRole('textbox', { name: 'Floor IDs' }).fill(SAFETY_IDS.floor);
  await admin.getByRole('textbox', { name: 'Incident message' }).fill('Evacuate now.');
  await admin.getByRole('textbox', { name: 'Required safety action' }).fill('Use the marked exit.');
  await admin.getByRole('checkbox', { name: 'Emergency broadcast system' }).check();
  await admin.getByRole('checkbox', { name: /governed activation preview request/i }).check();
  await admin.getByRole('button', { name: 'Preview audience and delivery' }).click();
  await expect(admin.getByText('EBS_PROVIDER_UNVERIFIED')).toBeVisible();
  await admin
    .getByRole('checkbox', { name: /confirm activation for the current deduplicated audience/i })
    .check();
  await expect(admin.getByRole('button', { name: 'Activate incident' })).toBeDisabled();
  expect(evidence.postPaths.filter((path) => path.endsWith('/incidents'))).toHaveLength(0);
});

test('keeps read-only safety administration fail-closed', async ({ page }) => {
  await mockWorkplaceSafety(page, { readOnly: true });
  await page.goto('/workplace/admin/safety');
  await expect(page.getByRole('button', { name: 'New incident' })).toBeDisabled();
  const inspector = await openAdminIncident(page);
  await expect(inspector.getByText(/cannot issue commands/u)).toBeVisible();
  const closure = section(inspector, 'Two-person closure');
  await closure.getByRole('button').first().click();
  await closure.getByRole('checkbox', { name: /closure impact preview request/i }).check();
  await expect(closure.getByRole('button', { name: 'Preview closure impact' })).toBeDisabled();
});

for (const entry of [
  { width: 390, locale: 'ko' as const },
  { width: 320, locale: 'en' as const },
]) {
  test(`keeps the ${entry.width}px ${entry.locale} command-center inspector accessible`, async ({
    page,
  }, testInfo) => {
    await mockWorkplaceSafety(page, { locale: entry.locale });
    if (entry.width === 390) {
      await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
    }
    await page.setViewportSize({ width: entry.width, height: 844 });
    const inspector = await openAdminIncident(page, true, entry.locale);
    await expect(
      inspector.getByRole('heading', {
        name: entry.locale === 'ko' ? '원천별 대상 Coverage' : 'Audience coverage by source',
      })
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      entry.width
    );
    await expectNoSeriousAccessibilityViolations(page);
    await page.screenshot({
      path: testInfo.outputPath(`screen20-safety-admin-${entry.locale}-${entry.width}.png`),
      fullPage: true,
    });
  });
}
