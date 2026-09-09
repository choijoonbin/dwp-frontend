import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';
import { mockShellSession } from './support/shell-session';
import { withMeetingDocumentCapture } from './support/meeting-document-capture';
import {
  mockMeetingVisualSession,
  mockMeetingVisualPublishedRecap,
} from './support/video-meeting-visual-fixtures';
import {
  PERSONAL_ROOM,
  PERSONAL_ROOM_PATH,
  mockPersonalRoom,
  readPersonalRoomBrowserEvidence,
} from './support/meeting-personal-room-fixtures';
import en from '../libs/shared-i18n/src/locales/en/meetings.json' with { type: 'json' };

for (const width of [320, 390]) {
  for (const locale of ['ko', 'en'] as const) {
    test(`library favorite stays in its own touch column at ${width}px ${locale}`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 844 });
      await mockMeetingVisualSession(page, { locale, reducedMotion: true });
      await mockMeetingVisualPublishedRecap(page);
      await page.goto('/meetings/history');
      const header = page.getByTestId('meeting-library-row-header').first();
      const favorite = header.getByRole('button');
      await expect(favorite).toBeEnabled();
      const bounds = await header.evaluate((element) => {
        const row = element.getBoundingClientRect();
        const button = element.querySelector('button')!.getBoundingClientRect();
        const metadata = element.firstElementChild!.getBoundingClientRect();
        return {
          top: button.top - row.top,
          width: button.width,
          height: button.height,
          overlap: metadata.right - button.left,
          right: button.right - row.right,
        };
      });
      expect(bounds.top).toBeLessThanOrEqual(1);
      expect(bounds.width).toBeGreaterThanOrEqual(44);
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      expect(bounds.overlap).toBeLessThanOrEqual(0);
      expect(bounds.right).toBeLessThanOrEqual(1);
      const pressed = await favorite.getAttribute('aria-pressed');
      await favorite.click();
      await expect(favorite).toHaveAttribute('aria-pressed', pressed === 'true' ? 'false' : 'true');
      await noOverflow(page);
      await accessible(page);
      await page.screenshot({ path: info.outputPath(`U07-header-${width}-${locale}.png`) });
    });

    test(`personal invitation action preserves whole words at ${width}px ${locale}`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 844 });
      const state = await mockPersonalRoom(page, { locale });
      await page.goto(PERSONAL_ROOM_PATH);
      await expect(
        page.getByRole('heading', { level: 1, name: PERSONAL_ROOM.name, exact: true })
      ).toBeVisible();
      const label = locale === 'ko' ? '초대 문구 복사' : 'Copy invitation';
      const copy = page.getByRole('button', { name: label, exact: true });
      const geometry = await copy.evaluate((element) => {
        const button = element.getBoundingClientRect();
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const words: { text: string; lines: number; escaped: boolean }[] = [];
        while (walker.nextNode()) {
          const node = walker.currentNode;
          for (const match of (node.textContent ?? '').matchAll(/\S+/gu)) {
            const range = document.createRange();
            range.setStart(node, match.index);
            range.setEnd(node, match.index + match[0].length);
            const rects = [...range.getClientRects()];
            words.push({
              text: match[0],
              lines: rects.length,
              escaped: rects.some((r) => r.left < button.left - 1 || r.right > button.right + 1),
            });
          }
        }
        return { width: button.width, height: button.height, words };
      });
      expect(geometry.width).toBeGreaterThanOrEqual(44);
      expect(geometry.height).toBeGreaterThanOrEqual(44);
      expect(geometry.words.map((word) => word.text)).toEqual(label.split(' '));
      for (const word of geometry.words) {
        expect(word.lines, word.text).toBe(1);
        expect(word.escaped, word.text).toBe(false);
      }
      await copy.click();
      const evidence = await readPersonalRoomBrowserEvidence(page);
      expect(evidence.clipboard).toContain(PERSONAL_ROOM.name);
      expect(evidence.clipboard).toContain(`revision=${PERSONAL_ROOM.invitationRevision}`);
      expect(evidence.mediaCalls).toBe(0);
      expect(state.commands).toEqual([]);
      await noOverflow(page);
      await accessible(page);
      await page.screenshot({ path: info.outputPath(`U11-actions-${width}-${locale}.png`) });
    });
  }
}

