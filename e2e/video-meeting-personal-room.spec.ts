import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  PERSONAL_ROOM,
  PERSONAL_ROOM_ALIAS,
  PERSONAL_ROOM_MEETING_ID,
  PERSONAL_ROOM_PATH,
  mockPersonalRoom,
  readPersonalRoomBrowserEvidence,
} from './support/meeting-personal-room-fixtures';

test.beforeEach(async ({ page }, testInfo) => {
  await page.setViewportSize({
    width: testInfo.project.name === 'mobile' ? 390 : 1280,
    height: 960,
  });
});
async function ready(page: Page, name = PERSONAL_ROOM.name) {
  await page.goto(PERSONAL_ROOM_PATH);
  await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible({
    timeout: 30_000,
  });
}
async function noOverflow(page: Page) {
  const widths = await page.evaluate(() => {
    const main = document.querySelector<HTMLElement>('#dwp-main-content');
    return {
      document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      main: main ? main.scrollWidth - main.clientWidth : 0,
    };
  });
  expect(widths.document).toBeLessThanOrEqual(1);
  expect(widths.main).toBeLessThanOrEqual(1);
}
async function accessible(page: Page) {
  const result = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  expect(
    result.violations.filter((item) => ['critical', 'serious'].includes(item.impact ?? ''))
  ).toEqual([]);
}
async function noMedia(page: Page) {
  expect((await readPersonalRoomBrowserEvidence(page)).mediaCalls).toBe(0);
}

test('personal room provisions, renames and rotates with current versions before explicit session preparation', async ({
  page,
}) => {
  const state = await mockPersonalRoom(page, { empty: true });
  await ready(page, 'Prepare your own meeting room');
  await expect(
    page.getByRole('button', { name: 'Create personal room', exact: true })
  ).toBeDisabled();
  await page.getByRole('textbox', { name: 'Room name' }).fill('Launch review room');
  await page.getByRole('button', { name: 'Create personal room', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Launch review room', exact: true })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Rename room', exact: true }).click();
  const rename = page.getByRole('dialog', { name: 'Rename room', exact: true });
  await rename.getByRole('textbox', { name: 'Room name' }).fill('Launch alignment room');
  await rename.getByRole('button', { name: 'Save name', exact: true }).click();
  await expect(rename).not.toBeVisible();
  await page.getByRole('button', { name: 'Copy link', exact: true }).click();
  const originalLink = (await readPersonalRoomBrowserEvidence(page)).clipboard;
  expect(new URL(originalLink).pathname).toBe('/meetings/join');
  expect(new URL(originalLink).searchParams.get('room')).toBe(PERSONAL_ROOM_ALIAS);
  expect(new URL(originalLink).searchParams.get('revision')).toBe('1');
  await page.getByRole('button', { name: 'Replace invitation link', exact: true }).click();
  const rotation = page.getByRole('alertdialog', { name: 'Invalidate previous invitation links?' });
  await expect(rotation).toContainText('does not revoke an open session');
  expect(state.commands.filter((item) => item.path.endsWith('/rotate-invitation'))).toHaveLength(0);
  await rotation
    .getByRole('button', { name: 'Invalidate and replace invitation', exact: true })
    .click();
  await expect(rotation).not.toBeVisible();
  await page.getByRole('button', { name: 'Copy invitation', exact: true }).click();
  expect((await readPersonalRoomBrowserEvidence(page)).clipboard).toContain('revision=2');
  expect(state.room?.opaqueAlias).toBe(PERSONAL_ROOM_ALIAS);
  expect(state.commands.map((item) => item.body)).toEqual([
    { name: 'Launch review room' },
    { name: 'Launch alignment room', expectedVersion: 0 },
    { expectedVersion: 1 },
  ]);
  await noMedia(page);
  await page.getByRole('button', { name: 'Start a meeting now', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/meetings/room/${PERSONAL_ROOM_MEETING_ID}$`));
  await expect(
    page.getByRole('heading', { name: 'Check the room before entering', exact: true })
  ).toBeVisible();
  expect(state.commands.at(-1)?.body).toEqual({ expectedVersion: 2, invitationRevision: 2 });
  expect(state.commands.every((item) => /^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/.test(item.key))).toBe(
    true
  );
  expect(state.unexpected).toEqual([]);
  await noMedia(page);
});

test('device checks do not provision a room or start any media automatically', async ({ page }) => {
  const state = await mockPersonalRoom(page, { empty: true });
  await ready(page, 'Prepare your own meeting room');
  await page.getByRole('button', { name: 'Check camera and microphone', exact: true }).click();
  await expect(page).toHaveURL(/\/meetings\/preferences$/);
  await expect(
    page.getByRole('heading', { name: 'Devices & preferences', exact: true })
  ).toBeVisible();
  expect(state.commands).toEqual([]);
  expect(state.room).toBeNull();
  await noMedia(page);
});

test('clipboard denial, optimistic conflict and retry idempotency remain explicit', async ({
  page,
}) => {
  const state = await mockPersonalRoom(page, { clipboardFailure: true });
  await ready(page);
  await page.getByRole('button', { name: 'Copy link', exact: true }).click();
  await expect(
    page.getByText(
      'Could not copy. Select the displayed invitation address and copy it manually.',
      { exact: true }
    )
  ).toBeVisible();
  state.conflict = true;
  await page.getByRole('button', { name: 'Rename room', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Rename room', exact: true });
  await dialog.getByRole('textbox', { name: 'Room name' }).fill('Updated room');
  await dialog.getByRole('button', { name: 'Save name', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Settings changed in another operation');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Refresh personal room', exact: true }).click();
  await expect(
    page.getByText('Settings v5 · Invitation revision 3', { exact: true })
  ).toBeVisible();
  state.sessionFailure = true;
  await page.getByRole('button', { name: 'Start a meeting now', exact: true }).click();
  await expect(
    page.getByText('The operation could not be completed. You can retry the same request.', {
      exact: true,
    })
  ).toBeVisible();
  state.sessionFailure = false;
  await page.getByRole('button', { name: 'Start a meeting now', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/meetings/room/${PERSONAL_ROOM_MEETING_ID}$`));
  const attempts = state.commands.filter((item) => item.path.endsWith('/sessions'));
  expect(attempts).toHaveLength(2);
  expect(attempts[0].key).toBe(attempts[1].key);
  expect(attempts[0].body).toEqual(attempts[1].body);
  await noMedia(page);
});

