type ModuleProviderContext = Readonly<{
  tenantCacheKey: string | null;
  subjectCacheKey: string | null;
  authorityCacheKey: string;
  contextScopeKey: string | null;
  decisionRevision: string;
  accessMode: string;
}>;

type HomeProviderSource = Readonly<{
  dataAuthority: 'MODULE_API' | 'LEGACY_AGGREGATE_COMPATIBILITY';
}>;

export function hasRequiredHrisHomeModuleContext<TSource extends HomeProviderSource>(
  source: TSource | undefined,
  context: ModuleProviderContext
): source is TSource {
  return Boolean(
    source &&
    (source.dataAuthority !== 'MODULE_API' ||
      (context.tenantCacheKey?.trim() &&
        context.subjectCacheKey?.trim() &&
        context.authorityCacheKey.trim() &&
        context.contextScopeKey?.trim() &&
        context.decisionRevision.trim() &&
        context.accessMode.trim()))
  );
}
