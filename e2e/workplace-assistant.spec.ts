import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { ASSISTANT_IDS, mockWorkplaceAssistant } from './support/workplace-assistant-fixtures';

import type { Locator, Page } from '@playwright/test';

async function expectNoSeriousAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((item) => ['critical', 'serious'].includes(item.impact ?? ''))
  ).toEqual([]);
}

async function expectNoDocumentOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
    )
  ).toBe(true);
}

async function focusByKeyboard(page: Page, target: Locator) {
  for (let index = 0; index < 120; index += 1) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((element) => element === document.activeElement)) return;
  }
  throw new Error('Keyboard focus did not reach the Workplace Assistant control.');
}

async function createSuggestion(page: Page) {
  await page
    .getByRole('textbox', { name: 'Natural-language request' })
    .fill('Book a nearby desk and parking next Tuesday for our team.');
  await page.getByRole('combobox', { name: 'Verified site' }).click();
  await page.getByRole('option', { name: 'Seoul Workplace' }).click();
  await page
    .getByRole('textbox', { name: 'Command reason' })
    .fill('Generate a reviewable booking proposal');
  await page
    .getByRole('checkbox', {
      name: 'I consent to processing this request for booking suggestions.',
    })
    .check();
  await page
    .getByRole('checkbox', {
      name: 'Allow separately submitted feedback to be considered under tenant policy.',
    })
    .check();
  await page.getByRole('button', { name: 'Create reviewable suggestions' }).click();
  await expect(page).toHaveURL(new RegExp(`request=${ASSISTANT_IDS.request}`));
  await expect(page.getByRole('heading', { name: 'Review proposals' })).toBeVisible();
}

async function validateAndConfirm(page: Page) {
  await page
    .getByRole('textbox', { name: 'Validation reason' })
    .fill('Validate selected suggestions against authoritative availability and policy');
  await page.getByRole('button', { name: 'Validate selected proposals' }).click();
  await expect(page.getByText('All selected items are valid')).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Confirmation reason' })
    .fill('Confirm the reviewed authoritative selection');
  await page
    .getByRole('checkbox', {
      name: 'I reviewed the authority evidence and explicitly confirm these bookings.',
    })
    .check();
  await page.getByRole('button', { name: 'Confirm selected bookings' }).click();
}

