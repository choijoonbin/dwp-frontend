const REGISTRY_TYPES = new Set([
  'APP',
  'CONNECTOR',
  'AGENT',
  'TOOL',
  'POLICY',
  'API',
  'DATA_PRODUCT',
]);
const RISK_TIERS = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

export function registryTypeLabelKey(value: string): string {
  return `registry.types.${REGISTRY_TYPES.has(value) ? value : 'UNKNOWN'}`;
}

export function registryTypeColor(
  value: string
): 'info' | 'secondary' | 'primary' | 'warning' | 'default' | 'success' {
  const colors: Record<string, ReturnType<typeof registryTypeColor>> = {
    APP: 'info',
    CONNECTOR: 'secondary',
    AGENT: 'primary',
    TOOL: 'warning',
    POLICY: 'default',
    API: 'primary',
    DATA_PRODUCT: 'success',
  };
  return colors[value] ?? 'default';
}

export function registryRiskLabelKey(value: string): string {
  return `registry.risk.${RISK_TIERS.has(value) ? value : 'UNKNOWN'}`;
}

export function registryRiskColor(
  value: string
): 'success' | 'info' | 'warning' | 'error' | 'default' {
  const colors: Record<string, ReturnType<typeof registryRiskColor>> = {
    LOW: 'success',
    MEDIUM: 'info',
    HIGH: 'warning',
    CRITICAL: 'error',
  };
  return colors[value] ?? 'default';
}
