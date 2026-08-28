export function isFuturePrivilegedAccessDateTime(
  value: string | null | undefined,
  now = Date.now()
): boolean {
  if (!value) return false;
  const instant = Date.parse(value);
  return Number.isFinite(instant) && instant > now;
}

export function isOptionalFuturePrivilegedAccessDateTime(
  value: string | null | undefined,
  now = Date.now()
): boolean {
  return !value || isFuturePrivilegedAccessDateTime(value, now);
}
