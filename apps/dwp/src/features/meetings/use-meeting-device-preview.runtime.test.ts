// @vitest-environment jsdom
import { act, createElement, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMeetingDevicePreview } from './use-meeting-device-preview';
import { DEFAULT_MEETING_DEVICE_PREFERENCES } from './meeting-preferences-model';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function localStream() {
  const track = Object.assign(new EventTarget(), { stop: vi.fn() });
  return { stream: { getTracks: () => [track] } as unknown as MediaStream, track };
}

let root: Root | null;
let container: HTMLDivElement;
let preview: ReturnType<typeof useMeetingDevicePreview>;
let media: { getUserMedia: ReturnType<typeof vi.fn>; enumerateDevices: ReturnType<typeof vi.fn> };
let context: {
  resume: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  createMediaStreamSource: ReturnType<typeof vi.fn>;
  createAnalyser: ReturnType<typeof vi.fn>;
  createOscillator: ReturnType<typeof vi.fn>;
  createGain: ReturnType<typeof vi.fn>;
  currentTime: number;
  destination: object;
};
let oscillator: {
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  frequency: { value: number };
  onended: (() => void) | null;
};
let created = vi.fn<() => void>();

function Harness({ signal }: { signal?: AbortSignal }) {
  preview = useMeetingDevicePreview(signal);
  return createElement('video', { ref: preview.video });
}

async function render(signal?: AbortSignal) {
  await act(async () =>
    root?.render(createElement(StrictMode, null, createElement(Harness, { signal })))
  );
}

