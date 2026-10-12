import type { Page } from '@playwright/test';
import type { PersonalPreference } from '@dwp-frontend/shared-utils';

import { APPROVAL_HOME_FIXTURE, HR_HOME_FIXTURE } from './product-area-fixtures';
import { routeEmptyFlowExecutionSummaries } from './flow-home-provider-fixtures';
import { routeHomeWave4ShadowRuntime } from './home-wave4-runtime-fixtures';
import {
  CANONICAL_HOME_WORKSPACE_APPS,
  routeCanonicalHomeWorkspaceApps,
} from './home-launchpad-contract-fixture';
import { WORKSPACE_ACTIVITY_FIXTURE, mockRuntimeNavigation } from './runtime-access';
import { createHomeOverviewFixture, fulfillSuccess } from './shell-session';
import { widgetRegistryEffectiveCatalog, widgetRegistryReadiness } from './widget-registry';

export const SHELL_ACTIVITY_AUDIT_RECORD_ID = 'a1000000-0000-5000-8000-000000000903';

export function createShellPersonalPreference(): PersonalPreference {
  return {
    schemaVersion: 2,
    customized: false,
    preferences: {
      appearance: { mode: 'system', density: 'standard' },
      accessibility: {
        highContrast: false,
        reduceMotion: false,
        underlineLinks: false,
        reduceTransparency: false,
      },
      regional: {
        timeZone: 'Asia/Seoul',
        dateFormat: 'LOCALE',
        timeFormat: '24_HOUR',
        firstDayOfWeek: 'MONDAY',
        numberFormat: 'LOCALE',
      },
    },
    managedPolicy: {
      policyId: 'tenant-experience',
      scope: 'TENANT',
      source: 'TENANT_EXPERIENCE_POLICY',
      ownerType: 'ROLE',
      ownerRef: 'TENANT_ADMIN',
      ownerDisplayName: 'Tenant administrator',
      managedPaths: [],
      rules: [],
      version: 1,
    },
    version: 0,
    updatedAt: null,
  };
}

export async function routeWorkOnlyShellWorkspaceApp(page: Page): Promise<void> {
  await page.route('**/api/platform/v1/workspace/apps', (route) =>
    fulfillSuccess(
      route,
      CANONICAL_HOME_WORKSPACE_APPS.filter((app) => app.resourceKey === 'APP.WORK')
    )
  );
}

export async function mockShellHomeReadModels(page: Page): Promise<void> {
  await mockRuntimeNavigation(page);
  await routeCanonicalHomeWorkspaceApps(page);
  await routeEmptyFlowExecutionSummaries(page, '2026-08-11T00:10:00.000Z');
  await routeHomeWave4ShadowRuntime(page);
  await page.route('**/api/platform/v1/widget-catalog/readiness', (route) =>
    fulfillSuccess(route, widgetRegistryReadiness('SHADOW'))
  );
  await page.route('**/api/platform/v1/widget-catalog/effective**', (route) =>
    fulfillSuccess(route, widgetRegistryEffectiveCatalog('SHADOW', 'AVAILABLE'))
  );

  await page.route('**/api/platform/v1/home-experience', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          headline: null,
          subheadline: null,
          backgroundPosition: 'CENTER',
          overlayOpacity: 18,
          backgroundUrl: null,
          compositionPolicy: {
            schemaVersion: 1,
            personalCustomizationEnabled: true,
            governedZones: [
              {
                zoneKey: 'announcements',
                placement: 'CANVAS',
                visible: true,
                size: 'compact',
                sortOrder: 20,
              },
            ],
          },
          version: 0,
        },
      }),
    })
  );
  await page.route('**/api/platform/v1/tenant-branding', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: { organizationName: null, logoUrl: null, version: 0 },
      }),
    })
  );
  await page.route('**/api/platform/v1/catalog/code-sets/**', (route) => {
    const codeSetKey = decodeURIComponent(
      new URL(route.request().url()).pathname.split('/').pop()!
    );
    const values: Record<string, string[]> = {
      'PLATFORM.HOME_WIDGET': ['command-rail', 'activity', 'focus', 'schedule', 'daily-brief'],
      'PLATFORM.PREFERENCE.COLOR_MODE': ['system', 'light', 'dark'],
      'PLATFORM.PREFERENCE.DENSITY': ['compact', 'standard', 'comfortable'],
    };
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          codeSetKey,
          schemaVersion: 1,
          values: (values[codeSetKey] ?? []).map((code) => ({ code, label: code })),
        },
      }),
    });
  });
  await page.route('**/api/platform/v1/announcements', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data: [] }),
    })
  );
  await page.route('**/api/platform/v1/communications**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          featured: null,
          items: [],
          summary: { total: 0, unread: 0, required: 0, saved: 0 },
          generatedAt: '2026-08-11T00:20:00Z',
        },
      }),
    })
  );
  await page.route('**/api/platform/v1/home/overview**', (route) =>
    fulfillSuccess(route, createHomeOverviewFixture(['ADMIN']))
  );
}

