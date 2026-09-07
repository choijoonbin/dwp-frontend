export type MeetingPreviewKind = 'audio' | 'video';

export type MeetingMediaDevices = Pick<MediaDevices, 'getUserMedia' | 'enumerateDevices'>;

/** Owns local preview tracks only. It never publishes, records, uploads, or grants consent. */
export class MeetingDeviceSession {
  private disposed = false;
  private generations = { audio: 0, video: 0 };
  private streams: Partial<Record<MeetingPreviewKind, MediaStream>> = {};

  constructor(private readonly devices: MeetingMediaDevices) {}

  async start(
    kind: MeetingPreviewKind,
    deviceId = 'default',
    noiseSuppression = true
  ): Promise<MediaStream | null> {
    if (this.disposed) return null;
    this.stop(kind);
    const generation = this.generations[kind];
    const device = deviceId === 'default' ? undefined : { exact: deviceId };
    const constraints: MediaStreamConstraints =
      kind === 'audio'
        ? { audio: { deviceId: device, echoCancellation: true, noiseSuppression }, video: false }
        : {
            audio: false,
            video: { deviceId: device, width: { ideal: 1280 }, height: { ideal: 720 } },
          };
    const stream = await this.devices.getUserMedia(constraints);
    if (this.disposed || generation !== this.generations[kind]) {
      stream.getTracks().forEach((track) => track.stop());
      return null;
    }
    this.streams[kind] = stream;
    return stream;
  }

  async enumerate(): Promise<MediaDeviceInfo[]> {
    if (this.disposed) return [];
    const devices = await this.devices.enumerateDevices();
    return this.disposed ? [] : devices;
  }

  stop(kind: MeetingPreviewKind) {
    this.generations[kind] += 1;
    this.streams[kind]?.getTracks().forEach((track) => track.stop());
    delete this.streams[kind];
  }

  dispose() {
    this.disposed = true;
    this.stop('audio');
    this.stop('video');
  }
}

export type MeetingDeviceFailure =
  'permission' | 'notFound' | 'busy' | 'constraints' | 'unsupported' | 'unknown';

export function meetingDeviceFailure(error: unknown): MeetingDeviceFailure {
  const name = error && typeof error === 'object' && 'name' in error ? error.name : null;
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'permission';
  if (name === 'NotFoundError') return 'notFound';
  if (name === 'NotReadableError' || name === 'AbortError') return 'busy';
  if (name === 'OverconstrainedError') return 'constraints';
  if (name === 'NotSupportedError') return 'unsupported';
  return 'unknown';
}
