import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  CATALOG_ACTIONS,
  CATALOG_AGENTS,
  mockDwaionCatalogs,
} from './support/dwaion-catalog-fixtures';
import { ASK_RUNTIME_FIXTURE } from './support/runtime-access';

async function checkOverflow(page: Page, selector: string) {
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  const overflow = await page
    .locator(selector)
    .locator('button, a, h1, h2, h3, p, dd')
    .evaluateAll((elements) =>
      elements
        .filter(
          (element) => element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 2
        )
        .map((element) => element.textContent)
    );
  expect(overflow).toEqual([]);
}

test('agent inspector displays real metadata and limits, then launches an opaque question for the selected agent', async ({
  page,
}) => {
  await mockDwaionCatalogs(page, { locale: 'en' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const requests: Record<string, unknown>[] = [];
  await page.route('**/api/agent/v1/ask/stream', (route) => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({
      contentType: 'text/event-stream',
      body: `event: result\ndata: ${JSON.stringify({ data: ASK_RUNTIME_FIXTURE })}\n\n`,
    });
  });
  await page.goto('/dwaion/agents');
  await page.getByRole('button', { name: 'View capabilities', exact: true }).click();
  const inspector = page.getByRole('complementary', { name: 'Capabilities and review boundaries' });
  await expect(inspector).toContainText('Approval review assistant');
  await expect(inspector).toContainText('2026.09.2');
  await expect(inspector).toContainText('Does not approve, reject, reassign');
  await expect(inspector).toContainText('ACTION.APPROVAL_TASK:VIEW');
  await expect(inspector).toContainText('ADMIN.APPROVAL_OPERATIONS:VIEW');
  await expect(inspector).toContainText(
    'Approval data is read only within current approval permissions'
  );
  await inspector
    .getByRole('button', {
      name: 'Summarize the status and deadline risks of approvals I should review.',
      exact: true,
    })
    .click();
  await expect(page).toHaveURL('/dwaion/new?agent=DWP_APPROVAL_EXPERT');
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0]).toMatchObject({
    agentKey: 'DWP_APPROVAL_EXPERT',
    query: 'Summarize the status and deadline risks of approvals I should review.',
  });
  expect(page.url()).not.toContain('Summarize');
  expect(new URL(page.url()).searchParams.has('q')).toBe(false);
});

test('failed launch preserves selection and supports retry without exposing the question in the URL', async ({
  page,
}) => {
  await mockDwaionCatalogs(page, { locale: 'en' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  let fail = true;
  let launches = 0;
  await page.route('**/api/agent/v1/question-launches', (route) => {
    launches += 1;
    return fail
      ? route.fulfill({ status: 503, json: { detail: 'Unavailable' } })
      : route.fallback();
  });
  await page.goto('/dwaion/agents?agent=DWP_ASSISTANT');
  const question = page.getByRole('button', {
    name: 'Summarize the work and deadline risks I should review today.',
    exact: true,
  });
  await question.click();
  await expect(page.getByRole('alert')).toContainText('Your agent and question are still selected');
  await expect(page).toHaveURL('/dwaion/agents?agent=DWP_ASSISTANT');
  await expect(question).toBeEnabled();
  fail = false;
  await question.click();
  await expect(page).toHaveURL('/dwaion/new');
  expect(launches).toBe(2);
});

test('only permitted recognized agents are shown and unavailable selections never select another agent', async ({
  page,
}) => {
  await mockDwaionCatalogs(page, {
    locale: 'en',
    approval: false,
    agents: [
      ...CATALOG_AGENTS,
      { ...CATALOG_AGENTS[0], entryKey: 'PRIVATE_AGENT', name: 'Private registry configuration' },
    ],
  });
  await page.goto('/dwaion/agents?agent=DWP_APPROVAL_EXPERT');
  await expect(
    page.getByText('The selected item is unavailable in the current catalog.')
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'General workplace guide', exact: true })
  ).toBeVisible();
  await expect(page.getByText('Approval review assistant', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Private registry configuration')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start conversation', exact: true })).toHaveCount(
    0
  );
});

