/** Primitive PAY-003 wire validation; domain projections remain in the contract module. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u;

export class StatutoryInsuranceContractError extends Error {
  readonly kind = 'PAY003_CONTRACT_ERROR' as const;

  constructor(path: string) {
    super(`Invalid PAY-003 contract: ${path}`);
    this.name = 'StatutoryInsuranceContractError';
  }
}

export function invalid(path: string): never {
  throw new StatutoryInsuranceContractError(path);
}

export function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid(path);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return invalid(path);
  return value as Record<string, unknown>;
}

export function exact(
  value: unknown,
  path: string,
  allowed: readonly string[],
  required: readonly string[] = allowed
) {
  const source = record(value, path);
  const keys = Object.keys(source);
  if (
    keys.some((key) => !allowed.includes(key)) ||
    required.some((key) => !Object.prototype.hasOwnProperty.call(source, key))
  ) {
    return invalid(path);
  }
  return source;
}

export function text(value: unknown, path: string, maximum: number, pattern?: RegExp): string {
  if (
    typeof value !== 'string' ||
    !value ||
    value !== value.trim() ||
    Array.from(value).length > maximum ||
    (pattern && !pattern.test(value))
  ) {
    return invalid(path);
  }
  return value;
}

export function integer(value: unknown, path: string, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    return invalid(path);
  }
  return Number(value);
}

export function uuid(value: unknown, path: string): string {
  return text(value, path, 36, UUID);
}

export function date(value: unknown, path: string): string {
  const candidate = text(value, path, 10, DATE);
  const parsed = new Date(`${candidate}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== candidate) {
    return invalid(path);
  }
  return candidate;
}

export function instant(value: unknown, path: string): string {
  const candidate = text(value, path, 100, INSTANT);
  if (Number.isNaN(Date.parse(candidate))) return invalid(path);
  return candidate;
}
