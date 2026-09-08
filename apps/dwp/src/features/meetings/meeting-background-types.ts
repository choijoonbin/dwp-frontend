export type MeetingBackgroundFailure =
  'UNSUPPORTED' | 'ASSET_UNAVAILABLE' | 'ASSET_UNTRUSTED' | 'PROCESSING_FAILED' | 'SUPERSEDED';

export type MeetingBackgroundState = {
  state: 'loading' | 'ready' | 'failed' | 'stopped';
  reason?: MeetingBackgroundFailure;
};

/** Static codes only: never attach frames, model payloads, or browser exception text. */
export class MeetingBackgroundError extends Error {
  constructor(readonly code: MeetingBackgroundFailure) {
    super(code);
    this.name = 'MeetingBackgroundError';
  }
}

export interface MeetingBackgroundSegmenter {
  segment(
    video: HTMLVideoElement,
    timestamp: number
  ): {
    width: number;
    height: number;
    foreground: Uint8Array;
  };
  close(): void;
}

export function isMeetingBackgroundSupported(): boolean {
  if (
    typeof document === 'undefined' ||
    typeof MediaStream === 'undefined' ||
    typeof WebAssembly === 'undefined' ||
    typeof crypto?.subtle?.digest !== 'function' ||
    typeof HTMLCanvasElement === 'undefined' ||
    typeof HTMLCanvasElement.prototype.captureStream !== 'function'
  )
    return false;
  try {
    const context = document.createElement('canvas').getContext('2d');
    if (!context || !('filter' in context)) return false;
    context.filter = 'blur(16px)';
    return context.filter === 'blur(16px)';
  } catch {
    return false;
  }
}

export const meetingBackgroundSupported = isMeetingBackgroundSupported;
