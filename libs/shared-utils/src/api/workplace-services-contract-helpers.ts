const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function invalid(path: string): never {
  throw new Error(`Invalid Workplace Services response at ${path}.`);
}

export function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid(path);
  return value as Record<string, unknown>;
}

export function text(value: unknown, path: string, maximum = 2000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) return invalid(path);
  return value;
}

export function nullableText(value: unknown, path: string, maximum = 2000): string | null {
  return value === null ? null : text(value, path, maximum);
}

export function integer(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return invalid(path);
  return value;
}

export function nullableInteger(value: unknown, path: string): number | null {
  return value === null ? null : integer(value, path);
}

export function number(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return invalid(path);
  return value;
}

export function enumeration<T extends string>(
  value: unknown,
  values: ReadonlySet<T>,
  path: string
): T {
  if (typeof value !== 'string' || !values.has(value as T)) return invalid(path);
  return value as T;
}

export function bool(value: unknown, path: string): boolean {
  return typeof value === 'boolean' ? value : invalid(path);
}

export function uuid(value: unknown, path: string): string {
  const result = text(value, path, 36);
  return uuidPattern.test(result) ? result : invalid(path);
}

export function instant(value: unknown, path: string): string {
  const result = text(value, path, 64);
  return Number.isFinite(Date.parse(result)) ? result : invalid(path);
}

export function nullableInstant(value: unknown, path: string): string | null {
  return value === null ? null : instant(value, path);
}

export function object(value: unknown, path: string): Readonly<Record<string, unknown>> {
  return Object.freeze({ ...record(value, path) });
}

export function list<T>(
  value: unknown,
  path: string,
  parser: (item: unknown, path: string) => T
): readonly T[] {
  if (!Array.isArray(value)) return invalid(path);
  return Object.freeze(value.map((item, index) => parser(item, `${path}[${index}]`)));
}

export function pageList<T>(
  value: unknown,
  path: string,
  parser: (item: unknown, path: string) => T
): readonly T[] {
  if (!Array.isArray(value) || value.length > 100) return invalid(path);
  return Object.freeze(value.map((item, index) => parser(item, `${path}[${index}]`)));
}

export function pageCursor(
  data: Record<string, unknown>,
  path: string
): Readonly<{ nextCursor: string | null; hasMore: boolean; generatedAt: string }> {
  const hasMore = bool(data.hasMore, `${path}.hasMore`);
  const nextCursor = nullableText(data.nextCursor, `${path}.nextCursor`, 2000);
  if ((hasMore && !nextCursor) || (!hasMore && nextCursor !== null)) return invalid(path);
  return Object.freeze({
    nextCursor,
    hasMore,
    generatedAt: instant(data.generatedAt, `${path}.generatedAt`),
  });
}

export function stringList(value: unknown, path: string): readonly string[] {
  return list(value, path, (item, itemPath) => text(item, itemPath, 160));
}