test('creates, validates and explicitly confirms an explainable partial booking batch', async ({
  page,
}, testInfo) => {
  const telemetryBodies: string[] = [];
  page.on('request', (request) => {
    if (/observability|telemetry|rum/iu.test(request.url())) {
      telemetryBodies.push(request.postData() ?? '');
    }
  });
  const evidence = await mockWorkplaceAssistant(page);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/workplace/assistant');
  await expect(page.getByRole('heading', { name: 'Workplace booking assistant' })).toBeVisible();
  const beneficiary = page.getByRole('combobox', { name: 'Authorized beneficiary' });
  await expect(beneficiary).toContainText('Workspace Member');
  const target = page.getByRole('combobox', { name: 'Booking beneficiary scope' });
  await target.click();
  await page.getByRole('option', { name: 'One delegated member' }).click();
  await expect(beneficiary).toContainText('Delegated Member');
  await beneficiary.click();
  await expect(page.getByRole('option', { name: /Delegated Member/u })).toBeVisible();
  await expect(page.getByRole('option', { name: /Expired Delegate/u })).toHaveCount(0);
  await page.keyboard.press('Escape');
  const resourceType = page.getByRole('combobox', { name: 'Resource type' });
  await resourceType.click();
  await expect(page.getByRole('option', { name: 'Parking' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await target.click();
  await page.getByRole('option', { name: 'Team members' }).click();
  await beneficiary.click();
  await expect(page.getByRole('option', { name: /Workspace Member/u })).toBeVisible();
  await expect(page.getByRole('option', { name: /Delegated Member/u })).toBeVisible();
  await page.keyboard.press('Escape');
  await target.click();
  await page.getByRole('option', { name: 'Myself' }).click();
  await expect(beneficiary).toContainText('Workspace Member');
  await expect(page.getByRole('textbox', { name: /beneficiary user id/i })).toHaveCount(0);

  const rawPiiMarker = 'private-screen23@example.test';
  await page
    .getByRole('textbox', { name: 'Natural-language request' })
    .fill(`Book a desk for ${rawPiiMarker}`);
  await page
    .getByRole('textbox', { name: 'Command reason' })
    .fill('Attempt an unsafe raw personal-data request');
  await page
    .getByRole('checkbox', {
      name: 'I consent to processing this request for booking suggestions.',
    })
    .check();
  await page.getByRole('button', { name: 'Create reviewable suggestions' }).click();
  await expect(page.getByText(/command was not accepted/i)).toBeVisible();
  expect(evidence.commandPaths).toHaveLength(0);

  await createSuggestion(page);
  await validateAndConfirm(page);

  await expect(page.getByRole('heading', { name: 'Authoritative execution result' })).toBeVisible();
  await expect(page.getByText('1 succeeded · 1 failed · 0 unknown · 0 processing')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'WORKPLACE' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'CALENDAR' })).toBeVisible();

  await page.getByRole('textbox', { name: 'Feedback comment' }).fill('The explanation was useful.');
  await page.getByRole('textbox', { name: 'Command reason' }).fill('Submit reviewed feedback');
  await page
    .getByRole('checkbox', { name: 'Allow this redacted feedback for model improvement' })
    .check();
  await page
    .getByRole('checkbox', { name: 'I explicitly confirm this feedback submission.' })
    .check();
  await page.getByRole('button', { name: 'Submit feedback' }).click();
  await expect(page.getByText('Feedback was stored with an audit record.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit feedback' })).toHaveCount(0);

  expect(evidence.commandPaths).toEqual(
    expect.arrayContaining([
      '/api/platform/v1/workplace/assistant/requests',
      `/api/platform/v1/workplace/assistant/requests/${ASSISTANT_IDS.request}:validate`,
      `/api/platform/v1/workplace/assistant/requests/${ASSISTANT_IDS.request}:confirm`,
      `/api/platform/v1/workplace/assistant/requests/${ASSISTANT_IDS.request}:feedback`,
    ])
  );
  expect(evidence.commandHeaders.every((headers) => Boolean(headers['idempotency-key']))).toBe(
    true
  );
  const createBody = evidence.commandBodies[0] as {
    requestText: string;
    requestedItems: Array<{
      beneficiaryUserId: number;
      beneficiaryPersonPublicId: string;
      delegationGrantId: null;
      siteId: string;
      startsAt: string;
      endsAt: string;
    }>;
  };
  expect(createBody.requestedItems[0]).toMatchObject({
    beneficiaryUserId: 10001,
    beneficiaryPersonPublicId: '23000000-0000-4000-8000-000000000019',
    delegationGrantId: null,
    siteId: ASSISTANT_IDS.site,
    startsAt: '2026-09-18T00:00:00Z',
    endsAt: '2026-09-18T09:00:00Z',
  });
  const sensitiveDraft = createBody.requestText;
  expect(
    await page.evaluate((value) => {
      const storage = `${JSON.stringify(localStorage)}${JSON.stringify(sessionStorage)}`;
      return location.href.includes(value) || storage.includes(value);
    }, sensitiveDraft)
  ).toBe(false);
  const privacyStorage = await page.evaluate(() => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
  }));
  expect(JSON.stringify(privacyStorage)).not.toContain(rawPiiMarker);
  expect(telemetryBodies.join('\n')).not.toContain(rawPiiMarker);
  expect(JSON.stringify(evidence.commandBodies)).not.toContain(rawPiiMarker);
  await expectNoSeriousAccessibilityViolations(page);
  await expectNoDocumentOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('screen23-assistant-user-en-1440.png'),
    fullPage: true,
  });
});

