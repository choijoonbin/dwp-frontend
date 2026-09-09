import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as BackgroundTypes from './meeting-background-types';

const mocks = vi.hoisted(() => ({
  supported: vi.fn(),
  load: vi.fn(),
  loadOffice: vi.fn(),
  compose: vi.fn(),
}));
vi.mock('./meeting-background-assets', () => ({
  loadMeetingBackgroundSegmenter: mocks.load,
  loadMeetingOfficeBackground: mocks.loadOffice,
}));
vi.mock('./meeting-background-compositor', () => ({
  createMeetingBackgroundCompositor: mocks.compose,
}));
vi.mock('./meeting-background-types', async (original) => ({
  ...(await original<typeof BackgroundTypes>()),
  isMeetingBackgroundSupported: mocks.supported,
}));
import {
  createMeetingBackgroundProcessor,
  MeetingBackgroundError,
} from './meeting-background-processor';

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
function input() {
  const events = new EventTarget();
  return Object.assign(events, {
    kind: 'video',
    readyState: 'live',
    stop: vi.fn(),
  }) as unknown as MediaStreamTrack;
}
function segmenter() {
  return {
    segment: vi.fn(() => ({ width: 1, height: 1, foreground: new Uint8Array([1]) })),
    close: vi.fn(),
  };
}
let callbacks: Map<number, FrameRequestCallback>;
let composites: {
  track: MediaStreamTrack;
  render: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}[];
let videos: {
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  srcObject: unknown;
  readyState: number;
  videoWidth: number;
}[];

