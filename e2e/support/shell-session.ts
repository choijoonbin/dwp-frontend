import {
  DEFAULT_APP_PERMISSIONS,
  WORKSPACE_ACTIVITY_FIXTURE,
  WORKSPACE_APPS_FIXTURE,
  WORKSPACE_QUEUE_FIXTURE,
} from './runtime-access';

import type { Page, Route } from '@playwright/test';

type Appearance = {
  mode: 'system' | 'light' | 'dark';
  density: 'compact' | 'standard' | 'comfortable';
  highContrast: boolean;
  reduceMotion: boolean;
};

type ShellSessionOptions = {
  locale?: 'en' | 'ko';
  displayName?: string;
  jobTitle?: string;
  appearance?: Appearance;
};

export function fulfillSuccess(route: Route, data: unknown) {
  return route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data }),
  });
}

export async function mockShellSession(
  page: Page,
  roles: string[],
  options: ShellSessionOptions = {}
) {
  const provider = roles.some((role) => role.startsWith('PROVIDER_'));
  const locale = options.locale ?? 'en';
  const appearance = options.appearance ?? {
    mode: 'system',
    density: 'standard',
    highContrast: false,
    reduceMotion: false,
  };

  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (!path.startsWith('/api/')) return route.continue();

    if (path === '/api/auth/me') {
      return fulfillSuccess(route, {
        userId: 1,
        displayName: options.displayName ?? (provider ? 'Provider Admin' : 'Tenant Admin'),
        jobTitle:
          options.jobTitle ?? (provider ? 'Platform operations lead' : 'Tenant administrator'),
        email: provider ? 'provider.admin@dwp.local' : 'tenant.admin@dwp.local',
        tenantId: 1,
        tenantCode: 'default',
        tenantName: 'SKAX',
        preferredLocale: locale,
        tenantDefaultLocale: locale,
        roles,
      });
    }
    if (path === '/api/auth/permissions') {
      return fulfillSuccess(route, provider ? [] : DEFAULT_APP_PERMISSIONS);
    }
    if (path === '/api/auth/session/refresh') {
      return fulfillSuccess(route, {
        rotated: true,
        idleExpiresAt: '2026-08-11T01:00:00Z',
        expiresAt: '2026-08-11T08:00:00Z',
      });
    }
    if (path.startsWith('/api/platform/v1/personal-preferences')) {
      return fulfillSuccess(route, {
        schemaVersion: 1,
        customized: true,
        preferences: {
          appearance: { mode: appearance.mode, density: appearance.density },
          accessibility: {
            highContrast: appearance.highContrast,
            reduceMotion: appearance.reduceMotion,
          },
        },
        version: 1,
        updatedAt: '2026-08-11T00:00:00Z',
      });
    }
    if (path === '/api/platform/v1/workspace/work-items') {
      return fulfillSuccess(route, WORKSPACE_QUEUE_FIXTURE);
    }
    if (path === '/api/platform/v1/workspace/activity') {
      return fulfillSuccess(route, WORKSPACE_ACTIVITY_FIXTURE);
    }
    if (path === '/api/platform/v1/workspace/apps') {
      return fulfillSuccess(route, WORKSPACE_APPS_FIXTURE);
    }
    if (path.startsWith('/api/platform/v1/catalog/code-sets/')) {
      const codeSetKey = decodeURIComponent(path.split('/').pop() ?? '');
      return fulfillSuccess(route, { codeSetKey, schemaVersion: 1, values: [] });
    }
    if (
      path.startsWith('/api/platform/v1/tenant-branding') ||
      path.startsWith('/api/platform/v1/admin/tenant-branding')
    ) {
      return fulfillSuccess(route, { organizationName: 'SKAX', logoUrl: null, version: 0 });
    }
    if (path === '/api/people/v1/people') {
      return fulfillSuccess(route, {
        items: [],
        nextCursor: null,
        size: 100,
        hasMore: false,
        asOf: '2026-08-11',
      });
    }
    if (path === '/api/people/v1/org-chart') {
      return fulfillSuccess(route, {
        asOf: '2026-08-11',
        company: {
          organizationId: 'org-skax',
          organizationKey: 'SKAX',
          name: 'SKAX',
        },
        scenario: null,
        metrics: {
          headcount: 0,
          activeHeadcount: 0,
          onLeaveHeadcount: 0,
          contingentHeadcount: 0,
          organizationCount: 1,
          managerCount: 0,
          openPositionCount: 0,
          locationCount: 0,
          plannedFte: 0,
          workforceCostAmount: 0,
          costCurrency: 'KRW',
        },
        analysis: {
          healthScore: 100,
          dataQualityScore: 100,
          averageManagerSpan: 0,
          maximumLayers: 1,
          managerRatioPercent: 0,
          contingentRatioPercent: 0,
          narrowSpanManagerCount: 0,
          wideSpanManagerCount: 0,
          singleReportManagerCount: 0,
          missingManagerCount: 0,
          missingGradeCount: 0,
          orphanOrganizationCount: 0,
          policy: {
            minimumManagerSpan: 3,
            maximumManagerSpan: 12,
            maximumLayers: 8,
            maximumContingentPercent: 20,
            maximumVacancyPercent: 15,
          },
          signals: [],
        },
        organizations: [],
        people: [],
        positions: [],
        relationships: [],
        openPositions: [],
      });
    }
    if (path === '/api/platform/v1/navigation') {
      const korean = (url.searchParams.get('locale') ?? locale).toLowerCase().startsWith('ko');
      const apps = [
        ['work', korean ? '업무' : 'Work', '/work', 'APP.WORK'],
        ['ask', korean ? 'DWP에게 묻기' : 'Ask', '/ask', 'APP.ASK'],
        ['activity', korean ? '활동' : 'Activity', '/activity', 'APP.ACTIVITY'],
        ['apps', korean ? '앱' : 'Apps', '/apps', 'APP.APPS'],
      ].map(([navigationKey, label, routePath, resourceKey]) => ({
        navigationKey,
        itemType: 'APP',
        label,
        registryEntryKey: `DWP_${navigationKey.toUpperCase()}`,
        route: routePath,
        iconKey: navigationKey,
        requiredResourceKey: resourceKey,
        requiredPermissionCode: 'VIEW',
        children: [],
      }));
      return fulfillSuccess(route, [
        {
          navigationKey: 'workspace',
          itemType: 'GROUP',
          label: korean ? '업무' : 'Workspace',
          requiredPermissionCode: 'VIEW',
          children: apps,
        },
      ]);
    }
    if (path === '/api/provider/v1/admin/support-session-context') {
      return fulfillSuccess(route, null);
    }
    if (path === '/api/provider/v1/admin/me') {
      return fulfillSuccess(route, {
        operatorId: 1,
        authUserId: 1,
        displayName: options.displayName ?? 'Provider Admin',
        roles: ['PROVIDER_ADMIN'],
        permissions: [
          'ESTATE_READ',
          'HEALTH_READ',
          'COMMERCIAL_READ',
          'CATALOG_READ',
          'DATA_GOVERNANCE_READ',
          'AUDIT_READ',
        ],
      });
    }
    if (path === '/api/provider/v1/admin/command-center') {
      return fulfillSuccess(route, {
        generatedAt: '2026-08-11T00:00:00Z',
        operatingState: 'HEALTHY',
        estate: {
          organizations: 12,
          tenants: 18,
          activeTenants: 17,
          provisioningTenants: 1,
          suspendedTenants: 0,
          failedTenants: 0,
          openOperations: 3,
          activeSupportSessions: 1,
          regions: [{ key: 'ap-northeast-2', count: 18 }],
          serviceTiers: [{ key: 'ENTERPRISE', count: 18 }],
        },
        activeIncidents: 0,
        expiringSubscriptions: 1,
        actionQueue: [
          {
            itemId: 'action-1',
            category: 'CHANGE',
            severity: 'MEDIUM',
            title: 'TENANT_UPGRADE',
            detail: 'A governed tenant upgrade is ready for review.',
            tenantId: 'tenant-skax',
            targetId: 'operation-1',
            createdAt: '2026-08-11T00:00:00Z',
            route: '/provider/operations',
          },
        ],
        services: [
          {
            serviceKey: 'identity',
            displayName: 'Identity service',
            criticality: 'CRITICAL',
            totalInstances: 18,
            healthyInstances: 18,
            pendingInstances: 0,
            degradedInstances: 0,
            failedInstances: 0,
            impactedTenants: 0,
            lastReconciledAt: '2026-08-11T00:00:00Z',
          },
          {
            serviceKey: 'workspace',
            displayName: 'Workspace service',
            criticality: 'HIGH',
            totalInstances: 18,
            healthyInstances: 17,
            pendingInstances: 1,
            degradedInstances: 0,
            failedInstances: 0,
            impactedTenants: 0,
            lastReconciledAt: '2026-08-11T00:00:00Z',
          },
        ],
        cells: [
          {
            deploymentCellId: 'cell-seoul-1',
            cellKey: 'seoul-1',
            displayName: 'Seoul enterprise cell',
            regionKey: 'ap-northeast-2',
            lifecycleState: 'ACTIVE',
            placementCapacity: 30,
            tenantCount: 18,
            serviceInstances: 36,
            healthyInstances: 35,
            saturationPct: 60,
            healthState: 'HEALTHY',
          },
        ],
        recentActivity: [
          {
            auditEventId: 'audit-1',
            action: 'TENANT_REVIEWED',
            category: 'TENANT',
            outcome: 'SUCCESS',
            operatorName: 'Provider Admin',
            tenantKey: 'skax',
            targetType: 'TENANT',
            targetId: 'tenant-skax',
            occurredAt: '2026-08-11T00:00:00Z',
          },
        ],
      });
    }

    return route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ERROR', message: 'Not required by shell contract test' }),
    });
  });
}