const templateId = '88000000-0000-4000-8000-000000000001';
const template = {
  templateId,
  scope: 'PERSONAL',
  name: 'Release decision',
  purpose: 'Choose the release date and agree on the next steps.',
  category: 'DECISION',
  durationMinutes: 45,
  agendaItems: [
    {
      title: 'Review evidence',
      description: 'Consider open risks',
      role: 'Host',
      durationMinutes: 15,
    },
    {
      title: 'Decide next steps',
      description: 'Agree on the release criteria',
      role: 'Team',
      durationMinutes: 20,
    },
    {
      title: 'Confirm responsibilities',
      description: 'Review actions together',
      role: 'Team',
      durationMinutes: 10,
    },
  ],
  favorite: true,
  canEdit: true,
  version: 2,
  updatedAt: '2026-09-04T01:00:00Z',
};
const preferences = {
  displayName: 'Mina Kim',
  microphoneOff: true,
  cameraOff: true,
  prejoinEnabled: true,
  reminderEnabled: true,
  reminderMinutes: 10,
  recapNotifications: true,
  version: 0,
  updatedAt: null,
};
const success = (route: Route, data: unknown) =>
  route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', success: true, message: 'OK', data }),
  });
async function session(page: Page) {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    userId: 42,
    locale: 'en',
    permissions: ['VIEW', 'CREATE', 'UPDATE'].map((permissionCode) => ({
      resourceType: 'APP',
      resourceKey: 'APP.MEETINGS',
      permissionCode,
      effect: 'ALLOW',
    })),
  });
  await page.addInitScript(() => {
    let calls = 0;
    Object.defineProperty(window, '__meetingMediaCalls', { get: () => calls });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        enumerateDevices: async () => [],
        getSupportedConstraints: () => ({}),
        getUserMedia: async () => {
          calls += 1;
          throw new DOMException('Not allowed', 'NotAllowedError');
        },
      },
    });
  });
  await page.route('**/api/meetings/v1/templates**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/apply'))
      return success(route, {
        sourceTemplateId: templateId,
        sourceTemplateVersion: 2,
        title: template.name,
        purpose: template.purpose,
        durationMinutes: template.durationMinutes,
        agendaItems: template.agendaItems,
        accessScope: 'INVITED',
        waitingRoomEnabled: true,
        defaultMicrophoneEnabled: false,
        defaultCameraEnabled: false,
        requiresPolicyRevalidation: true,
      });
    if (path.endsWith('/' + templateId)) return success(route, template);
    return success(route, { items: [template], total: 1, page: 0, pageSize: 30 });
  });
  await page.route('**/api/meetings/v1/preferences', (route) => success(route, preferences));
  await page.route('**/api/meetings/v1/schedule-draft', (route) =>
    success(route, {
      draft: null,
      discardOnly: false,
      draftId: null,
      version: null,
      retentionUntil: null,
      observedAt: '2026-09-04T01:00:00Z',
    })
  );
  await page.route('**/api/meetings/v1/capabilities', (route) =>
    success(route, {
      available: false,
      provider: 'LIVEKIT',
      unavailableReason: 'PROVIDER_NOT_CONFIGURED',
      maximumParticipants: 100,
    })
  );
}
async function noOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth - innerWidth,
    main: (() => {
      const main = document.querySelector<HTMLElement>('#dwp-main-content')!;
      return main.scrollWidth - main.clientWidth;
    })(),
  }));
  expect(overflow.page).toBeLessThanOrEqual(1);
  const overflowingElements =
    overflow.main > 1
      ? await page.locator('#dwp-main-content').evaluate((root) =>
          [...root.querySelectorAll<HTMLElement>('*')]
            .filter((element) => element.scrollWidth > element.clientWidth + 1)
            .map((element) => ({
              tag: element.tagName,
              class: element.className,
              text: element.textContent?.slice(0, 60),
              width: element.clientWidth,
              scroll: element.scrollWidth,
            }))
            .slice(0, 15)
        )
      : [];
  expect(overflow.main, JSON.stringify(overflowingElements)).toBeLessThanOrEqual(1);
}
async function accessible(page: Page) {
  const result = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  expect(
    result.violations.filter((item) => item.impact === 'serious' || item.impact === 'critical')
  ).toEqual([]);
}

