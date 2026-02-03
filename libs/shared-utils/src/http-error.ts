// ----------------------------------------------------------------------

export class HttpError extends Error {
  public readonly status: number;

  public readonly auditId?: string;

  public readonly traceId?: string;

  public readonly gatewayRequestId?: string;

  public constructor(
    message: string,
    status: number,
    extras?: { auditId?: string; traceId?: string; gatewayRequestId?: string }
  ) {
    super(message);
    this.status = status;
    this.name = 'HttpError';
    this.auditId = extras?.auditId;
    this.traceId = extras?.traceId;
    this.gatewayRequestId = extras?.gatewayRequestId;
  }

  get is403(): boolean {
    return this.status === 403;
  }
}

/** Error with auditId (from 200 + status:ERROR or 4xx/5xx body) */
export function getAuditIdFromError(err: unknown): string | undefined {
  if (err instanceof HttpError && err.auditId) return err.auditId;
  const e = err as Error & { auditId?: string };
  return e?.auditId;
}

export function isHttpError(err: unknown): err is HttpError {
  return err instanceof HttpError;
}

export function is403Error(err: unknown): boolean {
  return isHttpError(err) && err.is403;
}
