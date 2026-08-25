export type ProductSurfaceReadScopeConfig = Readonly<{
  contextScopeKey?: string;
  signal?: AbortSignal;
}>;

export function productSurfaceReadScopeConfig(
  contextScopeKey?: string,
  signal?: AbortSignal
): ProductSurfaceReadScopeConfig | undefined {
  if (contextScopeKey === undefined && signal === undefined) return undefined;
  return {
    ...(contextScopeKey === undefined ? {} : { contextScopeKey }),
    ...(signal === undefined ? {} : { signal }),
  };
}
