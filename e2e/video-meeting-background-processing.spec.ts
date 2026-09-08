import { writeFile } from 'node:fs/promises';
import { expect, test, type TestInfo } from '@playwright/test';

async function evidence(testInfo: TestInfo, name: string, value: unknown) {
  const path = testInfo.outputPath(`${name}.json`);
  await writeFile(path, JSON.stringify(value, null, 2));
  await testInfo.attach(name, { path, contentType: 'application/json' });
}

test('canonical CSP: local blur uses only same-origin assets and publishes the derived frame over WebRTC', async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  // Exercise the actual canonical header. This positive case never relaxes CSP.
  const expectedOrigin = new URL(testInfo.project.use.baseURL ?? 'http://localhost:4200').origin;
  const externalRequests: string[] = [];
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== expectedOrigin)
      externalRequests.push(request.url());
  });
  const response = await page.goto('/');
  expect(response?.headers()['content-security-policy']).toContain("'wasm-unsafe-eval'");
  const result = await page.evaluate(async () => {
    const modulePath = '/src/features/meetings/meeting-background-processor.ts';
    const { createMeetingBackgroundProcessor, isMeetingBackgroundSupported } = await import(
      modulePath
    );
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 180;
    const context = canvas.getContext('2d')!;
    for (let x = 0; x < 320; x += 4) {
      context.fillStyle = x % 8 ? 'white' : 'black';
      context.fillRect(x, 0, 4, 180);
    }
    const raw = canvas.captureStream(20).getVideoTracks()[0];
    const states: { state: string; reason?: string }[] = [];
    const processor = createMeetingBackgroundProcessor({
      onStateChange: (state: { state: string }) => states.push(state),
      stopInputOnFailure: true,
    });
    const animation = setInterval(() => {
      context.fillStyle = 'black';
      context.fillRect(0, 0, 1, 1);
    }, 50);
    const sender = new RTCPeerConnection({ iceServers: [] });
    const receiver = new RTCPeerConnection({ iceServers: [] });
    try {
      if (!isMeetingBackgroundSupported()) {
        try {
          await processor.start(raw);
        } catch {
          /* Required fail-closed unsupported browser path. */
        }
        return { supported: false, states, rawEnded: raw.readyState === 'ended' };
      }
      const output: MediaStreamTrack = await processor.start(raw);
      const remote = new Promise<MediaStreamTrack>((resolve) => {
        receiver.ontrack = (event) => resolve(event.track);
      });
      sender.onicecandidate = (event) => {
        if (event.candidate) void receiver.addIceCandidate(event.candidate);
      };
      receiver.onicecandidate = (event) => {
        if (event.candidate) void sender.addIceCandidate(event.candidate);
      };
      sender.addTrack(output, new MediaStream([output]));
      await sender.setLocalDescription(await sender.createOffer());
      await receiver.setRemoteDescription(sender.localDescription!);
      await receiver.setLocalDescription(await receiver.createAnswer());
      await sender.setRemoteDescription(receiver.localDescription!);
      const incoming = await remote;
      const video = document.createElement('video');
      video.muted = true;
      video.srcObject = new MediaStream([incoming]);
      await video.play();
      await new Promise((resolve) => setTimeout(resolve, 500));
      const sample = document.createElement('canvas');
      sample.width = 320;
      sample.height = 180;
      const sampleContext = sample.getContext('2d')!;
      sampleContext.drawImage(video, 0, 0);
      const pixels = sampleContext.getImageData(20, 90, 280, 1).data;
      const levels = Array.from(pixels).filter((_, index) => index % 4 === 0);
      const mean = levels.reduce((total, value) => total + value, 0) / levels.length;
      const variance =
        levels.reduce((total, value) => total + (value - mean) ** 2, 0) / levels.length;
      return {
        supported: true,
        states,
        distinct: output.id !== raw.id,
        publishedDerived: sender.getSenders()[0].track === output,
        mean,
        variance,
      };
    } finally {
      clearInterval(animation);
      await processor.destroy();
      raw.stop();
      sender.close();
      receiver.close();
    }
  });
  await evidence(testInfo, 'local-blur-webrtc-evidence', {
    policy: 'actual canonical header, no test CSP relaxation',
    result,
    externalRequestCount: externalRequests.length,
  });
  expect(externalRequests).toEqual([]);
  if (!result.supported) {
    expect(result.rawEnded).toBe(true);
    expect(result.states).toContainEqual({ state: 'failed', reason: 'UNSUPPORTED' });
  } else {
    expect(result.distinct).toBe(true);
    expect(result.publishedDerived).toBe(true);
    expect(result.states).toContainEqual({ state: 'ready' });
    expect(result.mean).toBeGreaterThan(20);
    // Raw alternating black/white stripes have variance 16,256. Derived video is materially blurred.
    expect(result.variance).toBeLessThan(13800);
  }
});

