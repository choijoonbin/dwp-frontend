import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadMeetingBackgroundSegmenter,
  meetingBackgroundAssetUrl,
} from './meeting-background-assets';

const factory = vi.hoisted(() => vi.fn());
vi.mock('@mediapipe/tasks-vision', () => ({ ImageSegmenter: { createFromOptions: factory } }));
const base = new URL(
  '../../../../../public/assets/meeting-background/mediapipe-0.10.14/',
  import.meta.url
);
let network: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('BASE_URL', '/');
  vi.stubGlobal('location', { origin: 'https://meetings.example' });
  network = vi.fn(
    async (url: string) => new Response(await readFile(new URL(url.split('/').at(-1)!, base)))
  );
  vi.stubGlobal('fetch', network);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('approved local background assets', () => {
  it.each(['/', '/assets/dwp/meetings/'])(
    'places all three pinned assets under the deployment namespace %s',
    (deploymentBase) => {
      vi.stubEnv('BASE_URL', deploymentBase);
      const files = {
        model: 'selfie-segmenter-landscape-v1.tflite',
        loader: 'vision_wasm_nosimd_internal.js',
        wasm: 'vision_wasm_nosimd_internal.wasm',
      };
      for (const name of ['model', 'loader', 'wasm'] as const) {
        expect(meetingBackgroundAssetUrl(name)).toBe(
          `https://meetings.example${deploymentBase}assets/meeting-background/mediapipe-0.10.14/${files[name]}`
        );
      }
    }
  );
  it.each([
    undefined,
    '',
    './',
    'assets/dwp/meetings/',
    '/assets/dwp/meetings',
    'https://external.example/',
    'https://meetings.example/',
    '//external.example/',
    '///external.example/',
    '/assets//meetings/',
    '/assets/../meetings/',
    '/assets/./meetings/',
    '/assets/%2e%2e/meetings/',
    '/assets/%2Fmeetings/',
    '/assets/%5cmeetings/',
    '/assets/\\meetings/',
    '/assets/meetings/?query=1',
    '/assets/meetings/#fragment',
    '/assets/ meetings/',
    '/assets/meetings/\n',
  ])(
    'rejects malformed or origin-escaping deployment base %# before any network/model work',
    async (deploymentBase) => {
      vi.stubEnv('BASE_URL', deploymentBase);
      expect(() => meetingBackgroundAssetUrl('model')).toThrow('ASSET_UNTRUSTED');
      await expect(
        loadMeetingBackgroundSegmenter(new AbortController().signal)
      ).rejects.toMatchObject({
        code: 'ASSET_UNTRUSTED',
      });
      expect(network).not.toHaveBeenCalled();
      expect(factory).not.toHaveBeenCalled();
    }
  );
  it('exposes only three fixed same-origin versioned assets and rejects unknown selectors', () => {
    expect(meetingBackgroundAssetUrl('model')).toBe(
      'https://meetings.example/assets/meeting-background/mediapipe-0.10.14/selfie-segmenter-landscape-v1.tflite'
    );
    expect(() => meetingBackgroundAssetUrl('https://external.example/model' as 'model')).toThrow(
      'ASSET_UNTRUSTED'
    );
    vi.stubGlobal('location', { origin: 'file:///private/device' });
    expect(() => meetingBackgroundAssetUrl('model')).toThrow('ASSET_UNTRUSTED');
  });
  it('blocks a substituted model before importing or creating an inference engine', async () => {
    network.mockResolvedValue(new Response('unapproved-model'));
    await expect(
      loadMeetingBackgroundSegmenter(new AbortController().signal)
    ).rejects.toMatchObject({ code: 'ASSET_UNTRUSTED' });
    expect(factory).not.toHaveBeenCalled();
  });
  it('does not follow redirects, send credentials, or accept cross-origin mode', async () => {
    network.mockResolvedValue(new Response('missing', { status: 404 }));
    const controller = new AbortController();
    await expect(loadMeetingBackgroundSegmenter(controller.signal)).rejects.toMatchObject({
      code: 'ASSET_UNAVAILABLE',
    });
    expect(network).toHaveBeenCalledWith(meetingBackgroundAssetUrl('model'), {
      signal: controller.signal,
      credentials: 'omit',
      redirect: 'error',
      mode: 'same-origin',
      cache: 'force-cache',
    });
  });
  it('hash-verifies WASM and loader as well as the model', async () => {
    const realRead = network.getMockImplementation()! as (url: string) => Promise<Response>;
    network.mockImplementation((url: string) =>
      url.endsWith('.js') ? Promise.resolve(new Response('changed-loader')) : realRead(url)
    );
    await expect(
      loadMeetingBackgroundSegmenter(new AbortController().signal)
    ).rejects.toMatchObject({ code: 'ASSET_UNTRUSTED' });
    expect(factory).not.toHaveBeenCalled();
  });
  it.each(['/', '/assets/dwp/meetings/'])(
    'verifies namespaced assets and uses the pinned confidence channel at %s',
    async (deploymentBase) => {
      vi.stubEnv('BASE_URL', deploymentBase);
      const result = {
        confidenceMasks: [
          { width: 3, height: 1, getAsFloat32Array: () => new Float32Array([0, 0.5, 1]) },
        ],
        close: vi.fn(),
      };
      const close = vi.fn();
      factory.mockResolvedValue({ segmentForVideo: () => result, close });
      const engine = await loadMeetingBackgroundSegmenter(new AbortController().signal);
      expect(network).toHaveBeenCalledTimes(3);
      expect(network.mock.calls.map(([url]) => url)).toEqual(
        ['model', 'loader', 'wasm'].map((name) =>
          meetingBackgroundAssetUrl(name as 'model' | 'loader' | 'wasm')
        )
      );
      expect(factory).toHaveBeenCalledWith(
        {
          wasmLoaderPath: meetingBackgroundAssetUrl('loader'),
          wasmBinaryPath: meetingBackgroundAssetUrl('wasm'),
        },
        expect.objectContaining({
          runningMode: 'VIDEO',
          outputCategoryMask: false,
          outputConfidenceMasks: true,
        })
      );
      expect(engine.segment({} as HTMLVideoElement, 100).foreground).toEqual(
        new Uint8Array([0, 0, 1])
      );
      expect(result.close).toHaveBeenCalledOnce();
      engine.close();
      expect(close).toHaveBeenCalledOnce();
    }
  );
  it('rejects unknown model output channels instead of exposing the raw frame', async () => {
    const result = { confidenceMasks: [], close: vi.fn() };
    factory.mockResolvedValue({ segmentForVideo: () => result, close: vi.fn() });
    const engine = await loadMeetingBackgroundSegmenter(new AbortController().signal);
    expect(() => engine.segment({} as HTMLVideoElement, 1)).toThrow('PROCESSING_FAILED');
    expect(result.close).toHaveBeenCalledOnce();
    engine.close();
  });
  it('closes an asynchronously created model if permission or generation was revoked', async () => {
    const controller = new AbortController();
    const close = vi.fn();
    factory.mockImplementation(async () => {
      controller.abort();
      return { close };
    });
    await expect(loadMeetingBackgroundSegmenter(controller.signal)).rejects.toMatchObject({
      code: 'SUPERSEDED',
    });
    expect(close).toHaveBeenCalledOnce();
  });
});
