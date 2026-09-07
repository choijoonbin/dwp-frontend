import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  mockScheduleWorkspace,
  SCHEDULE_MEETING_ID,
  SCHEDULE_TEMPLATE_ID,
} from './support/meeting-schedule-fixtures';
import { mockMeetingVisualHome } from './support/video-meeting-visual-fixtures';

async function review(page: Page, mobile: boolean) {
  if (mobile)
    for (let step = 0; step < 3; step += 1)
      await page.getByRole('button', { name: 'Next step', exact: true }).click();
}
const templatePath = `/meetings/mine?view=schedule&templateId=${SCHEDULE_TEMPLATE_ID}&templateVersion=2`;

async function assertReadableLayout(page: Page) {
  const violations = (
    await new AxeBuilder({ page })
      .include('[data-testid="meeting-schedule-workspace"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
  ).violations;
  expect(violations).toEqual([]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  ).toBeLessThanOrEqual(1);
}

function visibleButton(page: Page, name: string) {
  return page
    .locator('button:visible')
    .filter({ hasText: new RegExp(`^${name}$`, 'u') })
    .last();
}

function visibleStatus(page: Page, text: string) {
  return page.locator('[role="status"]:visible').filter({ hasText: text }).last();
}

test('schedule persists governed settings at the canonical create endpoint', async ({
  page,
  isMobile,
}) => {
  const state = await mockScheduleWorkspace(page);
  await mockMeetingVisualHome(page, 'EMPTY');
  await page.goto('/meetings/home');
  await page.getByRole('button', { name: 'Schedule meeting', exact: true }).click();
  await expect(page).toHaveURL(/\/meetings\/mine\?view=schedule/);
  const workspace = page.getByTestId('meeting-schedule-workspace');
  await workspace
    .getByRole('textbox', { name: 'Meeting title', exact: true })
    .fill('Architecture decision review');
  await workspace
    .getByLabel('Purpose and preparation notes')
    .fill('Choose the rollout option and assign owners.');
  if (isMobile) await page.getByRole('button', { name: 'Next step', exact: true }).click();
  await workspace.getByRole('combobox', { name: 'Invite people' }).fill('alex');
  await page
    .getByRole('option', { name: 'Alex Lee · alex.lee@sk.com · Platform Engineering' })
    .click();
  if (isMobile) {
    await page.getByRole('button', { name: 'Next step', exact: true }).click();
    await page.getByRole('button', { name: 'Next step', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Create scheduled meeting', exact: true }).click();
  await expect.poll(() => state.commits.length).toBe(1);
  expect(state.saves).toHaveLength(1);
  expect(state.saves[0].key).toMatch(/^[0-9a-f-]{36}$/u);
  expect(state.saves[0].body).toMatchObject({
    title: 'Architecture decision review',
    agenda: 'Choose the rollout option and assign owners.',
    participantUserIds: [17],
    accessScope: 'INVITED',
    waitingRoomEnabled: true,
    allowJoinBeforeHost: false,
  });
  expect(state.saves[0].body).not.toHaveProperty('defaultMicrophoneEnabled');
  expect(state.commits[0].body).toEqual({ expectedVersion: 0, previewFingerprint: null });
  await expect(page).toHaveURL(new RegExp(`view=preparation.*meetingId=${SCHEDULE_MEETING_ID}`));
});

test('single scheduling connects five sections / four mobile steps to real preparation', async ({
  page,
  isMobile,
}) => {
  const state = await mockScheduleWorkspace(page);
  await page.goto('/meetings/mine?view=schedule');
  await expect(
    page.getByRole('heading', { name: 'Schedule a meeting', exact: true })
  ).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Meeting title', exact: true })
    .fill('Architecture decision review');
  await page
    .getByLabel('Purpose and preparation notes')
    .fill('Choose the rollout option and assign owners.');
  await page.getByRole('button', { name: 'Add agenda item', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Agenda title', exact: true })
    .fill('Compare the rollout options');
  if (isMobile) await page.getByRole('button', { name: 'Next step', exact: true }).click();
  const people = page.getByRole('combobox', { name: 'Invite people' });
  await people.fill('alex');
  await page
    .getByRole('option', { name: 'Alex Lee · alex.lee@sk.com · Platform Engineering' })
    .click();
  if (isMobile) {
    await page.getByRole('button', { name: 'Next step', exact: true }).click();
    await expect(
      page
        .getByRole('region', { name: 'Recurrence', exact: true })
        .getByText('Creates one meeting. You can review later changes and cancellation', {
          exact: false,
        })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Next step', exact: true }).click();
  }
  const joinBeforeHost = page.getByRole('switch', {
    name: 'Request permission to join before the organizer',
  });
  const joinBeforeHostReason = page.getByText(
    'Unavailable until verified pre-host participant identity and organization policy enforcement are enabled.',
    { exact: true }
  );
  await expect(joinBeforeHost).toBeDisabled();
  await expect(joinBeforeHost).not.toBeChecked();
  await expect(joinBeforeHostReason).toBeVisible();
  if (isMobile) {
    await joinBeforeHostReason.evaluate((element) =>
      element.scrollIntoView({ block: 'center', inline: 'nearest' })
    );
    const reasonBounds = await joinBeforeHostReason.boundingBox();
    const footerBounds = await visibleButton(page, 'Create scheduled meeting').evaluate(
      (button) => {
        let candidate = button.parentElement;
        while (candidate && getComputedStyle(candidate).position !== 'fixed')
          candidate = candidate.parentElement;
        if (!candidate) throw new Error('Missing fixed mobile schedule action region');
        const bounds = candidate.getBoundingClientRect();
        return { top: bounds.top, bottom: bounds.bottom };
      }
    );
    if (!reasonBounds) throw new Error('Missing join-before-host support reason');
    expect(
      reasonBounds.y + reasonBounds.height <= footerBounds.top ||
        reasonBounds.y >= footerBounds.bottom,
      'Join-before-host support reason must not be covered by the mobile action region'
    ).toBe(true);
  }
  await expect(
    page.getByRole('button', { name: 'Create scheduled meeting', exact: true })
  ).toBeEnabled();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot('meeting-u03-schedule-review.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixelRatio: 0.002,
  });
  await page.getByRole('button', { name: 'Create scheduled meeting', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`view=preparation.*meetingId=${SCHEDULE_MEETING_ID}`));
  await expect(
    page.getByRole('heading', { name: 'Architecture decision review', exact: true })
  ).toBeVisible();
  expect(state.saves).toHaveLength(1);
  expect(state.commits).toHaveLength(1);
  expect(state.commits[0].key).toMatch(/^[0-9a-f-]{36}$/u);
  expect(state.saves[0].body).toMatchObject({
    participantUserIds: [17],
    accessScope: 'INVITED',
    waitingRoomEnabled: true,
    agendaItems: [{ title: 'Compare the rollout options', ownerUserId: null, plannedMinutes: 5 }],
  });
});

test('first scheduling step keeps the approved manual draft action visible at 1440 and 390', async ({
  page,
  isMobile,
}) => {
  await mockScheduleWorkspace(page);
  await page.setViewportSize({ width: isMobile ? 390 : 1440, height: 960 });
  await page.goto(templatePath);
  await expect(page.getByRole('textbox', { name: 'Meeting title', exact: true })).toHaveValue(
    'Release decision template'
  );
  await expect(visibleButton(page, 'Save draft')).toBeVisible();
  await expect(visibleStatus(page, 'Unsaved changes')).toBeVisible();
  await assertReadableLayout(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot('meeting-u03-schedule-first-step.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixelRatio: 0.002,
  });
});

test('manual draft survives reload and is discarded only after explicit confirmation', async ({
  page,
  isMobile,
}) => {
  const state = await mockScheduleWorkspace(page);
  await page.goto('/meetings/mine?view=schedule');
  await page
    .getByRole('textbox', { name: 'Meeting title', exact: true })
    .fill('Persisted decision');
  await visibleButton(page, 'Save draft').click();
  await expect.poll(() => state.saves.length).toBe(1);
  await expect(visibleStatus(page, 'Draft saved at')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Meeting title', exact: true })).toHaveValue(
    'Persisted decision'
  );
  await expect(visibleStatus(page, 'Draft restored from')).toBeVisible();
  await visibleButton(page, isMobile ? 'Discard' : 'Discard saved draft').click();
  const dialog = page.getByRole('dialog', { name: 'Discard this saved draft?' });
  await dialog.getByRole('button', { name: 'Discard saved draft', exact: true }).click();
  await expect.poll(() => state.discards.length).toBe(1);
  expect(state.discards[0].body).toEqual({ expectedVersion: 0 });
  await expect(page.getByRole('textbox', { name: 'Meeting title', exact: true })).toHaveValue('');
});

test('a conflicting draft save preserves current entries until explicit latest restore', async ({
  page,
}) => {
  await mockScheduleWorkspace(page, { saveStatuses: [409] });
  await page.goto(templatePath);
  await page.getByRole('textbox', { name: 'Meeting title', exact: true }).fill('My local decision');
  await visibleButton(page, 'Save draft').click();
  await expect(page.getByRole('textbox', { name: 'Meeting title', exact: true })).toHaveValue(
    'My local decision'
  );
  await expect(
    page.getByText('The saved draft changed in another session.', { exact: false })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Restore latest saved draft', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Meeting title', exact: true })).toHaveValue(
    'Draft updated in another session'
  );
});

test('source-revoked draft remains opaque and supports blind discard', async ({ page }) => {
  const state = await mockScheduleWorkspace(page, { sourceRevokedDraft: true });
  await page.goto(templatePath);
  await expect(
    page.getByText('This saved draft can no longer be opened', { exact: false })
  ).toBeVisible();
  await expect(page.getByText('Confidential template preparation', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Meeting title', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Discard saved draft', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Discard this saved draft?' })
    .getByRole('button', { name: 'Discard saved draft', exact: true })
    .click();
  await expect.poll(() => state.discards.length).toBe(1);
  await expect(page.getByRole('textbox', { name: 'Meeting title', exact: true })).toHaveValue('');
});

test('recurring scheduling requires a server impact preview and explicit occurrence review', async ({
  page,
  isMobile,
}) => {
  const state = await mockScheduleWorkspace(page);
  await page.goto('/meetings/mine?view=schedule');
  await page
    .getByRole('textbox', { name: 'Meeting title', exact: true })
    .fill('Weekly architecture review');
  if (isMobile) {
    await page.getByRole('button', { name: 'Next step', exact: true }).click();
    await page.getByRole('button', { name: 'Next step', exact: true }).click();
  }
  await page.getByRole('combobox', { name: /^Recurrence/u }).click();
  await page.getByRole('option', { name: 'Repeat weekly', exact: true }).click();
  await page.getByRole('spinbutton', { name: /^Number of occurrences/u }).fill('3');
  if (isMobile) await page.getByRole('button', { name: 'Next step', exact: true }).click();
  await expect(
    page.getByText('I reviewed every occurrence and calendar adjustment', { exact: true })
  ).toBeVisible();
  await page
    .getByLabel('I reviewed every occurrence and calendar adjustment', { exact: true })
    .check();
  await page.getByRole('button', { name: 'Create scheduled meeting', exact: true }).click();
  await expect.poll(() => state.commits.length).toBe(1);
  expect(state.saves[0].body).toMatchObject({
    recurrence: { frequency: 'WEEKLY', interval: 1, occurrenceCount: 3 },
    title: 'Weekly architecture review',
  });
  expect(state.commits[0].body).toEqual({
    expectedVersion: 0,
    previewFingerprint: 'a'.repeat(64),
  });
  expect(state.commits[0].key).toMatch(/^[0-9a-f-]{36}$/u);
});

test('template handoff carries only opaque reference and revalidates the revision', async ({
  page,
  isMobile,
}) => {
  const state = await mockScheduleWorkspace(page);
  await page.goto(templatePath);
  await expect(page.getByRole('textbox', { name: 'Meeting title', exact: true })).toHaveValue(
    'Release decision template'
  );
  await expect(page.getByRole('textbox', { name: 'Agenda title', exact: true })).toHaveValue(
    'Review risks'
  );
  expect(new URL(page.url()).searchParams.size).toBe(3);
  expect(page.url()).not.toContain('Confidential');
  await review(page, isMobile);
  await page.getByRole('button', { name: 'Create scheduled meeting', exact: true }).click();
  await expect.poll(() => state.commits.length).toBe(1);
  expect(state.saves[0].body).toMatchObject({
    sourceTemplateId: SCHEDULE_TEMPLATE_ID,
    sourceTemplateVersion: 2,
    agendaItems: [
      {
        title: 'Review risks',
        objective: 'Use approved evidence',
        ownerUserId: null,
        plannedMinutes: 15,
      },
    ],
  });
});

test('uncertain create preserves the same command key and does not claim delivery', async ({
  page,
  isMobile,
}) => {
  const state = await mockScheduleWorkspace(page, { commitStatuses: [503, 200] });
  await page.goto(templatePath);
  await expect(page.getByRole('textbox', { name: 'Meeting title', exact: true })).toHaveValue(
    'Release decision template'
  );
  await review(page, isMobile);
  await page.getByRole('button', { name: 'Create scheduled meeting', exact: true }).click();
  await expect(
    page.getByText('The scheduling outcome could not be confirmed.', { exact: false })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Create scheduled meeting', exact: true }).click();
  await expect.poll(() => state.commits.length).toBe(2);
  expect(state.saves).toHaveLength(1);
  expect(state.commits[0].key).toBe(state.commits[1].key);
  expect(state.commits[0].body).toEqual(state.commits[1].body);
});

test('409 keeps the draft and explains source/policy change', async ({ page, isMobile }) => {
  const state = await mockScheduleWorkspace(page, { commitStatuses: [409] });
  await page.goto(templatePath);
  await expect(page.getByRole('textbox', { name: 'Meeting title', exact: true })).toHaveValue(
    'Release decision template'
  );
  await review(page, isMobile);
  await page.getByRole('button', { name: 'Create scheduled meeting', exact: true }).click();
  await expect(
    page.getByText('The template or meeting conditions have changed.', { exact: false })
  ).toBeVisible();
  expect(state.commits).toHaveLength(1);
  if (isMobile)
    for (let step = 0; step < 3; step += 1)
      await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Meeting title', exact: true })).toHaveValue(
    'Release decision template'
  );
});

test('403 creation removes old input and leaves no success projection', async ({
  page,
  isMobile,
}) => {
  await mockScheduleWorkspace(page, { commitStatuses: [403] });
  await page.goto(templatePath);
  await expect(page.getByRole('textbox', { name: 'Meeting title', exact: true })).toHaveValue(
    'Release decision template'
  );
  await review(page, isMobile);
  await page.getByRole('button', { name: 'Create scheduled meeting', exact: true }).click();
  await expect(
    page.getByText('Meeting authoring access could not be verified', { exact: true })
  ).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Meeting title', exact: true })).toHaveCount(0);
  await expect(page).not.toHaveURL(/view=preparation/);
});

test('changed template revision blocks editing instead of silently applying the latest', async ({
  page,
}) => {
  const state = await mockScheduleWorkspace(page, { templateVersion: 3 });
  await page.goto(templatePath);
  await expect(
    page.getByRole('heading', { name: 'This template changed after you selected it.', exact: true })
  ).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Meeting title', exact: true })).toHaveCount(0);
  expect(state.saves).toHaveLength(0);
  expect(state.commits).toHaveLength(0);
});

test('keyboard workflow, layout and accessibility retain the approved structure', async ({
  page,
  isMobile,
}, testInfo) => {
  await mockScheduleWorkspace(page);
  await page.goto(templatePath);
  await expect(page.getByRole('textbox', { name: 'Meeting title', exact: true })).toHaveValue(
    'Release decision template'
  );
  await page.getByRole('textbox', { name: 'Meeting title', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Purpose and preparation notes')).toBeFocused();
  if (isMobile) {
    const next = page.getByRole('button', { name: 'Next step', exact: true });
    await next.focus();
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('button', { name: '2. Time · people', exact: true })
    ).toHaveAttribute('aria-current', 'step');
  }
  await assertReadableLayout(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath('schedule-responsive.png'), fullPage: true });
});

test('required viewport sizes and 200 percent text keep the workflow usable', async ({
  page,
  isMobile,
}, testInfo) => {
  await mockScheduleWorkspace(page);
  await page.goto(templatePath);
  await expect(page.getByRole('textbox', { name: 'Meeting title', exact: true })).toHaveValue(
    'Release decision template'
  );
  await page
    .getByRole('textbox', { name: 'Meeting title', exact: true })
    .fill(
      'Cross-organization architecture review with a long decision title and a detailed rollout agenda'
    );
  for (const width of isMobile ? [390, 320] : [1440, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await assertReadableLayout(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: testInfo.outputPath(`schedule-width-${width}.png`),
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
  await expect(page.getByRole('button', { name: 'Next step', exact: true })).toBeInViewport();
  await expect(visibleButton(page, 'Save draft')).toBeInViewport();
  await assertReadableLayout(page);
  await expect(page).toHaveScreenshot('meeting-u03-schedule-text-200.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixelRatio: 0.002,
  });
});

test('Korean long content remains readable in dark and forced-colors reduced-motion modes', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await mockScheduleWorkspace(page, { locale: 'ko', dark: true });
  await page.goto(templatePath);
  const title = page.getByRole('textbox', { name: '회의 제목', exact: true });
  await expect(title).toHaveValue('Release decision template');
  await title.fill(
    '여러 부서가 함께 참여하는 글로벌 서비스 출시 준비 및 아키텍처 의사결정 검토 회의'
  );
  await page
    .getByLabel('목적 및 사전 안내', { exact: true })
    .fill(
      '보안 검토 결과와 단계별 출시 근거를 함께 검토하고 담당자를 명확히 정합니다. 긴 한국어 설명에서도 정보를 생략하거나 잘라내지 않습니다.'
    );
  await assertReadableLayout(page);
  await page.screenshot({ path: testInfo.outputPath('schedule-ko-dark.png'), fullPage: true });
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(
    true
  );
  await title.focus();
  await expect(title).toBeFocused();
  await assertReadableLayout(page);
  await page.screenshot({
    path: testInfo.outputPath('schedule-ko-forced-colors.png'),
    fullPage: true,
  });
});

test('U03 approved-size Korean light baseline keeps manual draft action in the first workflow step', async ({
  page,
  isMobile,
}) => {
  await mockScheduleWorkspace(page, { locale: 'ko' });
  await page.setViewportSize({ width: isMobile ? 390 : 1440, height: 960 });
  await page.goto(templatePath);
  await expect(page.getByRole('heading', { name: '회의 예약', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '회의 제목', exact: true })).toHaveValue(
    'Release decision template'
  );
  await expect(visibleButton(page, '초안 임시저장')).toBeVisible();
  await expect(visibleStatus(page, '저장하지 않은 변경사항')).toBeVisible();
  await assertReadableLayout(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot('meeting-u03-ko-light-approved-size.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixelRatio: 0.002,
  });
});