test('keeps RESULT_UNKNOWN confirmation recovery GET-only', async ({ page }) => {
  const evidence = await mockWorkplaceAssistant(page, { resultUnknown: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/workplace/assistant');
  await createSuggestion(page);
  await validateAndConfirm(page);
  await expect(page.getByText(/Do not repeat confirmation/u)).toBeVisible();
  const commandCount = evidence.commandPaths.length;
  const executionReads = evidence.executionGets();
  await page.getByRole('button', { name: 'Recheck original execution' }).click();
  await expect.poll(evidence.executionGets).toBeGreaterThan(executionReads);
  expect(evidence.commandPaths).toHaveLength(commandCount);
  expect(evidence.commandPaths.filter((path) => path.endsWith(':confirm'))).toHaveLength(1);
});

test('shows a replayed pre-batch failure without requesting execution', async ({ page }) => {
  const evidence = await mockWorkplaceAssistant(page, { confirmFailedReplay: true });
  await page.goto('/workplace/assistant');
  await createSuggestion(page);
  await validateAndConfirm(page);
  await expect(page.getByText(/Result VERSION_CONFLICT/u)).toBeVisible();
  await expect(page.getByText(/Original command result replayed/u)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Authoritative execution result' })).toHaveCount(
    0
  );
  expect(evidence.executionGets()).toBe(0);
  expect(evidence.commandPaths.filter((path) => path.endsWith(':confirm'))).toHaveLength(1);
});

test('fails closed when the authoritative beneficiary scope is denied', async ({ page }) => {
  await mockWorkplaceAssistant(page, { beneficiaryDenied: true });
  await page.goto('/workplace/assistant');
  await expect(page.getByText(/beneficiary scope is denied/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create reviewable suggestions' })).toBeDisabled();
});

test('fails closed when the authoritative beneficiary scope is stale', async ({ page }) => {
  await mockWorkplaceAssistant(page, { beneficiaryStale: true });
  await page.goto('/workplace/assistant');
  await expect(page.getByText(/beneficiary scope is stale/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create reviewable suggestions' })).toBeDisabled();
});

test('shows the retention tombstone without reconstructing deleted content', async ({ page }) => {
  await mockWorkplaceAssistant(page, { retained: true });
  await page.goto(`/workplace/assistant?request=${ASSISTANT_IDS.request}`);
  await expect(page.getByText(/were deleted under tenant retention policy/i).first()).toBeVisible();
  await expect(page.getByText(/Book a nearby team desk/u)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Review proposals' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit feedback' })).toHaveCount(0);
});

test('disables model-improvement use when the tenant has not opted in', async ({ page }) => {
  await mockWorkplaceAssistant(page, { tenantOptOut: true });
  await page.goto(`/workplace/assistant?request=${ASSISTANT_IDS.request}`);
  await expect(
    page.getByRole('checkbox', {
      name: 'Allow this redacted feedback for model improvement',
    })
  ).toBeDisabled();
});

test('resets a completed conversation to a private new draft without issuing a command', async ({
  page,
}) => {
  const evidence = await mockWorkplaceAssistant(page);
  await page.goto(`/workplace/assistant?request=${ASSISTANT_IDS.request}`);
  await expect(page.getByRole('heading', { name: 'Review proposals' })).toBeVisible();
  await page.getByRole('button', { name: 'Reset conversation' }).click();
  await expect(page).not.toHaveURL(/(?:\?|&)request=/u);
  await expect(
    page.getByRole('heading', { name: 'Describe the work and booking requirements' })
  ).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Natural-language request' })).toHaveValue('');
  expect(evidence.commandPaths).toEqual([]);
});

test('starts opt-in voice input and keeps its transcript editable before submission', async ({
  page,
}) => {
  await page.addInitScript(() => {
    type SpeechResultEvent = {
      resultIndex: number;
      results: Array<Array<{ transcript: string }>>;
    };
    class TestSpeechRecognition {
      continuous = false;
      interimResults = false;
      lang = '';
      onresult: ((event: SpeechResultEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onend: (() => void) | null = null;

      start() {
        window.setTimeout(() => {
          this.onresult?.({
            resultIndex: 0,
            results: [[{ transcript: 'Book a quiet focus room tomorrow' }]],
          });
          this.onend?.();
        }, 0);
      }

      stop() {
        this.onend?.();
      }

      abort() {
        this.onend?.();
      }
    }
    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true,
      value: TestSpeechRecognition,
    });
  });
  const evidence = await mockWorkplaceAssistant(page);
  await page.goto('/workplace/assistant');
  await page.getByRole('button', { name: 'Voice input' }).click();
  const consentDialog = page.getByRole('dialog', { name: 'Start voice input' });
  await expect(consentDialog).toBeVisible();
  await expect(consentDialog.getByRole('button', { name: 'Start listening' })).toBeDisabled();
  await consentDialog
    .getByRole('checkbox', { name: /understand the voice-processing notice/i })
    .check();
  await consentDialog.getByRole('button', { name: 'Start listening' }).click();
  const request = page.getByRole('textbox', { name: 'Natural-language request' });
  await expect(request).toHaveValue('Book a quiet focus room tomorrow');
  await request.fill('Book a quiet focus room tomorrow near the design team.');
  await expect(request).toHaveValue('Book a quiet focus room tomorrow near the design team.');
  expect(evidence.commandPaths).toEqual([]);
  expect(await page.evaluate(() => location.href)).not.toContain('Book a quiet focus room');
  expect(
    await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))
  ).not.toContain('Book a quiet focus room');
  await page
    .getByRole('textbox', { name: 'Command reason' })
    .fill('Create a reviewable proposal from the reviewed transcript');
  await page
    .getByRole('checkbox', {
      name: 'I consent to processing this request for booking suggestions.',
    })
    .check();
  await request.press('ControlOrMeta+Enter');
  await expect(page).toHaveURL(new RegExp(`request=${ASSISTANT_IDS.request}`));
  expect(evidence.commandPaths).toContain('/api/platform/v1/workplace/assistant/requests');
});

test('updates governed assistant controls with elevation and renders redacted audit evidence', async ({
  page,
}, testInfo) => {
  const evidence = await mockWorkplaceAssistant(page);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/workplace/admin/assistant-governance');
  await expect(page.getByRole('heading', { name: 'Workplace Assistant governance' })).toBeVisible();
  await expect(
    page.getByRole('cell', { name: 'WorkplaceAssistantValidated', exact: true })
  ).toBeVisible();
  await page.getByRole('checkbox', { name: 'Global kill switch' }).check();
  await page
    .getByRole('textbox', { name: 'Command reason' })
    .fill('Pause assistant processing after reviewed tenant impact');
  await page
    .getByRole('checkbox', {
      name: 'I reviewed the tenant-wide impact and explicitly confirm this governance change.',
    })
    .check();
  await page.getByRole('button', { name: 'Apply governance change' }).click();
  await expect(page.getByText(/Command SUCCEEDED/u)).toBeVisible();

  const putIndex = evidence.commandPaths.findIndex((path) => path.endsWith('/governance'));
  expect(evidence.commandHeaders[putIndex]).toMatchObject({
    'x-dwp-active-access-mode': 'ELEVATED',
  });
  expect(evidence.commandBodies[putIndex]).toMatchObject({
    expectedVersion: 3,
    killSwitch: true,
    explicitConfirmation: true,
    reason: 'Pause assistant processing after reviewed tenant impact',
  });
  await expectNoSeriousAccessibilityViolations(page);
  await expectNoDocumentOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('screen23-assistant-admin-en-1440.png'),
    fullPage: true,
  });
});

