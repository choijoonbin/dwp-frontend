export type ProviderFeatureEvaluationSelection = {
  featureKey: string;
  tenantId: string;
};

export type ProviderFeatureValuePresentation =
  | { kind: 'scalar'; value: string }
  | { kind: 'collection'; collection: 'OBJECT' | 'ARRAY'; count: number }
  | { kind: 'unavailable' };

export function providerFeatureValuePresentation(value: unknown): ProviderFeatureValuePresentation {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return { kind: 'scalar', value: String(value) };
  }
  if (Array.isArray(value)) return { kind: 'collection', collection: 'ARRAY', count: value.length };
  if (value !== null && typeof value === 'object') {
    return { kind: 'collection', collection: 'OBJECT', count: Object.keys(value).length };
  }
  return { kind: 'unavailable' };
}

const EVALUATION_REASONS = new Set([
  'DEFAULT',
  'TARGET_MISS',
  'PERCENTAGE_EXCLUDED',
  'ROLLOUT_MATCH',
]);

export function providerFeatureEvaluationReason(value: string): string {
  return EVALUATION_REASONS.has(value) ? value : 'UNAVAILABLE';
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
