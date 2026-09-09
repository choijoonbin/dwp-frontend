import { createHmac, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Route } from '@playwright/test';
import {
  MEETING_VISUAL_ID,
  MEETING_VISUAL_SUMMARY,
  mockMeetingVisualPrejoin,
  mockMeetingVisualSession,
} from './support/video-meeting-visual-fixtures';

// Explicit local integration: DWP API fixtures, real disposable SFU participants.
test.skip(
  process.env.DWP_LIVEKIT_SMOKE !== 'true',
  'Requires explicit local disposable SFU probe.'
);
function success(route: Route, data: unknown) {
  return route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', success: true, message: 'OK', data }),
  });
}
test('host confirms one participant disconnect in the actual connected room', async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(90_000);
  const mobile = testInfo.project.name === 'mobile';
  const labels = mobile
    ? {
        devices: '카메라와 마이크 점검',
        join: '회의 참여',
        people: '참가자 목록 열기',
        cancel: '취소',
        disconnect: '연결 종료',
      }
    : {
        devices: 'Check camera and microphone',
        join: 'Join meeting',
        people: 'Open participant list',
        cancel: 'Cancel',
        disconnect: 'Disconnect',
      };
  const apiKey = process.env.DWP_LIVEKIT_API_KEY;
  const apiSecret = process.env.DWP_LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) throw new Error('Explicit local SFU credentials required');
  const roomName = `dwp-disposable-ui-${randomUUID()}`;
  const incarnation = randomUUID();
  const peer = {
    ...MEETING_VISUAL_SUMMARY.participants[1],
    displayName: mobile ? '알렉스 이 · 글로벌 고객 경험 및 아시아 태평양 사업 담당' : 'Alex Lee',
    attendanceState: 'JOINED',
    admittedAt: '2026-08-31T04:01:00Z',
    joinedAt: '2026-08-31T04:02:00Z',
  };
  const host = {
    ...MEETING_VISUAL_SUMMARY.participants[0],
    attendanceState: 'JOINED',
    admittedAt: '2026-08-31T04:01:00Z',
    joinedAt: '2026-08-31T04:02:00Z',
  };
  const identity = (participant: typeof host | typeof peer) =>
    `tenant:1:meeting:${MEETING_VISUAL_ID}:participant:${participant.participantId}:incarnation:${incarnation}:user:${participant.userId}`;
  function jwt(subject: string, video: Record<string, unknown>, name = subject, metadata?: string) {
    const now = Math.floor(Date.now() / 1000);
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const body = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ iss: apiKey, sub: subject, name, metadata, nbf: now - 5, exp: now + 180, video })}`;
    return `${body}.${createHmac('sha256', apiSecret!).update(body).digest('base64url')}`;
  }
  const admin = jwt('disposable-ui-operator', {
    roomCreate: true,
    roomAdmin: true,
    roomList: true,
    room: roomName,
  });
  async function command(name: string, body: unknown) {
    const response = await fetch(`http://127.0.0.1:7880/twirp/livekit.RoomService/${name}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${admin}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    expect(response.ok, `Local SFU ${name}: ${response.status}`).toBe(true);
    return response.json() as Promise<{ rooms?: unknown[] }>;
  }
  const participantToken = (participant: typeof host | typeof peer) =>
    jwt(
      identity(participant),
      {
        roomJoin: true,
        room: roomName,
        canPublish: false,
        canSubscribe: true,
        canPublishData: false,
      },
      participant.displayName,
      JSON.stringify({
        schemaVersion: 1,
        tenantId: 1,
        meetingId: MEETING_VISUAL_ID,
        participantId: participant.participantId,
        roomIncarnation: incarnation,
        userId: participant.userId,
        meetingRole: participant.participantRole,
        reactionsAllowed: false,
      })
    );
  await command('CreateRoom', { name: roomName, empty_timeout: 30, max_participants: 3 });
  const guest = await context.newPage();
  let disconnectCount = 0;
  const requests: Array<{ body: unknown; key: string | undefined }> = [];
  try {
    await mockMeetingVisualSession(page, {
      locale: mobile ? 'ko' : 'en',
      colorScheme: mobile ? 'dark' : 'light',
      reducedMotion: true,
    });
    await mockMeetingVisualPrejoin(page);
    await page.route(`**/api/meetings/v1/meetings/${MEETING_VISUAL_ID}`, (route) =>
      success(route, {
        ...MEETING_VISUAL_SUMMARY,
        lifecycleState: 'LIVE',
        provider: 'LIVEKIT',
        participants: [host, peer],
        recordingAvailable: false,
        transcriptAvailable: false,
        canHost: true,
        canModerate: true,
      })
    );
    await page.route(`**/api/meetings/v1/meetings/${MEETING_VISUAL_ID}/token`, (route) =>
      success(route, {
        meetingId: MEETING_VISUAL_ID,
        sessionId: host.participantId,
        provider: 'LIVEKIT',
        serverUrl: 'ws://127.0.0.1:7880',
        participantToken: participantToken(host),
        participantRole: 'ORGANIZER',
        expiresAt: new Date(Date.now() + 180_000).toISOString(),
        effectivePermissions: {
          microphone: false,
          camera: false,
          screenShare: false,
          participantList: true,
          chat: false,
          reactions: false,
          handRaise: false,
        },
      })
    );
    await page.route(`**/api/meetings/v1/meetings/${MEETING_VISUAL_ID}/connected`, (route) =>
      success(route, host)
    );
    await page.route(`**/api/meetings/v1/meetings/${MEETING_VISUAL_ID}/leave`, (route) =>
      success(route, { ...host, attendanceState: 'LEFT' })
    );
    await page.route(
      `**/api/meetings/v1/meetings/${MEETING_VISUAL_ID}/participants/${peer.participantId}/disconnect`,
      async (route) => {
        requests.push({
          body: route.request().postDataJSON(),
          key: route.request().headers()['idempotency-key'],
        });
        disconnectCount += 1;
        await command('RemoveParticipant', { room: roomName, identity: identity(peer) });
        await success(route, {
          meetingId: MEETING_VISUAL_ID,
          participantId: peer.participantId,
          commandId: randomUUID(),
          state: 'DISCONNECTED',
          blockedForCurrentSession: true,
        });
      }
    );
    await page.goto(`/meetings/room/${MEETING_VISUAL_ID}`);
    await page.getByRole('button', { name: labels.devices }).click();
    await page.getByRole('button', { name: labels.join, exact: true }).click();
    await expect(page.getByRole('button', { name: labels.people })).toBeVisible();
    await guest.route('**/synthetic-guest', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><html lang="en"><title>Synthetic guest</title><body></body></html>',
      })
    );
    await guest.goto('/synthetic-guest');
    await guest.addScriptTag({
      path: resolve('node_modules/livekit-client/dist/livekit-client.umd.js'),
    });
    await guest.evaluate(
      async ({ token }) => {
        const sdk = (
          window as unknown as {
            LivekitClient: {
              Room: new () => { connect: (url: string, token: string) => Promise<void> };
            };
          }
        ).LivekitClient;
        const room = new sdk.Room();
        Object.assign(window, { disposableGuestRoom: room });
        await room.connect('ws://127.0.0.1:7880', token);
      },
      { token: participantToken(peer) }
    );
    await page.getByRole('button', { name: labels.people }).click();
    const disconnect = page.getByRole('button', {
      name: mobile ? `${peer.displayName} 연결 종료` : `Disconnect ${peer.displayName}`,
      exact: true,
    });
    await expect(disconnect).toBeVisible();
    for (const width of mobile ? [390, 320] : [1440, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      if (width === 320) {
        await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '200%';
        });
      }
      const box = await disconnect.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
      await disconnect.click();
      const dialog = page.getByRole('alertdialog');
      await expect(dialog).toContainText(peer.displayName);
      const cancel = dialog.getByRole('button', { name: labels.cancel });
      const confirm = dialog.getByRole('button', { name: labels.disconnect, exact: true });
      await expect(cancel).toBeFocused();
      await cancel.press('Tab');
      await expect(confirm).toBeFocused();
      await confirm.press('Tab');
      await expect(cancel).toBeFocused();
      for (const action of [cancel, confirm]) {
        const target = await action.boundingBox();
        expect(target!.height).toBeGreaterThanOrEqual(44);
        expect(target!.x).toBeGreaterThanOrEqual(0);
        expect(target!.x + target!.width).toBeLessThanOrEqual(width + 1);
      }
      expect(disconnectCount).toBe(0);
      const a11y = await new AxeBuilder({ page }).include('[role="alertdialog"]').analyze();
      expect(
        a11y.violations.filter((item) => item.impact === 'critical' || item.impact === 'serious')
      ).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath(`meeting-disconnect-${width}.png`) });
      await cancel.click();
      await expect(disconnect).toBeFocused();
    }
    await disconnect.click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: labels.disconnect, exact: true })
      .click();
    await expect.poll(() => disconnectCount).toBe(1);
    await expect(page.locator('.dwp-meeting-participants__list')).not.toContainText(
      peer.displayName
    );
    expect(requests[0]?.body).toEqual({ expectedVersion: peer.version });
    expect(requests[0]?.key).toMatch(/^[0-9a-f-]{36}$/u);
    await expect
      .poll(() =>
        guest.evaluate(
          () =>
            (window as unknown as { disposableGuestRoom: { state: string } }).disposableGuestRoom
              .state
        )
      )
      .toBe('disconnected');
    await expect(page.locator('.dwp-meeting-participants__list')).toContainText('Mina Kim');
  } finally {
    await guest.close();
    await command('DeleteRoom', { room: roomName });
    expect((await command('ListRooms', { names: [roomName] })).rooms ?? []).toEqual([]);
  }
});
