// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMeetingDevicePreview } from './use-meeting-device-preview';
import { DEFAULT_MEETING_DEVICE_PREFERENCES } from './meeting-preferences-model';

const processing = vi.hoisted(() => ({ supported: true, create: vi.fn() }));
vi.mock('./meeting-background-processor', () => ({
  createMeetingBackgroundProcessor: processing.create,
  meetingBackgroundSupported: () => processing.supported,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function track(id: string) {
  return Object.assign(new EventTarget(), {
    id,
    kind: 'video',
    stop: vi.fn(),
  }) as unknown as MediaStreamTrack;
}
class PreviewStream {
  constructor(private readonly tracks: MediaStreamTrack[]) {}
  getTracks() {
    return this.tracks;
  }
  getVideoTracks() {
    return this.tracks;
  }
}
type Event = { state: 'loading' | 'ready' | 'failed' | 'stopped'; reason?: string };
let root: Root;
let mount: HTMLDivElement;
let preview: ReturnType<typeof useMeetingDevicePreview>;
let media: { getUserMedia: ReturnType<typeof vi.fn>; enumerateDevices: ReturnType<typeof vi.fn> };
let processors: {
  pending: ReturnType<typeof deferred<MediaStreamTrack>>;
  destroy: ReturnType<typeof vi.fn>;
  event: (event: Event) => void;
}[];
const selection = { ...DEFAULT_MEETING_DEVICE_PREFERENCES, backgroundBlur: true };
function Harness({ signal }: { signal?: AbortSignal }) {
  preview = useMeetingDevicePreview(signal);
  return createElement('video', { ref: preview.video });
}
async function render(signal?: AbortSignal) {
  await act(async () => root.render(createElement(Harness, { signal })));
}
function source() {
  return mount.querySelector('video')!.srcObject;
}
async function start() {
  let pending!: Promise<void>;
  await act(async () => {
    pending = preview.start('video', selection);
  });
  return { pending };
}
describe('processed preview privacy boundary', () => {
  beforeEach(async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    processing.supported = true;
    processors = [];
    processing.create.mockImplementation(
      ({ onStateChange }: { onStateChange: (event: Event) => void }) => {
        const processor = {
          pending: deferred<MediaStreamTrack>(),
          destroy: vi.fn().mockResolvedValue(undefined),
          event: onStateChange,
        };
        processors.push(processor);
        return { start: () => processor.pending.promise, destroy: processor.destroy };
      }
    );
    media = { getUserMedia: vi.fn(), enumerateDevices: vi.fn().mockResolvedValue([]) };
    vi.stubGlobal('navigator', { mediaDevices: media });
    vi.stubGlobal('MediaStream', PreviewStream);
    mount = document.createElement('div');
    document.body.append(mount);
    root = createRoot(mount);
    await render();
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    mount.remove();
    vi.unstubAllGlobals();
  });
  it('never attaches raw input while processing starts and attaches only the first completed output', async () => {
    const raw = track('raw');
    const output = track('processed');
    media.getUserMedia.mockResolvedValue(new PreviewStream([raw]));
    const operation = await start();
    expect(source()).toBeNull();
    expect(preview.states.video).toBe('requesting');
    await act(async () => {
      processors[0].pending.resolve(output);
      await operation.pending;
    });
    expect((source() as MediaStream).getVideoTracks()).toEqual([output]);
    expect(preview.states.video).toBe('active');
  });
  it('clears an existing raw preview synchronously and stays off if blur initialization fails', async () => {
    const first = track('first-raw');
    const next = track('new-raw');
    media.getUserMedia
      .mockResolvedValueOnce(new PreviewStream([first]))
      .mockResolvedValueOnce(new PreviewStream([next]));
    await act(async () => preview.start('video', { ...selection, backgroundBlur: false }));
    expect((source() as MediaStream).getVideoTracks()).toEqual([first]);
    const operation = await start();
    expect(source()).toBeNull();
    await act(async () => {
      processors[0].pending.reject(new Error('model unavailable'));
      await operation.pending;
    });
    expect(source()).toBeNull();
    expect(preview.states.video).toBe('idle');
    expect(first.stop).toHaveBeenCalled();
    expect(next.stop).toHaveBeenCalled();
    expect(processors[0].destroy).toHaveBeenCalled();
  });
  it('stops raw and processed resources after an in-flight request is cancelled', async () => {
    const raw = track('raw');
    const output = track('late');
    media.getUserMedia.mockResolvedValue(new PreviewStream([raw]));
    const operation = await start();
    await act(async () => preview.stop('video'));
    await act(async () => {
      processors[0].pending.resolve(output);
      await operation.pending;
    });
    expect(source()).toBeNull();
    expect(preview.states.video).toBe('idle');
    expect(raw.stop).toHaveBeenCalled();
    expect(output.stop).toHaveBeenCalled();
  });
  it('turns the camera off on runtime processor failure without restoring raw input', async () => {
    const raw = track('raw');
    const output = track('processed');
    media.getUserMedia.mockResolvedValue(new PreviewStream([raw]));
    const operation = await start();
    await act(async () => {
      processors[0].pending.resolve(output);
      await operation.pending;
    });
    await act(async () => processors[0].event({ state: 'failed', reason: 'PROCESSING_FAILED' }));
    expect(source()).toBeNull();
    expect(preview.states.video).toBe('idle');
    expect(raw.stop).toHaveBeenCalled();
    expect(processors[0].destroy).toHaveBeenCalled();
  });
  it('discards late completion after account or authorization scope revocation', async () => {
    const revoked = new AbortController();
    await render(revoked.signal);
    const raw = track('raw');
    const output = track('late');
    media.getUserMedia.mockResolvedValue(new PreviewStream([raw]));
    const operation = await start();
    await act(async () => revoked.abort());
    expect(source()).toBeNull();
    await act(async () => {
      processors[0].pending.resolve(output);
      await operation.pending;
    });
    expect(source()).toBeNull();
    expect(raw.stop).toHaveBeenCalled();
    expect(output.stop).toHaveBeenCalled();
  });
  it('fails closed before requesting camera permission on unsupported browsers', async () => {
    processing.supported = false;
    await act(async () => preview.start('video', selection));
    expect(media.getUserMedia).not.toHaveBeenCalled();
    expect(preview.states.video).toBe('idle');
    expect(preview.error).toBe('unsupported');
    expect(source()).toBeNull();
  });
  it('prevents a stale worker from replacing the newer camera output', async () => {
    const rawA = track('raw-a');
    const rawB = track('raw-b');
    const outputA = track('stale-output');
    const outputB = track('current-output');
    media.getUserMedia
      .mockResolvedValueOnce(new PreviewStream([rawA]))
      .mockResolvedValueOnce(new PreviewStream([rawB]));
    const first = await start();
    const next = await start();
    await act(async () => {
      processors[1].pending.resolve(outputB);
      await next.pending;
    });
    await act(async () => {
      processors[0].pending.resolve(outputA);
      await first.pending;
    });
    expect((source() as MediaStream).getVideoTracks()).toEqual([outputB]);
    expect(outputA.stop).toHaveBeenCalled();
    expect(rawA.stop).toHaveBeenCalled();
    expect(rawB.stop).not.toHaveBeenCalled();
  });
});