beforeEach(() => {
  vi.clearAllMocks();
  callbacks = new Map();
  composites = [];
  videos = [];
  mocks.supported.mockReturnValue(true);
  mocks.load.mockImplementation(async () => segmenter());
  mocks.loadOffice.mockResolvedValue({ source: {}, width: 1600, height: 900, close: vi.fn() });
  mocks.compose.mockImplementation(() => {
    const track = input();
    const item = { track, render: vi.fn(), destroy: vi.fn(() => track.stop()) };
    composites.push(item);
    return item;
  });
  vi.stubGlobal('document', {
    createElement: () => {
      const video = {
        play: vi.fn(async () => {}),
        pause: vi.fn(),
        srcObject: null,
        readyState: 2,
        videoWidth: 640,
      };
      videos.push(video);
      return video;
    },
  });
  vi.stubGlobal(
    'MediaStream',
    class {
      constructor(readonly tracks: unknown[]) {}
    }
  );
  let next = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callbacks.set(++next, callback);
    return next;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('meeting background fail-closed processor', () => {
  it('stops a superseded publication-owned input without stopping the replacement input', async () => {
    const pending = deferred<ReturnType<typeof segmenter>>();
    mocks.load.mockReturnValueOnce(pending.promise);
    const oldInput = input();
    const newInput = input();
    const processor = createMeetingBackgroundProcessor({ stopInputOnFailure: true });
    const first = processor.start(oldInput);
    const rejection = expect(first).rejects.toMatchObject({ code: 'SUPERSEDED' });
    await Promise.resolve();
    await processor.start(newInput);
    await rejection;
    expect(oldInput.stop).toHaveBeenCalledOnce();
    expect(newInput.stop).not.toHaveBeenCalled();
    pending.resolve(segmenter());
    await processor.destroy();
  });
  it('does not stop an input reused by the new generation when the old async setup rejects', async () => {
    const pending = deferred<ReturnType<typeof segmenter>>();
    mocks.load.mockReturnValueOnce(pending.promise);
    const raw = input();
    const processor = createMeetingBackgroundProcessor({ stopInputOnFailure: true });
    const first = processor.start(raw);
    const rejection = expect(first).rejects.toMatchObject({ code: 'SUPERSEDED' });
    await Promise.resolve();
    await processor.start(raw);
    await rejection;
    expect(raw.stop).not.toHaveBeenCalled();
    pending.resolve(segmenter());
    await processor.destroy();
  });
  it('continues media cleanup even if an observer or model disposal throws', async () => {
    const model = segmenter();
    model.close.mockImplementation(() => {
      throw new Error('private runtime detail');
    });
    mocks.load.mockResolvedValue(model);
    const processor = createMeetingBackgroundProcessor({
      onStateChange: () => {
        throw new Error('consumer failed');
      },
    });
    const output = await processor.start(input());
    await processor.destroy();
    expect(output.stop).toHaveBeenCalledOnce();
    expect(processor.processedTrack).toBeUndefined();
  });
  it('returns only a derived track after the first successful masked composition', async () => {
    const state = vi.fn();
    const processor = createMeetingBackgroundProcessor({ onStateChange: state });
    const raw = input();
    const output = await processor.start(raw);
    expect(output).not.toBe(raw);
    expect(processor.processedTrack).toBe(output);
    expect(composites[0].render).toHaveBeenCalledOnce();
    expect(state.mock.calls.map(([value]) => value.state)).toEqual(['loading', 'ready']);
    await processor.destroy();
    expect(raw.stop).not.toHaveBeenCalled();
    expect(output.stop).toHaveBeenCalledOnce();
  });
  it('loads the approved office plate before composing and releases it with the capture owner', async () => {
    const office = { source: {}, width: 1600, height: 900, close: vi.fn() };
    mocks.loadOffice.mockResolvedValue(office);
    const processor = createMeetingBackgroundProcessor({ mode: 'office' });
    await processor.start(input());
    expect(processor.name).toBe('dwp-local-background-office-v1');
    expect(mocks.supported).toHaveBeenCalledWith('office');
    expect(mocks.loadOffice).toHaveBeenCalledOnce();
    expect(mocks.compose).toHaveBeenCalledWith('office', office);
    await processor.destroy();
    expect(office.close).toHaveBeenCalledOnce();
  });
  it('never resolves during model loading and closes a late model after destroy', async () => {
    const pending = deferred<ReturnType<typeof segmenter>>();
    mocks.load.mockReturnValue(pending.promise);
    const processor = createMeetingBackgroundProcessor();
    const result = processor.start(input());
    const rejected = expect(result).rejects.toMatchObject({ code: 'SUPERSEDED' });
    await Promise.resolve();
    await processor.destroy();
    await rejected;
    const late = segmenter();
    pending.resolve(late);
    await Promise.resolve();
    await Promise.resolve();
    expect(late.close).toHaveBeenCalledOnce();
    expect(processor.processedTrack).toBeUndefined();
  });
  it('device replacement supersedes the previous generation without publishing its late success', async () => {
    const pending = deferred<ReturnType<typeof segmenter>>();
    mocks.load.mockReturnValueOnce(pending.promise);
    const state = vi.fn();
    const processor = createMeetingBackgroundProcessor({ onStateChange: state });
    const first = processor.start(input());
    const rejection = expect(first).rejects.toMatchObject({ code: 'SUPERSEDED' });
    await Promise.resolve();
    const second = await processor.start(input());
    await rejection;
    const late = segmenter();
    pending.resolve(late);
    await Promise.resolve();
    await Promise.resolve();
    expect(late.close).toHaveBeenCalledOnce();
    expect(processor.processedTrack).toBe(second);
    expect(state.mock.calls.filter(([event]) => event.state === 'ready')).toHaveLength(1);
    await processor.destroy();
  });
  it('destroy is idempotent and the same processor supports camera off/on or reconnect', async () => {
    const processor = createMeetingBackgroundProcessor();
    await processor.start(input());
    await processor.destroy();
    await processor.destroy();
    const next = await processor.start(input());
    expect(processor.processedTrack).toBe(next);
    expect(composites[0].destroy).toHaveBeenCalledOnce();
    await processor.destroy();
  });
  it('unsupported browsers fail without raw fallback and stop publication-owned input', async () => {
    mocks.supported.mockReturnValue(false);
    const raw = input();
    const processor = createMeetingBackgroundProcessor({ stopInputOnFailure: true });
    await expect(processor.start(raw)).rejects.toMatchObject({ code: 'UNSUPPORTED' });
    expect(raw.stop).toHaveBeenCalledOnce();
    expect(processor.processedTrack).toBeUndefined();
    expect(mocks.load).not.toHaveBeenCalled();
  });
  it('asset errors expose only static codes and never browser payloads', async () => {
    mocks.load.mockRejectedValue(new Error('sensitive browser/device detail'));
    const state = vi.fn();
    const raw = input();
    const processor = createMeetingBackgroundProcessor({
      onStateChange: state,
      stopInputOnFailure: true,
    });
    await expect(processor.start(raw)).rejects.toEqual(
      new MeetingBackgroundError('PROCESSING_FAILED')
    );
    expect(JSON.stringify(state.mock.calls)).not.toContain('sensitive');
    expect(raw.stop).toHaveBeenCalledOnce();
  });
  it('first composition failure closes the output and rejects ready', async () => {
    const state = vi.fn();
    const model = segmenter();
    model.segment.mockImplementation(() => {
      throw new Error('invalid');
    });
    mocks.load.mockResolvedValue(model);
    const processor = createMeetingBackgroundProcessor({ onStateChange: state });
    await expect(processor.start(input())).rejects.toMatchObject({ code: 'PROCESSING_FAILED' });
    expect(model.close).toHaveBeenCalledOnce();
    expect(composites[0].track.stop).toHaveBeenCalledOnce();
    expect(state.mock.calls.some(([event]) => event.state === 'ready')).toBe(false);
  });
  it('runtime segmentation failure stops derived and publication input without automatic raw restoration', async () => {
    const model = segmenter();
    mocks.load.mockResolvedValue(model);
    const state = vi.fn();
    const raw = input();
    const processor = createMeetingBackgroundProcessor({
      onStateChange: state,
      stopInputOnFailure: true,
    });
    await processor.start(raw);
    model.segment.mockImplementation(() => {
      throw new Error('frame unavailable');
    });
    [...callbacks.values()][0](performance.now() + 100);
    expect(processor.processedTrack).toBeUndefined();
    expect(raw.stop).toHaveBeenCalledOnce();
    expect(state).toHaveBeenLastCalledWith({ state: 'failed', reason: 'PROCESSING_FAILED' });
    expect(videos[0].srcObject).toBeNull();
  });
  it('input ending closes the active compositor', async () => {
    const raw = input();
    const processor = createMeetingBackgroundProcessor();
    await processor.start(raw);
    raw.dispatchEvent(new Event('ended'));
    expect(composites[0].track.stop).toHaveBeenCalledOnce();
    expect(processor.processedTrack).toBeUndefined();
  });
  it('a setup timeout closes output and rejects even if video play never settles', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('document', {
      createElement: () => ({ play: () => new Promise(() => {}), pause: vi.fn(), srcObject: null }),
    });
    const processor = createMeetingBackgroundProcessor();
    const promise = processor.start(input());
    const rejection = expect(promise).rejects.toMatchObject({ code: 'PROCESSING_FAILED' });
    await vi.advanceTimersByTimeAsync(20000);
    await rejection;
    expect(processor.processedTrack).toBeUndefined();
  });
  it('destroy rejects pending video play promptly, not only after timeout', async () => {
    vi.stubGlobal('document', {
      createElement: () => ({ play: () => new Promise(() => {}), pause: vi.fn(), srcObject: null }),
    });
    const processor = createMeetingBackgroundProcessor();
    const promise = processor.start(input());
    const rejection = expect(promise).rejects.toMatchObject({ code: 'SUPERSEDED' });
    await processor.destroy();
    await rejection;
  });
});
