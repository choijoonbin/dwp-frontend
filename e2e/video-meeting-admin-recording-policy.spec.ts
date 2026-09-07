import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import { openMeetingRecordingPolicy } from './support/video-meeting-admin-policy';
import { mockMeetingVisualSession } from './support/video-meeting-visual-fixtures';

type RecordingPolicy = 'NEVER' | 'HOST_OPT_IN' | 'ADMIN_REQUIRED';

const POLICY = {
  meetingsEnabled: true,
  waitingRoomRequired: true,
  guestsAllowed: false,
  participantChatAllowed: true,
  reactionsAllowed: true,
  screenShareAllowed: true,
  unmuteControl: 'REQUEST_ONLY',
  recordingPolicy: 'NEVER' as RecordingPolicy,
  retentionDays: 90,
  artifactRetentionDays: 30,
  chatRetentionDays: 60,
  allowJoinBeforeHost: false,
  requireAuthenticatedInternalUsers: true,
  maximumParticipants: 100,
  recordingConfigured: true,
  aiNotesConfigured: false,
  version: 4,
};

function fulfill(route: Route, data: unknown) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', success: true, data }),
  });
}

async function selectRecordingPolicy(page: Page, label: string) {
  await page.getByRole('combobox', { name: 'Allow recording' }).click();
  await page.getByRole('option', { name: label }).click();
}

test('U14 lets an authorized administrator explicitly select and persist all recording policies', async ({
  page,
}) => {
  await mockMeetingVisualSession(page, { locale: 'en', admin: true, reducedMotion: true });
  let current = { ...POLICY };
  const saved: Array<Record<string, unknown>> = [];
  await page.route('**/api/meetings/v1/admin/policy', async (route) => {
    if (route.request().method() === 'GET') return fulfill(route, current);
    const payload = route.request().postDataJSON() as Record<string, unknown>;
    saved.push(payload);
    current = {
      ...current,
      ...payload,
      recordingPolicy: payload.recordingPolicy as RecordingPolicy,
      version: current.version + 1,
    };
    return fulfill(route, current);
  });

  await page.goto('/meetings/admin/policies');
  const recording = await openMeetingRecordingPolicy(page);
  await expect(recording).toBeEnabled();
  await expect(recording).toHaveText('Disabled by tenant policy');

  const cases = [
    {
      policy: 'HOST_OPT_IN',
      label: 'Host opt-in with governed consent',
      evidence: 'Host opt-in permits only a governed recording request.',
    },
    {
      policy: 'ADMIN_REQUIRED',
      label: 'Required by tenant administrators',
      evidence: 'This inherited policy is preserved until explicitly changed.',
    },
    {
      policy: 'NEVER',
      label: 'Disabled by tenant policy',
      evidence: 'Allow hosts to request governed recording after participant notice and consent.',
    },
  ] as const;

  for (const item of cases) {
    await selectRecordingPolicy(page, item.label);
    await expect(recording).toHaveText(item.label);
    await expect(page.getByText(item.evidence)).toBeVisible();
    if (item.policy === 'ADMIN_REQUIRED') {
      await test.info().attach('u14-admin-required-policy', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });
    }
    await page.getByRole('button', { name: 'Save policy' }).click();
    const dialog = page.getByRole('dialog', { name: 'Apply these policy changes?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Save policy' }).click();
    await expect.poll(() => saved.length).toBe(cases.indexOf(item) + 1);
    expect(saved.at(-1)).toMatchObject({
      recordingPolicy: item.policy,
      expectedVersion: current.version - 1,
    });
  }

  const accessibility = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
});