export async function mockShellWorkspaceReadModels(page: Page): Promise<void> {
  const workspaceActivityEvents = WORKSPACE_ACTIVITY_FIXTURE.events.map((event) =>
    event.id === 'a1000000-0000-0000-0000-000000000003'
      ? {
          ...event,
          auditRecordId: SHELL_ACTIVITY_AUDIT_RECORD_ID,
          auditStatus: 'VERIFIED' as const,
          auditAccess: 'RESTRICTED' as const,
          dataProvenance: 'LIVE' as const,
        }
      : event
  );

  await page.route('**/api/auth/sessions', (route) => fulfillSuccess(route, []));
  await page.route('**/api/platform/v1/personal-settings/workspace', (route) =>
    fulfillSuccess(route, {
      favorites: [],
      recentActivity: [],
      observation: {
        sourceState: 'AVAILABLE',
        freshnessState: 'CURRENT',
        observedAt: '2026-08-11T00:00:00Z',
        lastConfirmedAt: '2026-08-11T00:00:00Z',
        version: 1,
        offlineBehavior: 'MEMORY_ONLY_READ_ONLY',
      },
    })
  );

  await page.route('**/api/approvals/v1/home', (route) =>
    fulfillSuccess(route, APPROVAL_HOME_FIXTURE)
  );
  await page.route('**/api/approvals/v1/tasks?*', (route) => fulfillSuccess(route, []));
  await page.route('**/api/approvals/v1/requests?*', (route) => fulfillSuccess(route, []));
  await page.route('**/api/people/v1/hr/home', (route) => fulfillSuccess(route, HR_HOME_FIXTURE));
  await page.route('**/api/platform/v1/workspace/work-hub/personal-tasks?*', (route) =>
    fulfillSuccess(route, {
      items: [],
      page: 0,
      size: 100,
      totalElements: 0,
      hasMore: false,
    })
  );
  await page.route('**/api/platform/v1/workspace/work-hub/day-plans/*', (route) => {
    const date = new URL(route.request().url()).pathname.split('/').pop()!;
    return fulfillSuccess(route, { date, version: 0, items: [], updatedAt: null });
  });
  await page.route('**/api/platform/v1/workspace/work-hub/calendar-links?*', (route) =>
    fulfillSuccess(route, {
      items: [],
      page: 0,
      size: 100,
      totalElements: 0,
      hasMore: false,
    })
  );
  await page.route('**/api/platform/v1/calendar/events?*', (route) => fulfillSuccess(route, []));
  await page.route('**/api/platform/v1/services/requests**', (route) => fulfillSuccess(route, []));
  await page.route('**/api/platform/v1/workspace/work-hub/assignments**', (route) => {
    const url = new URL(route.request().url());
    const pageNumber = Number(url.searchParams.get('page') ?? 0);
    const size = Number(url.searchParams.get('size') ?? 100);
    return fulfillSuccess(route, {
      items: [],
      page: pageNumber,
      size,
      totalElements: 0,
      hasMore: false,
    });
  });
  await page.route(/\/api\/platform\/v1\/workspace\/activity(?:\?.*)?$/u, (route) => {
    const url = new URL(route.request().url());
    const actor = url.searchParams.get('actor');
    const state = url.searchParams.get('state');
    const query = url.searchParams.get('query')?.toLocaleLowerCase('en');
    const events = workspaceActivityEvents.filter(
      (event) =>
        (!actor || event.actor === actor) &&
        (!state || event.state === state) &&
        (!query ||
          [event.title, event.summary, event.actorName, event.source, event.objectLabel].some(
            (value) => value.toLocaleLowerCase('en').includes(query)
          ))
    );
    return fulfillSuccess(route, {
      ...WORKSPACE_ACTIVITY_FIXTURE,
      events,
      snapshotAt: WORKSPACE_ACTIVITY_FIXTURE.generatedAt,
      coverage: {
        supportedObjectTypes: [...new Set(events.map((event) => event.objectType))],
        excludedProvenance: [],
        includesUsage: false,
      },
      hasMore: false,
      nextCursor: null,
      startCursor: null,
    });
  });
  const emptyExecutionSummary = {
    total: 0,
    running: 0,
    needsInput: 0,
    policyBlocked: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    unknown: 0,
    generatedAt: WORKSPACE_ACTIVITY_FIXTURE.generatedAt,
    coverage: { supportedObjectTypes: [], excludedProvenance: [], includesUsage: false },
    attentionItems: [],
  };
  await page.route('**/api/platform/v1/workspace/activity/executions/summary', (route) =>
    fulfillSuccess(route, emptyExecutionSummary)
  );
  await page.route('**/api/agent/v1/activity/executions/summary', (route) =>
    fulfillSuccess(route, emptyExecutionSummary)
  );
  await page.route('**/api/platform/v1/workspace/activity/sources/status', (route) =>
    fulfillSuccess(route, { observedAt: WORKSPACE_ACTIVITY_FIXTURE.generatedAt, sources: [] })
  );
  await page.route('**/api/platform/v1/workspace/activity/events/*', (route) => {
    const eventId = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop()!);
    const event = workspaceActivityEvents.find((candidate) => candidate.id === eventId);
    return event
      ? fulfillSuccess(route, event)
      : route.fulfill({ status: 404, json: { errorCode: 'RESOURCE_NOT_FOUND' } });
  });
  await page.route(/\/api\/agent\/v1\/activity\/events(?:\?.*)?$/u, (route) =>
    fulfillSuccess(route, {
      events: [],
      generatedAt: WORKSPACE_ACTIVITY_FIXTURE.generatedAt,
      snapshotAt: WORKSPACE_ACTIVITY_FIXTURE.generatedAt,
      coverage: { supportedObjectTypes: [], excludedProvenance: [], includesUsage: false },
      hasMore: false,
      nextCursor: null,
      startCursor: null,
    })
  );
  await page.route('**/api/agent/v1/activity/events/*', (route) =>
    route.fulfill({ status: 404, json: { errorCode: 'RESOURCE_NOT_FOUND' } })
  );
  await page.route(
    /\/api\/platform\/v1\/workspace\/activity\/events\/([^/]+)\/evidence$/u,
    (route) => {
      const eventId = decodeURIComponent(
        new URL(route.request().url()).pathname.split('/').at(-2)!
      );
      return fulfillSuccess(route, {
        eventId,
        auditRecordId: SHELL_ACTIVITY_AUDIT_RECORD_ID,
        linkStatus: 'LINKED',
        auditAccess: 'RESTRICTED',
        recordHash: null,
        hashAlgorithm: null,
        integrityStatus: 'UNAVAILABLE',
        integrityScope: 'DAILY_CHECKPOINT_REPORTED',
        verifiedAt: null,
        observedAt: WORKSPACE_ACTIVITY_FIXTURE.generatedAt,
      });
    }
  );
  await page.route('**/api/platform/v1/workplace/bookings**', (route) => fulfillSuccess(route, []));
}
