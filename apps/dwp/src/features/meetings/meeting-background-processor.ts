import type { Track, TrackProcessor, ProcessorOptions } from 'livekit-client';

import { loadMeetingBackgroundSegmenter } from './meeting-background-assets';
import { createMeetingBackgroundCompositor } from './meeting-background-compositor';
import {
  isMeetingBackgroundSupported,
  MeetingBackgroundError,
  type MeetingBackgroundSegmenter,
  type MeetingBackgroundState,
} from './meeting-background-types';

export {
  isMeetingBackgroundSupported,
  meetingBackgroundSupported,
  MeetingBackgroundError,
} from './meeting-background-types';
export type { MeetingBackgroundState, MeetingBackgroundFailure } from './meeting-background-types';

export type MeetingBackgroundOptions = {
  onStateChange?: (state: MeetingBackgroundState) => void;
  /** LiveKit capture owns its input; failed setup must stop it before publish. */
  stopInputOnFailure?: boolean;
};

type Session = {
  generation: number;
  input: MediaStreamTrack;
  abort: AbortController;
  video: HTMLVideoElement;
  compositor?: ReturnType<typeof createMeetingBackgroundCompositor>;
  segmenter?: MeetingBackgroundSegmenter;
  frame?: number;
  timer?: ReturnType<typeof setTimeout>;
  ended: () => void;
};

/** Reusable after destroy: every start, device replacement and reconnect gets a new fence. */
export class MeetingBackgroundProcessor implements TrackProcessor<Track.Kind.Video> {
  readonly name = 'dwp-local-background-blur-v1';
  processedTrack?: MediaStreamTrack;
  private generation = 0;
  private current?: Session;

  constructor(private readonly options: MeetingBackgroundOptions = {}) {}

  private emit(session: Session, state: MeetingBackgroundState) {
    if (this.current === session && session.generation === this.generation) {
      // Consumer observers cannot interrupt fail-closed media cleanup.
      try {
        this.options.onStateChange?.(state);
      } catch {
        /* No exception text or frame logging. */
      }
    }
  }

  private clear(session: Session) {
    session.abort.abort();
    if (session.frame !== undefined) cancelAnimationFrame(session.frame);
    clearTimeout(session.timer);
    session.input.removeEventListener('ended', session.ended);
    try {
      session.video.pause();
    } catch {
      /* Continue closing every owned resource. */
    }
    session.video.srcObject = null;
    try {
      session.compositor?.destroy();
    } catch {
      /* The derived track is stopped before canvas disposal. */
    }
    session.compositor = undefined;
    try {
      session.segmenter?.close();
    } catch {
      /* No model/browser exception text is retained. */
    }
    session.segmenter = undefined;
    if (this.current === session) this.processedTrack = undefined;
  }

  private assertCurrent(session: Session) {
    if (
      session.abort.signal.aborted ||
      this.current !== session ||
      session.generation !== this.generation
    ) {
      throw new MeetingBackgroundError('SUPERSEDED');
    }
  }

  private fail(session: Session, error: unknown) {
    if (this.current !== session || session.generation !== this.generation) {
      if (this.options.stopInputOnFailure && this.current?.input !== session.input)
        session.input.stop();
      return new MeetingBackgroundError('SUPERSEDED');
    }
    const failure =
      error instanceof MeetingBackgroundError
        ? error
        : new MeetingBackgroundError('PROCESSING_FAILED');
    if (this.current === session && session.generation === this.generation) {
      if (this.options.stopInputOnFailure) session.input.stop();
      this.clear(session);
      this.emit(session, { state: 'failed', reason: failure.code });
    }
    return failure;
  }

  private nextFrame(session: Session): Promise<void> {
    return new Promise((resolve, reject) => {
      const abort = () => {
        if (session.frame !== undefined) cancelAnimationFrame(session.frame);
        reject(new MeetingBackgroundError('SUPERSEDED'));
      };
      session.abort.signal.addEventListener('abort', abort, { once: true });
      session.frame = requestAnimationFrame(() => {
        session.abort.signal.removeEventListener('abort', abort);
        resolve();
      });
      if (session.abort.signal.aborted) abort();
    });
  }

