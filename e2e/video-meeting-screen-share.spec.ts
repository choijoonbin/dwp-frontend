import { createHmac, randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Route } from '@playwright/test';

import {
  MEETING_VISUAL_ID,
  MEETING_VISUAL_NOW,
  MEETING_VISUAL_SUMMARY,
  mockMeetingVisualPrejoin,
  mockMeetingVisualSession,
} from './support/video-meeting-visual-fixtures';
import { expectNoHorizontalOverflow } from './support/video-meeting-visual-accessibility';

test.skip(
  process.env.DWP_LIVEKIT_SMOKE !== 'true',
  'Requires the explicit local disposable LiveKit probe.'
);

function success(route: Route, data: unknown) {
  return route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', success: true, message: 'OK', data }),
  });
}

test('local screen sharing hides the recursive preview and keeps an announced status', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Desktop media publication evidence.');
  test.setTimeout(90_000);

  const apiKey = process.env.DWP_LIVEKIT_API_KEY;
  const apiSecret = process.env.DWP_LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) throw new Error('Explicit local SFU credentials required');

  const roomName = `dwp-screen-share-${randomUUID()}`;
  const participantId = '82000000-0000-0000-0000-000000000301';
  const participant = {
    ...MEETING_VISUAL_SUMMARY.participants[0],
    participantId,
    attendanceState: 'JOINED',
    admittedAt: '2026-08-31T04:01:00Z',
    joinedAt: '2026-08-31T04:02:00Z',
  };
  const now = Math.floor(Date.now() / 1_000);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const jwt = (subject: string, video: Record<string, unknown>, metadata?: string) => {
    const body = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
      iss: apiKey,
      sub: subject,
      name: participant.displayName,
      metadata,
      nbf: now - 5,
      exp: now + 180,
      video,
    })}`;
    return `${body}.${createHmac('sha256', apiSecret).update(body).digest('base64url')}`;
  };
  const adminToken = jwt('screen-share-visual-operator', {
    roomCreate: true,
    roomAdmin: true,
    roomList: true,
    room: roomName,
  });
  const command = async (name: 'CreateRoom' | 'DeleteRoom', body: unknown) => {
    const response = await fetch(`http://127.0.0.1:7880/twirp/livekit.RoomService/${name}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    expect(response.ok, `Local SFU ${name}: ${response.status}`).toBe(true);
  };

  await command('CreateRoom', { name: roomName, empty_timeout: 30, max_participants: 2 });
  try {
    await mockMeetingVisualSession(page, {
      locale: 'ko',
      colorScheme: 'dark',
      reducedMotion: true,
    });
    await mockMeetingVisualPrejoin(page);
    await page.addInitScript(() => {
      const mediaDevices = navigator.mediaDevices;
      if (!mediaDevices) return;
      Object.defineProperty(mediaDevices, 'getDisplayMedia', {
        configurable: true,
        value: async (options?: DisplayMediaStreamOptions) => {
          Object.assign(window, {
            __dwpScreenCaptureOptions: JSON.parse(JSON.stringify(options ?? {})),
          });
          const canvas = document.createElement('canvas');
          canvas.width = 1_280;
          canvas.height = 720;
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Synthetic screen-share canvas is unavailable.');
          context.fillStyle = '#172033';
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.fillStyle = '#f7f9fb';
          context.font = '600 42px sans-serif';
          context.fillText('DWP presentation surface', 72, 112);
          const stream = canvas.captureStream(5);
          Object.assign(window, { __dwpScreenCaptureStream: stream });
          return stream;
        },
      });
    });

    await page.route(`**/api/meetings/v1/meetings/${MEETING_VISUAL_ID}`, (route) =>
      success(route, {
        ...MEETING_VISUAL_SUMMARY,
        lifecycleState: 'LIVE',
        provider: 'LIVEKIT',
        participants: [participant],
        artifacts: [],
        recordingAvailable: false,
        transcriptAvailable: false,
        aiNotesAvailable: false,
        canHost: true,
        canModerate: true,
        version: 8,
      })
    );
    await page.route(`**/api/meetings/v1/meetings/${MEETING_VISUAL_ID}/token`, (route) =>
      success(route, {
        meetingId: MEETING_VISUAL_ID,
        sessionId: participantId,
        provider: 'LIVEKIT',
        serverUrl: 'ws://127.0.0.1:7880',
        participantToken: jwt(
          `tenant:1:meeting:${MEETING_VISUAL_ID}:participant:${participantId}:user:42`,
          {
            roomJoin: true,
            room: roomName,
            canPublish: true,
            canSubscribe: true,
            canPublishData: true,
          },
          JSON.stringify({
            schemaVersion: 1,
            tenantId: 1,
            meetingId: MEETING_VISUAL_ID,
            participantId,
            userId: 42,
            meetingRole: 'ORGANIZER',
            reactionsAllowed: true,
          })
        ),
        participantRole: 'ORGANIZER',
        expiresAt: new Date(Date.now() + 180_000).toISOString(),
        effectivePermissions: {
          microphone: true,
          camera: true,
          screenShare: true,
          participantList: true,
          chat: true,
          reactions: true,
          handRaise: true,
        },
      })
    );
    await page.route(`**/api/meetings/v1/meetings/${MEETING_VISUAL_ID}/connected`, (route) =>
      success(route, participant)
    );
    await page.route(`**/api/meetings/v1/meetings/${MEETING_VISUAL_ID}/leave`, (route) =>
      success(route, { ...participant, attendanceState: 'LEFT' })
    );
    await page.route(`**/api/meetings/v1/meetings/${MEETING_VISUAL_ID}/preparation`, (route) =>
      success(route, {
        meetingId: MEETING_VISUAL_ID,
        meetingVersion: 8,
        agendaVersion: 0,
        materialsVersion: 0,
        invitationRevision: 0,
        agendaItems: [],
        materials: [],
        myResponse: null,
        invitationResponses: [],
        invitationCounts: { accepted: 1, tentative: 0, declined: 0, pending: 0 },
        myPreparation: {
          agendaVersion: 0,
          version: 0,
          preparedAgendaItemIds: [],
          updatedAt: null,
        },
        canEditAgenda: true,
        canManageMaterials: true,
        canRespond: false,
        canPrepare: true,
        observedAt: MEETING_VISUAL_NOW.toISOString(),
      })
    );

    await page.setViewportSize({ width: 1_280, height: 900 });
    await page.goto(`/meetings/room/${MEETING_VISUAL_ID}`);
    await page.getByRole('button', { name: '카메라와 마이크 점검' }).click();
    await page.getByRole('button', { name: '회의 참여', exact: true }).click();
    const share = page.getByRole('button', { name: '화면 공유 시작' });
    await expect(share).toBeVisible();
    await share.click();

    const guidance = page.getByTestId('local-screen-share-guidance');
    await expect(guidance).toContainText('화면을 공유하고 있습니다');
    await expect(guidance).toContainText('내 미리보기는 숨겼습니다');
    await expect(
      page.locator('.dwp-meeting-conference__stage [data-lk-source="screen_share"]')
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () =>
          (
            window as unknown as {
              __dwpScreenCaptureOptions?: DisplayMediaStreamOptions;
            }
          ).__dwpScreenCaptureOptions
      )
    ).toMatchObject({
      audio: true,
      video: { displaySurface: 'window' },
      selfBrowserSurface: 'exclude',
      surfaceSwitching: 'include',
      preferCurrentTab: false,
    });

    const accessibility = await new AxeBuilder({ page })
      .include('.dwp-meeting-conference__stage')
      .analyze();
    expect(
      accessibility.violations.filter(
        (violation) => violation.impact === 'critical' || violation.impact === 'serious'
      )
    ).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath('meeting-local-screen-share-recursion-guard-1280.png'),
      fullPage: false,
    });

    await page.getByRole('button', { name: '닫기', exact: true }).click();
    for (const viewport of [
      { label: '1440', width: 1_440, height: 960, enlargedText: false },
      { label: '390', width: 390, height: 844, enlargedText: false },
      { label: '320', width: 320, height: 720, enlargedText: false },
      { label: 'text-200', width: 1_280, height: 900, enlargedText: true },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.evaluate((enlargedText) => {
        document.documentElement.style.fontSize = enlargedText ? '200%' : '';
      }, viewport.enlargedText);
      await expect(guidance).toBeVisible();
      await expectNoHorizontalOverflow(page, `local screen-share guidance ${viewport.label}`);
      const bounds = await guidance.boundingBox();
      expect(bounds, `local screen-share guidance ${viewport.label}: bounds`).not.toBeNull();
      expect(
        bounds!.x,
        `local screen-share guidance ${viewport.label}: left edge`
      ).toBeGreaterThanOrEqual(0);
      expect(
        bounds!.x + bounds!.width,
        `local screen-share guidance ${viewport.label}: right edge`
      ).toBeLessThanOrEqual(viewport.width);
      await page.screenshot({
        path: testInfo.outputPath(
          `meeting-local-screen-share-recursion-guard-${viewport.label}.png`
        ),
        fullPage: false,
      });
    }

    await page.setViewportSize({ width: 1_280, height: 900 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '';
    });

    await page.getByRole('button', { name: '화면 공유 중지' }).click();
    await expect(guidance).toHaveCount(0);
  } finally {
    await command('DeleteRoom', { room: roomName });
  }
});
