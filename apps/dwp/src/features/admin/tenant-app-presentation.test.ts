import { describe, expect, it } from 'vitest';

import {
  capabilityDesiredStatePresentationKey,
  capabilityEffectiveStatePresentationKey,
  capabilityOverrideModePresentationKey,
  capabilityPlanStatePresentationKey,
  capabilitySourcePresentationKey,
  capabilityWorkflowStatePresentationKey,
  isTenantCapabilityCatalogEmpty,
  tenantAppCoveragePresentationKey,
  tenantAppExecutorStatePresentationKey,
  tenantAppKindPresentationKey,
  tenantPlanCoveragePresentationKey,
  tenantAppStatePresentationKey,
} from './tenant-app-presentation';

describe('tenant app presentation', () => {
  it('maps owner-defined lifecycle values through closed sets', () => {
    expect(tenantAppStatePresentationKey('ACTIVE')).toContain('.ACTIVE');
    expect(tenantAppStatePresentationKey('EXPIRED')).toBe('appGovernance.adoption.states.EXPIRED');
    expect(tenantAppKindPresentationKey('EXTERNAL_SERVICE')).toContain('.EXTERNAL_SERVICE');
    expect(tenantAppExecutorStatePresentationKey('UNAVAILABLE')).toContain('.UNAVAILABLE');
  });

  it('fails closed for unknown adoption and capability values', () => {
    for (const key of [
      tenantAppStatePresentationKey('FUTURE_STATE'),
      tenantAppKindPresentationKey('FUTURE_KIND'),
      tenantAppExecutorStatePresentationKey('FUTURE_EXECUTOR'),
      capabilityEffectiveStatePresentationKey('FUTURE_EFFECTIVE'),
      capabilityOverrideModePresentationKey('FUTURE_OVERRIDE'),
      capabilitySourcePresentationKey('FUTURE_SOURCE'),
      capabilityDesiredStatePresentationKey('FUTURE_DESIRED'),
      capabilityWorkflowStatePresentationKey('FUTURE_WORKFLOW'),
      capabilityPlanStatePresentationKey('FUTURE_PLAN'),
      tenantAppCoveragePresentationKey('FUTURE_COVERAGE'),
      tenantPlanCoveragePresentationKey('FUTURE_PLAN_COVERAGE'),
    ]) {
      expect(key).toMatch(/\.UNKNOWN$/);
      expect(key).not.toContain('FUTURE_');
    }
  });

  it('distinguishes an authoritative empty capability catalog', () => {
    expect(isTenantCapabilityCatalogEmpty(0)).toBe(true);
    expect(isTenantCapabilityCatalogEmpty(1)).toBe(false);
  });
});