test('invitation revalidates only on explicit entry and replaced or forbidden links clear room metadata', async ({
  page,
}) => {
  const state = await mockPersonalRoom(page, { current: true });
  await page.goto(`/meetings/join?room=${PERSONAL_ROOM_ALIAS}&revision=3`);
  await expect(page.getByRole('heading', { name: PERSONAL_ROOM.name, exact: true })).toBeVisible({
    timeout: 30_000,
  });
  expect(state.commands).toEqual([]);
  await noMedia(page);
  const reads = state.resolverRequests;
  state.room!.invitationRevision = 4;
  await page.getByRole('button', { name: 'Prepare to join meeting', exact: true }).click();
  await expect(page.getByText('This invitation is unavailable.', { exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: PERSONAL_ROOM.name, exact: true })).toHaveCount(0);
  expect(state.resolverRequests).toBe(reads + 1);
  await expect(page).toHaveURL(/revision=3$/);
  await page.goto(`/meetings/join?room=${PERSONAL_ROOM_ALIAS}&revision=4`);
  await expect(page.getByRole('heading', { name: PERSONAL_ROOM.name, exact: true })).toBeVisible();
  state.forbidden = true;
  await page.getByRole('button', { name: 'Prepare to join meeting', exact: true }).click();
  await expect(
    page.getByText('Access to this room invitation could not be verified.', { exact: false })
  ).toBeVisible();
  await expect(page.getByText(PERSONAL_ROOM.name, { exact: true })).toHaveCount(0);
  expect(state.commands).toEqual([]);
  await noMedia(page);
});

