export type BoundedList<T> = {
  items: T[];
  hasMore: boolean;
  limit: number;
};

export function parseBoundedList<T>(
  value: unknown,
  maximumLimit: number,
  contractName: string
): BoundedList<T> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${contractName} response is unavailable.`);
  }
  const page = value as Record<string, unknown>;
  if (
    !Array.isArray(page.items) ||
    typeof page.hasMore !== 'boolean' ||
    !Number.isInteger(page.limit) ||
    Number(page.limit) < 1 ||
    Number(page.limit) > maximumLimit ||
    page.items.length > Number(page.limit)
  ) {
    throw new Error(`${contractName} response is unavailable.`);
  }
  return {
    items: page.items as T[],
    hasMore: page.hasMore,
    limit: Number(page.limit),
  };
}