test('new user menu routes render actual templates and preferences, never administrator actions', async ({
  page,
}) => {
  await session(page);
  await page.goto('/meetings/templates');
  await expect(page.getByRole('heading', { name: en.templates.title, exact: true })).toBeVisible();
  await expect(page.getByTestId('template-list')).toContainText(template.name);
  await expect(
    page.getByRole('link', {
      name: en.navigation.items.meetings['admin-policies'].label,
      exact: true,
    })
  ).toHaveCount(0);
  const link = page.getByRole('link', {
    name: en.navigation.items.meetings.preferences.label,
    exact: true,
  });
  if (!(await link.isVisible()))
    await page.getByRole('button', { name: en.shell.openNavigation }).click();
  await link.click();
  await expect(page).toHaveURL(/\/meetings\/preferences$/u);
  await expect(
    page.getByRole('heading', { name: en.preferences.title, exact: true })
  ).toBeVisible();
  expect(await page.evaluate(() => Reflect.get(window, '__meetingMediaCalls'))).toBe(0);
});

test('template selection revalidates current source and opens a structured schedule without private URL content', async ({
  page,
}) => {
  await session(page);
  await page.goto('/meetings/templates');
  const apply = page
    .getByRole('button', { name: en.templates.apply, exact: true })
    .filter({ visible: true });
  await apply.click();
  await expect(page).toHaveURL(
    new RegExp(`view=schedule&templateId=${templateId}&templateVersion=2`)
  );
  await expect(page.getByTestId('meeting-schedule-workspace')).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: en.schedule.meetingTitle, exact: true })
  ).toHaveValue(template.name);
  expect(page.url()).not.toContain('Release');
  expect(page.url()).not.toContain('Choose');
  expect(await page.evaluate(() => Reflect.get(window, '__meetingMediaCalls'))).toBe(0);
});

test('preferences persist only account values and revoke visible content after an authorization failure', async ({
  page,
}) => {
  await session(page);
  let body: Record<string, unknown> | null = null;
  let key = '';
  let revoked = false;
  await page.route('**/api/meetings/v1/preferences', async (route) => {
    if (route.request().method() !== 'PUT') return success(route, preferences);
    if (revoked)
      return route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ERROR', success: false, message: 'Forbidden' }),
      });
    body = route.request().postDataJSON() as Record<string, unknown>;
    key = route.request().headers()['idempotency-key'] ?? '';
    return success(route, {
      ...preferences,
      displayName: body.displayName,
      version: 1,
      updatedAt: '2026-09-04T02:00:00Z',
    });
  });
  await page.goto('/meetings/preferences');
  await page
    .getByLabel(en.preferences.join.displayName, { exact: true })
    .fill('Mina — meeting name');
  await page.getByRole('button', { name: en.preferences.save, exact: true }).click();
  await expect(page.getByText(en.preferences.saved, { exact: true })).toBeVisible();
  expect(key).toMatch(/^[a-f0-9-]{36}$/u);
  expect(body).toMatchObject({ expectedVersion: 0, displayName: 'Mina — meeting name' });
  expect(body).not.toHaveProperty('cameraId');
  expect(body).not.toHaveProperty('consent');
  revoked = true;
  await page.getByLabel(en.preferences.join.displayName, { exact: true }).fill('Must disappear');
  await page.getByRole('button', { name: en.preferences.save, exact: true }).click();
  await expect(page.getByText(en.preferences.loadError, { exact: true })).toBeVisible();
  await expect(page.getByLabel(en.preferences.join.displayName, { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => Reflect.get(window, '__meetingMediaCalls'))).toBe(0);
});

