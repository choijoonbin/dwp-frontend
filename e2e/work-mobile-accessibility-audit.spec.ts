import { expect, test } from '@playwright/test';
import {
  mockWorkHubFoundation,
  WORK_HUB_FIXTURE as fixture,
  personalTaskRoute,
} from './support/work-hub-foundation-fixtures';
import type { Locator, Page } from '@playwright/test';

const reviewRoute =
  '/work/queue?work=IDENTITY_GOVERNANCE%3Af1111111-1111-4111-8111-111111111111%3A';
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
    )
  ).toBe(true);
}
async function ready(page: Page) {
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 15_000 });
}
async function touchTarget(control: Locator) {
  await expect(control).toBeVisible();
  const bounds = await control.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.width).toBeGreaterThanOrEqual(44);
  expect(bounds!.height).toBeGreaterThanOrEqual(44);
}
async function standardDensity(control: Locator) {
  await expect(control).toBeVisible();
  expect((await control.boundingBox())!.height).toBe(38);
}
for (const width of [390, 320]) {
  for (const locale of ['ko', 'en'] as const) {
    test(`${width}px ${locale} exposes six Work views and restores the More focus`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 844 });
      await mockWorkHubFoundation(page, { locale });
      await page.goto('/work/queue');
      await ready(page);
      const nav = page.getByTestId('work-mobile-bottom-navigation');
      const labels =
        locale === 'ko'
          ? ['통합업무함', '오늘 계획', '내 조치', '더보기']
          : ['Inbox', 'Today', 'My actions', 'More'];
      for (const [index, path] of ['queue', 'day-plan', 'action-required'].entries()) {
        await nav.getByRole('button', { name: labels[index], exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`/work/${path}(\\?|$)`));
        await ready(page);
        await expect(nav.getByRole('button', { name: labels[index], exact: true })).toHaveAttribute(
          'aria-current',
          'page'
        );
      }
      const more = nav.getByRole('button', { name: labels[3], exact: true });
      for (const [path, label] of locale === 'ko'
        ? [
            ['in-progress', '진행 중'],
            ['awaiting-response', '응답 대기'],
            ['completed', '완료된 업무'],
          ]
        : [
            ['in-progress', 'In progress'],
            ['awaiting-response', 'Awaiting response'],
            ['completed', 'Completed work'],
          ]) {
        await more.focus();
        await page.keyboard.press('Enter');
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await dialog.getByRole('button', { name: label, exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`/work/${path}(\\?|$)`));
        await expect(dialog).toBeHidden();
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeFocused();
        await noOverflow(page);
      }
      await more.focus();
      await page.keyboard.press('Enter');
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toBeHidden();
      await expect(more).toBeFocused();
      for (const button of await nav.getByRole('button').all()) {
        const box = await button.boundingBox();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
      await page.screenshot({ path: info.outputPath(`navigation-${width}-${locale}.png`) });
    });
  }

  test(`${width}px Work-owned primary controls provide 44px touch targets`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await mockWorkHubFoundation(page);
    await page.goto('/work/queue?q=handover');
    await ready(page);
    const main = page.getByRole('main');
    const filters = main.getByRole('region', { name: 'Unified queue search and filters' });
    const controls = [
      page.getByTestId('work-mobile-navigation-trigger'),
      main.getByRole('button', { name: 'Add personal task', exact: true }),
      filters.getByRole('button', { name: /Today plan/u }),
      filters.getByRole('button', { name: 'Filter and sort', exact: true }),
      main.getByRole('button', { name: 'Select work', exact: true }),
    ];
    for (const control of controls) {
      await expect(control).toBeVisible();
      const bounds = await control.boundingBox();
      expect(bounds!.width).toBeGreaterThanOrEqual(44);
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
    }
    await filters.getByRole('button', { name: 'Filter and sort', exact: true }).click();
    const reset = filters.getByRole('button', { name: 'Reset filters', exact: true });
    await expect(reset).toBeVisible();
    const resetBounds = await reset.boundingBox();
    expect(resetBounds!.width).toBeGreaterThanOrEqual(44);
    expect(resetBounds!.height).toBeGreaterThanOrEqual(44);

    await page.goto('/work/day-plan');
    const plan = page.getByTestId('work-today-plan-page');
    await expect(plan).toBeVisible();
    const saveControls = await plan.getByRole('button', { name: 'Save plan', exact: true }).all();
    expect(saveControls.length).toBeGreaterThan(0);
    for (const save of saveControls) {
      if (!(await save.isVisible())) continue;
      const bounds = await save.boundingBox();
      expect(bounds!.width).toBeGreaterThanOrEqual(44);
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
    }
    await noOverflow(page);
    await page.screenshot({ path: info.outputPath(`work-touch-targets-${width}.png`) });
  });

  test(`${width}px 200 percent drawer, partial source status, and batch receipts retain touch targets`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await mockWorkHubFoundation(page, {
      failServices: true,
      loseFirstMutationResponse: true,
    });
    await page.goto('/work/queue');
    await ready(page);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });

    await touchTarget(page.getByRole('button', { name: 'Try again', exact: true }).first());
    const menu = page.getByTestId('work-mobile-navigation-trigger');
    await touchTarget(menu);
    await menu.click();
    const drawer = page.getByTestId('work-mobile-sidebar');
    await expect(drawer).toBeVisible();
    await touchTarget(drawer.getByRole('button', { name: 'Add personal task', exact: true }));
    await touchTarget(drawer.getByRole('link', { name: 'Back to personal home', exact: true }));
    await noOverflow(page);
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();

    await page.getByRole('button', { name: 'Select work', exact: true }).click();
    const personalSelection = page.getByRole('checkbox', {
      name: `Select ${fixture.personalTitle} for batch processing`,
      exact: true,
    });
    await personalSelection.focus();
    await page.keyboard.press('Space');
    await expect(personalSelection).toBeChecked();
    await page.getByRole('button', { name: 'Complete selected', exact: true }).click();
    const review = page.getByRole('dialog', { name: 'Complete the selected work?', exact: true });
    await review.getByRole('button', { name: 'Complete selected', exact: true }).click();

    const result = page.getByRole('dialog', { name: 'Batch results', exact: true });
    await expect(result).toContainText('Unconfirmed 1');
    await touchTarget(
      result.getByRole('button', {
        name: 'Recheck unconfirmed personal tasks',
        exact: true,
      })
    );
    for (const close of await result.getByRole('button', { name: 'Close', exact: true }).all()) {
      await touchTarget(close);
    }
    await noOverflow(page);
    await result.getByRole('button', { name: 'Close', exact: true }).last().click();

    const inspectSources = page.getByRole('button', { name: 'View source status', exact: true });
    await touchTarget(inspectSources);
    await inspectSources.click();
    const sources = page.getByRole('dialog', { name: 'Work source status', exact: true });
    const reopen = sources.getByRole('button', { name: /View latest batch results/u });
    await touchTarget(reopen);
    await noOverflow(page);
    await reopen.click();
    await expect(result).toBeVisible();
    await touchTarget(
      result.getByRole('button', {
        name: 'Recheck unconfirmed personal tasks',
        exact: true,
      })
    );
    await noOverflow(page);
    await page.screenshot({ path: info.outputPath(`work-mobile-receipt-${width}-200.png`) });
  });
}

