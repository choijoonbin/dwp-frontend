import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';
import { mockShellSession } from './support/shell-session';

const meetingId = '99000000-0000-4000-8000-000000000101';
const participantId = '99000000-0000-4000-8000-000000000102';
const itemId = '99000000-0000-4000-8000-000000000103';
const path = `/meetings/mine?view=preparation&meetingId=${meetingId}`;
const response = {
  participantId,
  displayName: 'Mina Kim',
  response: 'PENDING',
  invitationRevision: 1,
  respondedAt: null,
  version: 0,
  mine: true,
};
const initial = {
  meetingId,
  meetingVersion: 1,
  agendaVersion: 1,
  materialsVersion: 0,
  invitationRevision: 1,
  agendaItems: [
    {
      itemId,
      position: 0,
      title: 'Review release risks',
      objective: 'Confirm the rollout decision',
      ownerUserId: 42,
      ownerDisplayName: 'Mina Kim',
      plannedMinutes: 20,
    },
  ],
  materials: [] as Record<string, unknown>[],
  myResponse: response,
  invitationResponses: [response],
  invitationCounts: { accepted: 0, tentative: 0, declined: 0, pending: 1 },
  myPreparation: {
    agendaVersion: 1,
    version: 0,
    preparedAgendaItemIds: [] as string[],
    updatedAt: null as string | null,
  },
  canEditAgenda: true,
  canManageMaterials: true,
  canRespond: true,
  canPrepare: true,
  observedAt: '2026-09-04T00:00:00Z',
};
const detail = {
  meetingId,
  title: 'Release readiness review',
  description: 'Agree the rollout scope and accountable owners.',
  agenda: null,
  lifecycleState: 'SCHEDULED',
  accessScope: 'INVITED',
  meetingCode: 'ABCD-EFGH-JKMN',
  startsAt: '2026-09-04T01:00:00Z',
  endsAt: '2026-09-04T02:00:00Z',
  durationMinutes: 60,
  timeZone: 'Asia/Seoul',
  organizerUserId: 42,
  organizerName: 'Mina Kim',
  waitingRoomEnabled: true,
  allowJoinBeforeHost: false,
  defaultMicrophoneEnabled: false,
  defaultCameraEnabled: false,
  attendeeCount: 1,
  participantRole: 'ORGANIZER',
  canHost: true,
  canModerate: true,
  version: 1,
  guestAccessEnabled: false,
  participants: [],
  artifacts: [],
  recordingAvailable: false,
  transcriptAvailable: false,
  aiNotesAvailable: false,
};
function fulfill(route: Route, data: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({
      status: status < 400 ? 'SUCCESS' : 'ERROR',
      success: status < 400,
      message: status < 400 ? 'OK' : 'Not available',
      data,
    }),
  });
}
async function setup(
  page: Page,
  options: {
    readonly?: boolean;
    conflict?: boolean;
    personalConflict?: boolean;
    dark?: boolean;
    forcedColors?: boolean;
    locale?: 'en' | 'ko';
  } = {}
) {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    userId: 42,
    locale: options.locale ?? 'en',
    displayName: 'Mina Kim',
    permissions: ['VIEW', 'CREATE', 'UPDATE'].map((permissionCode) => ({
      resourceType: 'APP',
      resourceKey: 'APP.MEETINGS',
      permissionCode,
      effect: 'ALLOW' as const,
    })),
    appearance: { mode: options.dark ? 'dark' : 'light', density: 'standard', reduceMotion: true },
  });
  await page.emulateMedia({
    reducedMotion: 'reduce',
    colorScheme: options.dark ? 'dark' : 'light',
    forcedColors: options.forcedColors ? 'active' : 'none',
  });
  const state = {
    data: structuredClone(initial),
    revoked: false,
    agendaCalls: [] as unknown[],
    responseCalls: [] as unknown[],
    materialCalls: [] as unknown[],
    materialAccessCalls: [] as unknown[],
    personalPreparationCalls: [] as unknown[],
    keys: [] as string[],
    conflict: options.conflict ?? false,
    personalConflict: options.personalConflict ?? false,
    deferred: null as null | (() => Promise<void>),
    holdResponse: false,
  };
  state.data.canEditAgenda = !options.readonly;
  await page.route('**/api/meetings/v1/meetings/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.pathname.endsWith('/preparation'))
      return fulfill(route, state.revoked ? null : state.data, state.revoked ? 403 : 200);
    if (method === 'GET' && url.pathname.endsWith(meetingId)) return fulfill(route, detail);
    if (url.pathname.endsWith('/access-ticket') && method === 'POST') {
      const body = route.request().postDataJSON();
      state.materialAccessCalls.push(body);
      state.keys.push(route.request().headers()['idempotency-key']);
      return fulfill(route, {
        meetingId,
        materialId: '99000000-0000-4000-8000-000000000104',
        materialVersion: 0,
        accessUrl:
          'https://files.example.test/meeting-materials/open?ticket=short-lived-ticket-001',
        expiresAt: '2099-09-04T00:05:00Z',
        contentType: 'application/pdf',
        displayName: 'Release evidence',
      });
    }
    if (url.pathname.endsWith('/materials') && method === 'POST') {
      const body = route.request().postDataJSON();
      state.materialCalls.push(body);
      state.keys.push(route.request().headers()['idempotency-key']);
      state.data.materialsVersion += 1;
      state.data.materials = [
        {
          materialId: '99000000-0000-4000-8000-000000000104',
          displayName: body.displayName,
          contentType: body.contentType,
          referenceProvider: body.referenceProvider,
          opaqueReference: body.opaqueReference,
          sourceVersion: body.sourceVersion,
          classification: body.classification,
          sizeBytes: body.sizeBytes,
          contentSha256: body.contentSha256,
          retentionUntil: '2026-10-04T00:00:00Z',
          accessVerificationState: 'PENDING_REVALIDATION',
          version: 0,
        },
      ];
      return fulfill(route, state.data);
    }
    if (url.pathname.endsWith('/agenda') && method === 'PUT') {
      const body = route.request().postDataJSON();
      state.agendaCalls.push(body);
      state.keys.push(route.request().headers()['idempotency-key']);
      if (state.conflict) {
        state.conflict = false;
        state.data.agendaVersion = 2;
        state.data.agendaItems[0].title = 'Updated by another host';
        state.data.myPreparation.agendaVersion = 2;
        state.data.myPreparation.preparedAgendaItemIds = [];
        return fulfill(route, null, 409);
      }
      state.data.agendaVersion += 1;
      state.data.agendaItems = body.items.map(
        (item: Record<string, unknown>, position: number) => ({
          ...item,
          itemId: item.itemId ?? itemId,
          position,
          ownerDisplayName: 'Mina Kim',
        })
      );
      state.data.myPreparation.agendaVersion = state.data.agendaVersion;
      state.data.myPreparation.preparedAgendaItemIds = [];
      return fulfill(route, state.data);
    }
    if (url.pathname.endsWith('/my-preparation') && method === 'PUT') {
      const body = route.request().postDataJSON();
      state.personalPreparationCalls.push(body);
      state.keys.push(route.request().headers()['idempotency-key']);
      if (state.personalConflict) {
        state.personalConflict = false;
        return fulfill(route, null, 409);
      }
      state.data.myPreparation = {
        agendaVersion: state.data.agendaVersion,
        version: state.data.myPreparation.version + 1,
        preparedAgendaItemIds: [...body.preparedAgendaItemIds].sort(),
        updatedAt: '2026-09-04T00:05:00Z',
      };
      return fulfill(route, state.data);
    }
    if (url.pathname.endsWith('/invitation-response') && method === 'PUT') {
      const body = route.request().postDataJSON();
      state.responseCalls.push(body);
      state.keys.push(route.request().headers()['idempotency-key']);
      const complete = async () => {
        state.data.myResponse = {
          ...state.data.myResponse,
          response: body.response,
          version: state.data.myResponse.version + 1,
        };
        state.data.invitationResponses = [state.data.myResponse];
        state.data.invitationCounts = {
          accepted: body.response === 'ACCEPTED' ? 1 : 0,
          tentative: body.response === 'TENTATIVE' ? 1 : 0,
          declined: body.response === 'DECLINED' ? 1 : 0,
          pending: 0,
        };
        await fulfill(route, state.data);
      };
      if (state.holdResponse) {
        state.deferred = complete;
        return;
      }
      return complete();
    }
    return route.fallback();
  });
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1, name: detail.title })).toBeVisible({
    timeout: 30_000,
  });
  return state;
}

