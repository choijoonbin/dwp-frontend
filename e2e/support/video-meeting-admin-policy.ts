import type { Page } from '@playwright/test';

export const MEETING_MEMBER_PERMISSIONS = ['VIEW', 'CREATE', 'UPDATE'].map((permissionCode) => ({
  resourceType: 'APP',
  resourceKey: 'APP.MEETINGS',
  permissionCode,
  effect: 'ALLOW' as const,
}));

const EDITOR_SECTIONS = ['Recording and AI', 'In-meeting collaboration', 'Retention policy'];

export async function openMeetingPolicyEditor(page: Page) {
  for (const section of EDITOR_SECTIONS) {
    await page.getByRole('heading', { level: 2, name: section }).click();
  }
  return {
    recordingPolicy: page.getByRole('combobox', { name: 'Allow recording' }),
    participantChat: page.getByRole('switch', { name: 'Allow participant chat' }),
    chatRetention: page.getByLabel('Meeting chat retention (days)'),
  };
}

export async function openMeetingRecordingPolicy(page: Page) {
  const recordingPolicy = page.getByRole('combobox', { name: 'Allow recording' });
  if (!(await recordingPolicy.isVisible())) {
    await page.getByRole('heading', { level: 2, name: 'Recording and AI' }).click();
  }
  return recordingPolicy;
}