test('desktop Work controls retain standard density outside mobile touch media', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'chromium', 'The desktop density contract runs once.');
  await page.setViewportSize({ width: 1280, height: 900 });
  await mockWorkHubFoundation(page, {
    failServices: true,
    loseFirstMutationResponse: true,
  });
  await page.goto('/work/queue');
  await ready(page);
  const main = page.getByRole('main');
  const filters = main.getByRole('region', { name: 'Unified queue search and filters' });
  for (const control of [
    page.getByRole('button', { name: 'Try again', exact: true }).first(),
    main.getByRole('button', { name: 'Add personal task', exact: true }),
    filters.getByRole('button', { name: /Today plan/u }),
    filters.getByRole('button', { name: 'Filter and sort', exact: true }),
    main.getByRole('button', { name: 'Select work', exact: true }),
  ]) {
    await standardDensity(control);
  }

  await main.getByRole('button', { name: 'Select work', exact: true }).click();
  await page
    .getByRole('checkbox', {
      name: `Select ${fixture.personalTitle} for batch processing`,
      exact: true,
    })
    .check();
  await main.getByRole('button', { name: 'Complete selected', exact: true }).click();
  const review = page.getByRole('dialog', { name: 'Complete the selected work?', exact: true });
  await review.getByRole('button', { name: 'Complete selected', exact: true }).click();
  const result = page.getByRole('dialog', { name: 'Batch results', exact: true });
  await standardDensity(
    result.getByRole('button', {
      name: 'Recheck unconfirmed personal tasks',
      exact: true,
    })
  );
  for (const close of await result.getByRole('button', { name: 'Close', exact: true }).all()) {
    await standardDensity(close);
  }
  await result.getByRole('button', { name: 'Close', exact: true }).last().click();
  const inspectSources = page.getByRole('button', { name: 'View source status', exact: true });
  await standardDensity(inspectSources);
  await inspectSources.click();
  await standardDensity(
    page
      .getByRole('dialog', { name: 'Work source status', exact: true })
      .getByRole('button', { name: /View latest batch results/u })
  );
  await noOverflow(page);
});