test('preparation RSVP uses current revision and exposes no unsupported success claims', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({
    width: testInfo.project.name === 'mobile' ? 390 : 1440,
    height: 960,
  });
  const state = await setup(page);
  await page.getByRole('button', { name: 'Accept invitation', exact: true }).click();
  await expect.poll(() => state.responseCalls.length).toBe(1);
  expect(state.responseCalls[0]).toEqual({
    response: 'ACCEPTED',
    expectedInvitationRevision: 1,
    expectedVersion: 0,
  });
  expect(state.keys[0]).toMatch(/^[0-9a-f-]{36}$/u);
  await expect(
    page.getByText('Files stay in their approved source.', {
      exact: false,
    })
  ).toBeVisible();
  await page.getByText('Invitation response saved.', { exact: true }).waitFor({ state: 'hidden' });
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot('meeting-u04-preparation.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixelRatio: 0.002,
  });
  const accessibility = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  expect(
    accessibility.violations.filter(
      (item) => item.impact === 'serious' || item.impact === 'critical'
    )
  ).toEqual([]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  ).toBeLessThanOrEqual(1);
});

test('private agenda checklist persists self-only state and collapses when complete', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({
    width: testInfo.project.name === 'mobile' ? 390 : 1280,
    height: 960,
  });
  const state = await setup(page);
  const checklist = page
    .getByText('My preparation checklist', { exact: true })
    .locator('xpath=ancestor::details');
  await expect(checklist).toHaveAttribute('open', '');
  const checkbox = page.getByRole('checkbox', {
    name: 'Mark “Review release risks” as prepared',
  });
  const label = checkbox.locator('xpath=ancestor::label');
  expect((await label.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await checkbox.click();
  await expect.poll(() => state.personalPreparationCalls.length).toBe(1);
  expect(state.personalPreparationCalls[0]).toEqual({
    expectedAgendaVersion: 1,
    expectedVersion: 0,
    preparedAgendaItemIds: [itemId],
  });
  await expect(checklist).not.toHaveAttribute('open', '');
  await expect(page.getByText('1 of 1 prepared', { exact: true })).toBeVisible();
  expect(state.data).not.toHaveProperty('participantPreparationCounts');
  await expect(page.getByText(/participants prepared|host checklist/iu)).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot('meeting-u04-preparation-complete.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixelRatio: 0.002,
  });
});