describe('device preview resource and exception boundaries', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    media = { getUserMedia: vi.fn(), enumerateDevices: vi.fn().mockResolvedValue([]) };
    vi.stubGlobal('navigator', { mediaDevices: media });
    vi.stubGlobal('requestAnimationFrame', vi.fn().mockReturnValue(1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    oscillator = {
      start: vi.fn(),
      stop: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      frequency: { value: 0 },
      onended: null,
    };
    context = {
      resume: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      createMediaStreamSource: vi.fn().mockReturnValue({ connect: vi.fn(), disconnect: vi.fn() }),
      createAnalyser: vi.fn().mockReturnValue({
        fftSize: 256,
        disconnect: vi.fn(),
        getByteTimeDomainData: (array: Uint8Array) => array.fill(128),
      }),
      createOscillator: vi.fn().mockReturnValue(oscillator),
      createGain: vi.fn().mockReturnValue({
        gain: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        disconnect: vi.fn(),
      }),
      currentTime: 0,
      destination: {},
    };
    created = vi.fn();
    vi.stubGlobal('AudioContext', function () {
      created();
      return context;
    });
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    root = null;
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('requests no capture, enumeration or audio context on mount', async () => {
    await render();
    expect(media.getUserMedia).not.toHaveBeenCalled();
    expect(media.enumerateDevices).not.toHaveBeenCalled();
    expect(created).not.toHaveBeenCalled();
  });

  it('stops camera tracks and detaches preview on leaving', async () => {
    const local = localStream();
    media.getUserMedia.mockResolvedValue(local.stream);
    await render();
    await act(async () => preview.start('video', DEFAULT_MEETING_DEVICE_PREFERENCES));
    const video = container.querySelector('video');
    expect(video?.srcObject).toBe(local.stream);
    await act(async () => root?.unmount());
    root = null;
    expect(local.track.stop).toHaveBeenCalled();
    expect(video?.srcObject).toBeNull();
  });

  it.each(['constructor', 'source', 'analyser', 'resume'] as const)(
    'handles AudioContext %s failure without leaking microphone tracks',
    async (failure) => {
      const local = localStream();
      media.getUserMedia.mockResolvedValue(local.stream);
      const error = new DOMException('Browser rejected local audio', 'NotSupportedError');
      if (failure === 'constructor')
        created.mockImplementation(() => {
          throw error;
        });
      if (failure === 'source')
        context.createMediaStreamSource.mockImplementation(() => {
          throw error;
        });
      if (failure === 'analyser')
        context.createAnalyser.mockImplementation(() => {
          throw error;
        });
      if (failure === 'resume') context.resume.mockRejectedValue(error);
      await render();
      await act(async () => preview.start('audio', DEFAULT_MEETING_DEVICE_PREFERENCES));
      expect(preview.states.audio).toBe('idle');
      expect(preview.error).toBe('unsupported');
      expect(local.track.stop).toHaveBeenCalled();
      if (failure !== 'constructor') expect(context.close).toHaveBeenCalled();
    }
  );

  it('catches speaker constructor failures and clears busy state', async () => {
    created.mockImplementation(() => {
      throw new DOMException('Denied', 'SecurityError');
    });
    await render();
    await act(async () => preview.testSpeaker('default'));
    expect(preview.speakerActive).toBe(false);
    expect(preview.error).toBe('permission');
  });

  it('fails closed when a selected output cannot be bound by the browser', async () => {
    await render();
    await act(async () => preview.testSpeaker('speaker-without-sink-support'));
    expect(preview.speakerActive).toBe(false);
    expect(preview.error).toBe('unsupported');
    expect(oscillator.start).not.toHaveBeenCalled();
    expect(context.close).toHaveBeenCalled();
  });

  it('binds a supported selected output before playing the local test tone', async () => {
    const setSinkId = vi.fn().mockResolvedValue(undefined);
    Object.assign(context, { setSinkId });
    oscillator.start.mockImplementation(() => queueMicrotask(() => oscillator.onended?.()));
    await render();

    await act(async () => preview.testSpeaker('speaker-current'));

    expect(setSinkId).toHaveBeenCalledWith('speaker-current');
    expect(oscillator.start).toHaveBeenCalledTimes(1);
    expect(preview.error).toBeNull();
    expect(preview.speakerActive).toBe(false);
  });

  it('cancels a speaker promise even if resume never settles', async () => {
    context.resume.mockReturnValue(new Promise(() => undefined));
    await render();
    let pending!: Promise<void>;
    await act(async () => {
      pending = preview.testSpeaker('default');
    });
    await act(async () => root?.unmount());
    root = null;
    await expect(pending).resolves.toBeUndefined();
    expect(context.close).toHaveBeenCalled();
    expect(oscillator.start).not.toHaveBeenCalled();
  });

  it('cancels an oscillator without relying on the browser ended event', async () => {
    await render();
    let pending!: Promise<void>;
    await act(async () => {
      pending = preview.testSpeaker('default');
    });
    expect(oscillator.start).toHaveBeenCalledTimes(1);
    await act(async () => root?.unmount());
    root = null;
    await expect(pending).resolves.toBeUndefined();
    expect(oscillator.disconnect).toHaveBeenCalled();
    expect(oscillator.onended).toBeNull();
  });

  it('synchronously revokes live media and discards a late capture result', async () => {
    const authority = new AbortController();
    const audio = localStream();
    const video = localStream();
    const pending = deferred<MediaStream>();
    media.getUserMedia.mockResolvedValueOnce(audio.stream).mockReturnValueOnce(pending.promise);
    await render(authority.signal);
    await act(async () => preview.start('audio', DEFAULT_MEETING_DEVICE_PREFERENCES));
    let request!: Promise<void>;
    await act(async () => {
      request = preview.start('video', DEFAULT_MEETING_DEVICE_PREFERENCES);
    });
    authority.abort();
    expect(audio.track.stop).toHaveBeenCalled();
    await act(async () => {
      pending.resolve(video.stream);
      await request;
    });
    expect(video.track.stop).toHaveBeenCalled();
    await act(async () => preview.start('video', DEFAULT_MEETING_DEVICE_PREFERENCES));
    expect(media.getUserMedia).toHaveBeenCalledTimes(2);
  });

  it('guards synchronous duplicate speaker tests and closes on output selection change', async () => {
    await render();
    let first!: Promise<void>;
    let duplicate!: Promise<void>;
    await act(async () => {
      first = preview.testSpeaker('default');
      duplicate = preview.testSpeaker('default');
    });
    expect(created).toHaveBeenCalledTimes(1);
    await act(async () => preview.stopSpeaker());
    await expect(first).resolves.toBeUndefined();
    await expect(duplicate).resolves.toBeUndefined();
    expect(preview.speakerActive).toBe(false);
  });

  it('ignores stale inventory completions from an earlier refresh', async () => {
    const old = deferred<MediaDeviceInfo[]>();
    media.enumerateDevices
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce([{ deviceId: 'new' }]);
    await render();
    let request!: Promise<void>;
    await act(async () => {
      request = preview.refresh();
      await preview.refresh();
    });
    await act(async () => {
      old.resolve([{ deviceId: 'old' } as MediaDeviceInfo]);
      await request;
    });
    expect(preview.devices[0].deviceId).toBe('new');
  });
});