test('keyboard plan additions and removals move focus to the resulting work control', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await mockWorkHubFoundation(page);
  await page.goto('/work/day-plan');
  const plan = page.getByTestId('work-today-plan-page');
  await expect(plan).toBeVisible();
  const openCandidates = plan.getByRole('button', {
    name: 'Find work to add to the plan',
    exact: true,
  });
  await openCandidates.focus();
  await page.keyboard.press('Enter');
  const picker = page.getByRole('dialog', { name: 'Work to add', exact: true });
  await picker.getByRole('checkbox', { name: fixture.secondaryTitle, exact: true }).check();
  const add = picker.getByRole('button', { name: 'Add selected work (1)', exact: true });
  await add.focus();
  await page.keyboard.press('Enter');
  await expect(picker).not.toBeVisible();
  const added = plan.locator('ol > li').filter({ hasText: fixture.secondaryTitle });
  const title = added.getByRole('button', { name: fixture.secondaryTitle, exact: true });
  await expect(title).toBeFocused();
  const remove = added.getByRole('button', {
    name: `Remove ${fixture.secondaryTitle} from the plan`,
    exact: true,
  });
  await remove.focus();
  await page.keyboard.press('Enter');
  await expect(openCandidates).toBeFocused();
  await noOverflow(page);
  await page.screenshot({ path: info.outputPath('today-plan-keyboard-focus.png') });
});

test('personal edit and M1 decision dialogs restore the triggering control', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockWorkHubFoundation(page, { designDetails: true, accessReview: true });
  await page.goto(personalTaskRoute());
  const personalTitle = page
    .getByRole('article')
    .getByRole('heading', { name: fixture.personalTitle, exact: true });
  await expect(personalTitle).toBeFocused();
  const edit = page.getByRole('article').getByRole('button', { name: 'Edit', exact: true });
  await edit.click();
  await expect(
    page.getByRole('dialog').getByRole('textbox', { name: 'Title', exact: true })
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(edit).toBeFocused();
  await page.goto(reviewRoute);
  await expect(page.getByRole('heading', { name: 'Access review', exact: true })).toBeVisible();
  const rationale = page.getByRole('textbox', { name: 'Decision reason' });
  await page.getByRole('button', { name: 'Revoke access', exact: true }).click();
  await rationale.fill('The current business assignment no longer needs this access.');
  const preview = page.getByRole('button', { name: 'Review decision before submitting' });
  await preview.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(preview).toBeFocused();
  await expect(rationale).toHaveValue(
    'The current business assignment no longer needs this access.'
  );
  await page.screenshot({ path: info.outputPath('M1-preview-focus-return.png') });
});

