export type IdempotentMutationIntent = Readonly<{
  key: string;
  fingerprint: string;
}>;

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalValue(entry)])
    );
  }
  return value;
}

export function resolveIdempotentMutationIntent(
  previous: IdempotentMutationIntent | null,
  payload: unknown,
  createKey: () => string = () => crypto.randomUUID()
): IdempotentMutationIntent {
  const fingerprint = JSON.stringify(canonicalValue(payload));
  if (previous?.fingerprint === fingerprint) return previous;
  return { key: createKey(), fingerprint };
}
