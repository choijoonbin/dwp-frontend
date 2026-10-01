import { mkdir } from 'node:fs/promises';

import { expect, test, type Page } from '@playwright/test';

import { ADMIN_TRUTH_AUDIT_REVISION_PAGE } from './support/audit-control-fixtures';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';
import { appGovernance } from './support/admin-settings-truth-fixtures';
import {
  ADMIN_SETTINGS_EVIDENCE_DIRECTORY as EVIDENCE_DIRECTORY,
  ADMIN_SETTINGS_VIEWPORTS as viewports,
  expectKeyboardFocus,
  expectNoAxeViolations,
  expectNoHorizontalOverflow,
  fulfillSuccess as success,
} from './support/admin-settings-truth-support';

test.setTimeout(180_000);

async function mockTruthAuditOwners(page: Page) {
  await mockShellSession(page, ['TENANT_ADMIN', 'APP_CATALOG_ADMIN'], {
    locale: 'en',
    permissions: [...FULL_PRODUCT_PERMISSIONS],
    resourceRoles: [
      {
        responsibilityCode: 'APP_ACCESS_MANAGER',
        resourceType: 'APP',
        resourceKey: 'APP.MAIL',
        resourceSetId: 'rs-mail',
        resourceSetKey: 'RS_MAIL',
      },
    ],
  });

  await page.route('**/api/auth/me/policy', (route) =>
    success(route, {
      tenantId: 1,
      defaultLoginType: 'SSO',
      allowedLoginTypes: ['SSO', 'LOCAL'],
      localLoginEnabled: true,
      ssoLoginEnabled: true,
      ssoProviderKey: 'okta-workforce',
      requireMfa: true,
    })
  );
  await page.route('**/api/auth/idp', (route) =>
    success(route, [
      {
        enabled: true,
        providerType: 'SAML',
        providerKey: 'okta-workforce',
      },
    ])
  );
  await page.route('**/api/auth/admin/tenant-settings/auth-policy/changes?*', (route) =>
    success(route, { items: [], limit: 100, hasMore: true })
  );
  const ssoTestLoginReceipt = {
    testLoginJobId: '91000000-0000-4000-8000-000000000001',
    tenantId: 1,
    providerKey: 'okta-workforce',
    lifecycleState: 'UNAVAILABLE',
    internalPrerequisiteState: 'READY_FOR_EXTERNAL_PROBE',
    externalProbeState: 'UNAVAILABLE',
    blockingReasons: ['EXTERNAL_IDP_LOGIN_EXECUTOR_NOT_CONNECTED'],
    executionBoundary: 'UNCONNECTED_EXTERNAL_IDP_EXECUTOR',
    requestedBy: 1,
    idempotencyKey: '92000000-0000-4000-8000-000000000002',
    requestedAt: '2026-09-29T00:45:00Z',
    completedAt: '2026-09-29T00:45:01Z',
    receiptPayloadCanonical: '{"externalProbeState":"UNAVAILABLE"}',
    receiptSha256: 'b'.repeat(64),
  };
  await page.route('**/api/auth/admin/tenant-settings/sso-test-login-jobs*', (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'POST') return success(route, ssoTestLoginReceipt);
    if (path.endsWith('/sso-test-login-jobs')) {
      return success(route, { items: [ssoTestLoginReceipt], limit: 20, hasMore: false });
    }
    return success(route, ssoTestLoginReceipt);
  });
  await page.route('**/api/auth/admin/provisioning/scim/connectors', (route) =>
    success(route, [
      {
        connectorId: 'scim-okta',
        connectorKey: 'okta-workforce',
        displayName: 'Okta Workforce',
        tokenPrefix: 'dwp_scim',
        allowedOperations: ['USERS', 'GROUPS'],
        purpose: 'Authoritative workforce lifecycle',
        ownerUserId: 1,
        lifecycleState: 'ACTIVE',
        credentialState: 'ACTIVE',
        credentialIssuedAt: '2026-09-01T00:00:00Z',
        credentialExpiresAt: '2026-12-01T00:00:00Z',
        lastUsedAt: '2026-09-17T00:30:00Z',
        health: 'READY',
        events24h: 31,
        failedEvents24h: 0,
        lastSuccessAt: '2026-09-17T00:30:00Z',
        version: 2,
      },
    ])
  );
  await page.route('**/api/auth/admin/access/app-governance', (route) =>
    success(route, appGovernance)
  );
  await page.route('**/api/auth/admin/tenant-setting-registry/owners', (route) =>
    success(route, [
      {
        ownerKey: 'AUTH_POLICY',
        ownerVersion: 2,
        settingKey: 'authentication.defaultLoginType',
        ownerService: 'auth',
        valueType: 'STRING',
        editorKind: 'LOGIN_TYPE',
        resolutionStrategy: 'TENANT_OVERRIDE_OR_OWNER_DEFAULT',
        overridePolicy: 'OWNER_LOCKED',
        activationMode: 'PUBLISH',
        defaultValue: 'SSO',
        localizedLabelKey: 'managed.effective.settings.authentication.defaultLoginType.title',
        lifecycleState: 'ACTIVE',
        adapterState: 'CONNECTED',
        observedAt: '2026-09-29T01:00:00Z',
        freshnessState: 'FRESH',
        allowedActions: ['VIEW_EFFECTIVE'],
      },
      {
        ownerKey: 'AUTH_POLICY',
        ownerVersion: 1,
        settingKey: 'authentication.requireMfa',
        ownerService: 'auth',
        valueType: 'BOOLEAN',
        editorKind: 'BOOLEAN',
        resolutionStrategy: 'TENANT_OVERRIDE_OR_OWNER_DEFAULT',
        overridePolicy: 'OWNER_LOCKED',
        activationMode: 'PUBLISH',
        defaultValue: true,
        localizedLabelKey: 'managed.effective.settings.authentication.requireMfa.title',
        lifecycleState: 'ACTIVE',
        adapterState: 'CONNECTED',
        observedAt: '2026-09-29T01:00:00Z',
        freshnessState: 'FRESH',
        allowedActions: ['VIEW_EFFECTIVE'],
      },
      {
        ownerKey: 'AUTH_POLICY',
        ownerVersion: 3,
        settingKey: 'authentication.tokenTtlSec',
        ownerService: 'auth',
        valueType: 'INTEGER',
        editorKind: 'DURATION_SECONDS',
        resolutionStrategy: 'TENANT_OVERRIDE_OR_OWNER_DEFAULT',
        overridePolicy: 'OWNER_LOCKED',
        activationMode: 'PUBLISH',
        defaultValue: 28800,
        localizedLabelKey: 'managed.effective.settings.authentication.tokenTtlSec.title',
        lifecycleState: 'ACTIVE',
        adapterState: 'CONNECTED',
        observedAt: '2026-09-29T01:00:00Z',
        freshnessState: 'FRESH',
        allowedActions: ['VIEW_EFFECTIVE'],
      },
      {
        ownerKey: 'AUTH_TENANT_DIRECTORY',
        ownerVersion: 1,
        settingKey: 'identity.defaultLocale',
        ownerService: 'auth',
        valueType: 'STRING',
        editorKind: 'LOCALE',
        resolutionStrategy: 'TENANT_OVERRIDE_OR_OWNER_DEFAULT',
        overridePolicy: 'TENANT_ALLOWED',
        activationMode: 'PUBLISH',
        defaultValue: 'ko-KR',
        localizedLabelKey: 'managed.effective.settings.identity.defaultLocale.title',
        lifecycleState: 'ACTIVE',
        adapterState: 'CONNECTED',
        observedAt: '2026-09-29T01:00:00Z',
        freshnessState: 'FRESH',
        allowedActions: ['VIEW_EFFECTIVE', 'CREATE_CHANGE', 'RESTORE_INHERITANCE'],
      },
    ])
  );
  await page.route('**/api/auth/admin/tenant-setting-registry/changes', (route) =>
    success(route, {
      items: [
        {
          changeId: 'setting-change-locale-1',
          settingKey: 'identity.defaultLocale',
          ownerKey: 'AUTH_TENANT_DIRECTORY',
          ownerVersion: 1,
          desiredState: 'VALUE',
          beforeValue: 'ko-KR',
          proposedValue: 'en-US',
          lifecycleState: 'IN_REVIEW',
          impactCount: 42,
          impactCoverage: 'ACTIVE_TENANT_IDENTITIES',
          impactObservedAt: '2026-09-29T00:59:00Z',
          justification: 'Review the tenant verification baseline through independent approval.',
          requestedBy: 10,
          submittedAt: '2026-09-29T00:30:00Z',
          version: 1,
          createdAt: '2026-09-29T00:20:00Z',
          updatedAt: '2026-09-29T00:30:00Z',
          preview: {
            settingKey: 'identity.defaultLocale',
            beforeValue: 'ko-KR',
            effectiveAfter: 'en-US',
            sourceAfter: 'TENANT_OVERRIDE',
            impactedPrincipalCount: 42,
            coverage: 'ACTIVE_TENANT_IDENTITIES',
            observedAt: '2026-09-29T00:59:00Z',
            warnings: [],
          },
          allowedActions: ['APPROVE', 'REJECT'],
        },
      ],
      limit: 100,
      hasMore: false,
    })
  );
  await page.route('**/api/provider/v1/tenant/settings/provider-domains', (route) =>
    success(route, {
      ownerService: 'provider-control-plane',
      observationState: 'LIVE_OWNER_READ',
      observedAt: '2026-09-29T01:00:00Z',
      sourceLastChangedAt: '2026-09-29T00:58:00Z',
      coverageState: 'CURRENT_TENANT_NON_REVOKED_DOMAINS',
      exclusions: [],
      domains: [
        {
          domainId: 'domain-primary',
          domainName: 'workspace.dwp.example',
          domainType: 'LOGIN',
          verificationMethod: 'DNS_TXT',
          verificationState: 'VERIFIED',
          primaryDomain: true,
          verifiedAt: '2026-09-28T00:00:00Z',
          lastCheckedAt: '2026-09-29T00:55:00Z',
          sourceChangedAt: '2026-09-29T00:58:00Z',
          evidenceFreshnessState: 'OWNER_ATTESTED',
          version: 3,
        },
      ],
    })
  );
  await page.route('**/api/provider/v1/tenant/settings/data-governance-observation', (route) =>
    success(route, {
      ownerService: 'provider-control-plane',
      observationState: 'LIVE_OWNER_READ',
      observedAt: '2026-09-29T01:00:00Z',
      sourceLastChangedAt: '2026-09-29T00:58:00Z',
      coverageState: 'GLOBAL_POLICIES_AND_CURRENT_TENANT_LIFECYCLE_EVALUATIONS',
      exclusions: [
        'TENANT_SCOPED_HOLD_OWNER_NOT_CONNECTED',
        'EXTERNAL_SHARING_OWNER_NOT_CONNECTED',
        'PHYSICAL_RETENTION_OR_DELETION_EXECUTION_NOT_OBSERVED',
      ],
      policies: [
        {
          policyType: 'RETENTION',
          ownerService: 'provider-control-plane',
          coverage: 'GLOBAL',
          revisionNumber: 12,
          effectiveState: 'ACTIVE',
          retentionDays: 365,
          legalHoldActive: null,
          effectiveFrom: '2026-09-01T00:00:00Z',
          effectiveTo: null,
          publishedAt: '2026-09-01T00:00:00Z',
          sourceChangedAt: '2026-09-29T00:58:00Z',
          freshnessState: 'CURRENT_OWNER_REVISION',
          evidenceState: 'IMPACT_FINGERPRINT_RECORDED',
          impactFingerprint: 'c'.repeat(64),
          sourceVersion: 12,
        },
      ],
      tenantLifecycleHoldObservations: [
        {
          lifecycleRequestId: 'hold-request-tenant-1',
          requestedAction: 'PURGE',
          lifecycleState: 'BLOCKED_BY_HOLD',
          holdEvaluationState: 'ACTIVE_GLOBAL_LEGAL_HOLD',
          executionState: 'OWNER_HANDOFF_REQUIRED',
          evidenceReferenceCount: 2,
          evidenceState: 'REFERENCES_REDACTED',
          freshnessState: 'RECORDED_AT',
          sourceChangedAt: '2026-09-29T00:57:00Z',
          sourceVersion: 4,
        },
      ],
    })
  );
  await page.route('**/api/provider/v1/tenant/settings/plan-eligibility', (route) =>
    success(route, {
      ownerService: 'provider-control-plane',
      observationState: 'LIVE_OWNER_READ',
      observedAt: '2026-09-29T01:00:00Z',
      sourceLastChangedAt: '2026-09-29T00:58:00Z',
      coverageState: 'CURRENT_SUBSCRIPTION_AND_TENANT_ENTITLEMENTS',
      exclusions: ['EXTERNAL_SAAS_LICENSE_APPLICATION_NOT_OBSERVED'],
      plan: {
        planKey: 'DWP_ENTERPRISE',
        planVersion: 1,
        displayName: 'DWP Enterprise',
        subscriptionState: 'ACTIVE',
        startsAt: '2026-01-01T00:00:00Z',
        endsAt: null,
        sourceVersion: 3,
        sourceChangedAt: '2026-09-29T00:58:00Z',
      },
      products: [
        {
          productKey: 'mail',
          appResourceKey: 'APP.MAIL',
          entitlementKey: 'core.mail',
          entitlementType: 'APP',
          eligibilityState: 'ELIGIBLE',
          sourceChangedAt: '2026-09-29T00:58:00Z',
        },
      ],
    })
  );
  await page.route('**/api/auth/admin/tenant-app-adoption', (route) =>
    success(route, {
      observedAt: '2026-09-29T01:00:00Z',
      coverageState: 'COMPLETE_INTERNAL_OWNERS',
      includedOwners: [
        'AUTH_PRODUCT_AUTHORIZATION_CATALOG',
        'AUTH_TENANT_APP_INSTALLATION',
        'AUTH_WORKFORCE_SEAT_RESERVATION',
      ],
      exclusions: [
        'EXTERNAL_SAAS_PROVISIONING',
        'EXTERNAL_LICENSE_SETTLEMENT',
        'PRODUCT_RUNTIME_HEALTH_AND_RUNNABILITY',
      ],
      requestableAppResourceKeys: ['APP.MAIL'],
      installations: [
        {
          installationId: 'installation-mail',
          productKey: 'mail',
          appResourceKey: 'APP.MAIL',
          installationKind: 'INTERNAL_AUTH_CONTROLLED',
          lifecycleState: 'ENABLED',
          externalExecutorState: 'NOT_REQUIRED',
          seatCapacity: 100,
          reservedSeats: 1,
          activeSeats: 0,
          justification: 'Adopt Mail for the tenant workforce.',
          requestedBy: 10,
          submittedAt: '2026-09-29T00:00:00Z',
          approvedBy: 20,
          approvedAt: '2026-09-29T00:30:00Z',
          decisionReason: 'Independent scope review completed.',
          version: 2,
          createdAt: '2026-09-29T00:00:00Z',
          updatedAt: '2026-09-29T00:30:00Z',
          allowedActions: ['REQUEST_ASSIGNMENT'],
        },
      ],
      installationsLimit: 100,
      installationsHasMore: false,
    })
  );
  await page.route('**/api/auth/admin/tenant-app-adoption/assignments', (route) =>
    success(route, {
      items: [
        {
          assignmentId: 'mail-seat-1',
          installationId: 'installation-mail',
          productKey: 'mail',
          userId: 40,
          userDisplayName: 'Mail target administrator',
          lifecycleState: 'PENDING_APPROVAL',
          seatQuantity: 1,
          sourceType: 'TENANT_DIRECT',
          externalSettlementState: 'NOT_REQUIRED',
          validFrom: null,
          validTo: '2026-12-31T00:00:00Z',
          justification: 'Assign Mail administration to the workforce user.',
          requestedBy: 10,
          version: 0,
          createdAt: '2026-09-29T00:40:00Z',
          updatedAt: '2026-09-29T00:40:00Z',
          allowedActions: ['APPROVE', 'REJECT'],
        },
      ],
      limit: 100,
      hasMore: false,
    })
  );
  await page.route('**/api/auth/admin/tenant-app-adoption/capability-overrides', (route) =>
    success(route, {
      observedAt: '2026-09-29T01:00:00Z',
      coverageState: 'COMPLETE_INTERNAL_OWNERS',
      includedOwners: ['AUTH_PRODUCT_AUTHORIZATION_CATALOG', 'AUTH_TENANT_CAPABILITY_OVERRIDE'],
      exclusions: ['EXTERNAL_SAAS_CAPABILITY_APPLICATION'],
      capabilities: [
        {
          policy: {
            contractKey: 'mail.admin.policy.update',
            productKey: 'mail',
            appResourceKey: 'APP.MAIL',
            surfaceKey: 'mail.admin.policy',
            resolvedCapabilityCode: 'MAIL_POLICY_ADMIN',
            action: 'UPDATE',
            riskTier: 'HIGH',
            contractOwner: 'mail',
            activeBundleId: 'bundle-mail-1',
            activeRevision: 8,
            ruleKey: 'high-risk-owner-lock',
            ruleVersion: 1,
            overrideMode: 'OWNER_LOCKED',
            maxDurationDays: null,
            ruleOwner: 'AUTH_PRODUCT_AUTHORIZATION_CATALOG',
            reasonCode: 'HIGH_RISK_CAPABILITY_OWNER_LOCKED',
            planEligibilityState: 'UNAVAILABLE',
            allowedActions: [],
          },
          baselineState: 'ENABLED',
          effectiveState: 'ENABLED',
          effectiveSource: 'GLOBAL_AUTHORIZATION_BUNDLE',
          overrideState: 'OWNER_LOCKED',
          activeOverride: null,
          lineage: [
            {
              level: 'BASELINE',
              ownerKey: 'AUTH_PRODUCT_AUTHORIZATION_CATALOG',
              state: 'ENABLED',
              reason: 'ACTIVE_BUNDLE',
              receiptId: null,
              effectiveFrom: '2026-09-28T00:00:00Z',
              effectiveTo: null,
            },
          ],
          evaluatedAt: '2026-09-29T01:00:00Z',
        },
      ],
      changes: [
        {
          overrideChangeId: 'override-mail-1',
          contractKey: 'mail.admin.policy.update',
          productKey: 'mail',
          appResourceKey: 'APP.MAIL',
          policyRuleKey: 'tenant-restrictive-disable',
          policyRuleVersion: 1,
          baseBundleId: 'bundle-mail-1',
          baseActiveRevision: 8,
          desiredState: 'DISABLED',
          lifecycleState: 'IN_REVIEW',
          validTo: '2026-10-15T00:00:00Z',
          justification: 'Temporarily restrict the capability during an access control review.',
          requestedBy: 10,
          submittedAt: '2026-09-29T00:30:00Z',
          version: 1,
          createdAt: '2026-09-29T00:20:00Z',
          updatedAt: '2026-09-29T00:30:00Z',
          allowedActions: ['APPROVE', 'REJECT'],
        },
      ],
    })
  );
  await page.route('**/api/auth/admin/tenant-settings/governance-snapshot', (route) =>
    success(route, {
      observedAt: '2026-09-29T01:00:00Z',
      tenantDirectory: {
        state: 'OBSERVED',
        tenantId: 1,
        tenantCode: 'tenant-one',
        tenantName: 'DWP Tenant',
        defaultLocale: 'ko-KR',
        sourceUpdatedAt: '2026-09-29T00:59:00Z',
      },
      providerDomain: {
        ownerKey: 'PROVIDER_TENANT_DOMAIN',
        state: 'UNAVAILABLE',
        observedAt: '2026-09-29T01:00:00Z',
        exclusions: ['PROVIDER_TENANT_MAPPING_NOT_EXPOSED_TO_AUTH'],
      },
      loginVerification: {
        internalPrerequisiteState: 'READY_FOR_EXTERNAL_PROBE',
        configuredProviderKey: 'okta-workforce',
        externalProbeState: 'UNAVAILABLE',
        lastExternalProbeAt: null,
        latestReceipt: ssoTestLoginReceipt,
        blockingReasons: ['EXTERNAL_IDP_LOGIN_EXECUTOR_NOT_CONNECTED'],
      },
      recoveryVerification: {
        state: 'READY',
        total: 1,
        verified: 1,
        overdue: 0,
        notVerified: 0,
        freshestVerificationAt: '2026-09-28T01:00:00Z',
        exclusions: ['EXTERNAL_IDP_LOGIN_SUCCESS_NOT_INFERRED_FROM_INTERNAL_DRILL'],
      },
      policyOwners: [],
      effectiveSettings: [
        {
          settingKey: 'identity.preferredLocale',
          effectiveValue: 'en-US',
          resolutionStrategy: 'OVERRIDABLE_DEFAULT',
          effectiveSource: 'USER',
          locked: false,
          overrideAllowed: true,
          overrideState: 'EXPLICIT',
          evaluatedAt: '2026-09-29T01:00:00Z',
          evidenceState: 'OBSERVED',
          sources: [
            {
              level: 'TENANT',
              ownerKey: 'AUTH_TENANT_DIRECTORY',
              value: 'ko-KR',
              evaluation: 'OVERRIDDEN',
              reason: 'A user override has higher precedence.',
            },
            {
              level: 'USER',
              ownerKey: 'AUTH_USER_PROFILE',
              value: 'en-US',
              evaluation: 'WINNER',
              reason: 'The user selected this locale.',
            },
          ],
        },
      ],
    })
  );
  await page.route('**/api/auth/tenant-settings/effective-settings/me/preferred-locale', (route) =>
    success(route, {
      userId: 1,
      preferredLocale: 'en-US',
      tenantDefaultLocale: 'ko-KR',
      version: 5,
      updatedAt: '2026-09-29T00:59:00Z',
    })
  );
  await page.route('**/api/auth/admin/tenant-settings/access-projection**', (route) =>
    success(route, {
      snapshotId: 'a'.repeat(64),
      observedAt: '2026-09-29T01:00:00Z',
      coverage: {
        state: 'COMPLETE_INTERNAL_OWNERS',
        includedOwners: ['DIRECT_ROLE_ASSIGNMENTS', 'APP_ADMIN_PRESET_ASSIGNMENTS'],
        exclusions: ['EXTERNAL_SAAS_LICENSES_AND_SEATS'],
        freshestSourceUpdatedAt: '2026-09-29T00:59:00Z',
        owners: [
          {
            ownerKey: 'DIRECT_ROLE_ASSIGNMENTS',
            state: 'OBSERVED',
            freshnessState: 'FRESH',
            observedAt: '2026-09-29T01:00:00Z',
            sourceUpdatedAt: '2026-09-29T00:59:00Z',
            allowedActions: ['VIEW_DETAIL'],
            exclusions: [],
          },
          {
            ownerKey: 'APP_ADMIN_PRESET_ASSIGNMENTS',
            state: 'OBSERVED',
            freshnessState: 'FRESH',
            observedAt: '2026-09-29T01:00:00Z',
            sourceUpdatedAt: '2026-09-29T00:59:00Z',
            allowedActions: ['VIEW_DETAIL'],
            exclusions: [],
          },
        ],
      },
      principals: [
        {
          userId: 1,
          displayName: 'Tenant Admin',
          email: 'tenant.admin@dwp.local',
          status: 'ACTIVE',
          mfaEnabled: true,
          pendingApprovalCount: 0,
          sourceUpdatedAt: '2026-09-29T00:59:00Z',
          grants: [
            {
              entitlementType: 'ROLE',
              entitlementKey: 'TENANT_ADMIN',
              displayName: 'Tenant administrator',
              sourceType: 'DIRECT',
              sourceId: 'role-assignment-1',
              sourceName: 'Direct tenant role',
              scopeType: 'TENANT',
              scopeRef: '1',
              lifecycleState: 'ACTIVE',
              validFrom: '2026-09-01T00:00:00Z',
              validTo: null,
              privileged: true,
              requestedBy: 10,
              approvedBy: 20,
              approvedAt: '2026-09-01T00:30:00Z',
              activatedBy: 30,
              activatedAt: '2026-09-01T00:40:00Z',
              approvalLineageState: 'ACTIVATED_INDEPENDENTLY',
            },
          ],
        },
      ],
      page: 0,
      size: 100,
      totalElements: 1,
      totalPages: 1,
    })
  );
  await page.route('**/api/platform/v1/admin/catalog', (route) =>
    success(route, {
      entityCount: 1,
      relationCount: 0,
      declaredRelationCount: 0,
      orphanCount: 1,
      criticalRelationCount: 0,
      entitiesByKind: { APP: 1 },
      entitiesByLifecycle: { ACTIVE: 1 },
      entities: [
        {
          ref: 'APP:MAIL',
          kind: 'APP',
          key: 'APP.MAIL',
          name: 'Mail',
          description: 'Tenant Mail application registry record.',
          ownerRef: 'TEAM:MESSAGING',
          lifecycleState: 'ACTIVE',
          riskTier: 'HIGH',
          scope: 'TENANT',
          revision: 7,
          metadata: { appResourceKey: 'APP.MAIL' },
        },
      ],
      entitiesLimit: 100,
      entitiesHasMore: false,
      generatedAt: '2026-09-17T00:00:00Z',
    })
  );
  await page.route('**/api/auth/product-surface-contexts', (route) =>
    success(route, {
      contractVersion: 'product-surfaces/v3',
      decisionRevision: 'truth-audit-mail-1',
      sourceRevisions: {
        auth: 'auth-mail-1',
        policy: 'policy-mail-1',
        productRelationship: 'relationship-mail-1',
      },
      activeAccessMode: 'NORMAL',
      generatedAt: '2026-09-17T00:00:00Z',
      contexts: [
        {
          contextKey: 'mail-work',
          productKey: 'mail',
          surfaceKey: 'mail.work',
          plane: 'work',
          accessMode: 'NORMAL',
          accessSource: 'ENTITLEMENT',
          appResourceKey: 'APP.MAIL',
          effectiveGrants: [],
          scopes: [
            {
              key: 'scope:mail:self',
              kind: 'SELF',
              displayName: 'My Mail',
              isDefault: true,
              readOnly: false,
              validUntil: null,
            },
          ],
          revalidateAt: '2026-09-18T00:00:00Z',
        },
        {
          contextKey: 'mail-management',
          productKey: 'mail',
          surfaceKey: 'mail.management',
          plane: 'management',
          accessMode: 'NORMAL',
          accessSource: 'MANAGEMENT',
          appResourceKey: 'APP.MAIL',
          effectiveGrants: [],
          scopes: [
            {
              key: 'scope:mail:admin',
              kind: 'RESOURCE_SET',
              displayName: 'Mail administration',
              isDefault: true,
              readOnly: false,
              validUntil: '2026-12-31T00:00:00Z',
            },
          ],
          revalidateAt: '2026-09-18T00:00:00Z',
        },
      ],
      rollouts: [
        {
          productKey: 'mail',
          state: '111',
          flags: { contextShadow: true, capabilityEnforcement: true, surfaceUi: true },
          cohort: 'truth-audit',
          opaqueRevision: 'mail-rollout-1',
          authorityStatus: 'AVAILABLE',
        },
      ],
    })
  );
  await page.route('**/api/platform/v1/admin/audit-control/policy/revisions?*', (route) =>
    success(route, ADMIN_TRUTH_AUDIT_REVISION_PAGE)
  );
}

