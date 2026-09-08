import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMeetingBackgroundCompositor } from './meeting-background-compositor';

type Context = ReturnType<typeof context>;
function context() {
  return {
    fillStyle: '',
    filter: 'none',
    globalCompositeOperation: 'source-over',
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    putImageData: vi.fn(),
    createImageData: (width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
    }),
  };
}
let canvases: { width: number; height: number; context: Context }[];
let stop: ReturnType<typeof vi.fn>;
beforeEach(() => {
  canvases = [];
  stop = vi.fn();
  vi.stubGlobal('document', {
    createElement: () => {
      const value = {
        width: 0,
        height: 0,
        context: context(),
        getContext() {
          return this.context;
        },
        captureStream() {
          return { getVideoTracks: () => [{ stop }] };
        },
      };
      canvases.push(value);
      return value;
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('background output canvas', () => {
  it('starts black and exposes no original video before a valid mask exists', () => {
    const compositor = createMeetingBackgroundCompositor();
    expect(canvases[0].context.fillStyle).toBe('black');
    expect(canvases[0].context.fillRect).toHaveBeenCalledWith(0, 0, 640, 360);
    expect(canvases[0].context.drawImage).not.toHaveBeenCalled();
    compositor.destroy();
  });
  it('publishes only a complete composite, never the input video or unmasked scratch canvas', () => {
    const compositor = createMeetingBackgroundCompositor();
    const video = { videoWidth: 640, videoHeight: 360 } as HTMLVideoElement;
    compositor.render(video, { width: 2, height: 1, foreground: new Uint8Array([0, 1]) });
    expect(canvases[0].context.drawImage).toHaveBeenCalledExactlyOnceWith(canvases[1], 0, 0);
    expect(canvases[0].context.drawImage).not.toHaveBeenCalledWith(
      video,
      expect.anything(),
      expect.anything()
    );
    expect(canvases[3].context.putImageData.mock.calls[0][0].data).toEqual(
      new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 255])
    );
    compositor.destroy();
  });
  it.each([
    { width: 2, height: 1, foreground: new Uint8Array([1]) },
    { width: 1, height: 1, foreground: new Uint8Array([255]) },
    { width: 0, height: 0, foreground: new Uint8Array() },
  ])('fails before publishing malformed or unknown-category masks', (mask) => {
    const compositor = createMeetingBackgroundCompositor();
    expect(() =>
      compositor.render({ videoWidth: 640, videoHeight: 360 } as HTMLVideoElement, mask)
    ).toThrow('PROCESSING_FAILED');
    expect(canvases[0].context.drawImage).not.toHaveBeenCalled();
    compositor.destroy();
  });
  it('stops the derived track and clears all canvas frame buffers on teardown', () => {
    const compositor = createMeetingBackgroundCompositor();
    compositor.destroy();
    expect(stop).toHaveBeenCalledOnce();
    expect(canvases.every((canvas) => canvas.width === 0 && canvas.height === 0)).toBe(true);
  });
});
