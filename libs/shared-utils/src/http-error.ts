export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class HttpTransportError extends Error {
  constructor(
    public readonly reason: 'NETWORK' | 'TIMEOUT' | 'ABORT',
    cause?: unknown
  ) {
    super(`HTTP transport failed: ${reason.toLowerCase()}`, { cause });
    this.name = 'HttpTransportError';
  }
}