test.beforeAll(async () => {
  await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
});

for (const viewport of viewports) {
  test(`tenant settings truth evidence at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    const zoom = 'zoom' in viewport ? viewport.zoom : 1;
    await page.addInitScript((value) => {
      window.addEventListener('DOMContentLoaded', () => {
        document.documentElement.style.zoom = String(value);
      });
    }, zoom);
    await mockTruthAuditOwners(page);

    await page.goto('/admin');
    await expect
      .poll(() => page.evaluate(() => document.documentElement.style.zoom))
      .toBe(String(zoom));
    await expect(page.getByTestId('tenant-settings-operational-overview')).toBeVisible();
    await expect(page.getByText('okta-workforce').first()).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: 'Organization source, login readiness, and setting provenance',
      })
    ).toBeVisible();
    await expect(page.getByText(/external IdP login verifier is not connected/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'SSO test-login evidence' })).toBeVisible();
    await expect(
      page.getByText(/Additional changes, including actionable changes, may exist/)
    ).toBeVisible();
    await expect(
      page.getByText(/Additional revisions, including actionable revisions, may exist/)
    ).toBeVisible();
    await expect(page.getByText('bbbbbbbbbbbb…')).toBeVisible();
    await expect(page.getByText('b'.repeat(64))).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Provider-owned domains' })).toBeVisible();
    await expect(page.getByText('workspace.dwp.example')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Setting owner registry' })).toBeVisible();
    await expect(page.getByText('Default sign-in method')).toBeVisible();
    await expect(page.getByText('Additional verification').first()).toBeVisible();
    await expect(page.getByText('Sign-in duration')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Organization display language', level: 3 })
    ).toBeVisible();
    await expect(page.getByText('In independent review')).toBeVisible();
    await expect(page.getByText(/ko-KR → en-US/)).toBeVisible();
    const createPolicyAction = page.getByRole('button', { name: 'Create policy draft' });
    await createPolicyAction.focus();
    await expect(createPolicyAction).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('dialog', { name: 'Create authentication policy draft' })
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText(/managed\.effective\.settings/)).toHaveCount(0);
    await expectNoAxeViolations(page);
    await expectNoHorizontalOverflow(page, `S06 ${viewport.name}`);
    await page.screenshot({
      path: `${EVIDENCE_DIRECTORY}/S06-tenant-overview-${viewport.name}.png`,
      fullPage: true,
      animations: 'disabled',
    });

    await page.goto('/admin/identity/access');
    await expect(page.getByRole('heading', { name: 'Identity access', level: 1 })).toBeVisible();
    const tenantUserGrid = page.getByRole('grid');
    if (await tenantUserGrid.count()) await tenantUserGrid.scrollIntoViewIfNeeded();
    const reviewAccessAction = page
      .getByRole('button', { name: /^Review effective access(?: for Tenant Admin)?$/ })
      .first();
    if (await reviewAccessAction.count()) {
      await reviewAccessAction.focus();
      await expect(reviewAccessAction).toBeFocused();
      await page.keyboard.press('Enter');
    } else {
      await tenantUserGrid.getByRole('row').filter({ hasText: 'Tenant Admin' }).click();
    }
    await expect(page.getByRole('heading', { name: 'Effective access' })).toBeVisible();
    await expect(page.getByText('Source: Direct')).toBeVisible();
    await expect(page.getByText('Scope: Entire tenant')).toBeVisible();
    await expect(page.getByText('No expiry')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Unified internal entitlements' })
    ).toBeVisible();
    await expect(
      page.getByText(/request recorded → approval recorded → activation recorded/)
    ).toBeVisible();
    await expectNoAxeViolations(page);
    await expectNoHorizontalOverflow(page, `S07 ${viewport.name}`);
    await page.screenshot({
      path: `${EVIDENCE_DIRECTORY}/S07-effective-access-${viewport.name}.png`,
      fullPage: true,
      animations: 'disabled',
    });

    await page.goto('/admin/governance/audit-governance');
    await expect(
      page.getByRole('table', { name: 'Policy before and after comparison' })
    ).toBeVisible();
    const immutableImpact = page.getByRole('region', { name: 'Immutable impact snapshot' });
    await expect(immutableImpact).toBeVisible();
    await expect(
      immutableImpact.getByText('Complete internal audit-event owner coverage')
    ).toBeVisible();
    await expect(immutableImpact.getByText('Audit events affected')).toBeVisible();
    await expect(immutableImpact.getByText('48')).toBeVisible();
    await expect(immutableImpact.getByText('cccccccccccc…')).toBeVisible();
    await expect(page.getByText('c'.repeat(64))).toHaveCount(0);
    await expect(page.getByText('Independent approval pending')).toBeVisible();
    await expect(
      page.getByText(/Additional revisions, including actionable revisions, may exist/)
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Provider retention and legal-hold observation' })
    ).toBeVisible();
    await expect(page.getByText('Retention · revision 12')).toBeVisible();
    await expect(page.getByText(/Tenant-scoped hold owner is not connected/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Reject' })).toHaveCount(0);
    const refreshAuditAction = page.getByRole('button', { name: 'Refresh' }).first();
    await refreshAuditAction.focus();
    await expect(refreshAuditAction).toBeFocused();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    await refreshAuditAction.blur();
    await expect(page.locator('.MuiTooltip-popper')).toHaveCount(0);
    await expectNoAxeViolations(page);
    await expectNoHorizontalOverflow(page, `S08 ${viewport.name}`);
    await page.screenshot({
      path: `${EVIDENCE_DIRECTORY}/S08-policy-evidence-${viewport.name}.png`,
      fullPage: true,
      animations: 'disabled',
    });

    await page.goto('/admin/platform/catalog');
    await expect(page.getByTestId('application-lifecycle-catalog')).toBeVisible();
    const mailLifecycle = page.getByTestId('application-lifecycle-APP.MAIL');
    await expect(mailLifecycle).toBeVisible();
    await expect(mailLifecycle.getByText(/Enabled.*0 active.*1 reserved \/ 100/)).toBeVisible();
    await expect(
      mailLifecycle.getByText(/Workforce assignments: 0 active.*1 pending/)
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open management workspace' })).toBeVisible();
    await expect(mailLifecycle.getByText('1 work surface')).toBeVisible();
    await expectNoHorizontalOverflow(page, `S13 ${viewport.name}`);
    await page.screenshot({
      path: `${EVIDENCE_DIRECTORY}/S13-application-lifecycle-${viewport.name}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    await page.getByRole('tab', { name: 'Asset inventory' }).click();
    const relationshipAction = page.getByRole('button', { name: 'Review relationships for Mail' });
    if (await relationshipAction.count()) {
      await relationshipAction.focus();
      await expect(relationshipAction).toBeFocused();
      await page.keyboard.press('Enter');
    } else {
      await page.getByRole('row', { name: /Mail Application/ }).click();
    }
    await expect(page.getByRole('tab', { name: 'Relationship graph' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expectNoAxeViolations(page);

    await page.goto('/admin/identity/app-governance');
    const presetProgress = page.getByTestId('app-preset-assignment-progress');
    await expect(presetProgress).toBeVisible();
    await expect(presetProgress.getByText('Request owner')).toBeVisible();
    await expect(
      presetProgress.getByRole('heading', { name: 'Independent approver' })
    ).toBeVisible();
    await expect(
      presetProgress.getByRole('heading', { name: 'Independent activator' })
    ).toBeVisible();
    await expect(presetProgress.getByText(/Separation remains pending/)).toBeVisible();
    await page.getByRole('button', { name: 'App adoption and seats' }).click();
    await expect(page.getByTestId('tenant-app-adoption-panel')).toBeVisible();
    await expect(page.getByText(/External SaaS provisioning is not connected/)).toBeVisible();
    await expect(page.getByText('Mail target administrator')).toBeVisible();
    const mailCapabilities = page.getByTestId('tenant-app-capability-mail');
    await expect(mailCapabilities).toBeVisible();
    await expect(mailCapabilities.getByText('Policy controls · Update').first()).toBeVisible();
    await expect(
      page.getByText('Mail · Policy controls · Update · Suppress for this tenant')
    ).toBeVisible();
    await expect(page.getByText(/Baseline authorization bundle r8/i).first()).toBeVisible();
    await expect(page.getByText(/Plan: DWP Enterprise v1 · Eligible/)).toBeVisible();
    await expect(page.getByText('mail.admin.policy.update')).toHaveCount(0);
    await expectKeyboardFocus(page);
    await page.keyboard.press('Escape');
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await expect(page.locator('.MuiTooltip-popper')).toHaveCount(0);
    await expect(page.locator('.MuiTouchRipple-rippleVisible')).toHaveCount(0);
    await expectNoAxeViolations(page);
    await expectNoHorizontalOverflow(page, `S14 ${viewport.name}`);
    await page.screenshot({
      path: `${EVIDENCE_DIRECTORY}/S14-preset-progress-${viewport.name}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  });
}

test('S14 shows an authoritative empty capability catalog', async ({ page }) => {
  await mockTruthAuditOwners(page);
  await page.unroute('**/api/auth/admin/tenant-app-adoption/capability-overrides');
  await page.route('**/api/auth/admin/tenant-app-adoption/capability-overrides', (route) =>
    success(route, {
      observedAt: '2026-09-29T01:00:00Z',
      coverageState: 'COMPLETE_INTERNAL_OWNERS',
      includedOwners: ['AUTH_PRODUCT_AUTHORIZATION_CATALOG'],
      exclusions: ['EXTERNAL_SAAS_CAPABILITY_APPLICATION'],
      capabilities: [],
      changes: [],
    })
  );

  await page.goto('/admin/identity/app-governance');
  await page.getByRole('button', { name: 'App adoption and seats' }).click();
  await expect(page.getByText('No app capability contracts are published')).toBeVisible();
});

for (const appearance of ['dark', 'high-contrast'] as const) {
  test(`S07 S08 S13 S14 remain operable in ${appearance}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({
      colorScheme: appearance === 'dark' ? 'dark' : 'light',
      forcedColors: appearance === 'high-contrast' ? 'active' : 'none',
      reducedMotion: 'reduce',
    });
    await mockTruthAuditOwners(page);

    const journeys = [
      {
        key: 'S07',
        path: '/admin/identity/access',
        landmark: page.getByRole('heading', { name: 'Identity access', level: 1 }),
      },
      {
        key: 'S08',
        path: '/admin/governance/audit-governance',
        landmark: page.getByRole('table', { name: 'Policy before and after comparison' }),
      },
      {
        key: 'S13',
        path: '/admin/platform/catalog',
        landmark: page.getByTestId('application-lifecycle-catalog'),
      },
    ];

    for (const journey of journeys) {
      await page.goto(journey.path);
      await expect(journey.landmark).toBeVisible();
      await expectNoAxeViolations(page);
      await expectNoHorizontalOverflow(page, `${journey.key} ${appearance}`);
      await page.screenshot({
        path: `${EVIDENCE_DIRECTORY}/${journey.key}-${appearance}.png`,
        fullPage: true,
        animations: 'disabled',
      });
    }

    await page.goto('/admin/identity/app-governance');
    await page.getByRole('button', { name: 'App adoption and seats' }).click();
    await expect(page.getByTestId('tenant-app-capability-mail')).toBeVisible();
    await expectNoAxeViolations(page);
    await expectNoHorizontalOverflow(page, `S14 ${appearance}`);
    await page.screenshot({
      path: `${EVIDENCE_DIRECTORY}/S14-${appearance}.png`,
      fullPage: true,
      animations: 'disabled',
    });

    await expect
      .poll(() =>
        page.evaluate(
          (mode) =>
            mode === 'dark'
              ? matchMedia('(prefers-color-scheme: dark)').matches
              : matchMedia('(forced-colors: active)').matches,
          appearance
        )
      )
      .toBe(true);
  });
}