test('keeps unknown governance updates GET-only and disables resubmission', async ({ page }) => {
  const evidence = await mockWorkplaceAssistant(page, { governanceUnknown: true });
  await page.goto('/workplace/admin/assistant-governance');
  await page.getByRole('checkbox', { name: 'Global kill switch' }).check();
  await page.getByRole('textbox', { name: 'Command reason' }).fill('Pause governed assistant');
  await page
    .getByRole('checkbox', {
      name: 'I reviewed the tenant-wide impact and explicitly confirm this governance change.',
    })
    .check();
  await page.getByRole('button', { name: 'Apply governance change' }).click();
  await expect(page.getByText(/update result is unknown/i)).toBeVisible();
  const commandCount = evidence.commandPaths.length;
  const governanceGets = evidence.governanceGets();
  await page.getByRole('button', { name: 'Refresh governance evidence' }).click();
  await expect.poll(evidence.governanceGets).toBeGreaterThan(governanceGets);
  expect(evidence.commandPaths).toHaveLength(commandCount);
});

for (const entry of [
  { width: 1280, locale: 'ko' as const, route: '/workplace/assistant' },
  { width: 390, locale: 'ko' as const, route: '/workplace/assistant' },
  { width: 320, locale: 'en' as const, route: '/workplace/admin/assistant-governance' },
]) {
  test(`keeps ${entry.width}px ${entry.locale} Assistant evidence accessible and overflow-free`, async ({
    page,
  }, testInfo) => {
    await mockWorkplaceAssistant(page, { locale: entry.locale });
    await page.setViewportSize({ width: entry.width, height: 844 });
    if (entry.width === 1280) await page.emulateMedia({ colorScheme: 'dark' });
    if (entry.width === 390) {
      await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
    }
    await page.goto(entry.route);
    await expect(
      page.getByRole('heading', {
        name: entry.route.includes('/admin/')
          ? entry.locale === 'ko'
            ? '예약 도우미 거버넌스'
            : 'Workplace Assistant governance'
          : entry.locale === 'ko'
            ? '근무공간 예약 도우미'
            : 'Workplace booking assistant',
      })
    ).toBeVisible();
    const target = page.getByRole('textbox', {
      name: entry.route.includes('/admin/')
        ? entry.locale === 'ko'
          ? '승인된 제공자 참조'
          : 'Approved provider reference'
        : entry.locale === 'ko'
          ? '자연어 요청'
          : 'Natural-language request',
    });
    await focusByKeyboard(page, target);
    await expect(target).toBeFocused();
    await expectNoSeriousAccessibilityViolations(page);
    await expectNoDocumentOverflow(page);
    await page.screenshot({
      path: testInfo.outputPath(`screen23-${entry.width}-${entry.locale}.png`),
      fullPage: true,
    });
  });
}

test('keeps read-only and offline commands fail-closed', async ({ page, context }) => {
  await mockWorkplaceAssistant(page, { readOnly: true });
  await page.goto('/workplace/assistant');
  await expect(page.getByText(/current role can review/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create reviewable suggestions' })).toBeDisabled();
  await context.setOffline(true);
  await expect(page.getByText(/You are offline/u)).toBeVisible();
  await context.setOffline(false);

  await page.goto('/workplace/admin/assistant-governance');
  await expect(page.getByRole('button', { name: 'Apply governance change' })).toBeDisabled();
  await expect(page.getByRole('textbox', { name: 'Approved provider reference' })).toBeDisabled();
  await expect(page.getByRole('checkbox', { name: 'Global kill switch' })).toBeDisabled();
  await expect(page.getByRole('combobox', { name: 'Redaction readiness' })).toBeDisabled();
  await expect(page.getByRole('textbox', { name: 'Command reason' })).toBeDisabled();
});
