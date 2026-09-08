import { fetchSameOriginStaticAsset } from '@dwp-frontend/shared-utils/browser-static-asset';
import {
  MeetingBackgroundError,
  type MeetingBackgroundSegmenter,
} from './meeting-background-types';

const APPROVED_SHA256 = {
  model: '490e9ea734313e0de10fa0cd9e3c6133e36ea4db2b7a49bde9ef019f72796b8e',
  loader: 'abe9b6fbeaf86fcb53a5edce3926c82ccb0619e18fed4d9d9ce561ee7f55e054',
  wasm: '38b61feab2fd7934e05cbe9f68baa308978a5e3b7f85c1913bb8ae89b8ef8b97',
};
const ASSET_PATH = 'assets/meeting-background/mediapipe-0.10.14/';

export function meetingBackgroundAssetUrl(name: 'model' | 'loader' | 'wasm'): string {
  const filenames = {
    model: 'selfie-segmenter-landscape-v1.tflite',
    loader: 'vision_wasm_nosimd_internal.js',
    wasm: 'vision_wasm_nosimd_internal.wasm',
  };
  if (!Object.hasOwn(filenames, name)) throw new MeetingBackgroundError('ASSET_UNTRUSTED');
  const deploymentBase: unknown = import.meta.env.BASE_URL;
  // Vite copies public assets below BASE_URL for the independent product artifact.
  // Accept absolute path segments only: no remote origin, encoded/dot traversal or URL suffix.
  if (typeof deploymentBase !== 'string' || !/^(?:\/[A-Za-z0-9_-]+)*\/$/u.test(deploymentBase))
    throw new MeetingBackgroundError('ASSET_UNTRUSTED');
  let url: URL;
  try {
    url = new URL(`${deploymentBase}${ASSET_PATH}${filenames[name]}`, location.origin);
  } catch {
    throw new MeetingBackgroundError('ASSET_UNTRUSTED');
  }
  if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) {
    throw new MeetingBackgroundError('ASSET_UNTRUSTED');
  }
  return url.href;
}

async function readApprovedAsset(name: keyof typeof APPROVED_SHA256, signal: AbortSignal) {
  const response = await fetchSameOriginStaticAsset(meetingBackgroundAssetUrl(name), signal);
  if (!response.ok) throw new MeetingBackgroundError('ASSET_UNAVAILABLE');
  const bytes = new Uint8Array(await response.arrayBuffer());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const actual = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
  if (actual !== APPROVED_SHA256[name]) {
    bytes.fill(0);
    throw new MeetingBackgroundError('ASSET_UNTRUSTED');
  }
  return bytes;
}

export async function loadMeetingBackgroundSegmenter(
  signal: AbortSignal
): Promise<MeetingBackgroundSegmenter> {
  let model: Uint8Array<ArrayBuffer> | undefined;
  try {
    model = await readApprovedAsset('model', signal);
    // Reject unknown deployment artifacts before executing the local WASM loader.
    (await readApprovedAsset('loader', signal)).fill(0);
    (await readApprovedAsset('wasm', signal)).fill(0);
    signal.throwIfAborted();
    // The JS bundle is lazy; the only permitted model/WASM URLs are our own pinned assets.
    const { ImageSegmenter } = await import('@mediapipe/tasks-vision');
    signal.throwIfAborted();
    const segmenter = await ImageSegmenter.createFromOptions(
      {
        wasmLoaderPath: meetingBackgroundAssetUrl('loader'),
        wasmBinaryPath: meetingBackgroundAssetUrl('wasm'),
      },
      {
        baseOptions: { modelAssetBuffer: model, delegate: 'CPU' },
        runningMode: 'VIDEO',
        outputCategoryMask: false,
        outputConfidenceMasks: true,
      }
    );
    if (signal.aborted) {
      segmenter.close();
      throw new MeetingBackgroundError('SUPERSEDED');
    }
    return {
      segment(video, timestamp) {
        const result = segmenter.segmentForVideo(video, timestamp);
        try {
          // This pinned binary model has one foreground probability channel,
          // not the multiclass category IDs used by other segmentation models.
          const mask = result.confidenceMasks?.[0];
          if (!mask || result.confidenceMasks?.length !== 1)
            throw new MeetingBackgroundError('PROCESSING_FAILED');
          const confidence = mask.getAsFloat32Array();
          if (confidence.some((value) => !Number.isFinite(value) || value < 0 || value > 1))
            throw new MeetingBackgroundError('PROCESSING_FAILED');
          return {
            width: mask.width,
            height: mask.height,
            foreground: Uint8Array.from(confidence, (value) => (value >= 0.85 ? 1 : 0)),
          };
        } finally {
          result.close();
        }
      },
      close: () => segmenter.close(),
    };
  } catch (error) {
    if (signal.aborted) throw new MeetingBackgroundError('SUPERSEDED');
    throw error instanceof MeetingBackgroundError
      ? error
      : new MeetingBackgroundError('ASSET_UNAVAILABLE');
  } finally {
    model?.fill(0);
  }
}
