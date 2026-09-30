import { describe, expect, it } from 'vitest';

import type { TenantAccessGrant } from '@dwp-frontend/shared-utils';

import {
  projectionActorEvidenceLabelKey,
  projectionExclusionLabelKey,
  projectionEntitlementTypeLabelKey,
  projectionFreshnessLabelKey,
  projectionLifecycleLabelKey,
  projectionOwnerLabelKey,
  projectionScopeLabelKey,
  projectionSourcePresentation,
  projectionSourceTypeLabelKey,
} from './tenant-access-projection-model';

const grant = {
  entitlementType: 'APP_WORKFORCE',
  entitlementKey: 'test',
  displayName: 'Test app',
  sourceType: 'TENANT_APP_ASSIGNMENT',
  sourceId: 'raw-uuid-must-not-render',
  sourceName: 'APP.RAW_INTERNAL_KEY',
  scopeType: 'APP',
  scopeRef: 'raw-scope-uuid',
  lifecycleState: 'BLOCKED_BY_INSTALLATION_SUSPENDED',
  privileged: false,
  approvalLineageState: 'COMPLETE',
} satisfies TenantAccessGrant;

describe('tenant access projection presentation', () => {
  it('maps owner, lifecycle, scope, actor, and exclusion codes to localized keys', () => {
    expect(projectionOwnerLabelKey('AUTH_PRODUCT_AUTHORIZATION_CATALOG')).toContain('owners.');
    expect(projectionLifecycleLabelKey(grant.lifecycleState)).toBe(
      'access.projection.lifecycle.BLOCKED_BY_INSTALLATION'
    );
    expect(projectionScopeLabelKey(grant.scopeType)).toBe('access.projection.scopes.APP');
    expect(projectionActorEvidenceLabelKey(42)).toContain('RECORDED');
    expect(projectionExclusionLabelKey('EXTERNAL_SAAS_LICENSES_AND_SEATS')).toContain(
      'exclusionLabels.'
    );
  });

  it('fails closed for unknown codes and never falls back to raw identifiers', () => {
    expect(projectionOwnerLabelKey('RAW_OWNER')).toBe('access.projection.owners.UNKNOWN');
    expect(projectionLifecycleLabelKey('RAW_STATE')).toBe('access.projection.lifecycle.UNKNOWN');
    expect(projectionScopeLabelKey('RAW_SCOPE')).toBe('access.projection.scopes.UNKNOWN');
    expect(projectionExclusionLabelKey('RAW_EXCLUSION')).toBe(
      'access.projection.exclusionLabels.UNKNOWN'
    );
    expect(projectionFreshnessLabelKey('RAW_FRESHNESS')).toBe(
      'access.projection.freshness.UNKNOWN'
    );
    expect(projectionEntitlementTypeLabelKey('RAW_ENTITLEMENT')).toBe(
      'access.projection.entitlementTypes.UNKNOWN'
    );
    expect(projectionSourceTypeLabelKey('RAW_SOURCE')).toBe(
      'access.projection.sourceTypes.UNKNOWN'
    );
    expect(
      projectionSourcePresentation({
        ...grant,
        sourceType: 'RAW_SOURCE',
      } as unknown as TenantAccessGrant)
    ).toEqual({ kind: 'localized', key: 'access.projection.sourceDetails.UNKNOWN' });
    expect(projectionSourcePresentation(grant)).toEqual({
      kind: 'localized',
      key: 'access.projection.sourceDetails.TENANT_APP_ASSIGNMENT',
    });
  });
});