test('private checklist conflict requires review and preserves no aggregate state', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({
    width: testInfo.project.name === 'mobile' ? 390 : 1440,
    height: 960,
  });
  const state = await setup(page, { personalConflict: true });
  const checkbox = page.getByRole('checkbox', {
    name: 'Mark “Review release risks” as prepared',
  });
  await checkbox.click();
  await expect.poll(() => state.personalPreparationCalls.length).toBe(1);
  await expect(
    page.getByText('Your checklist changed in another session.', { exact: false })
  ).toBeVisible();
  await expect(checkbox).toBeDisabled();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot('meeting-u04-preparation-conflict.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixelRatio: 0.002,
  });
  await page.getByRole('button', { name: 'I reviewed my latest checklist' }).click();
  await expect(checkbox).toBeEnabled();
});

test('host registers a governed opaque material reference without file contents or credentials', async ({
  page,
}) => {
  const state = await setup(page);
  await page.getByRole('button', { name: 'Add governed reference', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: /^Display name/u }).fill('Release evidence');
  await dialog
    .getByRole('textbox', { name: /^Opaque provider reference/u })
    .fill('files/release-evidence');
  await dialog.getByRole('button', { name: 'Register reference', exact: true }).click();
  await expect.poll(() => state.materialCalls.length).toBe(1);
  expect(state.materialCalls[0]).toEqual({
    displayName: 'Release evidence',
    contentType: 'application/pdf',
    referenceProvider: 'DWP_FILES',
    opaqueReference: 'files/release-evidence',
    sourceVersion: null,
    classification: 'INTERNAL',
    sizeBytes: null,
    contentSha256: null,
    expectedMaterialsVersion: 0,
  });
  expect(JSON.stringify(state.materialCalls[0])).not.toContain('token');
  expect(JSON.stringify(state.materialCalls[0])).not.toContain('contents');
  await expect(page.getByText('Revalidate on open', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Release evidence/u })).toHaveCount(0);
});

