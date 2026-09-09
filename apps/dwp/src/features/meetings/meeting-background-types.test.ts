import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isMeetingBackgroundSupported } from './meeting-background-types';

class SupportedCanvas {
  getContext() {
    return { filter: 'none' };
  }
  captureStream() {
    return {};
  }
}

describe('meeting background capability detection', () => {
  beforeEach(() => {
    vi.stubGlobal('document', { createElement: () => new SupportedCanvas() });
    vi.stubGlobal('HTMLCanvasElement', SupportedCanvas);
    vi.stubGlobal('MediaStream', class {});
    vi.stubGlobal('WebAssembly', {});
    vi.stubGlobal('crypto', { subtle: { digest: vi.fn() } });
    vi.stubGlobal('Blob', class {});
    vi.stubGlobal('URL', { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('detects blur only when the canvas filter round-trips', () => {
    expect(isMeetingBackgroundSupported('blur')).toBe(true);
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => ({}) }) });
    expect(isMeetingBackgroundSupported('blur')).toBe(false);
  });

  it('detects office only with a decodable local image and object URL lifecycle', () => {
    vi.stubGlobal('Image', class {});
    expect(isMeetingBackgroundSupported('office')).toBe(false);
    vi.stubGlobal(
      'Image',
      class {
        decode() {}
      }
    );
    expect(isMeetingBackgroundSupported('office')).toBe(true);
  });
});
