import type { ClassicOrganizationResourceState } from '../../features/home/classic-home/classic-organization-resources';
import type { FlowFutureWidgetState } from '../../features/home/flow-home/flow-future-widget-mesh';

const RESOURCE_STATES = new Set([
  'initial-loading',
  'background-refresh',
  'partial',
  'forbidden',
  'stale',
] as const);

/** Playwright's test-mode server is the only runtime allowed to inject canonical visual evidence. */
export function resolveWave2ResourceEvidence(
  searchParams: URLSearchParams
): ClassicOrganizationResourceState | undefined {
  if (import.meta.env.MODE !== 'test') return undefined;
  const requested = searchParams.get('wave2ResourceState');
  if (!requested || !RESOURCE_STATES.has(requested as never)) return undefined;
  const kind = requested as ClassicOrganizationResourceState['kind'];
  const targetKey = ['initial-loading', 'background-refresh', 'stale'].includes(kind)
    ? 'workplace'
    : kind === 'forbidden'
      ? 'it'
      : 'handbook';
  return {
    kind,
    targetKey,
    source:
      targetKey === 'workplace'
        ? 'DWP_WORKPLACE'
        : targetKey === 'it'
          ? 'DWP_IT_SUPPORT'
          : 'DWP_KNOWLEDGE',
    lastSuccessfulAt: ['background-refresh', 'partial', 'stale'].includes(kind)
      ? '오전 9:24'
      : undefined,
    onRetry: ['partial', 'stale'].includes(kind) ? () => undefined : undefined,
  };
}

export function resolveWave2LoadedFlowEvidence(
  searchParams: URLSearchParams
): Readonly<Record<string, FlowFutureWidgetState>> | undefined {
  const requested = searchParams.get('wave2FlowState');
  if (import.meta.env.MODE !== 'test' || !['loaded', 'preview'].includes(requested ?? '')) {
    return undefined;
  }
  return Object.fromEntries(
    [
      'meetings-prep-decisions',
      'space-change-feed',
      'dwaion-artifact',
      'workplace-booking',
      'learning-progress',
    ].map((key) => [key, requested as FlowFutureWidgetState])
  );
}

export function resolveWave2ModePresetEvidence(searchParams: URLSearchParams) {
  if (import.meta.env.MODE !== 'test' || searchParams.get('wave2ModePreset') !== 'comparison') {
    return undefined;
  }
  return {
    currentMode: 'CLASSIC' as const,
    initialSelectedMode: 'FLOW_V1' as const,
  };
}

export function resolveWave2Evidence(searchParams: URLSearchParams) {
  return {
    resource: resolveWave2ResourceEvidence(searchParams),
    loadedFlow: resolveWave2LoadedFlowEvidence(searchParams),
    modePreset: resolveWave2ModePresetEvidence(searchParams),
  };
}
