/** Called only by the opt-in isolated PostgreSQL/LiveKit JUnit probe. */
import assert from 'node:assert/strict';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

assert.equal(process.env.DWP_LIVEKIT_SMOKE, 'true');
const contract = JSON.parse(process.env.DWP_WATCHDOG_CONTRACT);
const apiUrl = process.env.DWP_LIVEKIT_API_URL;
const clientUrl = process.env.DWP_LIVEKIT_CLIENT_URL;
for (const value of [apiUrl, clientUrl, contract.bridgeUrl]) {
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(value).hostname));
}
const sdk = await readFile(resolve('node_modules/livekit-client/dist/livekit-client.umd.js'));
const apiKey = process.env.DWP_LIVEKIT_API_KEY;
const apiSecret = process.env.DWP_LIVEKIT_API_SECRET;
assert.ok(apiKey && apiSecret);
function jwt(claims) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ iss: apiKey, nbf: now - 5, exp: now + 180, ...claims })}`;
  return `${body}.${createHmac('sha256', apiSecret).update(body).digest('base64url')}`;
}
const identity = (participant) =>
  `tenant:1:meeting:${contract.meetingId}:participant:${participant.id}:incarnation:${contract.incarnation}:user:${participant.userId}`;
function participantToken(participant) {
  return jwt({
    sub: identity(participant),
    name: 'Disposable synthetic participant',
    metadata: JSON.stringify({
      schemaVersion: 1,
      tenantId: 1,
      meetingId: contract.meetingId,
      participantId: participant.id,
      roomIncarnation: contract.incarnation,
      userId: participant.userId,
      meetingRole: participant.role,
      reactionsAllowed: false,
    }),
    video: {
      roomJoin: true,
      room: contract.roomName,
      canPublish: false,
      canSubscribe: true,
      canPublishData: false,
    },
  });
}
const admin = jwt({
  sub: 'disposable-watchdog-probe',
  video: { roomAdmin: true, roomList: true, roomCreate: true, room: contract.roomName },
});
async function command(name, body) {
  const response = await fetch(`${apiUrl}/twirp/livekit.RoomService/${name}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${admin}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(response.ok, true, `${name} HTTP ${response.status}`);
  return response.json();
}
const server = createServer((request, response) => {
  response.setHeader(
    'content-type',
    request.url === '/sdk.js' ? 'application/javascript' : 'text/html'
  );
  response.end(
    request.url === '/sdk.js'
      ? sdk
      : '<!doctype html><html lang="en"><title>Disposable participant</title><body></body></html>'
  );
});
await new Promise((accept) => server.listen(0, '127.0.0.1', accept));
const browser = await chromium.launch({ headless: true });
const evidence = { scope: 'ISOLATED_PG_SIGNED_FIXTURE_WEBHOOK_REAL_SFU', checks: {} };
try {
  const host = await browser.newPage();
  const guest = await browser.newPage();
  for (const page of [host, guest]) {
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.addScriptTag({ url: `http://127.0.0.1:${server.address().port}/sdk.js` });
    await page.evaluate(() => {
      window.physicalCaptureRequests = 0;
      for (const method of ['getUserMedia', 'getDisplayMedia']) {
        navigator.mediaDevices[method] = async () => {
          window.physicalCaptureRequests += 1;
          throw new Error('Physical capture forbidden');
        };
      }
      window.room = new window.LivekitClient.Room();
    });
  }
  const originalGuestToken = participantToken(contract.guest);
  for (const [page, token] of [
    [host, participantToken(contract.host)],
    [guest, originalGuestToken],
  ]) {
    await page.evaluate(({ endpoint, token }) => window.room.connect(endpoint, token), {
      endpoint: clientUrl,
      token,
    });
  }
  await host.waitForFunction(() => window.room.remoteParticipants.size === 1);
  const disconnect = await fetch(`${contract.bridgeUrl}/disconnect`, { method: 'POST' });
  assert.equal(disconnect.status, 200);
  assert.equal((await disconnect.json()).state, 'DISCONNECTED');
  await guest.waitForFunction(() => window.room.state === 'disconnected');
  evidence.checks.hostCommandActuallyDisconnectedGuest = true;
  await guest.evaluate(({ endpoint, token }) => window.room.connect(endpoint, token), {
    endpoint: clientUrl,
    token: originalGuestToken,
  });
  await host.waitForFunction(() => window.room.remoteParticipants.size === 1);
  evidence.checks.cachedJwtActuallyReconnected = true;

  const room = (await command('ListRooms', { names: [contract.roomName] })).rooms[0];
  const participant = (
    await command('ListParticipants', { room: contract.roomName })
  ).participants.find((item) => item.identity === identity(contract.guest));
  assert.ok(participant);
  const body = JSON.stringify({
    event: 'participant_joined',
    id: `EV_probe_${randomUUID()}`,
    createdAt: Math.floor(Date.now() / 1000),
    room,
    participant,
  });
  const authorization = `Bearer ${jwt({ sha256: createHash('sha256').update(body).digest('base64') })}`;
  for (let delivery = 0; delivery < 2; delivery += 1) {
    const response = await fetch(`${contract.bridgeUrl}/signed-webhook`, {
      method: 'POST',
      headers: { Authorization: authorization, 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    assert.equal(response.status, 204, `Signed delivery ${delivery} HTTP ${response.status}`);
  }
  await guest.waitForFunction(() => window.room.state === 'disconnected');
  await host.waitForFunction(() => window.room.remoteParticipants.size === 0);
  assert.equal(await host.evaluate(() => window.room.state), 'connected');
  evidence.checks.signedWebhookActuallyDisconnectedRejoinedGuest = true;
  evidence.checks.hostStayedConnected = true;
  evidence.checks.duplicateSignedDeliveryAccepted = true;
  evidence.physicalCaptureRequests =
    (await host.evaluate(() => window.physicalCaptureRequests)) +
    (await guest.evaluate(() => window.physicalCaptureRequests));
  assert.equal(evidence.physicalCaptureRequests, 0);
} finally {
  await browser.close();
  await command('DeleteRoom', { room: contract.roomName });
  assert.equal((await command('ListRooms', { names: [contract.roomName] })).rooms?.length ?? 0, 0);
  await new Promise((accept) => server.close(accept));
}
evidence.checks.disposableRoomRemoved = true;
evidence.exclusions = [
  'Automatic LiveKit webhook delivery configuration',
  'Production network/delivery latency',
  'Admission-time JWT revocation',
  'Recording/STT/LLM/customer retention',
];
process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
