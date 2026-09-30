import { describe, expect, it } from 'vitest';

import {
  providerCodeEnumTranslationKey,
  providerSafeEnumPresentation,
  providerWidgetEnumTranslationKey,
} from './provider-safe-enum-presentation';

describe('provider server enum presentation', () => {
  it('preserves allow-listed server values', () => {
    expect(providerSafeEnumPresentation('domainType', 'LOGIN')).toBe('LOGIN');
    expect(providerSafeEnumPresentation('domainVerificationMethod', 'DNS_TXT')).toBe('DNS_TXT');
    expect(providerSafeEnumPresentation('codeContractKind', 'SECURITY')).toBe('SECURITY');
    expect(providerSafeEnumPresentation('dataFindingCategory', 'LINEAGE_DRIFT')).toBe(
      'LINEAGE_DRIFT'
    );
    expect(providerSafeEnumPresentation('widgetWorkflowState', 'APPROVED')).toBe('APPROVED');
  });

  it('fails closed instead of exposing unknown internal enum values', () => {
    expect(providerSafeEnumPresentation('domainType', 'INTERNAL_DOMAIN')).toBe('UNAVAILABLE');
    expect(providerSafeEnumPresentation('codeRegistrationState', 'INTERNAL_STATE')).toBe(
      'UNAVAILABLE'
    );
    expect(providerSafeEnumPresentation('dataClassification', 'SECRET_INTERNAL')).toBe(
      'UNAVAILABLE'
    );
    expect(providerSafeEnumPresentation('dataFindingSeverity', null)).toBe('UNAVAILABLE');
    expect(providerCodeEnumTranslationKey('codeContractKind', 'INTERNAL_KIND')).toBe(
      'codeContracts.kinds.UNAVAILABLE'
    );
    expect(providerWidgetEnumTranslationKey('widgetSafetyState', 'INTERNAL_SAFETY')).toBe(
      'widgetCatalog.controlPlane.safetyState.UNAVAILABLE'
    );
  });
});
