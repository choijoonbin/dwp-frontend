const SAFE_SUPPORT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{5,127}$/;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function safeSupportId(value: unknown): string | null {
  return typeof value === 'string' && SAFE_SUPPORT_ID.test(value) ? value : null;
}

function supportIdFromHeaders(value: unknown): string | null {
  const headers = record(value);
  if (!headers || typeof headers.get !== 'function') return null;
  try {
    const get = headers.get as (name: string) => unknown;
    return (
      safeSupportId(get.call(value, 'X-Correlation-ID')) ??
      safeSupportId(get.call(value, 'X-Request-ID'))
    );
  } catch {
    return null;
  }
}

/** Reads only bounded, identifier-shaped fields; error messages are never exposed as support IDs. */
export function notificationRouteSupportId(error: unknown): string | null {
  const source = record(error);
  if (!source) return null;

  const header = supportIdFromHeaders(source.headers);
  if (header) return header;

  const direct = safeSupportId(source.correlationId) ?? safeSupportId(source.requestId);
  if (direct) return direct;

  const details = record(source.details);
  const nested = safeSupportId(details?.correlationId) ?? safeSupportId(details?.requestId);
  if (nested) return nested;

  const cause = record(source.cause);
  return safeSupportId(cause?.correlationId) ?? safeSupportId(cause?.requestId);
}

export function firstNotificationSupportId(errors: readonly unknown[]): string | null {
  for (const error of errors) {
    const supportId = notificationRouteSupportId(error);
    if (supportId) return supportId;
  }
  return null;
}