  async start(input: MediaStreamTrack): Promise<MediaStreamTrack> {
    this.generation += 1;
    if (this.current) this.clear(this.current);
    if (typeof document === 'undefined') {
      if (this.options.stopInputOnFailure) input.stop();
      throw new MeetingBackgroundError('UNSUPPORTED');
    }
    const session: Session = {
      generation: this.generation,
      input,
      abort: new AbortController(),
      video: document.createElement('video'),
      ended: () => {},
    };
    this.current = session;
    session.ended = () => {
      this.fail(session, new MeetingBackgroundError('PROCESSING_FAILED'));
    };
    this.emit(session, { state: 'loading' });
    try {
      if (
        !isMeetingBackgroundSupported() ||
        input.kind !== 'video' ||
        input.readyState !== 'live'
      ) {
        throw new MeetingBackgroundError('UNSUPPORTED');
      }
      session.compositor = createMeetingBackgroundCompositor();
      this.processedTrack = session.compositor.track;
      session.input.addEventListener('ended', session.ended, { once: true });
      session.video.muted = true;
      session.video.playsInline = true;
      session.video.srcObject = new MediaStream([input]);
      const timeout = new Promise<never>((_, reject) => {
        session.timer = setTimeout(
          () => reject(new MeetingBackgroundError('PROCESSING_FAILED')),
          20000
        );
        session.abort.signal.addEventListener(
          'abort',
          () => reject(new MeetingBackgroundError('SUPERSEDED')),
          { once: true }
        );
      });
      const prepare = async () => {
        await session.video.play();
        this.assertCurrent(session);
        const segmenter = await loadMeetingBackgroundSegmenter(session.abort.signal);
        if (session.abort.signal.aborted || this.current !== session) {
          segmenter.close();
          throw new MeetingBackgroundError('SUPERSEDED');
        }
        session.segmenter = segmenter;
        while (session.video.readyState < 2 || !session.video.videoWidth)
          await this.nextFrame(session);
        this.assertCurrent(session);
        this.render(session, performance.now());
      };
      await Promise.race([prepare(), timeout]);
      this.assertCurrent(session);
      clearTimeout(session.timer);
      this.emit(session, { state: 'ready' });
      let lastTime = performance.now();
      const tick = (now: number) => {
        try {
          this.assertCurrent(session);
          if (now - lastTime >= 50) {
            this.render(session, now);
            lastTime = now;
          }
          session.frame = requestAnimationFrame(tick);
        } catch (error) {
          this.fail(session, error);
        }
      };
      session.frame = requestAnimationFrame(tick);
      if (!session.compositor) throw new MeetingBackgroundError('PROCESSING_FAILED');
      return session.compositor.track;
    } catch (error) {
      throw this.fail(session, error);
    }
  }

  private render(session: Session, timestamp: number) {
    this.assertCurrent(session);
    if (!session.segmenter || !session.compositor || session.input.readyState !== 'live') {
      throw new MeetingBackgroundError('PROCESSING_FAILED');
    }
    const mask = session.segmenter.segment(session.video, timestamp);
    try {
      session.compositor.render(session.video, mask);
    } finally {
      mask.foreground.fill(0);
    }
  }

  async init(options: ProcessorOptions<Track.Kind.Video>) {
    await this.start(options.track);
  }
  async restart(options: ProcessorOptions<Track.Kind.Video>) {
    await this.start(options.track);
  }

  async destroy() {
    const session = this.current;
    if (!session) return;
    this.clear(session);
    this.emit(session, { state: 'stopped' });
    this.current = undefined;
    this.generation += 1;
  }
}

export const createMeetingBackgroundProcessor = (options: MeetingBackgroundOptions = {}) =>
  new MeetingBackgroundProcessor(options);
