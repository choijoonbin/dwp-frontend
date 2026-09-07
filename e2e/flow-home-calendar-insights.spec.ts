import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  FULL_PRODUCT_PERMISSIONS,
  createHomeOverviewFixture,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';

type InsightState = 'unavailable' | 'restricted' | 'empty';
type Locale = 'en' | 'ko';

const messages = {
  en: {
    unavailable: 'Calendar insights are temporarily unavailable.',
    restricted: 'Calendar insights are outside your current access.',
    empty: 'No calendar insight is available yet.',
    retry: 'Try again',
  },
  ko: {
    unavailable: '캘린더 인사이트를 일시적으로 불러올 수 없습니다.',
    restricted: '현재 권한으로 캘린더 인사이트를 볼 수 없습니다.',
    empty: '아직 확인할 수 있는 캘린더 인사이트가 없습니다.',
    retry: '다시 시도',
  },
} as const;

async function mockInsightState(page: Page, locale: Locale, state: InsightState) {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale,
    permissions: FULL_PRODUCT_PERMISSIONS,
    appearance: { mode: 'light', density: 'standard', highContrast: false, reduceMotion: true },
  });
  const overview = createHomeOverviewFixture(['WORKSPACE_MEMBER']);
  let recovered = false;
  let overviewRequests = 0;
  await page.route('**/api/platform/v1/home/overview**', (route) => {
    overviewRequests += 1;
    return fulfillSuccess(
      route,
      recovered
        ? overview
        : {
            ...overview,
            calendar: {
              ...overview.calendar,
              status:
                state === 'unavailable'
                  ? 'UNAVAILABLE'
                  : state === 'restricted'
                    ? 'FORBIDDEN'
                    : 'AVAILABLE',
              data: null,
            },
          }
    );
  });
  await page.route('**/api/platform/v1/home-experience', (route) =>
    fulfillSuccess(route, {
      headline: null,
      subheadline: null,
      localizedContent: {},
      defaultLocale: locale,
      backgroundPosition: 'RIGHT',
      overlayOpacity: 18,
      backgroundUrl: null,
      launchpadConfiguration: { schemaVersion: 1, groups: [], placements: [] },
      compositionPolicy: {
        schemaVersion: 3,
        experienceVariant: 'FLOW_V1',
        personalCustomizationEnabled: true,
        governedZones: [],
      },
      effectiveExperienceVariant: 'FLOW_V1',
      advancedPersonalizationEnabled: false,
      composerEnabled: false,
      homePreferenceStore: 'LEGACY',
      version: 7,
    })
  );
  await page.route('**/api/platform/v1/home-preferences**', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return fulfillSuccess(route, {
      schemaVersion: 5,
      surfaceKey: 'workspace-home',
      customized: false,
      layout: { appLayout: null, presentation: 'balanced', widgets: [] },
      version: 0,
    });
  });
  return {
    recover: () => {
      recovered = true;
    },
    requestCount: () => overviewRequests,
  };
}

async function expectDescendantTextFits(widget: Locator) {
  const overflow = await widget.evaluate((root) => {
    const bounds = root.getBoundingClientRect();
    return Array.from(root.querySelectorAll<HTMLElement>('.MuiTypography-root'))
      .filter((element) => element.getBoundingClientRect().width > 0)
      .flatMap((element) => {
        const rect = element.getBoundingClientRect();
        const exceedsOwnWidth =
          element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 1;
        const exceedsWidget = rect.left < bounds.left - 1 || rect.right > bounds.right + 1;
        return exceedsOwnWidth || exceedsWidget
          ? [
              {
                text: element.textContent,
                width: element.clientWidth,
                scrollWidth: element.scrollWidth,
              },
            ]
          : [];
      });
  });
  expect(overflow, 'Visible descendant text must fit, even if the outer widget fits').toEqual([]);
}

test.use({ viewport: { width: 320, height: 900 } });

for (const locale of ['en', 'ko'] as const) {
  for (const state of ['unavailable', 'restricted', 'empty'] as const) {
    test(`calendar insights ${state} fits 320px at 200% text in ${locale}`, async ({ page }) => {
      const server = await mockInsightState(page, locale, state);
      await page.goto('/');
      const widgets = page.locator('[data-calendar-insight-widget]');
      await expect(widgets).toHaveCount(2);
      await page.evaluate(() => {
        document.documentElement.style.setProperty('font-size', '200%', 'important');
        window.dispatchEvent(new Event('resize'));
      });
      await expect(page.locator('[data-flow-large-text]')).toHaveAttribute(
        'data-flow-large-text',
        'true'
      );
      await expect
        .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).fontSize))
        .toBe('32px');

      for (const widget of await widgets.all()) {
        await expect(widget).toHaveAttribute('data-calendar-insight-state', state);
        const status = widget.getByRole(state === 'unavailable' ? 'alert' : 'status');
        const message = status.getByText(messages[locale][state], { exact: true });
        await expect(message).toBeVisible();
        await expect(widget.locator('[data-calendar-insight-value]')).toHaveCount(0);
        await expect(widget.locator('[data-calendar-insight-open]')).toHaveCount(0);
        await expectDescendantTextFits(widget);

        const retry = status.getByRole('button', { name: messages[locale].retry, exact: true });
        if (state === 'unavailable') {
          await expect(retry).toBeVisible();
          const messageBounds = await message.boundingBox();
          const retryBounds = await retry.boundingBox();
          expect(messageBounds).not.toBeNull();
          expect(retryBounds).not.toBeNull();
          expect(retryBounds!.y).toBeGreaterThanOrEqual(messageBounds!.y + messageBounds!.height);
          expect(retryBounds!.height).toBeGreaterThanOrEqual(44);
        } else {
          await expect(retry).toHaveCount(0);
        }
      }

      if (state === 'unavailable') {
        const requestsBeforeRetry = server.requestCount();
        server.recover();
        const retry = widgets
          .first()
          .getByRole('button', { name: messages[locale].retry, exact: true });
        await retry.focus();
        await expect(retry).toBeFocused();
        await retry.press('Enter');
        await expect.poll(server.requestCount).toBeGreaterThan(requestsBeforeRetry);
        for (const widget of await widgets.all()) {
          await expect(widget).toHaveAttribute('data-calendar-insight-state', 'available');
          await expect(widget.locator('[data-calendar-insight-open]')).toHaveAttribute(
            'href',
            '/calendar/insights'
          );
          await expectDescendantTextFits(widget);
        }
      }
    });
  }
}