test('changing the selected agent cancels navigation from a late question ticket', async ({
  page,
}) => {
  await mockDwaionCatalogs(page, { locale: 'en' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested = false;
  await page.route('**/api/agent/v1/question-launches', async (route) => {
    requested = true;
    await held;
    return route.fallback();
  });
  await page.goto('/dwaion/agents?agent=DWP_ASSISTANT');
  await page
    .getByRole('button', {
      name: 'Summarize the work and deadline risks I should review today.',
      exact: true,
    })
    .click();
  await expect.poll(() => requested).toBe(true);
  await page.getByRole('button', { name: 'View capabilities', exact: true }).click();
  const receipt = page.waitForResponse('**/api/agent/v1/question-launches');
  release();
  await receipt;
  await expect(page).toHaveURL('/dwaion/agents?agent=DWP_APPROVAL_EXPERT');
  await expect(
    page.getByRole('complementary', { name: 'Capabilities and review boundaries' })
  ).toContainText('Approval review assistant');
});

test('each supported action exposes its own mode, risk, input fields, and final app boundary', async ({
  page,
}) => {
  await mockDwaionCatalogs(page, { locale: 'en' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/dwaion/actions');
  for (const [index, action] of CATALOG_ACTIONS.entries()) {
    await page.getByRole('button', { name: 'View capabilities', exact: true }).nth(index).click();
    const inspector = page.getByRole('complementary', { name: 'Action and responsible app' });
    await expect(inspector.getByRole('heading', { level: 2 })).toHaveText(action.title);
    await expect(inspector.locator('dl')).toContainText(action.requiredPermission);
    await expect(inspector.locator('dl')).toContainText(action.riskTier);
    await expect(inspector.locator('dl')).toContainText(
      action.mode === 'APPROVAL_HANDOFF' ? 'Open approval request' : 'Open responsible app'
    );
    await expect(inspector.getByRole('listitem')).toHaveCount(action.inputFields.length);
    await expect(
      inspector.getByRole('button', { name: 'Open responsible app', exact: true })
    ).toBeEnabled();
    expect(new URL(page.url()).pathname).toBe('/dwaion/actions');
  }
});

test('action selection shows the contract and only the explicit CTA opens the app without a fabricated handoff', async ({
  page,
}) => {
  await mockDwaionCatalogs(page, { locale: 'en' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  let previews = 0;
  page.on('request', (request) => {
    if (request.url().includes('/preview')) previews += 1;
  });
  await page.goto('/dwaion/actions');
  await page.getByRole('button', { name: 'View capabilities', exact: true }).nth(1).click();
  await expect(page).toHaveURL('/dwaion/actions?action=MAIL.DRAFT.CREATE');
  const inspector = page.getByRole('complementary', { name: 'Action and responsible app' });
  await expect(inspector).toContainText('APP.MAIL:CREATE');
  await expect(inspector).toContainText('Required in the responsible app');
  await expect(inspector.getByRole('list')).toContainText('Recipients');
  await expect(inspector).toContainText('This catalog does not transfer work content');
  await inspector.getByRole('button', { name: 'Open responsible app', exact: true }).click();
  await expect(page).toHaveURL('/mail/inbox?compose=open');
  expect(previews).toBe(0);
  expect(await page.evaluate(() => window.history.state?.usr?.dwaionHandoff ?? null)).toBeNull();
  await page.goBack();
  await expect(page).toHaveURL('/dwaion/actions?action=MAIL.DRAFT.CREATE');
  await expect(
    page.getByRole('complementary', { name: 'Action and responsible app' })
  ).toContainText('APP.MAIL:CREATE');
});

test('an unrecognized action target cannot navigate and catalog errors are recoverable', async ({
  page,
}) => {
  await mockDwaionCatalogs(page, {
    locale: 'en',
    actions: [{ ...CATALOG_ACTIONS[0], targetRoute: '//external.example/work' }],
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/dwaion/actions?action=CALENDAR.EVENT.CREATE');
  await expect(
    page.getByText('The responsible app route could not be verified. Reload the catalog.')
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Open responsible app', exact: true })
  ).toBeDisabled();
});

for (const catalog of ['agents', 'actions'] as const) {
  test(`${catalog} keeps failures distinct from empty and retries safely`, async ({ page }) => {
    await mockDwaionCatalogs(page, { locale: 'en', agents: [], actions: [] });
    const api =
      catalog === 'agents'
        ? '**/api/platform/v1/catalog/registry-entries?**'
        : '**/api/agent/v1/actions';
    let fail = true;
    await page.route(api, (route) =>
      fail ? route.fulfill({ status: 403, json: { detail: 'Forbidden' } }) : route.fallback()
    );
    await page.goto(`/dwaion/${catalog}`);
    await expect(
      page
        .getByTestId(`dwaion-${catalog}`)
        .getByRole('alert')
        .filter({ hasText: 'You do not have access' })
    ).toContainText('You do not have access to this catalog', { timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'View capabilities', exact: true })).toHaveCount(
      0
    );
    fail = false;
    await page
      .getByTestId(`dwaion-${catalog}`)
      .getByRole('button', { name: 'Retry', exact: true })
      .click();
    await expect(page.getByTestId(`dwaion-${catalog}`).getByRole('alert')).toHaveCount(
      catalog === 'actions' ? 1 : 0
    );
    await expect(page.getByTestId(`dwaion-${catalog}`)).toContainText(
      catalog === 'agents' ? 'No agents are available' : 'No work actions are currently available'
    );
  });
}

for (const view of [
  { width: 1440, height: 1000, name: 'desktop', locale: 'ko' },
  { width: 1280, height: 900, name: 'desktop-en', locale: 'en' },
  { width: 390, height: 844, name: 'mobile', locale: 'ko' },
  { width: 320, height: 740, name: 'small-mobile', locale: 'en' },
  { width: 1280, height: 900, name: 'dark', locale: 'ko', dark: true },
  { width: 640, height: 900, name: 'zoom-200', locale: 'en', zoom: true },
  { width: 390, height: 844, name: 'forced-colors', locale: 'ko', forced: true },
] as const) {
  for (const catalog of ['agents', 'actions'] as const) {
    test(`${catalog} responsive inspector, keyboard, axe and overflow ${view.name}`, async ({
      page,
    }, testInfo) => {
      const consoleErrors: string[] = [];
      const failedResponses: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      page.on('response', (response) => {
        if (response.status() >= 400)
          failedResponses.push(`${response.status()} ${response.url()}`);
      });
      await page.setViewportSize({ width: view.width, height: view.height });
      await mockDwaionCatalogs(page, { locale: view.locale, dark: 'dark' in view });
      if ('forced' in view) await page.emulateMedia({ forcedColors: 'active' });
      const catalogLoaded = page.waitForResponse(
        (response) =>
          response.status() === 200 &&
          response
            .url()
            .includes(catalog === 'agents' ? '/catalog/registry-entries?' : '/agent/v1/actions')
      );
      await page.goto(`/dwaion/${catalog}`);
      await catalogLoaded;
      if (catalog === 'agents') {
        const inspect = page.getByRole('button', {
          name: view.locale === 'ko' ? '지원 범위 보기' : 'View capabilities',
          exact: true,
        });
        await expect(inspect).toBeVisible();
        if ('zoom' in view)
          await page.evaluate(() => {
            document.documentElement.style.fontSize = '200%';
          });
        await checkOverflow(page, '[data-testid="dwaion-agents"]');
        await page.screenshot({
          path: testInfo.outputPath(`agents-${view.name}-list.png`),
          fullPage: true,
          animations: 'disabled',
        });
        await inspect.focus();
        await expect(inspect).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL(/agent=DWP_APPROVAL_EXPERT/);
        const selectedName =
          CATALOG_AGENTS[1].agentCatalogProfile?.displayName[view.locale] ?? CATALOG_AGENTS[1].name;
        await expect(
          page.getByRole('heading', { name: selectedName, exact: true }).first()
        ).toBeVisible();
        if (view.width >= 1200) {
          const inspector = page.getByRole('complementary', {
            name:
              view.locale === 'ko' ? '지원 범위와 검토 경계' : 'Capabilities and review boundaries',
          });
          await expect(inspector).toContainText('ACTION.APPROVAL_TASK:VIEW');
        }
        const controls = await page
          .getByTestId('dwaion-agents')
          .getByRole('button')
          .evaluateAll((buttons) =>
            buttons
              .filter(
                (button) =>
                  button.getBoundingClientRect().height > 0 &&
                  button.getBoundingClientRect().height < 43.5
              )
              .map((button) => button.textContent)
          );
        expect(controls).toEqual([]);
        const axe = await new AxeBuilder({ page })
          .include('[data-testid="dwaion-agents"]')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        expect(axe.violations).toEqual([]);
        await page.screenshot({
          path: testInfo.outputPath(`agents-${view.name}-detail.png`),
          fullPage: true,
          animations: 'disabled',
        });
        await expect(page.locator('vite-error-overlay')).toHaveCount(0);
        expect({ consoleErrors, failedResponses }).toEqual({
          consoleErrors: [],
          failedResponses: [],
        });
        return;
      }
      const inspect = page
        .getByRole('button', {
          name: view.locale === 'ko' ? '지원 범위 보기' : 'View capabilities',
          exact: true,
        })
        .first();
      await expect(inspect).toBeVisible();
      if ('zoom' in view)
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '200%';
        });
      await checkOverflow(page, `[data-testid="dwaion-${catalog}"]`);
      await page.screenshot({
        path: testInfo.outputPath(`${catalog}-${view.name}-list.png`),
        fullPage: true,
        animations: 'disabled',
      });
      await inspect.focus();
      await expect(inspect).toBeFocused();
      await page.keyboard.press('Enter');
      const inspector = page.getByRole(view.width >= 1200 ? 'complementary' : 'dialog', {
        name:
          catalog === 'agents'
            ? view.locale === 'ko'
              ? '지원 범위와 검토 경계'
              : 'Capabilities and review boundaries'
            : view.locale === 'ko'
              ? '행동과 담당 앱'
              : 'Action and responsible app',
      });
      await expect(inspector).toBeVisible();
      await expect(inspector.getByRole('heading', { level: 2 })).toHaveText(
        CATALOG_ACTIONS[0].title
      );
      await checkOverflow(
        page,
        view.width >= 1200 ? `[data-testid="dwaion-${catalog}"]` : '[role="dialog"]'
      );
      const controls = await inspector
        .getByRole('button')
        .evaluateAll((buttons) =>
          buttons
            .filter((button) => button.getBoundingClientRect().height < 43.5)
            .map((button) => button.textContent)
        );
      expect(controls).toEqual([]);
      const axe = await new AxeBuilder({ page })
        .include(view.width >= 1200 ? `[data-testid="dwaion-${catalog}"]` : '[role="dialog"]')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(axe.violations).toEqual([]);
      await page.screenshot({
        path: testInfo.outputPath(`${catalog}-${view.name}-detail.png`),
        fullPage: true,
        animations: 'disabled',
      });
      if (view.width < 1200) {
        await inspector.getByRole('button').last().scrollIntoViewIfNeeded();
        await page.screenshot({
          path: testInfo.outputPath(`${catalog}-${view.name}-detail-actions.png`),
          animations: 'disabled',
        });
        const close = inspector.getByRole('button', {
          name: view.locale === 'ko' ? '상세 닫기' : 'Close details',
          exact: true,
        });
        await close.focus();
        await page.keyboard.press('Shift+Tab');
        expect(
          await inspector.evaluate((element) => element.contains(document.activeElement))
        ).toBe(true);
        await page.keyboard.press('Escape');
        await expect(inspector).toHaveCount(0);
        await expect(inspect).toBeFocused();
      } else {
        await inspector
          .getByRole('button', {
            name: view.locale === 'ko' ? '상세 닫기' : 'Close details',
            exact: true,
          })
          .click();
      }
      expect(new URL(page.url()).search).toBe('');
    });
  }
}