// These reviewed implementation snapshots detect regressions, not 100% Stitch fidelity.
// The supplied source archive and original-frame acceptance remain a separate human review.
test('U10 and U12 retain reviewed source blocks and responsive product actions', async ({
  page,
}, testInfo) => {
  test.slow(); // Two complete product journeys, each with independent visual evidence.
  const mobile = testInfo.project.name === 'mobile';
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 960 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await session(page);

  await page.goto('/meetings/templates');
  await expect(page.getByRole('heading', { name: en.templates.title, exact: true })).toBeVisible();
  const catalog = page.getByTestId('template-catalog-card');
  await expect(catalog).toContainText(template.name);
  await expect(catalog).toContainText(en.templates.scopes.PERSONAL);
  await expect(
    page.getByText(en.stitch.templates.recommendationTitle, { exact: true })
  ).toBeVisible();
  if (mobile) {
    const intro = page.getByTestId('template-mobile-intro');
    await expect(intro).toBeVisible();
    await expect(intro).toContainText(en.stitch.templates.bannerTitle);
    expect(await intro.evaluate((element) => getComputedStyle(element).backgroundImage)).toContain(
      'linear-gradient'
    );
    const preview = page.getByTestId('template-mobile-preview');
    await expect(preview.locator('ol > li')).toHaveCount(template.agendaItems.length);
    await expect(preview.getByTestId('template-usage-evidence')).toContainText(
      en.stitch.templates.usageUnavailable
    );
    await expect(
      preview.getByRole('button', { name: en.templates.apply, exact: true })
    ).toBeVisible();
    await expect(
      preview.getByRole('button', { name: en.templates.fullPreview, exact: true })
    ).toBeVisible();
    const navigation = page.getByTestId('meeting-mobile-navigation');
    await expect(navigation).toBeVisible();
    await expect(navigation.getByRole('link')).toHaveCount(5);
    await expect(navigation.getByTestId('meeting-mobile-navigation-templates')).toHaveAttribute(
      'href',
      '/meetings/templates'
    );
    await expect(navigation.getByTestId('meeting-mobile-navigation-templates')).toHaveAttribute(
      'aria-current',
      'page'
    );
  } else {
    const preview = page.getByTestId('template-desktop-preview');
    await expect(preview).toBeVisible();
    await expect(preview.getByTestId('template-overview')).toContainText(
      en.stitch.templates.invited
    );
    await expect(preview.getByTestId('template-governance')).toContainText(
      en.stitch.templates.policyAtBooking
    );
    await expect(preview.locator('ol > li')).toHaveCount(template.agendaItems.length);
    await expect(
      page.getByRole('button', { name: en.stitch.templates.import, exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: en.stitch.templates.share, exact: true })
    ).toBeVisible();
  }
  await noOverflow(page);
  await accessible(page);
  await withMeetingDocumentCapture(page, () =>
    expect
      .soft(page)
      .toHaveScreenshot(`meeting-u10-templates-${mobile ? 'mobile' : 'desktop'}.png`, {
        animations: 'disabled',
        caret: 'hide',
        fullPage: true,
        maxDiffPixelRatio: 0.002,
      })
  );

  await page.goto('/meetings/preferences');
  await expect(
    page.getByRole('heading', { name: en.preferences.title, exact: true })
  ).toBeVisible();
  await expect(page.getByTestId('meeting-device-storage-banner')).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: en.preferences.sections }).getByRole('button')
  ).toHaveCount(5);
  await expect(page.getByRole('meter', { name: en.preferences.audio.level })).toHaveAttribute(
    'aria-valuenow',
    '0'
  );
  await expect(page.locator('#meeting-preferences-video video')).toHaveCount(1);
  await expect(page.getByTestId('meeting-background-options').getByRole('button')).toHaveCount(4);
  const office = page.getByRole('button', {
    name: en.stitch.devices.office,
    exact: true,
  });
  await expect(office).toBeEnabled();
  await office.click();
  await expect(office).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => Reflect.get(window, '__meetingMediaCalls'))).toBe(0);
  await page.getByRole('button', { name: en.stitch.devices.none, exact: true }).click();
  await expect(office).toHaveAttribute('aria-pressed', 'false');
  await expect(
    page.getByRole('button', { name: en.stitch.devices.image, exact: true })
  ).toBeDisabled();
  const blur = page.getByRole('button', { name: en.stitch.devices.blur, exact: true });
  if (testInfo.project.name === 'chromium') {
    await expect(blur).toBeEnabled();
    await blur.click();
    await expect(blur).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => Reflect.get(window, '__meetingMediaCalls'))).toBe(0);
    await page.getByRole('button', { name: en.stitch.devices.none, exact: true }).click();
    await expect(blur).toHaveAttribute('aria-pressed', 'false');
  } else {
    await expect(blur).toBeDisabled();
  }
  await expect(
    page.getByRole('switch', { name: en.stitch.devices.hd, exact: true })
  ).toBeDisabled();
  const diagnostics = page.getByTestId('meeting-device-diagnostics').filter({ visible: true });
  await expect(diagnostics).toContainText(en.stitch.devices.checkRequired);
  await expect(diagnostics.getByText(en.stitch.devices.unmeasured, { exact: true })).toHaveCount(2);
  expect(await page.evaluate(() => Reflect.get(window, '__meetingMediaCalls'))).toBe(0);
  if (mobile) {
    const advanced = page.locator('#meeting-preferences-advanced');
    const privacy = page
      .getByRole('complementary', { name: en.preferences.privacy.title })
      .locator('details');
    const dock = page.getByTestId('meeting-preferences-save-dock');
    await expect(dock).toBeVisible();
    await expect(page.getByTestId('meeting-mobile-navigation')).toHaveCount(0);
    await expect(
      dock.getByRole('button', { name: en.preferences.save, exact: true })
    ).toBeDisabled();
    await expect(
      dock.getByRole('button', { name: en.preferences.reset, exact: true })
    ).toBeEnabled();
    const dockPosition = await dock.evaluate((element) => ({
      position: getComputedStyle(element).position,
      bottom: element.getBoundingClientRect().bottom,
      viewport: innerHeight,
    }));
    expect(dockPosition.position).toBe('fixed');
    expect(Math.abs(dockPosition.bottom - dockPosition.viewport)).toBeLessThanOrEqual(1);
    const sectionOrder = await page.evaluate(() =>
      [
        '#meeting-preferences-audio',
        '#meeting-preferences-video',
        '#meeting-preferences-join',
        '[data-testid="meeting-device-diagnostics"]',
      ].map((selector) => document.querySelector(selector)!.getBoundingClientRect().top)
    );
    expect(sectionOrder).toEqual([...sectionOrder].sort((a, b) => a - b));
    await page
      .getByRole('button', { name: en.preferences.notifications.title, exact: true })
      .click();
    await expect(advanced).toHaveAttribute('open', '');
    await expect(
      page.getByRole('heading', { name: en.preferences.notifications.title, exact: true })
    ).toBeVisible();
    await advanced.locator('summary').click();
    await expect(advanced).not.toHaveAttribute('open', '');
    if ((await privacy.getAttribute('open')) === null) await privacy.locator('summary').click();
    await expect(
      privacy.getByText(en.preferences.privacy.accountTitle, { exact: true })
    ).toBeVisible();
    await privacy.locator('summary').click();
    await expect(privacy).not.toHaveAttribute('open', '');
    await page.getByRole('button', { name: en.preferences.audio.title, exact: true }).click();
    await expect(
      page.getByRole('button', { name: en.preferences.audio.title, exact: true })
    ).toHaveAttribute('aria-current', 'location');
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  } else {
    const main = await page.locator('#meeting-preferences-audio').boundingBox();
    const aside = await diagnostics.boundingBox();
    expect(main!.x + main!.width).toBeLessThan(aside!.x);
    expect(main!.width / aside!.width).toBeGreaterThan(1.8);
    expect(main!.width / aside!.width).toBeLessThan(2.4);
  }
  await noOverflow(page);
  await accessible(page);
  await withMeetingDocumentCapture(page, () =>
    expect
      .soft(page)
      .toHaveScreenshot(`meeting-u12-preferences-${mobile ? 'mobile' : 'desktop'}.png`, {
        animations: 'disabled',
        caret: 'hide',
        fullPage: true,
        maxDiffPixelRatio: 0.002,
      })
  );
});