test('available invitation enters the actual preparation route and empty sessions never auto-create', async ({
  page,
}) => {
  const state = await mockPersonalRoom(page);
  await page.goto(`/meetings/join?room=${PERSONAL_ROOM_ALIAS}&revision=3`);
  await expect(
    page.getByText('There is no open meeting session yet.', { exact: false })
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByRole('button', { name: 'Prepare to join meeting', exact: true })
  ).toHaveCount(0);
  state.room!.currentMeetingId = PERSONAL_ROOM_MEETING_ID;
  await page.getByRole('button', { name: 'Check session again', exact: true }).click();
  await page.getByRole('button', { name: 'Prepare to join meeting', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/meetings/room/${PERSONAL_ROOM_MEETING_ID}$`));
  expect(state.commands).toEqual([]);
  await noMedia(page);
});

test('owner access revocation removes room name and invitation from the page', async ({ page }) => {
  const state = await mockPersonalRoom(page);
  await ready(page);
  state.forbidden = true;
  await page.getByRole('button', { name: 'Refresh personal room', exact: true }).click();
  await expect(
    page.getByText('Personal room access could not be verified.', { exact: false })
  ).toBeVisible();
  await expect(page.getByText(PERSONAL_ROOM.name, { exact: true })).toHaveCount(0);
  await expect(page.getByText(PERSONAL_ROOM_ALIAS, { exact: false })).toHaveCount(0);
  await noMedia(page);
});

for (const mode of ['light', 'dark', 'forced-colors', 'text-200'] as const) {
  test(`personal room ${mode} is responsive, keyboard operable and accessible`, async ({
    page,
  }, testInfo) => {
    const mobile = testInfo.project.name === 'mobile';
    await page.setViewportSize({
      width: mode === 'forced-colors' ? 320 : mobile ? 390 : mode === 'dark' ? 1440 : 1280,
      height: 960,
    });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const state = await mockPersonalRoom(page, {
      colorScheme: mode === 'dark' ? 'dark' : 'light',
      forcedColors: mode === 'forced-colors' ? 'active' : 'none',
      locale: mode === 'dark' ? 'ko' : 'en',
    });
    await ready(page);
    if (mode === 'text-200')
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    const main = page.getByTestId('meeting-personal-room');
    await expect(main.getByText('Release follow-up', { exact: true })).toBeVisible();
    if (mobile && mode === 'light') {
      const supplemental = page.getByTestId('personal-room-supplemental-settings');
      await expect(supplemental).not.toHaveAttribute('open', '');
      await supplemental.locator('summary').click();
      await expect(supplemental).toHaveAttribute('open', '');
      await expect(
        supplemental.getByRole('heading', {
          name: 'Devices and recording guidance',
          exact: true,
        })
      ).toBeVisible();
      await supplemental.locator('summary').click();
      await expect(supplemental).not.toHaveAttribute('open', '');
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThan(2200);
    }
    const regions = await page.evaluate(() => {
      const section = (id: string) =>
        document
          .querySelector<HTMLElement>(`section[aria-labelledby="${id}"]`)!
          .getBoundingClientRect();
      const policy = section('personal-room-policy');
      const current = section('personal-room-current');
      const history = section('personal-room-history');
      return {
        policy: { y: policy.y, width: policy.width },
        current: { y: current.y, width: current.width, bottom: current.bottom },
        history: { y: history.y },
      };
    });
    if (mobile || mode === 'forced-colors')
      expect(regions.current.y).toBeLessThan(regions.policy.y);
    else {
      expect(regions.policy.width / regions.current.width).toBeCloseTo(7 / 5, 1);
      expect(regions.history.y - regions.current.bottom).toBe(24);
    }
    const start = page.getByRole('button', {
      name: mode === 'dark' ? '지금 회의 시작하기' : 'Start a meeting now',
      exact: true,
    });
    await expect(start).toBeVisible();
    expect((await start.boundingBox())!.height).toBeGreaterThanOrEqual(48);
    await start.focus();
    await expect(start).toBeFocused();
    await page.keyboard.press('Tab');
    const devices = page.getByRole('button', {
      name: mode === 'dark' ? '입장 전 카메라·마이크 점검' : 'Check camera and microphone',
      exact: true,
    });
    await expect(devices).toBeFocused();
    expect(await devices.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
    await noOverflow(page);
    await accessible(page);
    await noMedia(page);
    expect(state.commands).toEqual([]);
    expect(state.unexpected).toEqual([]);
    expect(errors).toEqual([]);
    if (mode === 'light') {
      await expect(page).toHaveScreenshot(
        `meeting-u11-personal-room-${mobile ? 'mobile' : 'desktop'}.png`,
        {
          animations: 'disabled',
          caret: 'hide',
          fullPage: true,
          maxDiffPixelRatio: 0.002,
        }
      );
    } else {
      await page.screenshot({
        path: testInfo.outputPath(`personal-room-${mode}-${testInfo.project.name}.png`),
        fullPage: true,
      });
    }
  });
}
