export function organizationScenarioQueryKeys(cacheKey: readonly unknown[]) {
  return {
    listKey: ['workforce', 'organization-scenarios', ...cacheKey] as const,
    detailKey: (scenarioId: string | undefined, detail: string) =>
      ['workforce', 'organization-scenarios', scenarioId, detail, ...cacheKey] as const,
  };
}