for (const width of [1440, 1280, 390, 320]) {
  test(`templates and preferences are responsive and accessible at ${width}px`, async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === 'mobile',
      'Explicit viewport matrix runs once in Chromium; mobile device journeys run above.'
    );
    await session(page);
    await page.setViewportSize({ width, height: 960 });
    for (const [path, title] of [
      ['templates', en.templates.title],
      ['preferences', en.preferences.title],
    ]) {
      await page.goto('/meetings/' + path);
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
      await noOverflow(page);
      await accessible(page);
      await page.screenshot({ path: testInfo.outputPath(`${path}-${width}.png`), fullPage: true });
    }
  });
}

test('preferences support keyboard, dark high contrast, reduced motion, and 200 percent content zoom', async ({
  page,
  browserName,
}, testInfo) => {
  await session(page);
  await page.goto('/meetings/preferences');
  await expect(page.getByRole('heading', { name: en.preferences.title })).toBeVisible();
  const name = page.getByLabel(en.preferences.join.displayName, { exact: true });
  await name.focus();
  await expect(name).toBeFocused();
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
  await expect(page.getByRole('switch', { name: en.preferences.join.microphoneOff })).toBeFocused();
  await page.emulateMedia({ colorScheme: 'dark', forcedColors: 'active', reducedMotion: 'reduce' });
  await page.locator('#dwp-main-content').evaluate((element) => {
    (element as HTMLElement).style.zoom = '2';
  });
  await noOverflow(page);
  await accessible(page);
  await page.screenshot({
    path: testInfo.outputPath('preferences-contrast-200-percent.png'),
    fullPage: true,
  });
});
