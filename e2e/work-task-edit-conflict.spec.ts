import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fulfillSuccess } from './support/shell-session';
import {
  mockWorkHubFoundation,
  personalTaskRoute,
  WORK_HUB_FIXTURE,
} from './support/work-hub-foundation-fixtures';
import type { PersonalWorkTask } from '@dwp-frontend/shared-utils/api/personal-work-contracts';

const variants = [
  { name: 'desktop 1440', width: 1440, height: 1000, locale: 'en', useLatest: false, zoom: false },
  { name: 'desktop 1280', width: 1280, height: 900, locale: 'en', useLatest: true, zoom: false },
  {
    name: 'Korean mobile 390 dark high contrast',
    width: 390,
    height: 844,
    locale: 'ko',
    useLatest: false,
    zoom: false,
  },
  {
    name: 'Korean mobile 320',
    width: 320,
    height: 740,
    locale: 'ko',
    useLatest: true,
    zoom: false,
  },
  {
    name: 'Korean 200 percent zoom',
    width: 1280,
    height: 1000,
    locale: 'ko',
    useLatest: false,
    zoom: true,
  },
] as const;

for (const variant of variants) {
  test(`task edit conflict: ${variant.name} reviews the latest content before saving`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: variant.width, height: variant.height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockWorkHubFoundation(page, {
      designDetails: true,
      locale: variant.locale,
      mode: variant.width === 390 ? 'dark' : 'light',
      highContrast: variant.width === 390,
    });
    const ko = variant.locale === 'ko';
    const initialDescription = ko
      ? '편집을 시작할 때 저장되어 있던 설명입니다.'
      : 'Description saved before editing.';
    const draftTitle = ko
      ? '입력 중인 고객 안내 초안을 그대로 보존합니다'
      : 'Preserve my edited customer note';
    const serverTitle = ko
      ? '다른 기기에서 수정한 고객 안내 및 전체 준비 절차와 검토 대상 확인'.repeat(3)
      : 'A concurrent server title';
    const serverDescription = ko
      ? '고객 안내 대상과 필요한 검토 자료를 다른 담당자가 변경했습니다. '.repeat(16)
      : 'A concurrent update that must be reviewed before it is replaced.';
    let task: PersonalWorkTask = {
      taskId: WORK_HUB_FIXTURE.personalId,
      title: WORK_HUB_FIXTURE.personalTitle,
      description: initialDescription,
      priority: 'HIGH',
      status: 'OPEN',
      version: 4,
      source: null,
      sources: [],
      dueAt: null,
      checklist: [{ itemId: 'original', title: 'Original checklist item', completed: false }],
      createdAt: '2026-09-07T00:00:00Z',
      updatedAt: '2026-09-07T00:00:00Z',
      completedAt: null,
    };
    const writes: Array<{ body: Record<string, unknown>; key: string | undefined }> = [];
    const base = '/api/platform/v1/workspace/work-hub/personal-tasks';
    await page.route(`**${base}?*`, (route) =>
      fulfillSuccess(route, { items: [task], page: 0, size: 100, totalElements: 1, hasMore: false })
    );
    await page.route(`**${base}/${task.taskId}`, async (route) => {
      if (route.request().method() === 'PUT') {
        const body = route.request().postDataJSON();
        writes.push({ body, key: route.request().headers()['idempotency-key'] });
        if (writes.length === 1) {
          task = {
            ...task,
            title: serverTitle,
            description: serverDescription,
            priority: 'LOW',
            version: 5,
            checklist: [
              {
                itemId: 'new',
                title: ko ? '새로 추가된 검토 절차' : 'Concurrent checklist item',
                completed: true,
              },
            ],
          };
          return route.fulfill({ status: 409 });
        }
        if (body.version !== task.version) return route.fulfill({ status: 409 });
        task = { ...task, ...body, version: task.version + 1 };
      }
      return fulfillSuccess(route, task);
    });

    await page.goto(personalTaskRoute());
    await expect(
      page.getByRole('heading', { name: ko ? '개인 할 일 내용' : 'Personal task details' })
    ).toBeVisible({ timeout: 20_000 });
    if (variant.zoom)
      await page.evaluate(() => {
        document.documentElement.style.zoom = '2';
      });
    await page.getByRole('button', { name: ko ? '편집' : 'Edit', exact: true }).click();
    const dialog = page.getByRole('dialog', {
      name: ko ? '개인 할 일 편집' : 'Edit personal task',
    });
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    const title = dialog.getByRole('textbox', { name: ko ? '제목' : 'Title', exact: false });
    const save = dialog.getByRole('button', {
      name: ko ? '변경 저장' : 'Save changes',
      exact: true,
    });
    await title.fill(draftTitle);
    await save.click();
    const review = dialog.getByRole('region', {
      name: ko ? '최신 저장 내용' : 'Latest saved task',
    });
    await expect(review).toBeVisible();
    await expect(review).toContainText(serverTitle);
    await expect(review).toContainText(serverDescription);
    await expect(title).toHaveValue(draftTitle);
    await expect(save).toBeDisabled();
    expect(writes).toHaveLength(1);
    expect(writes[0].body.version).toBe(4);
    await review.focus();
    await expect(review).toBeFocused();
    await page.keyboard.press('PageDown');
    await expect(review).toBeFocused();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
    ).toBeLessThanOrEqual(1);
    if (variant.width === 320) {
      const accessibility = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
      expect(
        accessibility.violations.filter((violation) =>
          ['serious', 'critical'].includes(violation.impact ?? '')
        )
      ).toEqual([]);
    }
    await page.screenshot({
      path: testInfo.outputPath('task-edit-conflict-review.png'),
      fullPage: false,
      animations: 'disabled',
    });
    await dialog
      .getByRole('button', {
        name: variant.useLatest
          ? ko
            ? '최신 내용으로 편집하기'
            : 'Edit the latest content'
          : ko
            ? '변경 내용을 확인하고 내 초안 유지'
            : 'Reviewed: keep my draft',
        exact: true,
      })
      .click();
    expect(writes).toHaveLength(1);
    await expect(title).toBeFocused();
    await expect(title).toBeInViewport();
    await expect(title).toHaveValue(variant.useLatest ? serverTitle : draftTitle);
    await expect(save).toBeEnabled();
    await save.click();
    await expect(dialog).not.toBeVisible();
    expect(writes).toHaveLength(2);
    expect(writes[1].body).toMatchObject({
      version: 5,
      title: variant.useLatest ? serverTitle : draftTitle,
      description: (variant.useLatest ? serverDescription : initialDescription).trim(),
    });
    expect(writes[1].key).toBeTruthy();
    expect(writes[1].key).not.toBe(writes[0].key);
  });
}
