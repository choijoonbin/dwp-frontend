export type OrganizationExperience = 'directory' | 'workforce';

export function organizationManagementQueryPlan({
  workforceView,
  requestScopeReady,
  workforceReadOnly,
  insightsSelected,
}: {
  workforceView: boolean;
  requestScopeReady: boolean;
  workforceReadOnly: boolean;
  insightsSelected: boolean;
}) {
  return Object.freeze({
    chart: !workforceView || requestScopeReady,
    scenarios: workforceView && requestScopeReady,
    candidates: workforceView && !workforceReadOnly && requestScopeReady,
    intelligence: workforceView && insightsSelected && requestScopeReady,
  });
}

export function organizationManagementChartRequest({
  experience,
  asOf,
  rootOrganizationId,
  scenarioId,
  contextScopeKey,
  signal,
}: {
  experience: OrganizationExperience;
  asOf: string;
  rootOrganizationId?: string;
  scenarioId?: string;
  contextScopeKey?: string;
  signal: AbortSignal;
}) {
  const workforceView = experience === 'workforce';
  return {
    asOf,
    rootOrganizationId,
    scenarioId: workforceView && scenarioId ? scenarioId : undefined,
    depth: 10,
    surface: experience,
    view: workforceView ? ('design' as const) : undefined,
    contextScopeKey: workforceView ? contextScopeKey : undefined,
    signal,
  };
}
