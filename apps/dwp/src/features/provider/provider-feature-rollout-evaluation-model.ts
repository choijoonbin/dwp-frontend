export type ProviderFeatureEvaluationSelection = {
  featureKey: string;
  tenantId: string;
};

export function displayProviderFeatureValue(value: unknown): string {
  return typeof value === 'string' ? value : (JSON.stringify(value, null, 2) ?? '');
}

export function resolveProviderFeatureEvaluationOption(
  selected: string,
  options: readonly string[]
): string {
  return options.includes(selected) ? selected : (options[0] ?? '');
}

export function providerFeatureEvaluationSelectionMatches(
  selection: ProviderFeatureEvaluationSelection | undefined,
  featureKey: string,
  tenantId: string
): boolean {
  return (
    selection !== undefined &&
    selection.featureKey === featureKey &&
    selection.tenantId === tenantId
  );
}

export function providerFeatureEvaluationResultMatches(
  result: { featureKey: string; providerTenantId: string } | undefined,
  featureKey: string,
  tenantId: string
): boolean {
  return (
    result !== undefined && result.featureKey === featureKey && result.providerTenantId === tenantId
  );
}
