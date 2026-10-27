export function assertIncreasingOrder(values: readonly { displayOrder: number }[], label: string) {
  if (
    values.some(
      (value, index) => index > 0 && value.displayOrder <= values[index - 1]!.displayOrder
    )
  ) {
    throw new Error(`Effective policy ${label} sequence is invalid.`);
  }
}

export function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} is invalid.`);
  }
  return value as Record<string, unknown>;
}

export function nonBlank(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is invalid.`);
  return value;
}

export function boundedOpaque(value: unknown, label: string) {
  const candidate = nonBlank(value, label);
  if (candidate !== candidate.trim() || candidate.length > 512 || /[\r\n]/u.test(candidate)) {
    throw new Error(`${label} is invalid.`);
  }
  return candidate;
}

export function patternedOpaque(value: unknown, pattern: RegExp, label: string) {
  const candidate = boundedOpaque(value, label);
  if (!pattern.test(candidate)) throw new Error(`${label} is invalid.`);
  return candidate;
}

export function optionalString(value: unknown): string | null {
  return value == null ? null : nonBlank(value, 'optional string');
}

export function optionalUuid(value: unknown): string | null {
  if (value == null) return null;
  return requiredUuid(value, 'UUID');
}

export function requiredUuid(value: unknown, label: string): string {
  const candidate = nonBlank(value, label);
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu.test(candidate)) {
    throw new Error(`${label} is invalid.`);
  }
  return candidate;
}

export function optionalNavigationRevisionPin(
  value: unknown,
  schemaVersion: '2' | '3'
): string | null {
  if (value == null) return null;
  const candidate = nonBlank(value, 'navigation revision pin');
  if (!new RegExp(`^nav-v${schemaVersion}-[a-f0-9]{64}$`, 'u').test(candidate)) {
    throw new Error('Navigation revision pin is invalid.');
  }
  return candidate;
}

export function integer(value: unknown, minimum: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    throw new Error('Integer is invalid.');
  }
  return value;
}

export function optionalInteger(value: unknown): number | null {
  return value == null ? null : integer(value, 1);
}

export function instant(value: unknown): string {
  const candidate = nonBlank(value, 'instant');
  if (!Number.isFinite(Date.parse(candidate))) throw new Error('Instant is invalid.');
  return candidate;
}

export function oneOf<const Value extends string>(
  value: unknown,
  allowed: readonly Value[],
  label: string
): Value {
  if (typeof value !== 'string' || !allowed.includes(value as Value)) {
    throw new Error(`${label} is invalid.`);
  }
  return value as Value;
}

export function normalizePath(value: string) {
  const pathname = value.split(/[?#]/u, 1)[0] || '/';
  return pathname.length > 1 ? pathname.replace(/\/+$/u, '') : pathname;
}
export function isFreshAfterNow(value: string | null) {
  return value !== null && Date.parse(value) > Date.now();
}
