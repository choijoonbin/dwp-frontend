import type { ProviderActionItem, ProviderServicePosture } from '@dwp-frontend/shared-utils';

import { PROVIDER_OPERATIONAL_MAX_AGE_MS } from './provider-operational-freshness';

export type ProviderServiceObservationState = 'CURRENT' | 'STALE' | 'UNOBSERVED';

type Translate = (key: string, values?: Record<string, unknown>) => string;

const OPERATION_TYPES = new Set([
  'TENANT_ONBOARD',
  'TENANT_UPGRADE',
  'TENANT_SUSPEND',
  'TENANT_ACTIVATE',
  'ENTITLEMENT_CHANGE',
  'MAINTENANCE_SCHEDULE',
]);
const SERVICE_STATES = new Set(['READY', 'PROVISIONING', 'DEGRADED', 'FAILED']);
const VERIFICATION_STATES = new Set(['PENDING', 'FAILED']);
const TARGET_TYPES = new Set([
  'GLOBAL',
  'ORGANIZATION',
  'TENANT',
  'SERVICE',
  'SERVICE_INSTANCE',
  'DEPLOYMENT_CELL',
  'OPERATOR',
]);
const IMPACT_TYPES = new Set(['NONE', 'LOW', 'MEDIUM', 'HIGH', 'SERVICE_DISRUPTION']);
const ACTION_CATEGORIES = new Set([
  'CHANGE',
  'SERVICE_HEALTH',
  'IDENTITY',
  'COMMERCIAL',
  'RELIABILITY',
  'GOVERNANCE_DRIFT',
  'MAINTENANCE',
]);

export function providerActionCategoryPresentation(value: string): string {
  return ACTION_CATEGORIES.has(value) ? value : 'unavailable';
}

export function providerServiceObservationState(
  service: Pick<ProviderServicePosture, 'lastReconciledAt'>,
  now = Date.now()
): ProviderServiceObservationState {
  const observedAt = service.lastReconciledAt ? Date.parse(service.lastReconciledAt) : Number.NaN;
  if (!Number.isFinite(observedAt)) return 'UNOBSERVED';
  return now - observedAt > PROVIDER_OPERATIONAL_MAX_AGE_MS ? 'STALE' : 'CURRENT';
}

export function providerServiceObservationWatermark(
  services: Array<Pick<ProviderServicePosture, 'lastReconciledAt'>>
): number {
  if (services.length === 0) return Number.NaN;
  const observations = services.map((service) =>
    service.lastReconciledAt ? Date.parse(service.lastReconciledAt) : Number.NaN
  );
  if (observations.some((value) => !Number.isFinite(value))) return Number.NaN;
  return Math.min(...observations);
}

export function providerActionPresentation(
  item: ProviderActionItem,
  t: Translate
): { title: string; detail: string } {
  const fallback = {
    title: t('command.action.unavailableTitle'),
    detail: t('command.action.unavailableDetail'),
  };

  switch (item.category) {
    case 'CHANGE': {
      if (!OPERATION_TYPES.has(item.title)) return fallback;
      return {
        title: t(`operationTypes.${item.title}`),
        detail: safeNarrative(item.detail) ? item.detail : t('command.action.changeReviewRequired'),
      };
    }
    case 'SERVICE_HEALTH': {
      const split = splitTypedDetail(item.detail);
      if (!split || !SERVICE_STATES.has(split.value)) return fallback;
      return {
        title: item.title,
        detail: t('command.action.serviceState', {
          tenant: split.label,
          state: t(`command.action.serviceStates.${split.value}`),
        }),
      };
    }
    case 'IDENTITY':
      if (!VERIFICATION_STATES.has(item.detail)) return fallback;
      return {
        title: item.title,
        detail: t('command.action.domainState', {
          state: t(`command.action.verificationStates.${item.detail}`),
        }),
      };
    case 'COMMERCIAL': {
      const suffix = ' renewal';
      if (!item.detail.endsWith(suffix)) return fallback;
      const plan = item.detail.slice(0, -suffix.length).trim();
      if (!safeLabel(plan)) return fallback;
      return { title: item.title, detail: t('command.action.renewal', { plan }) };
    }
    case 'RELIABILITY': {
      const match = /^Error budget (unavailable|\d+(?:\.\d+)?%)$/.exec(item.detail);
      if (!match) return fallback;
      return {
        title: item.title,
        detail:
          match[1] === 'unavailable'
            ? t('command.action.errorBudgetUnavailable')
            : t('command.action.errorBudget', { value: match[1] }),
      };
    }
    case 'GOVERNANCE_DRIFT': {
      const split = splitTypedDetail(item.detail);
      const targetType = split?.value ?? item.detail;
      if (!TARGET_TYPES.has(targetType)) return fallback;
      return {
        title: item.title,
        detail: split?.label
          ? t('command.action.governanceTargetWithTenant', {
              tenant: split.label,
              target: t(`command.action.targetTypes.${targetType}`),
            })
          : t('command.action.governanceTarget', {
              target: t(`command.action.targetTypes.${targetType}`),
            }),
      };
    }
    case 'MAINTENANCE': {
      const split = splitTypedDetail(item.detail);
      if (!split || !IMPACT_TYPES.has(split.value)) return fallback;
      return {
        title: item.title,
        detail: t('command.action.maintenanceImpact', {
          trackingKey: split.label,
          impact: t(`command.action.impactTypes.${split.value}`),
        }),
      };
    }
    default:
      return fallback;
  }
}

function splitTypedDetail(value: string): { label: string; value: string } | null {
  const separator = value.lastIndexOf(' / ');
  if (separator <= 0 || separator >= value.length - 3) return null;
  const label = value.slice(0, separator).trim();
  const typedValue = value.slice(separator + 3).trim();
  return safeLabel(label) ? { label, value: typedValue } : null;
}

function safeLabel(value: string): boolean {
  return value.length > 0 && value.length <= 160;
}

function safeNarrative(value: string): boolean {
  return safeLabel(value) && !/^[A-Z][A-Z0-9_]*(?:\s*\/\s*[A-Z][A-Z0-9_]*)*$/.test(value);
}