test('participant receives a short-lived material link only after current access is revalidated', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({
    width: testInfo.project.name === 'mobile' ? 390 : 1280,
    height: 960,
  });
  const state = await setup(page);
  await page.getByRole('button', { name: 'Add governed reference', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: /^Display name/u }).fill('Release evidence');
  await dialog
    .getByRole('textbox', { name: /^Opaque provider reference/u })
    .fill('files/release-evidence');
  await dialog.getByRole('button', { name: 'Register reference', exact: true }).click();

  await expect(page.getByRole('link', { name: 'Open material', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Verify access', exact: true }).click();
  await expect.poll(() => state.materialAccessCalls.length).toBe(1);
  expect(state.materialAccessCalls[0]).toEqual({ expectedVersion: 0 });

  const link = page.getByRole('link', { name: 'Open material', exact: true });
  await expect(link).toHaveAttribute(
    'href',
    'https://files.example.test/meeting-materials/open?ticket=short-lived-ticket-001'
  );
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  expect(JSON.stringify(state.materialAccessCalls[0])).not.toContain('opaqueReference');
  expect(JSON.stringify(state.materialAccessCalls[0])).not.toContain('ticket');
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  ).toBeLessThanOrEqual(1);
});

test('host agenda conflict preserves input and requires explicit latest-version review', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({
    width: testInfo.project.name === 'mobile' ? 390 : 1280,
    height: 960,
  });
  const state = await setup(page, { conflict: true });
  await page.getByRole('button', { name: 'Edit agenda', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Agenda title', { exact: false }).fill('My revised release agenda');
  await dialog.getByRole('button', { name: 'Save agenda', exact: true }).click();
  await expect(dialog.getByText('Another change was saved first.', { exact: false })).toBeVisible();
  await expect(dialog.getByLabel('Agenda title', { exact: false })).toHaveValue(
    'My revised release agenda'
  );
  await expect(dialog.getByRole('button', { name: 'Save agenda', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Compare latest agenda', exact: true }).click();
  await expect(dialog.getByText('Updated by another host', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Save agenda', exact: true })).toBeDisabled();
  await dialog
    .getByRole('button', { name: 'Confirm latest version for my changes', exact: true })
    .click();
  await dialog.getByRole('button', { name: 'Save agenda', exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(state.agendaCalls).toHaveLength(2);
  expect(state.agendaCalls[1]).toMatchObject({
    expectedAgendaVersion: 2,
    items: [{ title: 'My revised release agenda', ownerUserId: 42 }],
  });
  expect(state.keys[0]).not.toBe(state.keys[1]);
});

test('revocation clears visible content and a late RSVP cannot restore it', async ({ page }) => {
  const state = await setup(page);
  state.holdResponse = true;
  await page.getByRole('button', { name: 'Accept invitation', exact: true }).click();
  await expect.poll(() => state.deferred !== null).toBe(true);
  state.revoked = true;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(
    page.getByText('Meeting preparation is not accessible', { exact: true })
  ).toBeVisible();
  await state.deferred!();
  await expect(page.getByRole('heading', { name: detail.title, exact: true })).toHaveCount(0);
  await expect(page.getByText('Review release risks', { exact: true })).toHaveCount(0);
});

test('read-only narrow dark preparation retains structure and keyboard-accessible join', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await setup(page, { readonly: true, dark: true });
  await expect(page.getByRole('button', { name: 'Edit agenda', exact: true })).toHaveCount(0);
  const join = page.getByRole('button', { name: 'Check devices and join', exact: true });
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await page.keyboard.press('Tab');
    if (await join.evaluate((element) => element === document.activeElement)) break;
  }
  await expect(join).toBeFocused();
  expect((await join.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  ).toBeLessThanOrEqual(1);
  const accessibility = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  expect(
    accessibility.violations.filter(
      (item) => item.impact === 'serious' || item.impact === 'critical'
    )
  ).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath('preparation-320-dark.png'), fullPage: true });
});

test('320px forced-colors checklist remains keyboard operable without horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await setup(page, { forcedColors: true });
  const checkbox = page.getByRole('checkbox', {
    name: 'Mark “Review release risks” as prepared',
  });
  await checkbox.focus();
  await expect(checkbox).toBeFocused();
  await page.keyboard.press('Space');
  await expect(checkbox).toBeChecked();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  ).toBeLessThanOrEqual(1);
  const accessibility = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  expect(
    accessibility.violations.filter(
      (item) => item.impact === 'serious' || item.impact === 'critical'
    )
  ).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot('meeting-u04-preparation-forced-colors-320.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixelRatio: 0.002,
  });
});

test('200 percent text keeps personal preparation operable without horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await setup(page);
  await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
  const checkbox = page.getByRole('checkbox', {
    name: 'Mark “Review release risks” as prepared',
  });
  await checkbox.focus();
  await expect(checkbox).toBeFocused();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  ).toBeLessThanOrEqual(1);
  const accessibility = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  expect(
    accessibility.violations.filter(
      (item) => item.impact === 'serious' || item.impact === 'critical'
    )
  ).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot('meeting-u04-preparation-text-200.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixelRatio: 0.002,
  });
});

test('U04 approved-size Korean light baseline keeps the work-first preparation hierarchy', async ({
  page,
  isMobile,
}) => {
  await page.setViewportSize({ width: isMobile ? 390 : 1440, height: 960 });
  await setup(page, { locale: 'ko' });
  await expect(page.getByText('나의 준비 체크리스트', { exact: true })).toBeVisible();
  await expect(page.getByText('회의 목적과 준비', { exact: true })).toBeVisible();
  await expect(page.getByText('순서 있는 의제', { exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot('meeting-u04-ko-light-approved-size.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixelRatio: 0.002,
  });
});