test('visual viewport keyboard hides Work bottom navigation without losing the M1 reason', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await mockWorkHubFoundation(page, { accessReview: true, designDetails: true, locale: 'ko' });
  await page.goto(reviewRoute);
  const reason = page.getByRole('textbox', { name: '결정 사유' });
  await reason.fill('소속 조직의 업무 변경에 따라 현재 접근 권한을 다시 검토합니다.');
  await reason.focus();
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport!, 'height', {
      configurable: true,
      value: window.innerHeight - 320,
    });
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  await expect(page.getByTestId('work-mobile-bottom-navigation')).toBeHidden();
  await expect(reason).toBeFocused();
  await page.evaluate(() => {
    delete (window.visualViewport as unknown as Record<string, unknown>).height;
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  await expect(page.getByTestId('work-mobile-bottom-navigation')).toBeVisible();
  await expect(reason).toHaveValue(
    '소속 조직의 업무 변경에 따라 현재 접근 권한을 다시 검토합니다.'
  );
  await noOverflow(page);
  await page.screenshot({ path: info.outputPath('M1-keyboard-navigation-restored.png') });
});

test('200 percent Work reflow and forced colors retain visible keyboard actions', async ({
  page,
}, info) => {
  const mobileTextZoom = info.project.name === 'mobile';
  await page.setViewportSize({ width: mobileTextZoom ? 390 : 1280, height: 900 });
  await mockWorkHubFoundation(page, {
    personalTitle:
      '분기별 프로젝트 권한과 인수인계 자료를 검토하여 담당자에게 전달합니다 — Review the complete quarterly handover and project responsibilities',
    highContrast: true,
  });
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await page.goto(personalTaskRoute());
  await page.evaluate((textZoom) => {
    // Mobile WebKit preserves its layout viewport during CSS zoom. Exercise its
    // text enlargement explicitly; Chromium separately verifies page reflow.
    if (textZoom) document.documentElement.style.fontSize = '200%';
    else document.documentElement.style.zoom = '2';
  }, mobileTextZoom);
  const nav = page.getByTestId('work-mobile-bottom-navigation');
  await expect(nav).toBeVisible();
  const action = page
    .getByRole('article')
    .getByRole('button', { name: 'In progress', exact: true });
  await action.focus();
  await action.scrollIntoViewIfNeeded();
  await expect(action).toBeInViewport();
  await expect(action).toBeFocused();
  expect(await action.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
  const actionBox = await action.boundingBox();
  const navBox = await nav.boundingBox();
  expect(actionBox!.y + actionBox!.height).toBeLessThanOrEqual(navBox!.y);
  const headerBox = await page.getByTestId('work-header').boundingBox();
  expect(actionBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height);
  for (const button of await nav.getByRole('button').all()) {
    const label = await button.locator('.MuiTypography-root').boundingBox();
    const bounds = await button.boundingBox();
    expect(label!.x).toBeGreaterThanOrEqual(bounds!.x);
    expect(label!.x + label!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width);
  }
  const heading = await page
    .getByRole('heading', { name: 'Personal task details', exact: true })
    .boundingBox();
  for (const name of ['Edit', 'Delete task']) {
    const button = await page
      .getByRole('article')
      .getByRole('button', { name, exact: true })
      .boundingBox();
    const overlaps =
      heading!.x < button!.x + button!.width &&
      heading!.x + heading!.width > button!.x &&
      heading!.y < button!.y + button!.height &&
      heading!.y + heading!.height > button!.y;
    expect(overlaps).toBe(false);
  }
  await noOverflow(page);
  await page.screenshot({
    path: info.outputPath(`work-200-${mobileTextZoom ? 'text' : 'reflow'}-forced-colors.png`),
  });
  const lastAction = page
    .getByRole('article')
    .getByRole('button', { name: 'Ask DWAI·ON', exact: true });
  await lastAction.focus();
  await expect(lastAction).toBeFocused();
  await expect
    .poll(async () => {
      const bounds = await lastAction.boundingBox();
      const navigation = await nav.boundingBox();
      return bounds!.y + bounds!.height <= navigation!.y;
    })
    .toBe(true);
  await page.screenshot({
    path: info.outputPath(`work-200-${mobileTextZoom ? 'text' : 'reflow'}-last-action.png`),
  });
});
