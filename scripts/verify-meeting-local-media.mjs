/**
 * Explicit local LiveKit conformance probe. No physical microphone/camera, DWP account,
 * customer room, recording provider or stored transcript is used. Only the uniquely
 * generated disposable room is removed in finally. Tokens are never written to evidence.
 */
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';

assert.equal(process.env.DWP_LIVEKIT_SMOKE, 'true', 'Set DWP_LIVEKIT_SMOKE=true explicitly.');
const serverUrl = process.env.DWP_LIVEKIT_CLIENT_URL ?? 'ws://127.0.0.1:7880';
const apiUrl = process.env.DWP_LIVEKIT_API_URL ?? 'http://127.0.0.1:7880';
for (const address of [serverUrl, apiUrl]) {
  const url = new URL(address);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Local endpoints only.');
  assert.ok(
    !url.username && !url.password && !url.search && !url.hash,
    'Plain local endpoint required.'
  );
}
const apiKey = process.env.DWP_LIVEKIT_API_KEY;
const apiSecret = process.env.DWP_LIVEKIT_API_SECRET;
assert.ok(apiKey && apiSecret, 'Explicit local LiveKit credentials are required.');
const roomName = `dwp-disposable-synthetic-${randomUUID()}`;
const startedAt = new Date().toISOString();
const output = resolve(process.env.DWP_MEETING_MEDIA_EVIDENCE ?? `/tmp/${roomName}.json`);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sdk = await readFile(resolve(root, 'node_modules/livekit-client/dist/livekit-client.umd.js'));
const evidence = {
  startedAt,
  roomName,
  syntheticOnly: true,
  physicalCaptureRequests: 0,
  checks: {},
};
function jwt(subject, video) {
  const now = Math.floor(Date.now() / 1_000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      iss: apiKey,
      sub: subject,
      name: subject,
      nbf: now - 5,
      exp: now + 120,
      video,
    })
  ).toString('base64url');
  const body = `${header}.${payload}`;
  return `${body}.${createHmac('sha256', apiSecret).update(body).digest('base64url')}`;
}
const administration = jwt('disposable-local-smoke', {
  roomCreate: true,
  roomList: true,
  roomAdmin: true,
  room: roomName,
});
async function command(name, body) {
  const response = await fetch(`${apiUrl}/twirp/livekit.RoomService/${name}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${administration}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  assert.ok(response.ok, `LiveKit ${name} returned HTTP ${response.status}`);
  return response.json();
}
function participantToken(identity) {
  return jwt(identity, {
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
}
const server = createServer((request, response) => {
  response.setHeader('cache-control', 'no-store');
  if (request.url === '/sdk.js') {
    response.setHeader('content-type', 'application/javascript');
    response.end(sdk);
  } else {
    response.setHeader('content-type', 'text/html');
    response.end(
      '<!doctype html><html lang="en"><title>Synthetic local media probe</title><body><script src="/sdk.js"></script></body></html>'
    );
  }
});
await new Promise((accept) => server.listen(0, '127.0.0.1', accept));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
let browser;
let created = false;
try {
  const room = await command('CreateRoom', {
    name: roomName,
    empty_timeout: 30,
    max_participants: 3,
  });
  created = true;
  assert.equal(room.name, roomName);
  browser = await chromium.launch({
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const host = await browser.newPage();
  const guest = await browser.newPage();
  for (const page of [host, guest]) {
    await page.goto(baseUrl);
    await page.evaluate(() => {
      window.physicalCaptureRequests = 0;
      navigator.mediaDevices.getUserMedia = async () => {
        window.physicalCaptureRequests += 1;
        throw new Error('Physical capture is forbidden in the synthetic probe');
      };
      navigator.mediaDevices.getDisplayMedia = async () => {
        window.physicalCaptureRequests += 1;
        throw new Error('Desktop capture is forbidden in the synthetic probe');
      };
      const { Room, RoomEvent } = window.LivekitClient;
      window.room = new Room({ adaptiveStream: false, dynacast: false });
      window.remoteTracks = new Map();
      window.events = [];
      window.room.on(RoomEvent.TrackSubscribed, (track, publication) => {
        window.remoteTracks.set(publication.source, track);
        if (track.kind === 'video') {
          const element = track.attach();
          element.muted = true;
          document.body.append(element);
          void element.play();
        }
      });
      window.room.on(RoomEvent.TrackUnsubscribed, (_track, publication) => {
        window.remoteTracks.delete(publication.source);
      });
      window.room.on(RoomEvent.DataReceived, (bytes) =>
        window.events.push(new TextDecoder().decode(bytes))
      );
      window.room.on(RoomEvent.Disconnected, (reason) => {
        window.disconnectedReason = reason;
      });
    });
  }
  await host.evaluate(({ serverUrl: endpoint, token }) => window.room.connect(endpoint, token), {
    serverUrl,
    token: participantToken('synthetic-host'),
  });
  const originalGuestToken = participantToken('synthetic-guest');
  await guest.evaluate(({ serverUrl: endpoint, token }) => window.room.connect(endpoint, token), {
    serverUrl,
    token: originalGuestToken,
  });
  await guest.waitForFunction(() => window.room.remoteParticipants.size === 1);
  evidence.checks.twoParticipantsConnected = true;
  for (const publisher of [host, guest])
    await publisher.evaluate(async () => {
      const { Track } = window.LivekitClient;
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 180;
      const drawing = canvas.getContext('2d');
      let frame = 0;
      window.syntheticFrameTimer = setInterval(() => {
        drawing.fillStyle = frame++ % 2 ? '#2d68d7' : '#38a169';
        drawing.fillRect(0, 0, 320, 180);
        drawing.fillStyle = 'white';
        drawing.fillText(`Synthetic frame ${frame}`, 20, 50);
      }, 100);
      window.canvas = canvas;
      window.syntheticVideo = canvas.captureStream(10).getVideoTracks()[0];
      const context = new AudioContext();
      await context.resume();
      const destination = context.createMediaStreamDestination();
      const tone = context.createOscillator();
      const volume = context.createGain();
      volume.gain.value = 0.05;
      tone.connect(volume).connect(destination);
      tone.start();
      window.syntheticAudioContext = context;
      window.syntheticAudio = destination.stream.getAudioTracks()[0];
      window.cameraPublication = await window.room.localParticipant.publishTrack(
        window.syntheticVideo,
        { source: Track.Source.Camera }
      );
      await window.room.localParticipant.publishTrack(window.syntheticAudio, {
        source: Track.Source.Microphone,
      });
    });
  for (const receiver of [host, guest])
    await expect
      .poll(
        () =>
          receiver.evaluate(async () => {
            const tracks = window.remoteTracks;
            const camera = tracks.get('camera');
            const microphone = tracks.get('microphone');
            if (!camera || !microphone) return false;
            const cameraStats = await camera.getRTCStatsReport();
            const audioStats = await microphone.getRTCStatsReport();
            return (
              [...(cameraStats?.values() ?? [])].some(
                (stat) => stat.type === 'inbound-rtp' && stat.framesDecoded > 0
              ) &&
              [...(audioStats?.values() ?? [])].some(
                (stat) => stat.type === 'inbound-rtp' && stat.bytesReceived > 0
              )
            );
          }),
        { timeout: 30_000 }
      )
      .toBe(true);
  evidence.checks.receivedMedia = {};
  for (const [name, receiver] of [
    ['host', host],
    ['guest', guest],
  ]) {
    evidence.checks.receivedMedia[name] = await receiver.evaluate(async () => {
      const result = {};
      for (const source of ['camera', 'microphone']) {
        const track = window.remoteTracks.get(source);
        if (!track) throw new Error(`Missing subscribed ${source} track`);
        const stats = await track.getRTCStatsReport();
        result[source] = [...stats.values()]
          .filter((stat) => stat.type === 'inbound-rtp')
          .map(({ bytesReceived, packetsReceived, framesDecoded }) => ({
            bytesReceived,
            packetsReceived,
            framesDecoded,
          }));
      }
      return result;
    });
    assert.ok(evidence.checks.receivedMedia[name].camera.some((stat) => stat.framesDecoded > 0));
    assert.ok(
      evidence.checks.receivedMedia[name].microphone.some((stat) => stat.bytesReceived > 0)
    );
  }
  await host.evaluate(() => window.cameraPublication.mute());
  await guest.waitForFunction(
    () =>
      [...window.room.remoteParticipants.values()][0]?.getTrackPublication('camera')?.isMuted ===
      true
  );
  await host.evaluate(() => window.cameraPublication.unmute());
  await guest.waitForFunction(
    () =>
      [...window.room.remoteParticipants.values()][0]?.getTrackPublication('camera')?.isMuted ===
      false
  );
  evidence.checks.cameraMuteAndResume = true;
  await host.evaluate(async () => {
    window.syntheticShare = window.canvas.captureStream(10).getVideoTracks()[0];
    await window.room.localParticipant.publishTrack(window.syntheticShare, {
      source: window.LivekitClient.Track.Source.ScreenShare,
    });
  });
  await guest.waitForFunction(() => window.remoteTracks.has('screen_share'));
  await host.evaluate(() => window.room.localParticipant.unpublishTrack(window.syntheticShare));
  await guest.waitForFunction(() => !window.remoteTracks.has('screen_share'));
  evidence.checks.syntheticScreenTrackPublishAndStop = true;
  await host.evaluate(() =>
    window.room.localParticipant.publishData(new TextEncoder().encode('synthetic-reaction'), {
      reliable: true,
      topic: 'dwp.meetings.interaction.v1',
    })
  );
  await guest.waitForFunction(() => window.events.includes('synthetic-reaction'));
  await guest.evaluate(() =>
    window.room.localParticipant.publishData(
      new TextEncoder().encode('synthetic-acknowledgement'),
      { reliable: true, topic: 'dwp.meetings.interaction.v1' }
    )
  );
  await host.waitForFunction(() => window.events.includes('synthetic-acknowledgement'));
  evidence.checks.reliableDataChannel = true;
  await command('RemoveParticipant', { room: roomName, identity: 'synthetic-guest' });
  await guest.waitForFunction(() => window.room.state === 'disconnected');
  await host.waitForFunction(() => window.room.remoteParticipants.size === 0);
  assert.equal(await host.evaluate(() => window.room.state), 'connected');
  evidence.checks.disconnectTargetsOnlyOneParticipant = true;
  await guest.evaluate(({ serverUrl: endpoint, token }) => window.room.connect(endpoint, token), {
    serverUrl,
    token: originalGuestToken,
  });
  await host.waitForFunction(() => window.room.remoteParticipants.size === 1);
  evidence.operationalLimits = {
    selfHostedRemovedParticipantCanReuseExistingJwt: true,
    applicationTokenFenceWasNotExercisedByRawSdkProbe: true,
  };
  evidence.physicalCaptureRequests =
    (await host.evaluate(() => window.physicalCaptureRequests)) +
    (await guest.evaluate(() => window.physicalCaptureRequests));
  assert.equal(evidence.physicalCaptureRequests, 0);
  await command('DeleteRoom', { room: roomName });
  created = false;
  await Promise.all(
    [host, guest].map((page) => page.waitForFunction(() => window.room.state === 'disconnected'))
  );
  evidence.checks.hostEndDisconnectsEveryone = true;
  const remaining = await command('ListRooms', { names: [roomName] });
  assert.equal(remaining.rooms?.length ?? 0, 0);
  evidence.checks.disposableRoomRemoved = true;
  evidence.status = 'PASS_LOCAL_SYNTHETIC_SFU_ONLY';
} catch (error) {
  evidence.status = 'FAIL';
  evidence.error = (error instanceof Error ? error.message : String(error)).replace(
    /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/gu,
    '[redacted JWT]'
  );
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (created) {
    try {
      await command('DeleteRoom', { room: roomName });
      evidence.checks.disposableRoomRemoved = true;
    } catch {
      evidence.checks.disposableRoomRemoved = false;
      evidence.status = 'FAIL';
      process.exitCode = 1;
    }
  }
  await new Promise((accept) => server.close(accept));
  evidence.finishedAt = new Date().toISOString();
  evidence.exclusions = [
    'DWP admission and authorization API',
    'Production TURN and TLS',
    'Recording/Egress',
    'STT/LLM',
    'KMS',
    'Retention/deletion of customer records',
  ];
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(
    JSON.stringify({ status: evidence.status, evidence: output, checks: evidence.checks })
  );
}