test('explicit restrictive CSP rejects the pinned engine without raw publication', async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  // Negative deployment regression: remove only WASM execution permission.
  await page.route(/\/$/, async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch();
    const headers = response.headers();
    headers['content-security-policy'] = headers['content-security-policy'].replace(
      /\s+'wasm-unsafe-eval'/gu,
      ''
    );
    await route.fulfill({ response, headers });
  });
  const expectedOrigin = new URL(testInfo.project.use.baseURL ?? 'http://localhost:4200').origin;
  const externalRequests: string[] = [];
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== expectedOrigin)
      externalRequests.push(request.url());
  });
  const response = await page.goto('/');
  const wasmPermitted =
    response?.headers()['content-security-policy']?.includes("'wasm-unsafe-eval'") ?? false;
  const result = await page.evaluate(async () => {
    const modulePath = '/src/features/meetings/meeting-background-processor.ts';
    const { createMeetingBackgroundProcessor, isMeetingBackgroundSupported } = await import(
      modulePath
    );
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext('2d')!;
    context.fillRect(0, 0, 32, 32);
    const raw = canvas.captureStream(20).getVideoTracks()[0];
    const processor = createMeetingBackgroundProcessor({ stopInputOnFailure: true });
    try {
      const output = await processor.start(raw);
      return { supported: true, ready: true, distinct: output !== raw };
    } catch (error) {
      return {
        supported: isMeetingBackgroundSupported(),
        ready: false,
        reason: (error as { code: string }).code,
        noOutput: !processor.processedTrack,
        rawEnded: raw.readyState === 'ended',
      };
    } finally {
      await processor.destroy();
      raw.stop();
    }
  });
  await evidence(testInfo, 'restrictive-csp-evidence', {
    wasmPermitted,
    result,
    externalRequestCount: externalRequests.length,
  });
  expect(wasmPermitted).toBe(false);
  expect(externalRequests).toEqual([]);
  expect(result.ready).toBe(false);
  expect(result.reason).toBe(result.supported ? 'ASSET_UNAVAILABLE' : 'UNSUPPORTED');
  expect(result.noOutput).toBe(true);
  expect(result.rawEnded).toBe(true);
});

test('unapproved model bytes fail closed without sending raw camera frames or loading WASM', async ({
  page,
}, testInfo) => {
  await page.route(
    '**/assets/meeting-background/**/selfie-segmenter-landscape-v1.tflite',
    (route) => route.fulfill({ body: 'unapproved model', contentType: 'application/octet-stream' })
  );
  const wasmRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith('.wasm')) wasmRequests.push(request.url());
  });
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const modulePath = '/src/features/meetings/meeting-background-processor.ts';
    const { createMeetingBackgroundProcessor, isMeetingBackgroundSupported } = await import(
      modulePath
    );
    const canvas = document.createElement('canvas');
    canvas.getContext('2d')!.fillRect(0, 0, canvas.width, canvas.height);
    const raw = canvas.captureStream(20).getVideoTracks()[0];
    const processor = createMeetingBackgroundProcessor({ stopInputOnFailure: true });
    try {
      await processor.start(raw);
      return { unexpected: true };
    } catch (error) {
      return {
        expected: isMeetingBackgroundSupported() ? 'ASSET_UNTRUSTED' : 'UNSUPPORTED',
        code: (error as { code: string }).code,
        rawEnded: raw.readyState === 'ended',
        noOutput: !processor.processedTrack,
      };
    } finally {
      await processor.destroy();
      raw.stop();
    }
  });
  await evidence(testInfo, 'model-integrity-failure-evidence', {
    result,
    wasmRequestCount: wasmRequests.length,
  });
  expect(result.unexpected).not.toBe(true);
  expect(result.code).toBe(result.expected);
  expect(result.rawEnded).toBe(true);
  expect(result.noOutput).toBe(true);
  expect(wasmRequests).toEqual([]);
});
