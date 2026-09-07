import { describe, expect, it, vi } from 'vitest';
import { MeetingDeviceSession, meetingDeviceFailure } from './meeting-device-session';

function mediaStream() {
  const stop = vi.fn();
  return { stream: { getTracks: () => [{ stop }] } as unknown as MediaStream, stop };
}

describe('meeting local device session', () => {
  it('never acquires media at construction or enumeration', async () => {
    const getUserMedia = vi.fn();
    const session = new MeetingDeviceSession({
      getUserMedia,
      enumerateDevices: vi.fn().mockResolvedValue([]),
    });
    await session.enumerate();
    expect(getUserMedia).not.toHaveBeenCalled();
    session.dispose();
  });
  it('asks only for explicitly chosen media and stops it on disposal', async () => {
    const audio = mediaStream();
    const getUserMedia = vi.fn().mockResolvedValue(audio.stream);
    const session = new MeetingDeviceSession({ getUserMedia, enumerateDevices: vi.fn() });
    expect(await session.start('audio', 'chosen-mic', false)).toBe(audio.stream);
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: { deviceId: { exact: 'chosen-mic' }, echoCancellation: true, noiseSuppression: false },
      video: false,
    });
    session.dispose();
    expect(audio.stop).toHaveBeenCalledOnce();
    expect(await session.start('video')).toBeNull();
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });
  it('stops a late permission success after route exit', async () => {
    const late = mediaStream();
    let resolve!: (stream: MediaStream) => void;
    const session = new MeetingDeviceSession({
      getUserMedia: () =>
        new Promise((done) => {
          resolve = done;
        }),
      enumerateDevices: vi.fn(),
    });
    const result = session.start('video');
    session.dispose();
    resolve(late.stream);
    expect(await result).toBeNull();
    expect(late.stop).toHaveBeenCalledOnce();
  });
  it('fences older requests when a user switches camera', async () => {
    const old = mediaStream();
    const current = mediaStream();
    let resolve!: (stream: MediaStream) => void;
    const getUserMedia = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done;
          })
      )
      .mockResolvedValueOnce(current.stream);
    const session = new MeetingDeviceSession({ getUserMedia, enumerateDevices: vi.fn() });
    const first = session.start('video', 'old');
    expect(await session.start('video', 'current')).toBe(current.stream);
    resolve(old.stream);
    expect(await first).toBeNull();
    expect(old.stop).toHaveBeenCalledOnce();
    expect(current.stop).not.toHaveBeenCalled();
    session.stop('video');
    expect(current.stop).toHaveBeenCalledOnce();
  });
  it('stopping microphone does not stop the independently owned camera', async () => {
    const audio = mediaStream();
    const video = mediaStream();
    const session = new MeetingDeviceSession({
      getUserMedia: vi.fn().mockResolvedValueOnce(audio.stream).mockResolvedValueOnce(video.stream),
      enumerateDevices: vi.fn(),
    });
    await session.start('audio');
    await session.start('video');
    session.stop('audio');
    expect(audio.stop).toHaveBeenCalledOnce();
    expect(video.stop).not.toHaveBeenCalled();
    session.dispose();
    expect(video.stop).toHaveBeenCalledOnce();
  });
  it.each([
    ['NotAllowedError', 'permission'],
    ['SecurityError', 'permission'],
    ['NotFoundError', 'notFound'],
    ['NotReadableError', 'busy'],
    ['AbortError', 'busy'],
    ['OverconstrainedError', 'constraints'],
    ['NotSupportedError', 'unsupported'],
    ['Error', 'unknown'],
  ])('maps %s to safe actionable %s without exposing browser details', (name, code) => {
    expect(meetingDeviceFailure({ name, message: 'sensitive hardware detail' })).toBe(code);
  });
});
